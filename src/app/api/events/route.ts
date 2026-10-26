import { z } from 'zod'
import {
  COMPANIONS,
  DISHES,
  EFFECTS,
  FAVORITES,
  FOUNDRY_SETTINGS,
  GROUPS,
  MAX_ENVELOPE_BYTES,
  MIDI_PROMPTS,
  NOTES,
  PROTOCOL_VERSION,
  EVENTS,
  REFUSAL,
  REMOVALS,
  SLIM_SHEETS,
  TRANSFERS,
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
import { attempt, cors, notSetUp, refuse } from '@/lib/bridge-http'
import { bearerSecret } from '@/lib/campaign-secret'
import { toForgeGameUrl } from '@/schemas/campaign'
import { envelopeSchema, parseGameEvent } from '@/schemas/sending-stone'

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
  const respond = (status: number) =>
    new Response(undefined, { status, headers: cors(request) })
  const unavailable = () =>
    refuse(request, 500, {
      reason: REFUSAL.UNAVAILABLE,
      message: 'Sending Stone couldn’t take this just now',
    })
  const wrongSecret = () =>
    refuse(request, 401, {
      reason: REFUSAL.WRONG_SECRET,
      message: 'The secret isn’t this campaign’s in Sending Stone',
    })
  const unknown = (origin: string, title?: string) =>
    refuse(request, 404, {
      reason: REFUSAL.NOT_SET_UP,
      message: notSetUp(origin, title),
    })
  const tooLarge = () =>
    refuse(request, 413, {
      reason: REFUSAL.TOO_LARGE,
      message: `Larger than the ${MAX_ENVELOPE_BYTES} bytes Sending Stone takes`,
      limit: MAX_ENVELOPE_BYTES,
    })

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

  // Refused before reading when the size is declared; checked again for a body that wasn't.
  const declared = Number(request.headers.get('content-length'))
  if (declared > MAX_ENVELOPE_BYTES) return tooLarge()
  const body = await request.text()
  if (Buffer.byteLength(body) > MAX_ENVELOPE_BYTES) return tooLarge()

  let envelope
  try {
    envelope = envelopeSchema.parse(JSON.parse(body))
  } catch {
    return refuse(request, 400, {
      reason: REFUSAL.BAD_ENVELOPE,
      message: 'Not a Sending Stone envelope',
    })
  }
  if (envelope.protocol !== PROTOCOL_VERSION) {
    return refuse(request, 400, {
      reason: REFUSAL.UNSUPPORTED_PROTOCOL,
      message: `Unsupported protocol ${envelope.protocol}`,
      protocol: PROTOCOL_VERSION,
    })
  }
  // A connection test. It names the campaign tested; one from a module before 0.4.0 names none,
  // and passes with the secret of any of this game's campaigns. Its title and secret are as typed,
  // perhaps not saved, so nothing is recorded of it.
  if (envelope.type === EVENTS.PING) {
    const { campaign } = envelope
    const checked = await attempt(async () => {
      if (!campaign) return checkGameSecret(origin, secret)
      const found = await findEventCampaign(origin, campaign, secret, {
        record: false,
      })
      return typeof found === 'string' ? found : 'ok'
    }, CHECK_FAILED)
    if (!checked) return unavailable()
    if (checked === 'unknown') return unknown(origin, campaign?.title)
    return checked === 'ok' ? respond(204) : wrongSecret()
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
  if (!found) return unavailable()
  if (found === 'unknown') return unknown(origin, envelope.campaign.title)
  if (found === 'refused') return wrongSecret()

  let event
  try {
    event = parseGameEvent(envelope.type, envelope.data)
  } catch (error) {
    const detail =
      error instanceof z.ZodError ? z.prettifyError(error) : undefined
    // Recorded only now that the secret is known to be the campaign's: its card shows what was
    // wrong first, with the type.
    const firstLines = detail?.split('\n').slice(0, 2).join('\n') ?? ''
    await recordRefusal(
      { ids: [found.id] },
      {
        reason: REFUSAL.MALFORMED,
        status: 400,
        detail: `${envelope.type}: ${firstLines}`.trimEnd().slice(0, 300),
      },
    )
    return refuse(request, 400, {
      reason: REFUSAL.MALFORMED,
      message: `Malformed ${envelope.type}`,
      type: envelope.type,
      detail: detail?.slice(0, 1000),
    })
  }

  let applied
  try {
    if (event?.type === EVENTS.COMMAND_RESULT) {
      // What became of a roll. Only the page that sent it asks after it, and its character's
      // player's watches the Gamemaster's as theirs apart (#156), so the campaign's version, which
      // every page watches, is left alone, unless the result changes what they all show: a prompt
      // it closed, or the Gamemaster's messages it marks.
      await recordCommandResult(found.id, event.data)
      await markSeen(found.id)
    } else if (
      event?.type === EVENTS.DISH_APPLIED ||
      event?.type === EVENTS.DISH_DISMISSED
    ) {
      // What the Gamemaster did with a dish from the Magical Recipe Book, from module 0.38.0. Only
      // its sender's card shows it, so the campaign's version is left alone.
      await recordDishDecision(found.id, event)
      await markSeen(found.id)
    } else if (event) {
      applied = await applyCampaignEvent(
        found.id,
        envelope.world,
        envelope.campaign,
        event,
        envelope.session,
        envelope.time,
      )
    } else {
      // A heartbeat, or an event this app does not use yet, still says the game is connected.
      await markSeen(found.id)
    }
  } catch (error) {
    console.error(`Failed to apply ${envelope.type} from ${origin}`, error)
    return unavailable()
  }

  // Descriptions come before the hello or sheet that refers to them, so they may arrive first.
  if (event?.type === EVENTS.CHARACTER_TEXTS) return respond(204)
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
  return respond(204)
}

/**
 * What this app does beyond taking events, as told to the module: it has commands to fetch, it
 * expands slim sheets up to this format, it takes posts of up to this many bytes, and it reads
 * what Midi-QOL asks of characters in this format, which the module sends only then (0.27.0); and
 * the campaign's groups in this format, which the module sends only then too (0.30.0).
 * Foundry's settings too, in this format, which the module likewise sends only then (0.30.0);
 * moves of items and coins, from module 0.31.0; removals of a character's items, from module
 * 0.33.0; and journal notes, from module 0.34.0, which the module fetches for, and sends journals
 * of, only then, and from module 0.35.0 orders of a group's notes and who changed a journal in
 * Foundry; and from module 0.36.0 the campaign's characters' companions, which the module sends,
 * and marks its combats and chat with, only then; and from module 0.37.0 favorites added and
 * removed, which the module fetches for only then; and from module 0.38.0 dishes from the Magical
 * Recipe Book, which the module fetches, and reports the Gamemaster's choice of, only then; and
 * from module 0.39.0 a player's own effects turned off, on and deleted, which the module fetches
 * for only then.
 */
const FEATURES = {
  commands: true,
  slimSheets: SLIM_SHEETS,
  maxBytes: MAX_ENVELOPE_BYTES,
  midiPrompts: MIDI_PROMPTS,
  groups: GROUPS,
  settings: FOUNDRY_SETTINGS,
  transfers: TRANSFERS,
  removals: REMOVALS,
  notes: NOTES,
  companions: COMPANIONS,
  favorites: FAVORITES,
  dishes: DISHES,
  effects: EFFECTS,
}

/**
 * The events answered with them: a hello and a heartbeat, and from module 0.22.0 a sheet's post,
 * as the module sends each sheet slim or in full, and sizes it, by the latest answer, so that it
 * follows this app being rolled back or deployed again without waiting for a heartbeat; a group's
 * sheet too, from module 0.30.0, and a companion's, from module 0.36.0.
 */
const ANSWERED_WITH_FEATURES: ReadonlySet<string> = new Set([
  EVENTS.HELLO,
  EVENTS.HEARTBEAT,
  EVENTS.CHARACTER_UPDATED,
  EVENTS.GROUP_UPDATED,
  EVENTS.COMPANION_UPDATED,
])

const CHECK_FAILED = 'Failed to check a Sending Stone event'
