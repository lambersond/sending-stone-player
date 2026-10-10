import { HIT_DIE } from '@/constants/sending-stone'
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

/** Is this a size of hit die the game has, which a hit die spent there can be, such as "d10"? */
export function spendable({ die }: Pick<HitDicePool, 'die'>): boolean {
  return HIT_DIE.test(die)
}

/**
 * A character's hit dice by size, largest first, as dnd5e's sheet shows them: those of every class
 * with that size of hit die added together.
 */
export function hitDicePools(classes: SheetClass[]): HitDicePool[] {
  const pools = new Map<string, HitDicePool>()
  for (const { hitDice } of classes) {
    if (!hitDice || !spendable(hitDice)) continue
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
 * Hit dice of one size spent, as dnd5e rolls each: the die, and the character's Constitution
 * modifier, giving back at least 1 hit point, or at least none under the 2014 rules. Several spent
 * at once are thrown together, each giving back its own, at least its least.
 * @param count - How many, one unless said.
 */
export function hitDieRoll(
  sheet: Pick<CharacterSheet, 'abilities' | 'rules'>,
  die: string,
  count = 1,
): SheetFormulaRoll {
  const con = conOf(sheet)
  const sides = sizeOf(die)
  return {
    label: count > 1 ? `Hit dice (${count}${die})` : `Hit die (${die})`,
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
    ...(count > 1 && { times: count }),
    source: { kind: 'hitDie', denomination: die },
  }
}

/**
 * What hit dice of one size spent at once give back, as a formula: the dice, and the character's
 * Constitution modifier for each, such as "3d8 + 9", or "3d8 − 3" for a modifier of −1.
 */
export function hitDiceFormula(
  sheet: Pick<CharacterSheet, 'abilities'>,
  die: string,
  count: number,
): string {
  const added = conOf(sheet) * count
  const dice = `${count}${die}`
  if (added === 0) return dice
  return `${dice} ${added < 0 ? '−' : '+'} ${Math.abs(added)}`
}

/**
 * Is the character at full hit points, where a hit die spent would give back nothing? As far as
 * the sheet says: at their maximum, which from module 0.17.0 is the one dnd5e heals up to, with any
 * temporary change to it. An older module's leaves that out, so above it, which only one raising
 * it allows, some may still be missing, and they aren't known to be full.
 */
export function atFullHitPoints({ hp }: Pick<CharacterSheet, 'hp'>): boolean {
  return !!hp && hp.value === hp.max
}

/** The character's Constitution modifier, which each hit die spent adds; none where unknown. */
function conOf({ abilities }: Pick<CharacterSheet, 'abilities'>): number {
  return abilities.find(({ id }) => id === 'con')?.mod ?? 0
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
