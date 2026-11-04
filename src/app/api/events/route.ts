import { z } from 'zod'
import { ANSWERED_WITH_FEATURES, FEATURES } from '@/constants/features'
import {
  MAX_ENVELOPE_BYTES,
  PROTOCOL_VERSION,
  EVENTS,
  REFUSAL,
} from '@/constants/sending-stone'
import { applyCampaignEvent } from '@/db/campaign-events'
import {
  checkGameSecret,
  findEventCampaign,
  markSeen,
  recordRefusal,
} from '@/db/campaigns'
import { recordDishDecision } from '@/db/cookbook'
import { recordCommandResult } from '@/db/roll-requests'
import { attempt } from '@/lib/attempt'
import { bearerSecret } from '@/lib/campaign-secret'
import { readBody } from '@/lib/routes/body'
import { cors, notSetUp, refuse } from '@/lib/routes/bridge-http'
import { toForgeGameUrl } from '@/schemas/campaign'
import { envelopeSchema, parseGameEvent } from '@/schemas/sending-stone'
import type { CampaignRef, GameEvent } from '@/types/sending-stone'

// The listener the fvtt-sending-stone module posts to: the Gamemaster sets this app's address as
// the module's destination, and the module posts to its /api/events. Posts come from the
// Gamemaster's browser, not the Foundry server, so this answers CORS like any cross-origin API.
// See the module's PROTOCOL.md for what it sends and how it treats each response status.
//
// Each campaign is set up here by its Gamemaster with a secret, and only events carrying that
// secret are accepted for it. The module drops a post refused with a 4xx. Every refusal keeps its
// status and says why in JSON, `{reason, message}`, which module 0.23.0 tells the Gamemaster in its
// own words; one that can be tied to a campaign is also recorded, for the campaign's card.
//
// Its hello and heartbeats are answered with what this app does beyond taking events: it has
// commands, such as players' rolls, for the module to fetch from /api/bridge/commands. A module
// fetches them only from an app that says so, as an older app would refuse the fetch in a way
// that, across origins, the module can't tell from a network failure. From module 0.22.0, which
// sends each sheet in a post of its own, a sheet's post is answered so too: this app reads slim
// sheets, and takes posts up to its limit, which the module sizes every post by.

export function OPTIONS(request: Request) {
  return new Response(undefined, { status: 204, headers: cors(request) })
}

export async function POST(request: Request) {
  const secret = bearerSecret(request.headers.get('authorization'))
  if (!secret) {
    return refuse(request, 401, {
      reason: REFUSAL.NO_SECRET,
      message: 'Send the campaign’s secret',
    })
  }

  // Campaigns are set up for the game they come from, which is the page that sent them.
  const origin = request.headers.get('origin')
  if (!origin || toForgeGameUrl(origin) !== origin) {
    return refuse(request, 403, {
      reason: REFUSAL.NOT_FORGE,
      message: 'Only games on The Forge are accepted',
    })
  }

  const envelope = await readEnvelope(request)
  if (envelope instanceof Response) return envelope
  // A connection test. It names the campaign tested; one from a module before 0.4.0 names none,
  // and passes with the secret of any of this game's campaigns. Its title and secret are as typed,
  // perhaps not saved, so nothing is recorded of it.
  if (envelope.type === EVENTS.PING) {
    return pingAnswer(request, origin, envelope.campaign, secret)
  }
  if (!envelope.campaign) {
    return refuse(request, 400, {
      reason: REFUSAL.MALFORMED,
      message: `No campaign for ${envelope.type}`,
      type: envelope.type,
    })
  }

  const { campaign } = envelope
  const found = await attempt(
    () => findEventCampaign(origin, campaign, secret),
    CHECK_FAILED,
  )
  if (!found) return unavailable(request)
  if (found === 'unknown') return unknown(request, origin, campaign.title)
  if (found === 'refused') return wrongSecret(request)

  let event
  try {
    event = parseGameEvent(envelope.type, envelope.data)
  } catch (error) {
    return malformed(request, found.id, envelope.type, error)
  }

  let applied
  try {
    applied = await takeEvent(found.id, envelope, campaign, event)
  } catch (error) {
    console.error(`Failed to apply ${envelope.type} from ${origin}`, error)
    return unavailable(request)
  }
  return eventAnswer(request, envelope, event, found, applied)
}

/**
 * The envelope a post carries, or the refusal of one too large, of none, or of another protocol.
 * Refused before reading when the size is declared; checked again for a body that wasn't.
 */
async function readEnvelope(
  request: Request,
): Promise<z.infer<typeof envelopeSchema> | Response> {
  const body = await readBody(request, {
    limit: MAX_ENVELOPE_BYTES,
    declared: true,
  })
  if (!body.ok && body.why === 'size') return tooLarge(request)
  const parsed = body.ok ? envelopeSchema.safeParse(body.value) : undefined
  if (!parsed?.success) {
    return refuse(request, 400, {
      reason: REFUSAL.BAD_ENVELOPE,
      message: 'Not a Sending Stone envelope',
    })
  }
  const envelope = parsed.data
  if (envelope.protocol !== PROTOCOL_VERSION) {
    return refuse(request, 400, {
      reason: REFUSAL.UNSUPPORTED_PROTOCOL,
      message: `Unsupported protocol ${envelope.protocol}`,
      protocol: PROTOCOL_VERSION,
    })
  }
  return envelope
}

