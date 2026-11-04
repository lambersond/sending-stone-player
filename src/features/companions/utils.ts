import { relationWords } from '@/utils/creature-words'
import type { SwitcherCreature } from '@/features/companions/types'

/** A creature's name as its tab says it: numbered where the row repeats it. */
export function shownName({ name, number }: SwitcherCreature): string {
  return number === undefined ? name : `${name} ${number}`
}

/**
 * Whose a companion is, as its tab's description says it: "Thorin’s companion", "Summoned by Thorin
 * with Find Familiar", or once gone, "No longer with Thorin in your Gamemaster’s game".
 */
export function describe(
  { kind, from, gone }: SwitcherCreature,
  character: string,
  game: string,
): string {
  if (gone) return `No longer with ${character} in ${game}`
  return relationWords(
    kind === 'summoned'
      ? { kind, of: character, ...(from && { from }) }
      : { kind: 'owned', of: character },
  )
}
