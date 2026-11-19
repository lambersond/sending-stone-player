import {
  currentCombatant,
  isMyTurn,
  seatTurn,
} from '@/features/table/utils/combat'
import {
  TURN_OVER,
  turnFragment,
  turnKey,
  turnRefusedLine,
} from '@/features/table/utils/end-turn'
import type { PanelEnding } from '@/features/table/types'
import type { SeatRole } from '@/types/seats'
import type { TableCombat, TableCombatant } from '@/types/table'

/**
 * The combatant whose turn it is, where it's a creature not of the party whose health or hit
 * points the seat is shown, from module 0.50.0, for the turn panel; none on the party's turns.
 */
export function actingHealth(
  current: TableCombatant | undefined,
): TableCombatant | undefined {
  if (current?.side !== 'other') return
  return current.hp || current.health ? current : undefined
}

/**
 * An initiative as Foundry shows it. Systems break ties with decimals, such as D&D's dexterity
 * tiebreaker giving 18.14, which are rounded to two places to hide floating-point noise.
 */
export function formatInitiative(initiative: number | null): string {
  if (initiative === null) return '–'
  return String(Math.round(initiative * 100) / 100)
}

/**
 * The turn panel's heading: whose turn it is, as the seat reads it, the character's or, from module
 * 0.36.0, one of its companions' by name.
 */
export function turnHeading(combat: TableCombat): string {
  const current = currentCombatant(combat)
  if (current?.side === 'me') return 'Your turn'
  if (current && seatTurn(current)?.companion) return `${current.name}’s turn`
  if (current) return `${current.name} is acting`
  return 'Waiting for the next turn'
}

/**
 * The seat's turns in the encounters not shown (item 36), for the tracker's second live region:
 * "Your turn, in another encounter." or "Pip’s turn, in another encounter.", one for each where
 * it's the seat's turn; nothing where there's none.
 */
export function otherTurnsLine(
  combats: readonly TableCombat[],
  shown: TableCombat | undefined,
): string {
  return combats
    .filter(other => other.id !== shown?.id && isMyTurn(other))
    .map(other => `${turnHeading(other)}, in another encounter.`)
    .join(' ')
}

/**
 * Why the last End Turn wasn't made, while the panel still shows its turn; none otherwise.
 * @param shown - The turn the panel offers End Turn for, by its key.
 */
export function refusalLine(
  refused: PanelEnding['refused'],
  shown: string | undefined,
  role: SeatRole,
): string | undefined {
  if (!refused || shown !== turnKey(refused.turn)) return undefined
  const { key } = refused
  return turnRefusedLine(
    refused.turn,
    turnFragment(key, role),
    !TURN_OVER.has(key),
  )
}
