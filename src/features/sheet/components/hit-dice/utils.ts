import {
  hitDicePools,
  hitDieRoll,
  hitDiceRoll,
  hitDiceFormula,
  atFullHitPoints,
} from '@/utils/formulas'
import type { HitDieSpending } from './types'
import type { HitDiceCount, SheetFormulaRoll, HitDicePool } from '@/types/roll'
import type { TableSheet } from '@/types/table'

/** How a sheet's hit dice are spent, given what rolls them; none where nothing rolls them. */
export function hitDieSpending(
  sheet: TableSheet,
  onRollFormula?: (roll: SheetFormulaRoll) => void,
): HitDieSpending | undefined {
  if (!onRollFormula) return
  return {
    pools: hitDicePools(sheet.classes),
    onSpend: counts => {
      const spent = counts.filter(({ count }) => count > 0)
      const total = spent.reduce((all, { count }) => all + count, 0)
      if (total === 0) return
      onRollFormula(
        total === 1
          ? hitDieRoll(sheet, spent[0].die)
          : hitDiceRoll(sheet, spent),
      )
    },
    formula: counts => hitDiceFormula(sheet, counts),
    full: atFullHitPoints(sheet),
  }
}

/** A class's hit dice as its row says them: "Hit dice 3/5 d10", a dash for a count unknown. */
export function hitDiceText(pool: HitDicePool): string {
  return `Hit dice ${countOf(pool)} ${pool.die}`
}

/** How many are left, of how many: "3/5", a dash for a count unknown. */
export function countOf({ value, max }: HitDicePool): string {
  return `${value ?? '–'}/${max ?? '–'}`
}

/** The character's hit dice by size, with a button's own, should they leave its size out. */
export function withPool(
  pools: HitDicePool[],
  pool: HitDicePool,
): HitDicePool[] {
  if (pools.some(({ die }) => die === pool.die)) return pools
  return [...pools, pool].toSorted(
    (a, b) => Number(b.die.slice(1)) - Number(a.die.slice(1)),
  )
}

/** How many are left, such as "3 of 5 left", saying a count the sheet doesn't know so. */
export function leftOf({ value, max }: HitDicePool, unknown: string): string {
  const left = value ?? unknown
  return max === null ? `${left} left` : `${left} of ${max} left`
}

/**
 * How many of a size may be spent at once: as many as are left, or where the sheet doesn't say, as
 * many as there are.
 */
export function mostOf({ value, max }: HitDicePool): number {
  return value ?? max ?? 1
}

/** What spending these of one size is, after how many, for a screen reader: " d8 hit dice". */
export function spentOne(die: string, count: number): string {
  return ` ${die} hit ${count === 1 ? 'die' : 'dice'}`
}

/**
 * What spending these of every size is, after how many, for a screen reader: " hit dice: 2d10 and
 * 1d8", or of one die alone, " d10 hit die".
 */
export function spentOf(counts: HitDiceCount[], total: number): string {
  const spent = counts.filter(({ count }) => count > 0)
  if (total === 1) return spentOne(spent[0].die, 1)
  const dice = spent.map(({ die, count }) => `${count}${die}`)
  if (dice.length === 0) return ' hit dice'
  const listed =
    dice.length > 1
      ? `${dice.slice(0, -1).join(', ')} and ${dice.at(-1)}`
      : dice[0]
  return ` hit dice: ${listed}`
}
