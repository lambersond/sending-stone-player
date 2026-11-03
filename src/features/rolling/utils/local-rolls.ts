import {
  executeRoll,
  type DiePool,
  type ExecuteRollOptions,
  type RollResult,
} from '@lambersond/3d-dice-core'
import { ROLL_HISTORY } from '@/features/rolling/constants'
import { withoutRerolls } from '@/features/rolling/utils/effect-dice'
import { throwTerm } from '@/utils/dice-modifiers'
import { formatExtraTerm } from '@/utils/roll-modifiers'
import type { More, TypedEffect } from '@/features/rolling/types'
import type {
  SheetDamageRoll,
  LocalCheck,
  LocalDamage,
  SheetFormulaRoll,
  LocalFormula,
  LocalRoll,
  LocalExtra,
  ExtraDice,
  ExtraTerm,
  SheetOffer,
} from '@/types/roll'

/*
 * The sheet's rolls as this page keeps them (`useSheetRoller`), from their dice as thrown or typed
 * in: a check's or save's, damage's and a formula's, with the dice Foundry would throw again, the
 * dice effects add and those offered; and the rolls kept, newest first.
 */

/**
 * A d20 roll with the dice its effects add that the player typed in, from module 0.42.0: each
 * after the player's own extras, so that those keep their places, which the game's dice are read
 * by, named by what adds it, such as "Bless +1d4", and added to the total, or taken from it, by
 * its sign, as the app's own dice of the roll are all added; and the dice as the game is sent them.
 * A die skipped is the game's: neither among them nor in the total, which says so.
 */
export function withEffects(
  check: LocalCheck,
  effects: TypedEffect[],
): LocalCheck {
  if (effects.length === 0) return check
  const typed = effects.filter(({ values }) => values.length > 0)
  const added = typed.map(({ die, values }) => ({
    text: `${die.name} ${formatExtraTerm({ sign: die.sign, count: die.count, sides: die.faces })}`,
    values,
    value: die.sign * values.reduce((sum, value) => sum + value, 0),
  }))
  return {
    ...check,
    extras: [...check.extras, ...added],
    total: added.reduce((total, { value }) => total + value, check.total),
    ...(typed.length > 0 && {
      effectDice: typed.map(({ die, values }) => ({
        faces: die.faces,
        sign: die.sign,
        results: values,
      })),
    }),
    ...(typed.length < effects.length && { skipped: true as const }),
  }
}

/** The dice offered that the player added, from module 0.42.1, as the roll's extras send them. */
export function offerTerms(added: readonly SheetOffer[]): ExtraTerm[] {
  return added.map(({ die }) => ({
    sign: 1,
    count: die.count,
    sides: die.faces,
  }))
}

/**
 * A d20 roll with the dice offered that the player added, from module 0.42.1, such as Bardic
 * Inspiration's: among its extras already, after the player's own, as the game is sent them; each
 * named by what offers it, as "Bardic Inspiration +1d6", as an effect's die is.
 * @param from - Where they start among the extras: after the player's own.
 */
export function withOffers(
  check: LocalCheck,
  from: number,
  added: readonly SheetOffer[],
): LocalCheck {
  if (added.length === 0) return check
  return {
    ...check,
    extras: check.extras.map((extra, at) => {
      const offer = at >= from ? added[at - from] : undefined
      return offer
        ? { ...extra, text: `${offer.die.name} ${extra.text}` }
        : extra
    }),
  }
}

export function toLocalRoll(
  label: string,
  result: RollResult,
  extras: ExtraTerm[],
  extra: RollResult | undefined,
): LocalCheck {
  const [d20] = result.pools
  // The extra dice's pools are in the order their terms were written.
  const pools = [...(extra?.pools ?? [])]
  const added = extras.map(term => {
    const values = 'sides' in term ? (pools.shift()?.kept ?? []) : []
    const amount =
      'sides' in term
        ? values.reduce((sum, value) => sum + value, 0)
        : term.flat
    return {
      text: formatExtraTerm(term),
      values,
      value: term.sign * amount,
    }
  })
  return {
    kind: 'check',
    id: result.id,
    label,
    total: added.reduce((total, { value }) => total + value, result.total),
    modifier: result.modifier,
    advantage: result.advantage,
    d20s: d20.rolls[0],
    natural: d20.kept[0],
    extras: added,
    at: result.at,
  }
}

/**
 * A hit die spent, or a formula rolled, as this page keeps it, from its dice as thrown: each set's
 * pools in the order their sets and terms were written, each with every time's dice, the first's
 * first.
 * @param more - Throws the dice Foundry would throw again, rerolled or exploded.
 * @param rerollsKept - Its dice were typed as kept once rerolled at the table (module 0.42.0).
 */
