import type { DueDamage, RollStateAction } from '@/features/rolling/types'
import type { TableRollState } from '@/types/roll'

/*
 * The ways of the rolls sent to the Gamemaster's game (`useTableRolls`), each by its local roll's
 * id: how they change as the game is heard from, and what's read from them.
 */

/**
 * The rolls' ways, changed: one's way as the game tells it, kept with what was kept of it when it
 * was sent (`way`); rolls sent one after another, as one (`together`); an attack's or use's damage
 * on its way, not offered again (`damaged`), or offered again as the game didn't make it after all
 * (`undamaged`); or a use's damage left for the player to roll, while they type in their own dice,
 * once (`offer`).
 */
export function rollStates(
  held: ReadonlyMap<string, TableRollState>,
  action: RollStateAction,
): ReadonlyMap<string, TableRollState> {
  switch (action.type) {
    case 'way': {
      const { id, kept, state } = action
      return new Map(held).set(id, { ...kept, ...state, ...partly(state) })
    }
    case 'together': {
      return new Map(held).set(action.id, together(action.each, action.count))
    }
    case 'damaged': {
      const next = new Map(held)
      for (const [id, state] of next) {
        if (state.requestId === action.use) {
          next.set(id, { ...state, damaged: true })
        }
      }
      return next
    }
    case 'undamaged': {
      const next = new Map(held)
      for (const [id, { damaged, ...state }] of held) {
        if (damaged && state.requestId === action.use) next.set(id, state)
      }
      return next
    }
    case 'offer': {
      const state = held.get(action.id)
      if (!state || state.offer) return held
      return new Map(held).set(action.id, { ...state, offer: true })
    }
  }
}

/** Hit dice the game stopped spending part way, which it made some of, say how many. */
export function partly(
  state: Pick<TableRollState, 'status' | 'spent'>,
): Pick<TableRollState, 'together'> {
  return state.status === 'failed' && (state.spent?.made ?? 0) > 0
    ? { together: state.spent }
    : {}
}

/**
 * Whether a roll answers what the game asked, a save or its dice: on its way, or made there. One
 * refused, failed, expired or lost leaves it asked.
 */
export function answers({ status }: Pick<TableRollState, 'status'>): boolean {
  return ['sending', 'rolling', 'done'].includes(status)
}

/** The prompts answered by rolls on their way to the game, or made there. */
export function answeringOf(
  states: ReadonlyMap<string, TableRollState>,
): ReadonlySet<string> {
  const answering = new Set<string>()
  for (const state of states.values()) {
    if (state.prompt && answers(state)) answering.add(state.prompt)
  }
  return answering
}

/** The latest of the attacks that pass the test whose damage is still to roll at the table. */
export function dueOf(
  states: ReadonlyMap<string, TableRollState>,
  test: (state: TableRollState) => boolean,
): DueDamage | undefined {
  const due = [...states.values()].findLast(
    state =>
      test(state) &&
      state.status === 'done' &&
      !!state.damage &&
      !state.damaged &&
      !!state.requestId,
  )
  return due?.requestId && due.damage
    ? {
        use: due.requestId,
        damage: due.damage,
        ...(due.modifiers && { modifiers: due.modifiers }),
      }
    : undefined
}

/**
 * Why damage the game failed may have been made all the same, or was made already: damage that
 * took too long may still be made, and is told so once it is; one that failed with an error may
 * have failed after it was rolled; and damage already rolled for its attack or use, from the app
 * or in Foundry, is refused again, whatever is sent.
 */
const MAYBE_MADE: ReadonlySet<string> = new Set([
  'timeout',
  'error',
  'damaged',
  'not-waiting',
])

/**
 * Whether the game didn't make an attack's or use's damage, so that it's offered again: the app
 * refused it, or couldn't be reached, but not as damage for it already on its way or made, as from
 * another device; the game never fetched it (`expired`), as the app hands over none that's waited
 * too long; or it failed before any of it was rolled. Never where it may have been made: fetched
 * and never answered for (`lost`), as an answer that comes late still counts; taken with nothing
 * to follow it by; or failed as `MAYBE_MADE` says.
 */
export function damageUnmade(state: TableRollState): boolean {
  switch (state.status) {
    case 'refused': {
      return state.reason !== 'damaged'
    }
    case 'expired': {
      return true
    }
    case 'failed': {
      return state.reason !== undefined && !MAYBE_MADE.has(state.reason)
    }
    default: {
      return false
    }
  }
}

/** Whether the app turned a roll away as one too many at once, to send again a moment later. */
export function busy(state: TableRollState): boolean {
  return state.status === 'refused' && state.reason === 'busy'
}

/**
 * Rolls sent one after another, as one: where the latest sent is on its way; or, once each is made,
 * what the game made of them all, their totals and the hit points they gave back added up, or only
 * that they were sent, where any couldn't be followed; or that one of them wasn't made, and why,
 * after how many were, or were sent, where any of those couldn't be followed.
 */
function together(each: TableRollState[], count: number): TableRollState {
  const made = each.filter(({ status }) => status === 'done')
  const latest = each.at(-1) ?? { status: 'sending' }
  const visible = made.length > 0 && made.every(state => state.visible)
  const totals = made.map(({ total }) => total)
  const healed = made.map(state => state.healed)
  const status =
    latest.status === 'done' && made.length < count ? 'sending' : latest.status
  const unfollowed = made.some(state => state.unfollowed)
  return {
    status,
    ...(latest.reason !== undefined && { reason: latest.reason }),
    ...(made.length > 0 && { visible }),
    ...(visible && known(totals) && { total: added(totals) }),
    ...(visible && known(healed) && { healed: added(healed) }),
    ...(status === 'done' && unfollowed && { unfollowed: true as const }),
    together: {
      count,
      made: made.length,
      ...(unfollowed && { unfollowed: true as const }),
    },
  }
}

/** Whether every number is known. */
function known(numbers: (number | undefined)[]): numbers is number[] {
  return numbers.every(number => number !== undefined)
}

/** Numbers added up. */
function added(numbers: number[]): number {
  return numbers.reduce((sum, number) => sum + number, 0)
}
