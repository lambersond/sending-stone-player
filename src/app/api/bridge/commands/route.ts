import { BRIDGE_SWITCHES } from '@/constants/features'
import {
  COMMANDS_CHECK_EVERY,
  COMMANDS_COLD_WAIT,
  COMMANDS_HOLD,
  COMMANDS_OFF_WAIT,
  REFUSAL,
} from '@/constants/sending-stone'
import { findEventCampaign } from '@/db/campaigns'
import { claimDishes } from '@/db/cookbook'
import { claimNoteWrites } from '@/db/note-sync'
import {
  claimRollRequests,
  findClaimCampaign,
  markBridgePolled,
  openActorIds,
} from '@/db/roll-requests'
import { attempt } from '@/lib/attempt'
import { bearerSecret } from '@/lib/campaign-secret'
import { readBody } from '@/lib/routes/body'
import { cors, notSetUp, refuse } from '@/lib/routes/bridge-http'
import { toForgeGameUrl } from '@/schemas/campaign'
import { commandsPollSchema } from '@/schemas/roll-request'
import type { DishCommand } from '@/types/cookbook'
import type { NoteCommand } from '@/types/notes'
import type { RollCommand } from '@/utils/requests/types'

// Where the Gamemaster's module fetches what players ask its game to do: for now, rolls made here,
// for the game to make with the dice the player rolled. The module fetches from the Gamemaster's
// browser, as it posts events, and only once this app has said it has commands, in its answer to
// the module's hello or heartbeat. See the module's PROTOCOL.md.
//
// While one of the campaign's players has their table open, a fetch is held open until a roll
// comes, so it reaches the game at once. Otherwise it's answered at once, saying when to ask
// again, so a game nobody is playing at costs little.
//
// From this app's round with module 0.27.0, every answer also says which of the campaign's
// characters are open in the app, `open`, by their actors' ids: the module waits for their
// players' answers to what Midi-QOL asks of them, and for no one else's. A held fetch is answered
// early, with no rolls, once that changes, so the module stops waiting for a page closed soon
// after.
//
// A fetch is refused as an event is, its status kept and why said in JSON.

/** A held fetch lasts COMMANDS_HOLD, and a check, after the campaign's lookup. */
export const maxDuration = 30

/** The largest fetch read. It names only its session and campaign. */
const MAX_POLL_BYTES = 4096

const CHECK_FAILED = 'Failed to check a Sending Stone fetch'

export function OPTIONS(request: Request) {
  return new Response(undefined, { status: 204, headers: cors(request) })
}

export async function POST(request: Request) {
  const headers = cors(request)
  headers.set('Cache-Control', 'no-store')

  const secret = bearerSecret(request.headers.get('authorization'))
  if (!secret) {
    return refuse(
      request,
      401,
      { reason: REFUSAL.NO_SECRET, message: 'Send the campaign’s secret' },
      headers,
    )
  }

  const origin = request.headers.get('origin')
  if (!origin || toForgeGameUrl(origin) !== origin) {
    return refuse(
      request,
      403,
      {
        reason: REFUSAL.NOT_FORGE,
        message: 'Only games on The Forge are accepted',
      },
      headers,
    )
  }

  const body = await readBody(request, {
    limit: MAX_POLL_BYTES,
    declared: true,
  })
  if (!body.ok && body.why === 'size') return tooLarge(request, headers)

  const parsed = body.ok ? commandsPollSchema.safeParse(body.value) : undefined
  if (!parsed?.success) {
    return refuse(
      request,
      400,
      { reason: REFUSAL.BAD_ENVELOPE, message: 'Not a Sending Stone fetch' },
      headers,
    )
  }
  const { campaign, session } = parsed.data

  const found = await attempt(
    () => findEventCampaign(origin, campaign, secret),
    CHECK_FAILED,
  )
  if (!found) return unavailable(request, headers)
  if (found === 'unknown') {
    return refuse(
      request,
      404,
      {
        reason: REFUSAL.NOT_SET_UP,
        message: notSetUp(origin, campaign.title),
      },
      headers,
    )
  }
  if (found === 'refused') {
    return refuse(
      request,
      401,
      {
        reason: REFUSAL.WRONG_SECRET,
        message: 'The secret isn’t this campaign’s in Sending Stone',
      },
      headers,
    )
  }
  return commandsFor(request, headers, found.id, session)
}

const unavailable = (request: Request, headers: Headers) =>
  refuse(
    request,
    500,
    {
      reason: REFUSAL.UNAVAILABLE,
      message: 'Sending Stone couldn’t take this just now',
    },
    headers,
  )

