import {
  hitDicePools,
  hitDieRoll,
  hitDiceRoll,
  hitDiceFormula,
  atFullHitPoints,
} from '@/utils/formulas'
import type { HitDieSpending } from './types'
import type { SheetFormulaRoll, HitDicePool } from '@/types/roll'
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