export function toLocalFormula(
  request: SheetFormulaRoll,
  sets: NonNullable<SheetFormulaRoll['sets']>,
  result: RollResult,
  more: More,
  rerollsKept = false,
): LocalFormula {
  const { label, healing = false, minimum } = request
  const pools = [...result.pools]
  const thrown = sets.map(({ terms }) =>
    terms.map(term => ('sides' in term ? (pools.shift()?.kept ?? []) : [])),
  )
  // Only a formula thrown once has dice thrown again, never hit dice.
  const kept: LocalExtra[] = request.sets
    ? setTerms(sets, thrown)
    : request.terms.map((term, index) => {
        const text = damageTerm(term, {
          first: index === 0,
          doubled: false,
        })
        if (!('sides' in term)) {
          return { text, values: [], value: term.sign * term.flat }
        }
        const done = landTerm(term, thrown[0][index], more, rerollsKept)
        return { text, ...done.extra, value: term.sign * done.amount }
      })
  const sum = kept.reduce((total, { value }) => total + value, 0)
  const totals = request.sets
    ? formulaTotals(sets, thrown, minimum)
    : [minimum === undefined ? sum : Math.max(minimum, sum)]
  const total = totals.reduce((all, each) => all + each, 0)
  return {
    kind: 'formula',
    id: result.id,
    label,
    total,
    healing,
    terms: kept,
    ...(total !== sum && { minimum }),
    ...(totals.length > 1 && { times: totals.length }),
    ...(request.source?.kind === 'textRoll' && { described: true }),
    ...(rethrown(kept) && { gameTotal: true }),
    // Thrown or typed in, a recharge's d6 is titled by what it recharges, as the game answers.
    ...(request.recharge && {
      recharge: { name: request.label.replace(/ recharge$/, '') },
    }),
    at: result.at,
  }
}

/**
 * What each time each set is thrown came to, at least its least, as hit dice spent at once each
 * give back at least 1.
 * @param thrown - Each set's dice, term by term, every time's together, the first's first.
 */
function formulaTotals(
  sets: NonNullable<SheetFormulaRoll['sets']>,
  thrown: number[][][],
  minimum: number | undefined,
): number[] {
  return sets.flatMap(({ terms, times }, set) =>
    Array.from({ length: times }, (_, time) => {
      let sum = 0
      for (const [index, term] of terms.entries()) {
        const amount =
          'sides' in term
            ? thrown[set][index]
                .slice(time * term.count, (time + 1) * term.count)
                .reduce((sum, value) => sum + value, 0)
            : term.flat
        sum += term.sign * amount
      }
      return minimum === undefined ? sum : Math.max(minimum, sum)
    }),
  )
}

/**
 * No dice thrown again: the player's are typed in, and Foundry throws its rerolls itself. Whether
 * any was asked for says the game's total counts, once it says.
 */
export function noRethrows() {
  let asked = false
  const none = (): number[] => {
    asked = true
    return []
  }
  const more: More = () => none
  return { more, asked: () => asked }
}

/**
 * The dice thrown again, rerolled or exploded, after the first throw: `more` throws them, as the
 * first throw was, and `with` adds them to it, to be thrown with it, as extra dice are.
 */
export function rethrows(options?: ExecuteRollOptions) {
  const pools: DiePool[] = []
  const more: More = sides => count => {
    const thrown = executeRoll(
      { pools: [{ sides, count }], modifier: 0 },
      options,
    )
    pools.push(...thrown.pools)
    return thrown.pools[0]?.kept ?? []
  }
  return {
    more,
    with: (result: RollResult): RollResult =>
      pools.length > 0
        ? { ...result, pools: [...result.pools, ...pools] }
        : result,
  }
}

/**
 * A term of dice as it landed: what its dice count for, as Foundry works out any modifiers they
 * have, such as 2d6r<=2's reroll, which throws more after; its first throw, and every die thrown
 * where it has modifiers.
 * @param rerollsKept - Its dice were typed as kept once rerolled at the table, from module 0.42.0:
 * without its rerolls, which the game drops too, and with the rest, as what it explodes or counts
 * at least.
 */
function landTerm(
  term: ExtraDice,
  values: number[],
  more: More,
  rerollsKept = false,
): { amount: number; extra: Pick<LocalExtra, 'values' | 'thrown'> } {
  const landing = rerollsKept ? withoutRerolls(term) : term
  if (!landing.modifiers?.length) {
    return {
      amount: values.reduce((sum, value) => sum + value, 0),
      extra: { values },
    }
  }
  const thrown = throwTerm(landing, values, more(term.sides))
  return {
    amount: thrown.total,
    extra: { values, thrown: thrown.dice },
  }
}

