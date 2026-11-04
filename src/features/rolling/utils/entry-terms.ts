import { damageTerm } from '@/features/rolling/utils/local-rolls'
import type { DiceEntryTerm } from '@/types/dice-entry'
import type { SheetDamageRoll, SheetFormulaRoll } from '@/types/roll'

/*
 * The dice a roll asks the player for, while they type in their own (module 0.32.0): each term's,
 * named as the tray writes it; and what's typed in so far.
 */

/** What's typed in so far, each term's dice as typed, those not yet left out. */
export function typedSoFar(values: (number | undefined)[][]): number[][] {
  return values.map(term =>
    term.filter((value): value is number => value !== undefined),
  )
}

/**
 * Damage's dice for the player to type in: each term's, its count doubled where the app doubles
 * it, named as the tray writes it, with its part's kind, such as "2d6 Slashing" or "−1d4".
 */
export function damageEntryTerms(
  parts: SheetDamageRoll['parts'],
  doubled: boolean,
): DiceEntryTerm[] {
  let first = true
  return parts.flatMap(({ terms, type }) =>
    terms.flatMap(term => {
      const text = damageTerm(term, { first, doubled })
      first = false
      if (!('sides' in term)) return []
      return [
        {
          sides: term.sides,
          count: doubled ? term.count * 2 : term.count,
          label: type ? `${text} ${type}` : text,
        },
      ]
    }),
  )
}

/**
 * A formula's dice for the player to type in: each term's, as the tray writes it; or, thrown in
 * sets, as hit dice spent at once are, each set's term's every time's together, such as "2d10".
 */
export function formulaEntryTerms(
  request: SheetFormulaRoll,
  sets: NonNullable<SheetFormulaRoll['sets']>,
): DiceEntryTerm[] {
  if (!request.sets) {
    return request.terms.flatMap((term, index) =>
      'sides' in term
        ? [
            {
              sides: term.sides,
              count: term.count,
              label: damageTerm(term, { first: index === 0, doubled: false }),
            },
          ]
        : [],
    )
  }
  const terms: DiceEntryTerm[] = []
  for (const { terms: each, times } of sets) {
    for (const term of each) {
      if (!('sides' in term)) continue
      const count = term.count * times
      terms.push({
        sides: term.sides,
        count,
        label: damageTerm(
          { ...term, count },
          { first: terms.length === 0, doubled: false },
        ),
      })
    }
  }
  return terms
}
