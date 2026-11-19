import { relationWords } from '@/utils/creature-words'
import { articled } from '@/utils/wild-shape'
import type {
  CompanionAskRow,
  SwitcherCreature,
} from '@/features/companions/types'
import type { SeatWords } from '@/types/seats'

/** A creature's name as its tab says it: numbered where the row repeats it. */
export function shownName({ name, number }: SwitcherCreature): string {
  return number === undefined ? name : `${name} ${number}`
}

/**
 * Whose a companion is, as its tab's description says it: "Thorin’s companion", "Summoned by Thorin
 * with Find Familiar", or once gone, "No longer with Thorin in your Gamemaster’s game"; and from
 * module 0.51.0, for one on another scene, ending ", on another scene".
 */
export function describe(
  { kind, from, gone, away }: SwitcherCreature,
  character: string,
  game: string,
): string {
  if (gone) return `No longer with ${character} in ${game}`
  const whose = relationWords(
    kind === 'summoned'
      ? { kind, of: character, ...(from && { from }) }
      : { kind: 'owned', of: character },
  )
  return away ? `${whose}, on another scene` : whose
}

/**
 * What a companion's sheet says of it while it's on another scene, from module 0.51.0, in the
 * seat's words for the game and who views it: its rolls are still made, but an attack's target
 * may need viewing, as Midi-QOL targets only what the Gamemaster's screen draws.
 * @param name - Its name as its tab gives it, such as "Bat 2".
 */
export function awayWords(
  name: string,
  { game, notViewing }: Pick<SeatWords, 'game' | 'notViewing'>,
): string {
  return `${name} is on another scene in ${game}. You can still roll for it here, but an attack may be refused while ${notViewing} its target.`
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
