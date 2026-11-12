import {
  FOLLOW_FOR,
  CHECK_EVERY,
  LATE_FOLLOW,
  SETTLED,
} from '@/constants/lifecycle'
import { MAX_ROLL_LABEL } from '@/constants/sending-stone'
import type {
  RollRequestInput,
  TableRollState,
  RollRequestView,
} from '@/types/roll'

/**
 * A roll as the Gamemaster's page sends it (#156): with what it calls it, for the character's
 * player to be shown it by, cut to as long a name as the app keeps, never splitting a character,
 * and left out where there's nothing to say.
 */
export function labelled(
  input: RollRequestInput,
  label: string,
): RollRequestInput {
  let kept = ''
  for (const character of label.trim()) {
    if (kept.length + character.length > MAX_ROLL_LABEL) break
    kept += character
  }
  return kept ? { ...input, label: kept } : input
}

/**
 * Send a roll to the game, then ask after it until it's made, or given up on.
 * @param api - The seat's API base, such as `/api/characters/<id>`.
 */
export async function follow(
  api: string,
  input: RollRequestInput,
  signal: AbortSignal,
  update: (state: TableRollState) => void,
  taken: (id: string) => void,
) {
  const sent = await post(api, input, signal, update, taken)
  if (!sent) return
  const { id } = sent
  let until = Date.now() + FOLLOW_FOR
  let late = false
  let asked = Date.now()
  while (Date.now() < until) {
    await pause(CHECK_EVERY, signal)
    if (signal.aborted) return
    const heard = await look(api, id, signal, update)
    // While the game asks for the dice of a later roll in its run (module 0.44.0), the time it has
    // to be made stands still, as the game's own does.
    const now = Date.now()
    if (heard === 'held') until += now - asked
    asked = now
    if (heard === 'gone') break
    if (heard === 'settled') return
    // One the game took too long to make is asked after for longer, once.
    if (heard === 'late' && !late) {
      until = Date.now() + LATE_FOLLOW
      late = true
    }
  }
  if (!late) update({ status: 'lost', requestId: id })
}

/**
 * Send a roll to the game: the id the app took it under, as its answer gives it, told to
 * `taken` too; or, where the app didn't take it, or couldn't be reached, nothing, with why told
 * to `update`; or, where it took it but its answer names no id, nothing, with it told as made,
 * unfollowed: it went to the game, and there's no id to follow it by.
 */
async function post(
  api: string,
  input: RollRequestInput,
  signal: AbortSignal,
  update: (state: TableRollState) => void,
  taken: (id: string) => void,
): Promise<{ id: string } | undefined> {
  try {
    const response = await fetch(`${api}/rolls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    })
    if (response.status !== 202) {
      update({ status: 'refused', reason: await refusal(response) })
      return
    }
    const id = await takenId(response)
    if (id === undefined) {
      update({ status: 'done', unfollowed: true })
      return
    }
    taken(id)
    return { id }
  } catch {
    update({ status: 'refused', reason: 'network' })
    return
  }
}

/** The id the app took a roll under, as its answer says; none where it isn't read or says none. */
async function takenId(response: Response): Promise<string | undefined> {
  try {
    const { id } = (await response.json()) as { id?: unknown }
    return typeof id === 'string' ? id : undefined
  } catch {
    return undefined
  }
}

/**
 * Ask once after a roll sent, telling `update` where it stands: whether it's made, or given up on
 * (`settled`); one this page can't see any more (`gone`); one the game took too long to make,
 * which may still be made (`late`); from module 0.44.0, one the game holds asking for the dice of
 * a later roll in its run (`held`); or else, or where the app couldn't be asked, one to ask after
 * again (`again`).
 */
async function look(
  api: string,
  id: string,
  signal: AbortSignal,
  update: (state: TableRollState) => void,
): Promise<'settled' | 'gone' | 'late' | 'held' | 'again'> {
  try {
    const response = await fetch(`${api}/rolls/${id}`, {
      cache: 'no-store',
      signal,
    })
    // A roll this page can't see any more, such as once signed out, is given up on.
    if (response.status === 401 || response.status === 404) return 'gone'
    if (!response.ok) return 'again'
    // What became of an effect (module 0.39.0), or of Wild Shape (module 0.40.0), is kept apart
    // from what was asked; and so is what damage on its own spent (module 0.41.0), apart from the
    // hit dice a request spent, and the hit points set (module 0.44.0), apart from the marker.
    const {
      effect: changed,
      wildShape: wildShaped,
      alone: made,
      hitPoints: hitPointsNow,
      ...view
    } = (await response.json()) as RollRequestView
    update({
      ...view,
      ...(changed && { changed }),
      ...(wildShaped && { wildShaped }),
      ...(made && { aloneSpent: made.spent }),
      ...(made?.concentrating && { concentrating: true as const }),
      ...(hitPointsNow && { hitPointsNow }),
      requestId: id,
    })
    // A roll that took too long may still be made, once the Gamemaster answers; but not hit dice
    // the game says it made some of before it stopped, as it does once it had to.
    if (view.status === 'failed' && view.reason === 'timeout' && !view.spent) {
      return 'late'
    }
    if (view.status === 'rolling' && view.diceAsked) return 'held'
    return SETTLED.has(view.status) ? 'settled' : 'again'
  } catch {
    // Asked again next time.
    return 'again'
  }
}

/** Why the app didn't take a roll, as it says. */
async function refusal(response: Response): Promise<string> {
  if (![409, 422, 429].includes(response.status)) return 'error'
  try {
    const { reason } = (await response.json()) as { reason?: unknown }
    return typeof reason === 'string' ? reason : 'error'
  } catch {
    return 'error'
  }
}

/** Wait this long, or until given up on. */
export function pause(ms: number, signal: AbortSignal): Promise<void> {
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

/** Whether a request is on its way: sent and not yet heard of, or being made at the table. */
export function onItsWay(state?: Pick<TableRollState, 'status'>): boolean {
  return state?.status === 'sending' || state?.status === 'rolling'
}

/**
 * Whether the game has answered a request: made, or not made as it said. Its answer may have
 * changed the sheet (ROADMAP item 39), which the game sends a moment after it.
 */
export function answeredByGame(state: Pick<TableRollState, 'status'>): boolean {
  return state.status === 'done' || state.status === 'failed'
}
