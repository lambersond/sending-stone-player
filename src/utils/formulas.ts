import {
  parseExtraTerms,
  type ExtraDice,
  type ExtraTerm,
} from '@/utils/roll-modifiers'
import type { SheetFormulaRoll } from '@/hooks/use-sheet-roller'
import type { CharacterSheet, SheetClass } from '@/types/sending-stone'

/**
 * Rolls with no d20 the sheet makes: the hit dice a character spends, and the formulas of its
 * items' activities, such as a light's radius.
 */

/** A formula's terms, such as 1d4 + 3, as the app throws them; none for one it can't read. */
export function formulaTerms(formula: string): ExtraTerm[] | undefined {
  const read = parseExtraTerms(formula)
  return read.ok && read.terms.length > 0 ? read.terms : undefined
}

/** The dice a formula throws, in order; none for one the app can't read. */
export function formulaDice(formula: string): ExtraDice[] | undefined {
  return formulaTerms(formula)?.filter(
    (term): term is ExtraDice => 'sides' in term,
  )
}

/** A character's hit dice of one size: how many are left, of how many, where the sheet says. */
export type HitDicePool = {
  /** Such as "d10". */
  die: string
  value: number | null
  max: number | null
}

/**
 * A character's hit dice by size, largest first, as dnd5e's sheet shows them: those of every class
 * with that size of hit die added together.
 */
export function hitDicePools(classes: SheetClass[]): HitDicePool[] {
  const pools = new Map<string, HitDicePool>()
  for (const { hitDice } of classes) {
    if (!hitDice) continue
    const pool = pools.get(hitDice.die)
    pools.set(
      hitDice.die,
      pool
        ? {
            die: hitDice.die,
            value: sum(pool.value, hitDice.value),
            max: sum(pool.max, hitDice.max),
          }
        : { ...hitDice },
    )
  }
  return [...pools.values()].toSorted((a, b) => sizeOf(b.die) - sizeOf(a.die))
}

/**
 * A hit die spent, as dnd5e rolls it: the die, and the character's Constitution modifier, giving
 * back at least 1 hit point, or at least none under the 2014 rules.
 */
export function hitDieRoll(
  sheet: Pick<CharacterSheet, 'abilities' | 'rules'>,
  die: string,
): SheetFormulaRoll {
  const con = sheet.abilities.find(({ id }) => id === 'con')?.mod ?? 0
  const sides = sizeOf(die)
  return {
    label: `Hit die (${die})`,
    terms: [
      { sign: 1, count: 1, sides } as ExtraDice,
      ...(con === 0
        ? []
        : [
            {
              sign: con < 0 ? (-1 as const) : (1 as const),
              flat: Math.abs(con),
            },
          ]),
    ],
    healing: true,
    minimum: sheet.rules === 'legacy' ? 0 : 1,
    source: { kind: 'hitDie', denomination: die },
  }
}

/** A die's size, such as 10 for "d10". */
function sizeOf(die: string): number {
  return Number(die.slice(1)) || 0
}

/** Two counts added, where both are known. */
function sum(a: number | null, b: number | null): number | null {
  // eslint-disable-next-line unicorn/no-null -- the sheet's for a count it doesn't know
  return a === null || b === null ? null : a + b
}
