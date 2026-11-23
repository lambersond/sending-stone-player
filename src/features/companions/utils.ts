import { relationWords } from '@/utils/creature-words'
import { articled } from '@/utils/wild-shape'
import type {
  CompanionAskRow,
  SwitcherCreature,
} from '@/features/companions/types'
import type { SeatWords } from '@/types/seats'
import type { CreatureRelation } from '@/types/table'

/** A creature's name as its tab says it: numbered where the row repeats it. */
export function shownName({ name, number }: SwitcherCreature): string {
  return number === undefined ? name : `${name} ${number}`
}

/**
 * Whose a companion is, as its tab's description says it: "Thorin’s companion", "Summoned by Thorin
 * with Find Familiar", or once gone, "No longer with Thorin in your Gamemaster’s game"; from module
 * 0.51.0, for one on another scene, ending ", on another scene"; and from module 0.54.0 "Thorin’s
 * constant companion", ending ", not on a scene" for one with no token on any scene.
 */
export function describe(
  { kind, from, gone, away, unplaced }: SwitcherCreature,
  character: string,
  game: string,
): string {
  if (gone) return `No longer with ${character} in ${game}`
  const whose = relationWords(relationOf(kind, character, from))
  if (unplaced) return `${whose}, not on a scene`
  return away ? `${whose}, on another scene` : whose
}

/**
 * Whose a companion is, as its tab and its sheet say it, by its kind: owned where it says none.
 * @param from - What summoned a summoned one, where known.
 */
export function relationOf(
  kind: SwitcherCreature['kind'],
  character: string,
  from?: string,
): CreatureRelation {
  if (kind === 'summoned') return { kind, of: character, ...(from && { from }) }
  if (kind === 'constant') return { kind, of: character }
  return { kind: 'owned', of: character }
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
 * What a constant companion's sheet says of it while it has no token on any scene, from module
 * 0.54.0, in the seat's words for the game: it still rolls and uses its features, at no target.
 * @param name - Its name as its tab gives it.
 */
export function unplacedWords(
  name: string,
  { game }: Pick<SeatWords, 'game'>,
): string {
  return `${name} isn’t on a scene in ${game}. You can still roll for it and use its features here; its attacks and spells go without a target.`
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
