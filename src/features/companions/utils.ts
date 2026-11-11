import { relationWords } from '@/utils/creature-words'
import { articled } from '@/utils/wild-shape'
import type {
  CompanionAskRow,
  SwitcherCreature,
} from '@/features/companions/types'

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

/**
 * What a companion is asked for, as the character's notice says it: "a Dexterity saving throw"; or
 * from module 0.44.0, its player's dice, "the dice of Bite: Rend", or "dice" where nothing names
 * them.
 */
export function askedWords({
  label,
  dice,
}: Pick<CompanionAskRow, 'label' | 'dice'>): string {
  if (!dice) return articled(label)
  return label ? `the dice of ${label}` : 'dice'
}
