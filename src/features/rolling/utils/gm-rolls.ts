import type { gmRollsOf } from '@/features/rolling/hooks/use-gm-rolls'
import type { LocalRoll, TableRollState } from '@/types/roll'

/**
 * The page's own rolls and the Gamemaster's as the character together (#156), newest first by when
 * each was made, or for the Gamemaster's, heard of, and their ways to the game.
 */
export function withGmRolls(
  rolls: readonly LocalRoll[],
  states: ReadonlyMap<string, TableRollState>,
  gm: ReturnType<typeof gmRollsOf>,
): { rolls: LocalRoll[]; states: ReadonlyMap<string, TableRollState> } {
  if (gm.rolls.length === 0) return { rolls: [...rolls], states }
  return {
    rolls: [...rolls, ...gm.rolls].toSorted((a, b) => b.at - a.at),
    states: new Map([...states, ...gm.states]),
  }
}
