import { currentCombatant, seatTurn } from '@/features/table/utils/combat'
import type { TableCombat } from '@/types/table'

/**
 * An encounter's tab's name (item 36): its own name, where the Gamemaster gave it one; else who of
 * the seat's is in it, its character, then its first companion; else the party's first; else
 * "Encounter".
 */
function encounterLabel({ name, combatants }: TableCombat): string {
  const named = name?.trim()
  if (named) return named
  const own =
    combatants.find(({ side }) => side === 'me') ??
    combatants.find(({ yours, companion }) => yours && companion) ??
    combatants.find(({ side }) => side === 'party')
  return own?.name ?? 'Encounter'
}

/**
 * Each encounter's tab's name, by id, as `encounterLabel` has it: a second and later with the same
 * name get " (2)", " (3)", in the list's order.
 */
export function encounterLabels(
  combats: readonly TableCombat[],
): Map<string, string> {
  const labels = new Map<string, string>()
  const seen = new Map<string, number>()
  for (const combat of combats) {
    const label = encounterLabel(combat)
    const count = (seen.get(label) ?? 0) + 1
    seen.set(label, count)
    labels.set(combat.id, count > 1 ? `${label} (${count})` : label)
  }
  return labels
}

/**
 * What an encounter's tab says of it while it isn't the one shown: whose turn of the seat's it is
 * there, ", your turn" or ", Pip’s turn"; nothing on anyone else's, or while a hidden one acts.
 */
export function encounterNews(combat: TableCombat): string {
  const current = combat.underWay ? currentCombatant(combat) : undefined
  if (!current) return ''
  if (current.side === 'me') return ', your turn'
  return seatTurn(current)?.companion ? `, ${current.name}’s turn` : ''
}
