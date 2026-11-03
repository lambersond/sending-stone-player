import type { GmRolls } from '@/features/rolling/types'
import type { GmRollView, LocalRoll, TableRollState } from '@/types/roll'
import type { TableCombat } from '@/types/table'

/**
 * The page's own rolls and the Gamemaster's as the character together (#156), newest first by when
 * each was made, or for the Gamemaster's, heard of, and their ways to the game.
 */
export function withGmRolls(
  rolls: readonly LocalRoll[],
  states: ReadonlyMap<string, TableRollState>,
  gm: GmRolls,
): { rolls: LocalRoll[]; states: ReadonlyMap<string, TableRollState> } {
  if (gm.rolls.length === 0) return { rolls: [...rolls], states }
  return {
    rolls: [...rolls, ...gm.rolls].toSorted((a, b) => b.at - a.at),
    states: new Map([...states, ...gm.states]),
  }
}

/**
 * The names of an area attack's targets of the Gamemaster's (#156), by their ids, as the player's
 * own view of the combat names them: only ever names its player may see, as that view leaves out
 * those hidden from players, never names the Gamemaster's page saw. None of a target that view
 * doesn't hold, nor of an attack at one target, which says nothing of whom.
 */
export function namesOf(
  attack: GmRollView['attack'],
  combat?: TableCombat,
): Record<string, string> | undefined {
  const targets = attack?.targets ?? []
  if (!combat || targets.length < 2) return undefined
  const names = targets.flatMap(({ combatId, combatantId }) => {
    const combatant =
      combatId === combat.id
        ? combat.combatants.find(({ id }) => id === combatantId)
        : undefined
    return combatant ? [[combatantId, combatant.name] as const] : []
  })
  return names.length > 0 ? Object.fromEntries(names) : undefined
}

/**
 * When this page first heard of each of the Gamemaster's rolls the view has, those new to it now:
 * none it no longer has, which never come back, as they only grow older.
 */
export function heardOf(
  held: ReadonlyMap<string, number>,
  views: readonly GmRollView[],
): ReadonlyMap<string, number> {
  const now = Date.now()
  return new Map(views.map(({ id }) => [id, held.get(id) ?? now]))
}
