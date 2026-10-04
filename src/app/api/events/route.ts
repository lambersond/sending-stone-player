import { z } from 'zod'
import {
  MAX_ENVELOPE_BYTES,
  PROTOCOL_VERSION,
  EVENTS,
} from '@/constants/sending-stone'
import { applyCampaignEvent } from '@/db/campaign-events'
import { hasSecret } from '@/lib/listener-auth'
import { toForgeGameUrl } from '@/schemas/character'
import { envelopeSchema, parseGameEvent } from '@/schemas/sending-stone'

// The listener the fvtt-sending-stone module posts to: the Gamemaster sets this app's address as
// the module's destination, and the module posts to its /api/events. Posts come from the
// Gamemaster's browser, not the Foundry server, so this answers CORS like any cross-origin API.
// See the module's PROTOCOL.md for what it sends and how it treats each response status.

export function OPTIONS(request: Request) {
  return new Response(undefined, { status: 204, headers: cors(request) })
}

export async function POST(request: Request) {
  const respond = (status: number, message?: string) =>
    new Response(message, { status, headers: cors(request) })

  const secret = process.env.SENDING_STONE_SECRET
  if (!secret) {
    console.error(
      'SENDING_STONE_SECRET is not set; refusing Sending Stone events.',
    )
    return respond(503, 'Listener not configured')
  }
  if (!hasSecret(request.headers.get('authorization'), secret)) {
    return respond(401)
  }

  // Events are filed under the game they come from, which is the page that sent them.
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
  // A connection test: answer, and otherwise ignore it.
  if (envelope.type === EVENTS.PING) return respond(204)

  let event
  try {
    event = parseGameEvent(envelope.type, envelope.data)
  } catch (error) {
    const reason = error instanceof z.ZodError ? z.prettifyError(error) : ''
    return respond(400, `Malformed ${envelope.type}\n${reason}`)
  }
  // An event this app does not use yet.
  if (!event) return respond(204)
  // Everything but a connection test is sent to a campaign.
  if (!envelope.campaign)
    return respond(400, `No campaign for ${envelope.type}`)

  try {
    await applyCampaignEvent(origin, envelope.world, envelope.campaign, event)
  } catch (error) {
    console.error(`Failed to apply ${envelope.type} from ${origin}`, error)
    return respond(500)
  }
  return respond(204)
}

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
