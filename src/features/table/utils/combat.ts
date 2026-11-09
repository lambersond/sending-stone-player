import type { SeatTurn } from '@/features/table/types'
import type { TableCombat, TableCombatant } from '@/types/table'

/** Who acts in the combat now: its current combatant, where it lists one. */
export function currentCombatant(
  combat: TableCombat,
): TableCombatant | undefined {
  return combat.combatants.find(({ id }) => id === combat.currentId)
}

/**
 * Whether this combatant's turn is the seat's own, the one rule for the Combat tab's dot, the turn
 * panel's outline and End Turn (v0.44): its character's, or from module 0.36.0 one of its
 * companions', by the key the combat names it by. None for anyone else's, nor for a companion
 * whose key is empty, which names none, nor a gone one's, which no longer has its key.
 */
export function seatTurn(combatant: TableCombatant): SeatTurn | undefined {
  if (combatant.side === 'me') return {}
  if (combatant.yours === true && combatant.companion) {
    return { companion: combatant.companion }
  }
  return undefined
}

/** Whether it's the player's turn, as `seatTurn` has it, in a combat that has started. */
export function isMyTurn(combat?: TableCombat): boolean {
  return isTurnOf(combat, combatant => seatTurn(combatant) !== undefined)
}

/** Whether the combat has started and its current combatant is one that `is` picks. */
export function isTurnOf(
  combat: TableCombat | undefined,
  is: (combatant: TableCombat['combatants'][number]) => boolean,
): boolean {
  return (
    combat?.started === true &&
    combat.combatants.some(
      combatant => combatant.id === combat.currentId && is(combatant),
    )
  )
}

/** Who acts after the current combatant, skipping the defeated. */
export function nextUp(combat: TableCombat): TableCombatant | undefined {
  const { combatants, currentId } = combat
  const index = combatants.findIndex(({ id }) => id === currentId)
  if (!combat.started || index === -1) return undefined
  for (let step = 1; step < combatants.length; step++) {
    const candidate = combatants[(index + step) % combatants.length]
    if (!candidate.defeated) return candidate
  }
  return undefined
}

/**
 * A combatant's hit points as its bar draws them: how full, in percent, where it has a maximum,
 * a living one's at least a sliver; and the bar's colour, the accent's, a warning's from half, a
 * danger's at none.
 */
export function hpBar(hp: NonNullable<TableCombatant['hp']>): {
  percent?: number
  bar: string
} {
  const living = hp.value > 0
  const percent = hp.max
    ? Math.min(
        100,
        Math.max(living ? 1 : 0, Math.round((hp.value / hp.max) * 100)),
      )
    : undefined
  let bar = 'bg-primary'
  if (percent !== undefined && percent <= 50) bar = 'bg-warning'
  if (percent !== undefined && !living) bar = 'bg-danger'
  return { percent, bar }
}
