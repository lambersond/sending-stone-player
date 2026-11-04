import type { TableCombat, TableCombatant } from '@/types/table'

/** Who acts in the combat now: its current combatant, where it lists one. */
export function currentCombatant(
  combat: TableCombat,
): TableCombatant | undefined {
  return combat.combatants.find(({ id }) => id === combat.currentId)
}

/**
 * Whether it's the player's turn: their character's, or from module 0.36.0 one of its companions',
 * as the combat names it. Not a gone companion's, which no longer has its key.
 */
export function isMyTurn(combat?: TableCombat): boolean {
  return isTurnOf(
    combat,
    ({ side, yours, companion }) =>
      side === 'me' || (yours === true && companion !== undefined),
  )
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
