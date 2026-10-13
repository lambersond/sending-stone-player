import {
  COMMANDS_CHECK_EVERY,
  COMMANDS_COLD_WAIT,
  COMMANDS_HOLD,
  COMMANDS_OFF_WAIT,
  REFUSAL,
} from '@/constants/sending-stone'
import { findEventCampaign } from '@/db/campaigns'
import { claimRollRequests, markBridgePolled } from '@/db/roll-requests'
import { attempt, cors, notSetUp, refuse } from '@/lib/bridge-http'
import { bearerSecret } from '@/lib/campaign-secret'
import { toForgeGameUrl } from '@/schemas/campaign'
import { commandsPollSchema } from '@/schemas/roll-request'
import type { RollCommand } from '@/utils/roll-requests'

// Where the Gamemaster's module fetches what players ask its game to do: for now, rolls made here,
// for the game to make with the dice the player rolled. The module fetches from the Gamemaster's
// browser, as it posts events, and only once this app has said it has commands, in its answer to
// the module's hello or heartbeat. See the module's PROTOCOL.md.
//
// While one of the campaign's players has their table open, a fetch is held open until a roll
// comes, so it reaches the game at once. Otherwise it's answered at once, saying when to ask
// again, so a game nobody is playing at costs little.
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
  const unavailable = () =>
    refuse(
      request,
      500,
      {
        reason: REFUSAL.UNAVAILABLE,
        message: 'Sending Stone couldn’t take this just now',
      },
      headers,
    )
  const tooLarge = () =>
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
  /** The commands fetched, and how long to wait before fetching again; none for at once. */
  const answer = (commands: RollCommand[], wait?: number) =>
    Response.json(wait === undefined ? { commands } : { commands, wait }, {
      headers,
    })

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

  const declared = Number(request.headers.get('content-length'))
  if (declared > MAX_POLL_BYTES) return tooLarge()
  const body = await request.text()
  if (Buffer.byteLength(body) > MAX_POLL_BYTES) return tooLarge()

  let poll
  try {
    poll = commandsPollSchema.parse(JSON.parse(body))
  } catch {
    return refuse(
      request,
      400,
      { reason: REFUSAL.BAD_ENVELOPE, message: 'Not a Sending Stone fetch' },
      headers,
    )
  }
  const { campaign, session } = poll

  const found = await attempt(
    () => findEventCampaign(origin, campaign, secret),
    CHECK_FAILED,
  )
  if (!found) return unavailable()
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

  const polled = await attempt(() => markBridgePolled(found.id), CHECK_FAILED)
  if (!polled) return unavailable()
  if (!polled.rollsEnabled) return answer([], COMMANDS_OFF_WAIT)

  const claim = () =>
    attempt(
      () => claimRollRequests(found.id, session),
      'Failed to hand over players’ rolls',
    )
  if (!polled.playersPresent) {
    const commands = await claim()
    return commands ? answer(commands, COMMANDS_COLD_WAIT) : unavailable()
  }

  const until = Date.now() + COMMANDS_HOLD
  for (;;) {
    // Rolls handed to a fetch that was given up on, as when its page closed, would be lost.
    if (request.signal.aborted) return answer([])
    const commands = await claim()
    if (!commands) return unavailable()
    if (commands.length > 0 || Date.now() >= until) return answer(commands)
    await pause(
      Math.min(COMMANDS_CHECK_EVERY, until - Date.now()),
      request.signal,
    )
  }
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
