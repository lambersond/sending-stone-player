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
 * An initiative as Foundry shows it. Systems break ties with decimals, such as D&D's dexterity
 * tiebreaker giving 18.14, which are rounded to two places to hide floating-point noise.
 */
export function formatInitiative(initiative: number | null): string {
  if (initiative === null) return '–'
  return String(Math.round(initiative * 100) / 100)
}

/** The turn panel's heading: whose turn it is, as the seat reads it. */
export function turnHeading(
  combat: TableCombat,
  current: TableCombatant | undefined,
  companion: string | undefined,
): string {
  if (!combat.started) return 'Getting ready'
  if (current?.side === 'me') return 'Your turn'
  if (current && companion) return `${current.name}’s turn`
  if (current) return `${current.name} is acting`
  return 'Waiting for the next turn'
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
