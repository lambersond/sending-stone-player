import { seatWords } from '@/utils/seat-words'
import type { PlainRollInput, RollKind } from '@/types/roll'
import type { SeatRole } from '@/types/seats'

// How a plain roll of the dice the player picks (module 0.44.0) is told, in English: what it
// throws, what it's called, and whether the game makes it at all, and why not. Its way to the game
// once sent, and why one wasn't made, are a roll's, as any roll's are worded for its tray and toast
// (`briefOf`, features/rolling/utils/brief.ts): "Rolling", "At the table: 17", "Not made at the
// table".

/** What a plain roll throws, as a formula: "2d6 + 1d8 + 2", "1d20 − 1", "1d100". */
export function plainRollFormula({ terms, bonus }: PlainRollInput): string {
  const dice = terms.map(({ faces, count }) => `${count}d${faces}`).join(' + ')
  if (!bonus) return dice
  return `${dice} ${bonus < 0 ? '−' : '+'} ${Math.abs(bonus)}`
}

/**
 * What a plain roll is called where it's shown, as hit dice are, "Hit dice (2d10)": "Dice (2d6 +
 * 1d8 + 2)". Foundry's card says "Dice roll".
 */
export function plainRollLabel(plainRoll: PlainRollInput): string {
  return `Dice (${plainRollFormula(plainRoll)})`
}

/** Whose Sending Stone module makes the game's rolls, as each seat reads it. */
const MODULE_OF: Record<SeatRole, string> = {
  player: 'Your Gamemaster’s Sending Stone module',
  gm: 'Your Sending Stone module',
}

/**
 * Whether the dice picked are made in the Gamemaster's game too, as the seat reads it, and if not,
 * why: the game takes them and this device sends them; the game takes them, but Send to the table
 * is off here; the game takes other rolls, from a module before 0.44.0, which makes none of these;
 * or it takes none from here now.
 * @param kinds - The rolls the game takes from the seat now, as its view says (`rollsToTable`).
 * @param sending - Whether this device sends rolls to the table, as its settings say.
 */
export function plainRollReach(
  kinds: readonly RollKind[],
  sending: boolean,
  role: SeatRole,
): string {
  const { game, notSent } = seatWords(role)
  if (kinds.includes('plainRoll')) {
    return sending
      ? `Made in ${game} too, with the same dice.`
      : 'Only you see these dice: Send to the table is off in Settings.'
  }
  if (kinds.length > 0) {
    return `${MODULE_OF[role]} makes these from version 0.44.0.`
  }
  return notSent
}
