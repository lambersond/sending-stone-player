import type { DueDamage, RollStateAction } from '@/features/rolling/types'
import type { TableRollState } from '@/types/roll'

/*
 * The ways of the rolls sent to the Gamemaster's game (`useTableRolls`), each by its local roll's
 * id: how they change as the game is heard from, and what's read from them.
 */

/**
 * The rolls' ways, changed: one's way as the game tells it, kept with what was kept of it when it
 * was sent (`way`); rolls sent one after another, as one (`together`); an attack's or use's damage
 * on its way, not offered again (`damaged`), or offered again as the app didn't take it after all
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

/** The prompts answered by rolls on their way to the game, or made there. */
export function answeringOf(
  states: ReadonlyMap<string, TableRollState>,
): ReadonlySet<string> {
  const answering = new Set<string>()
  for (const { prompt, status } of states.values()) {
    if (prompt && ['sending', 'rolling', 'done'].includes(status)) {
      answering.add(prompt)
    }
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
 * Whether the app didn't take an attack's or use's damage, refusing it or out of reach, so that
 * it's offered again: not where it says damage for that attack or use is already on its way or
 * made, as from another device.
 */
export function damageUntaken(state: TableRollState): boolean {
  return state.status === 'refused' && state.reason !== 'damaged'
}

/** Whether the app turned a roll away as one too many at once, to send again a moment later. */
export function busy(state: TableRollState): boolean {
  return state.status === 'refused' && state.reason === 'busy'
}

/**
 * Rolls sent one after another, as one: where the latest sent is on its way; or, once each is made,
 * what the game made of them all, their totals and the hit points they gave back added up; or that
 * one of them wasn't made, and why, after how many were.
 */
function together(each: TableRollState[], count: number): TableRollState {
  const made = each.filter(({ status }) => status === 'done')
  const latest = each.at(-1) ?? { status: 'sending' }
  const visible = made.length > 0 && made.every(state => state.visible)
  const totals = made.map(({ total }) => total)
  const healed = made.map(state => state.healed)
  const status =
    latest.status === 'done' && made.length < count ? 'sending' : latest.status
  return {
    status,
    ...(latest.reason !== undefined && { reason: latest.reason }),
    ...(made.length > 0 && { visible }),
    ...(visible && known(totals) && { total: added(totals) }),
    ...(visible && known(healed) && { healed: added(healed) }),
    together: { count, made: made.length },
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