/** An answer with no body, CORS headers and all. */
const respond = (request: Request, status: number) =>
  new Response(undefined, { status, headers: cors(request) })

const unavailable = (request: Request) =>
  refuse(request, 500, {
    reason: REFUSAL.UNAVAILABLE,
    message: 'Sending Stone couldn’t take this just now',
  })

const wrongSecret = (request: Request) =>
  refuse(request, 401, {
    reason: REFUSAL.WRONG_SECRET,
    message: 'The secret isn’t this campaign’s in Sending Stone',
  })

const unknown = (request: Request, origin: string, title?: string) =>
  refuse(request, 404, {
    reason: REFUSAL.NOT_SET_UP,
    message: notSetUp(origin, title),
  })

const tooLarge = (request: Request) =>
  refuse(request, 413, {
    reason: REFUSAL.TOO_LARGE,
    message: `Larger than the ${MAX_ENVELOPE_BYTES} bytes Sending Stone takes`,
    limit: MAX_ENVELOPE_BYTES,
  })

/**
 * A connection test's answer. It names the campaign tested; one from a module before 0.4.0 names
 * none, and passes with the secret of any of this game's campaigns. Its title and secret are as
 * typed, perhaps not saved, so nothing is recorded of it.
 */
async function pingAnswer(
  request: Request,
  origin: string,
  campaign: CampaignRef | null,
  secret: string,
): Promise<Response> {
  const checked = await attempt(async () => {
    if (!campaign) return checkGameSecret(origin, secret)
    const found = await findEventCampaign(origin, campaign, secret, {
      record: false,
    })
    return typeof found === 'string' ? found : 'ok'
  }, CHECK_FAILED)
  if (!checked) return unavailable(request)
  if (checked === 'unknown') return unknown(request, origin, campaign?.title)
  return checked === 'ok' ? respond(request, 204) : wrongSecret(request)
}

/**
 * The refusal of an event the campaign's own module sent malformed: recorded only now that the
 * secret is known to be the campaign's, its card showing what was wrong first, with the type.
 */
async function malformed(
  request: Request,
  campaignId: string,
  type: string,
  error: unknown,
): Promise<Response> {
  const detail =
    error instanceof z.ZodError ? z.prettifyError(error) : undefined
  const firstLines = detail?.split('\n').slice(0, 2).join('\n') ?? ''
  await recordRefusal(
    { ids: [campaignId] },
    {
      reason: REFUSAL.MALFORMED,
      status: 400,
      detail: `${type}: ${firstLines}`.trimEnd().slice(0, 300),
    },
  )
  return refuse(request, 400, {
    reason: REFUSAL.MALFORMED,
    message: `Malformed ${type}`,
    type,
    detail: detail?.slice(0, 1000),
  })
}

/**
 * Take an event for its campaign.
 * @returns What applying it says, for an event that changes what's held of the campaign.
 */
async function takeEvent(
  campaignId: string,
  envelope: z.infer<typeof envelopeSchema>,
  campaign: CampaignRef,
  event: GameEvent | undefined,
): Promise<{ lacksTexts: boolean } | undefined> {
  if (event?.type === EVENTS.COMMAND_RESULT) {
    // What became of a roll. Only the page that sent it asks after it, and its character's
    // player's watches the Gamemaster's as theirs apart (#156), so the campaign's version, which
    // every page watches, is left alone, unless the result changes what they all show: a prompt
    // it closed, or the Gamemaster's messages it marks.
    await recordCommandResult(campaignId, event.data)
    await markSeen(campaignId)
  } else if (
    event?.type === EVENTS.DISH_APPLIED ||
    event?.type === EVENTS.DISH_DISMISSED
  ) {
    // What the Gamemaster did with a dish from the Magical Recipe Book, from module 0.38.0. Only
    // its sender's card shows it, so the campaign's version is left alone.
    await recordDishDecision(campaignId, event)
    await markSeen(campaignId)
  } else if (event) {
    return applyCampaignEvent(
      campaignId,
      envelope.world,
      campaign,
      event,
      envelope.session,
      envelope.time,
    )
  } else {
    // A heartbeat, or an event this app does not use yet, still says the game is connected.
    await markSeen(campaignId)
  }
  return undefined
}

/** An event's answer, once taken: what this app does beyond events, or to send everything again. */
function eventAnswer(
  request: Request,
  envelope: z.infer<typeof envelopeSchema>,
  event: GameEvent | undefined,
  found: { helloSession?: string },
  applied: { lacksTexts: boolean } | undefined,
): Response {
  // Descriptions come before the hello or sheet that refers to them, so they may arrive first.
  if (event?.type === EVENTS.CHARACTER_TEXTS) return respond(request, 204)
  // Without this session's hello, such as when it was refused before the campaign was set up
  // here, the campaign may lack its characters and combats; and a sheet that refers to a
  // description not held means one went missing. Either way, ask for everything again.
  const lacksHello =
    event?.type !== EVENTS.HELLO && found.helloSession !== envelope.session
  const resend = lacksHello || applied?.lacksTexts === true
  const announce = ANSWERED_WITH_FEATURES.has(envelope.type)
  if (resend || announce) {
    return Response.json(
      {
        ...(resend && { resend: 'hello' }),
        ...(announce && { features: FEATURES }),
      },
      { headers: cors(request) },
    )
  }
  return respond(request, 204)
}

const CHECK_FAILED = 'Failed to check a Sending Stone event'
