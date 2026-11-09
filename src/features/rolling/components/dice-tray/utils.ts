import { MOST_PLAIN_DICE } from '@/constants/sending-stone'
import { plainRollFormula, plainRollLabel } from '@/utils/plain-roll-words'
import { MAX_FLAT } from '@/utils/roll-modifiers'
import type { TrayButton, TrayDie } from './types'
import type { DieSides as IconSides } from '@/components/icons/types'
import type { ExtraTerm, PlainRollInput, SheetFormulaRoll } from '@/types/roll'
import type { DieSides } from '@lambersond/3d-dice-core'

/*
 * The chat's dice tray (v0.44): the dice the player picks, any mix of sizes, and a number added,
 * as the game takes them from module 0.44.0 (`plainRoll`): no more than 20 dice in all, and a
 * number from −100 to +100.
 */

/**
 * The tray's dice, smallest first, as the game is sent them: the dice library's tray keeps them in
 * the order each size was first added.
 */
export function trayDice(pools: readonly TrayDie[]): TrayDie[] {
  return pools.toSorted((a, b) => a.sides - b.sides)
}

/** Whether one more die may be added: no more than 20 in all. */
export function roomFor(dice: readonly TrayDie[]): boolean {
  return dice.reduce((all, { count }) => all + count, 0) < MOST_PLAIN_DICE
}

/** Whether the number added may go one up (`1`) or one down (`-1`): from −100 to +100. */
export function canStep(bonus: number, by: 1 | -1): boolean {
  return Math.abs(bonus + by) <= MAX_FLAT
}

/**
 * Where keyboard focus goes as the last die of a size is taken away, its chip and both its buttons
 * going with it: the next chip's One fewer, else the one before's, else, with no dice left, that
 * size's Add. Nowhere while the size keeps a die, its chip staying.
 */
export function focusOnRemoving(
  dice: readonly TrayDie[],
  sides: DieSides,
): TrayButton | undefined {
  const at = dice.findIndex(die => die.sides === sides)
  if (at === -1 || dice[at].count > 1) return undefined
  const beside = dice[at + 1] ?? dice[at - 1]
  return beside
    ? { button: 'fewer', sides: beside.sides }
    : { button: 'add', sides }
}

/** A die's shape, as the app draws it: a d100 as a d10, which it has none of its own for. */
export function iconSides(sides: DieSides): IconSides {
  return sides === 100 ? 10 : sides
}

/** What the tray rolls, as the game is sent it: each size and how many, and any number added. */
export function plainRollOf(
  dice: readonly TrayDie[],
  bonus: number,
): PlainRollInput {
  return {
    terms: dice.map(({ sides, count }) => ({ faces: sides, count })),
    ...(bonus !== 0 && { bonus }),
  }
}

/**
 * The tray's roll as a sheet's formula is rolled, "Dice (2d6 + 1d8 + 2)": its dice, a term each
 * size, then the number added, if any; for the game to make it too, as a plain roll.
 */
export function toPlainRoll(
  dice: readonly TrayDie[],
  bonus: number,
): SheetFormulaRoll {
  const plainRoll = plainRollOf(dice, bonus)
  const flat: ExtraTerm[] =
    bonus === 0 ? [] : [{ sign: bonus < 0 ? -1 : 1, flat: Math.abs(bonus) }]
  return {
    label: plainRollLabel(plainRoll),
    terms: [
      ...dice.map(({ sides, count }) => ({ sign: 1 as const, count, sides })),
      ...flat,
    ],
    source: { kind: 'plainRoll', plainRoll },
  }
}

/** What the tray's Roll says: "Roll 2d6 + 1d8 + 2", or with no dice yet, "Pick dice to roll". */
export function rollName(dice: readonly TrayDie[], bonus: number): string {
  if (dice.length === 0) return 'Pick dice to roll'
  return `Roll ${plainRollFormula(plainRollOf(dice, bonus))}`
}
