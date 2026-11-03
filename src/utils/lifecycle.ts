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
  let id: string
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
    const created = (await response.json()) as { id: string }
    id = created.id
    taken(id)
  } catch {
    update({ status: 'refused', reason: 'network' })
    return
  }

  let until = Date.now() + FOLLOW_FOR
  let late = false
  while (Date.now() < until) {
    await pause(CHECK_EVERY, signal)
    if (signal.aborted) return
    try {
      const response = await fetch(`${api}/rolls/${id}`, {
        cache: 'no-store',
        signal,
      })
      // A roll this page can't see any more, such as once signed out, is given up on.
      if (response.status === 401 || response.status === 404) break
      if (response.ok) {
        // What became of an effect (module 0.39.0), or of Wild Shape (module 0.40.0), is kept
        // apart from what was asked; and so is what damage on its own spent (module 0.41.0),
        // apart from the hit dice a request spent.
        const {
          effect: changed,
          wildShape: wildShaped,
          alone: made,
          ...view
        } = (await response.json()) as RollRequestView
        update({
          ...view,
          ...(changed && { changed }),
          ...(wildShaped && { wildShaped }),
          ...(made && { aloneSpent: made.spent }),
          ...(made?.concentrating && { concentrating: true as const }),
          requestId: id,
        })
        // A roll that took too long may still be made, once the Gamemaster answers; but not hit
        // dice the game says it made some of before it stopped, as it does once it had to.
        if (
          view.status === 'failed' &&
          view.reason === 'timeout' &&
          !view.spent
        ) {
          if (!late) until = Date.now() + LATE_FOLLOW
          late = true
        } else if (SETTLED.has(view.status)) {
          return
        }
      }
    } catch {
      // Asked again next time.
    }
  }
  if (!late) update({ status: 'lost', requestId: id })
}

/** Why the app didn't take a roll, as it says. */
export async function refusal(response: Response): Promise<string> {
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
