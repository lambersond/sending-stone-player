import { z } from 'zod'
import {
  MAX_ENVELOPE_BYTES,
  PROTOCOL_VERSION,
  EVENTS,
} from '@/constants/sending-stone'
import { applyCampaignEvent } from '@/db/campaign-events'
import { checkGameSecret, findEventCampaign, markSeen } from '@/db/campaigns'
import { bearerSecret } from '@/lib/campaign-secret'
import { toForgeGameUrl } from '@/schemas/campaign'
import { envelopeSchema, parseGameEvent } from '@/schemas/sending-stone'

// The listener the fvtt-sending-stone module posts to: the Gamemaster sets this app's address as
// the module's destination, and the module posts to its /api/events. Posts come from the
// Gamemaster's browser, not the Foundry server, so this answers CORS like any cross-origin API.
// See the module's PROTOCOL.md for what it sends and how it treats each response status.
//
// Each campaign is set up here by its Gamemaster with a secret, and only events carrying that
// secret are accepted for it. The module drops a post refused with a 4xx and tells the Gamemaster.

export function OPTIONS(request: Request) {
  return new Response(undefined, { status: 204, headers: cors(request) })
}

export async function POST(request: Request) {
  const respond = (status: number, message?: string) =>
    new Response(message, { status, headers: cors(request) })

  const secret = bearerSecret(request.headers.get('authorization'))
  if (!secret) return respond(401, 'Send the campaign’s secret')

  // Campaigns are set up for the game they come from, which is the page that sent them.
  const origin = request.headers.get('origin')
  if (!origin || toForgeGameUrl(origin) !== origin) {
    return respond(403, 'Only games on The Forge are accepted')
  }

  // Refused before reading when the size is declared; checked again for a body that wasn't.
  const declared = Number(request.headers.get('content-length'))
  if (declared > MAX_ENVELOPE_BYTES) return respond(413)
  const body = await request.text()
  if (Buffer.byteLength(body) > MAX_ENVELOPE_BYTES) return respond(413)

  let envelope
  try {
    envelope = envelopeSchema.parse(JSON.parse(body))
  } catch {
    return respond(400, 'Not a Sending Stone envelope')
  }
  if (envelope.protocol !== PROTOCOL_VERSION) {
    return respond(400, `Unsupported protocol ${envelope.protocol}`)
  }
  // A connection test. It names the campaign tested; one from a module before 0.4.0 names none,
  // and passes with the secret of any of this game's campaigns.
  if (envelope.type === EVENTS.PING) {
    const { campaign } = envelope
    const checked = await attempt(async () => {
      if (!campaign) return checkGameSecret(origin, secret)
      const found = await findEventCampaign(origin, campaign, secret)
      return typeof found === 'string' ? found : 'ok'
    })
    if (!checked) return respond(500)
    if (checked === 'unknown')
      return respond(404, notSetUp(origin, campaign?.title))
    return respond(checked === 'ok' ? 204 : 401)
  }
  if (!envelope.campaign) {
    return respond(400, `No campaign for ${envelope.type}`)
  }

  const { campaign } = envelope
  const found = await attempt(() => findEventCampaign(origin, campaign, secret))
  if (!found) return respond(500)
  if (found === 'unknown') {
    return respond(404, notSetUp(origin, envelope.campaign.title))
  }
  if (found === 'refused') return respond(401)

  let event
  try {
    event = parseGameEvent(envelope.type, envelope.data)
  } catch (error) {
    const reason = error instanceof z.ZodError ? z.prettifyError(error) : ''
    return respond(400, `Malformed ${envelope.type}\n${reason}`)
  }

  let applied
  try {
    // A heartbeat, or an event this app does not use yet, still says the game is connected.
    applied = event
      ? await applyCampaignEvent(
          found.id,
          envelope.world,
          envelope.campaign,
          event,
          envelope.session,
        )
      : await markSeen(found.id)
  } catch (error) {
    console.error(`Failed to apply ${envelope.type} from ${origin}`, error)
    return respond(500)
  }

  // Descriptions come before the hello or sheet that refers to them, so they may arrive first.
  if (event?.type === EVENTS.CHARACTER_TEXTS) return respond(204)
  // Without this session's hello, such as when it was refused before the campaign was set up
  // here, the campaign may lack its characters and combats; and a sheet that refers to a
  // description not held means one went missing. Either way, ask for everything again.
  const lacksHello =
    event?.type !== EVENTS.HELLO && found.helloSession !== envelope.session
  if (lacksHello || applied?.lacksTexts) {
    return Response.json({ resend: 'hello' }, { headers: cors(request) })
  }
  return respond(204)
}

/** Run a database step, logging a failure for a retryable 500 answer, with CORS headers. */
async function attempt<T>(step: () => Promise<T>): Promise<T | undefined> {
  try {
    return await step()
  } catch (error) {
    console.error('Failed to check a Sending Stone event', error)
    return undefined
  }
}

const notSetUp = (origin: string, title?: string) =>
  title
    ? `No campaign titled “${title}” is set up for ${origin} in Sending Stone`
    : `No campaign is set up for ${origin} in Sending Stone`

function cors(request: Request): Headers {
  const headers = new Headers({
    'Access-Control-Allow-Origin': request.headers.get('origin') ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  })
  // Chromium asks before a public page, such as a Forge game, may reach a private address,
  // such as this listener running on localhost.
  if (
    request.headers.get('access-control-request-private-network') === 'true'
  ) {
    headers.set('Access-Control-Allow-Private-Network', 'true')
  }
  return headers
}