/** Does a term reroll any of its dice, such as 2d6r<=2? */
export function rerolls(term: ExtraDice): boolean {
  return withoutRerolls(term) !== term
}

/** Was any die of these terms rerolled or exploded, which Foundry throws again itself? */
export function rethrown(terms: LocalExtra[]): boolean {
  return terms.some(({ thrown }) =>
    thrown?.some(die => die.rerolled || die.exploded),
  )
}

export function toLocalDamage(
  label: string,
  parts: SheetDamageRoll['parts'],
  result: RollResult,
  {
    critical,
    healing,
    doubled,
    maximized,
  }: {
    critical: boolean
    healing: boolean
    doubled: boolean
    maximized: boolean
  },
  more: More,
  rerollsKept = false,
): LocalDamage {
  // The dice's pools are in the order their terms were written.
  const pools = [...result.pools]
  let first = true
  const kept = parts.map(({ terms, type }) => {
    const done = terms.map((term): LocalExtra => {
      const text = damageTerm(term, { first, doubled })
      first = false
      if (!('sides' in term)) {
        return { text, values: [], value: term.sign * term.flat }
      }
      const landed = landTerm(
        term,
        pools.shift()?.kept ?? [],
        more,
        rerollsKept,
      )
      return { text, ...landed.extra, value: term.sign * landed.amount }
    })
    return {
      type,
      total: done.reduce((sum, { value }) => sum + value, 0),
      terms: done,
    }
  })
  // As dnd5e's card adds damage up: each kind's parts together, each kind at least 0, then every
  // kind; each part's own total as it came.
  const kinds = new Map<string | null, number>()
  for (const { type, total } of kept) {
    kinds.set(type, (kinds.get(type) ?? 0) + total)
  }
  return {
    kind: 'damage',
    id: result.id,
    label,
    total: [...kinds.values()].reduce(
      (sum, kind) => sum + Math.max(0, kind),
      0,
    ),
    critical,
    healing,
    ...(maximized && { maximized }),
    parts: kept,
    at: result.at,
  }
}

/**
 * Sets thrown at once, as hit dice spent at once, term by term: each set's dice, every time's
 * together, such as 2d10, then +1d8, in order; then all of their numbers added up, such as +9,
 * where they come to any.
 */
function setTerms(
  sets: NonNullable<SheetFormulaRoll['sets']>,
  thrown: number[][][],
): LocalExtra[] {
  const dice: LocalExtra[] = []
  let flat = 0
  for (const [set, { terms, times }] of sets.entries()) {
    for (const [index, term] of terms.entries()) {
      if (!('sides' in term)) {
        flat += term.sign * term.flat * times
        continue
      }
      const values = thrown[set][index]
      dice.push({
        text: damageTerm(
          { ...term, count: term.count * times },
          { first: dice.length === 0, doubled: false },
        ),
        values,
        value: term.sign * values.reduce((sum, value) => sum + value, 0),
      })
    }
  }
  if (flat === 0) return dice
  return [
    ...dice,
    {
      text: damageTerm(
        { sign: flat < 0 ? -1 : 1, flat: Math.abs(flat) },
        { first: dice.length === 0, doubled: false },
      ),
      values: [],
      value: flat,
    },
  ]
}

/**
 * A term of a damage roll as thrown: 1d8 first, then +4 or −1d4, its dice doubled on a crit, with
 * what Foundry does with them, such as 2d6r<=2.
 */
export function damageTerm(
  term: ExtraTerm,
  { first, doubled }: { first: boolean; doubled: boolean },
): string {
  let sign = first ? '' : '+'
  if (term.sign < 0) sign = '−'
  if ('flat' in term) return `${sign}${term.flat}`
  const count = doubled ? term.count * 2 : term.count
  return `${sign}${count}d${term.sides}${term.modifiers?.join('') ?? ''}`
}

/**
 * The rolls kept, and another, newest first by when each was thrown rather than when its dice
 * landed: a roll thrown while the dice of one before it still tumble is the latest, should they
 * land after it.
 */
export function keeping(earlier: LocalRoll[], roll: LocalRoll): LocalRoll[] {
  return [roll, ...earlier]
    .toSorted((a, b) => b.at - a.at)
    .slice(0, ROLL_HISTORY)
}

/** Wait for a promise, but no longer than this many milliseconds. */
export async function within(promise: Promise<unknown>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise(resolve => {
    timer = setTimeout(resolve, ms)
  })
  try {
    await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