const tooLarge = (request: Request, headers: Headers) =>
  refuse(
    request,
    413,
    {
      reason: REFUSAL.TOO_LARGE,
      message: `Larger than the ${MAX_POLL_BYTES} bytes Sending Stone takes`,
      limit: MAX_POLL_BYTES,
    },
    headers,
  )

/**
 * The commands fetched, the characters open in the app, and how long to wait before fetching
 * again; none for at once.
 */
const answer = (
  headers: Headers,
  commands: (RollCommand | NoteCommand | DishCommand)[],
  open: string[],
  wait?: number,
) =>
  Response.json(
    wait === undefined ? { commands, open } : { commands, wait, open },
    { headers },
  )

/**
 * What a fetch for a campaign found is answered: no commands while it takes none, saying when to
 * ask again; else its commands, at once where none of its players has their table open, and held
 * until some come where one has.
 */
async function commandsFor(
  request: Request,
  headers: Headers,
  campaignId: string,
  session: string,
): Promise<Response> {
  const polled = await attempt(() => markBridgePolled(campaignId), CHECK_FAILED)
  if (!polled) return unavailable(request, headers)
  // Read before any rolls are handed over, which a failure after would lose.
  const readOpen = () =>
    attempt(
      () => openActorIds(campaignId),
      'Failed to read which characters are open',
    )
  const began = await readOpen()
  if (!began) return unavailable(request, headers)
  // Moves of items and coins, from module 0.31.0, removals of characters' items, from module
  // 0.33.0, journal notes, from module 0.34.0, favorites, from module 0.37.0, dishes from the
  // Magical Recipe Book, from module 0.38.0, effects, from module 0.39.0, and Wild Shape, from
  // module 0.40.0, are fetched with rolls off too.
  if (!BRIDGE_SWITCHES.some(field => polled[field])) {
    return answer(headers, [], began, COMMANDS_OFF_WAIT)
  }

  const claim = () => claimAll(campaignId, session, polled.dishesEnabled)
  if (!polled.playersPresent) {
    const commands = await claim()
    return commands
      ? answer(headers, commands, began, COMMANDS_COLD_WAIT)
      : unavailable(request, headers)
  }
  return holdForCommands(request, headers, claim, readOpen, began)
}

/**
 * Hand over what the campaign's game is to make: notes written here, from module 0.34.0, and
 * dishes from the Magical Recipe Book, from module 0.38.0, are handed over after the rolls, but
 * claimed first: each handed to an answer that's lost is handed over again, and a roll never is,
 * so a failure claiming them must come before any roll is taken. The campaign is read once for
 * all three, as a held fetch checks about once a second.
 */
function claimAll(
  campaignId: string,
  session: string,
  dishesEnabled: boolean,
): Promise<(RollCommand | NoteCommand | DishCommand)[] | undefined> {
  return attempt(async () => {
    const campaign = await findClaimCampaign(campaignId)
    const dishes = dishesEnabled
      ? await claimDishes(campaignId, session, campaign)
      : []
    const notes = await claimNoteWrites(campaignId, session, campaign)
    return [
      ...(await claimRollRequests(campaignId, session, campaign)),
      ...notes,
      ...dishes,
    ]
  }, 'Failed to hand over players’ rolls')
}

/**
 * A fetch held open while one of the campaign's players has their table open, until a command
 * comes, so it reaches the game at once, or until the hold is over; answered early, with none,
 * where a character opened or closed meanwhile, or the fetch was given up on.
 */
async function holdForCommands(
  request: Request,
  headers: Headers,
  claim: () => Promise<(RollCommand | NoteCommand | DishCommand)[] | undefined>,
  readOpen: () => Promise<string[] | undefined>,
  began: string[],
): Promise<Response> {
  const until = Date.now() + COMMANDS_HOLD
  for (;;) {
    // Rolls handed to a fetch that was given up on, as when its page closed, would be lost.
    if (request.signal.aborted) return answer(headers, [], began)
    const commands = await claim()
    if (!commands) return unavailable(request, headers)
    if (commands.length > 0 || Date.now() >= until) {
      return answer(headers, commands, began)
    }
    await pause(
      Math.min(COMMANDS_CHECK_EVERY, until - Date.now()),
      request.signal,
    )
    if (request.signal.aborted) continue
    // A character opened or closed meanwhile: the module is told at once.
    const open = await readOpen()
    if (!open) return unavailable(request, headers)
    if (!sameIds(open, began)) return answer(headers, [], open)
  }
}

/** Whether two sorted lists of ids are the same. */
function sameIds(one: string[], other: string[]): boolean {
  return (
    one.length === other.length && one.every((id, index) => id === other[index])
  )
}

/** Wait this long, or until the request is given up on. */
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}
