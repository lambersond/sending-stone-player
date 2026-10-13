import { DIE_SIDES, type DieSides } from '@lambersond/3d-dice-core'
import { HIT_DIE } from '@/constants/sending-stone'
import { readModifier, splitModifiers } from '@/utils/dice-modifiers'
import {
  MAX_DICE,
  MAX_FLAT,
  type ExtraDice,
  type ExtraTerm,
} from '@/utils/roll-modifiers'
import type { SheetFormulaRoll } from '@/hooks/use-sheet-roller'
import type { CharacterSheet, SheetClass } from '@/types/sending-stone'

/**
 * Rolls with no d20 the sheet makes: the hit dice a character spends, and the formulas of its
 * items' activities, such as a light's radius.
 */

/**
 * A sign or a comma (or the start), then dice such as 2d6 with what Foundry does with them after
 * their faces, such as r<=2, or a number; either with a flavor after it, such as [fire].
 */
const FORMULA_TERM =
  /\s*(,)?\s*([+-])?\s*(?:(\d*)\s*[dD]\s*(\d+)([^\s()[\]{}+\-*/,]*)|(\d+))\s*(?:\[[^\]]*\])?\s*/y

/**
 * A formula's terms, such as 1d4 + 3 or a sheet's 2d6r<=2 + 7, as the app throws them, read as the
 * player's own extras are (`parseExtraTerms`), with a flavor after a term, such as [fire], left
 * out, and each die's modifiers, as Foundry splits them, where it reads every one
 * (`readModifier`). None for one it can't read: such as one with brackets, a function, a die it
 * hasn't, or a modifier it doesn't work out, which is shown, never rolled here.
 */
export function formulaTerms(formula: string): ExtraTerm[] | undefined {
  const text = formula.replaceAll('−', '-').trim()
  const terms: ExtraTerm[] = []
  let index = 0
  while (index < text.length) {
    FORMULA_TERM.lastIndex = index
    const match = FORMULA_TERM.exec(text)
    const [, comma, sign, count, sides, written = '', flat] = match ?? []
    const joined = terms.length === 0 ? !comma : Boolean(comma || sign)
    if (!match || !joined) return
    const signed = sign === '-' ? -1 : 1
    if (flat === undefined) {
      const dice = count ? Number(count) : 1
      const die = Number(sides)
      if (!(DIE_SIDES as readonly number[]).includes(die)) return
      if (dice < 1 || dice > MAX_DICE) return
      const modifiers = written === '' ? [] : splitModifiers(written)
      if (!modifiers?.every(each => readModifier(each, die))) return
      terms.push({
        sign: signed,
        count: dice,
        sides: die as DieSides,
        ...(modifiers.length > 0 && { modifiers }),
      })
    } else {
      const value = Number(flat)
      if (value > MAX_FLAT) return
      terms.push({ sign: signed, flat: value })
    }
    index = FORMULA_TERM.lastIndex
  }
  return terms.length > 0 ? terms : undefined
}

/**
 * The dice a formula throws, in order, each term's first throw: a die Foundry rerolls or explodes
 * is thrown again after; none for one the app can't read.
 */
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

/** Hit dice of one size chosen to spend at once: the size, such as "d10", and how many. */
export type HitDiceCount = { die: string; count: number }

/**
 * A hit die spent, as dnd5e rolls it: the die, and the character's Constitution modifier, giving
 * back at least 1 hit point, or at least none under the 2014 rules.
 */
export function hitDieRoll(
  sheet: Pick<CharacterSheet, 'abilities' | 'rules'>,
  die: string,
): SheetFormulaRoll {
  return {
    label: `Hit die (${die})`,
    terms: hitDieTerms(sheet, die),
    healing: true,
    minimum: leastOf(sheet),
    source: { kind: 'hitDie', denomination: die },
  }
}

/**
 * Hit dice spent at once, of one size or more, as dnd5e rolls each: thrown together, the largest
 * first, each die with the character's Constitution modifier, giving back its own, at least its
 * least. For the game, they're spent in the same order. Those of a size with none chosen are left
 * out. For two dice or more in all: one die alone is `hitDieRoll`'s, as a hit die spent is.
 */
export function hitDiceRoll(
  sheet: Pick<CharacterSheet, 'abilities' | 'rules'>,
  counts: HitDiceCount[],
): SheetFormulaRoll {
  const spent = spentOf(counts)
  return {
    label: `Hit dice (${diceOf(spent)})`,
    terms: [],
    sets: spent.map(({ die, count }) => ({
      terms: hitDieTerms(sheet, die),
      times: count,
    })),
    healing: true,
    minimum: leastOf(sheet),
    source: {
      kind: 'hitDice',
      hitDice: spent.map(({ die, count }) => ({ denomination: die, count })),
    },
  }
}

/**
 * What hit dice spent at once give back, as a formula: the dice, the largest first, and the
 * character's Constitution modifier for each, such as "2d10 + 1d8 + 9", or "3d8 − 3" for a
 * modifier of −1; "0" for none.
 */
export function hitDiceFormula(
  sheet: Pick<CharacterSheet, 'abilities'>,
  counts: HitDiceCount[],
): string {
  const spent = spentOf(counts)
  if (spent.length === 0) return '0'
  const added = conOf(sheet) * spent.reduce((all, { count }) => all + count, 0)
  const dice = diceOf(spent)
  if (added === 0) return dice
  return `${dice} ${added < 0 ? '−' : '+'} ${Math.abs(added)}`
}

/** A hit die's terms, as dnd5e rolls it: the die, and the character's Constitution modifier. */
function hitDieTerms(
  sheet: Pick<CharacterSheet, 'abilities'>,
  die: string,
): ExtraTerm[] {
  const con = conOf(sheet)
  return [
    { sign: 1, count: 1, sides: sizeOf(die) } as ExtraDice,
    ...(con === 0
      ? []
      : [
          {
            sign: con < 0 ? (-1 as const) : (1 as const),
            flat: Math.abs(con),
          },
        ]),
  ]
}

/** The least a hit die gives back: 1, or none under the 2014 rules. */
function leastOf({ rules }: Pick<CharacterSheet, 'rules'>): number {
  return rules === 'legacy' ? 0 : 1
}

/** Hit dice chosen to spend, the sizes with none chosen left out, the largest first. */
function spentOf(counts: HitDiceCount[]): HitDiceCount[] {
  return counts
    .filter(({ count }) => count > 0)
    .toSorted((a, b) => sizeOf(b.die) - sizeOf(a.die))
}

/** Hit dice as thrown, such as "2d10 + 1d8". */
function diceOf(spent: HitDiceCount[]): string {
  return spent.map(({ die, count }) => `${count}${die}`).join(' + ')
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
