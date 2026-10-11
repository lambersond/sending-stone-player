import { MAX_DAMAGE_TERMS } from '@/constants/sending-stone'
import { formulaTerms } from '@/utils/formulas'
import { MAX_DICE, type ExtraTerm } from '@/utils/roll-modifiers'
import type {
  CriticalRule,
  DamagePreview,
  DamagePreviewRoll,
} from '@/types/sending-stone'
import type { DamageLink } from '@/utils/description-links'

/*
 * Changing damage or healing as it's rolled, as dnd5e's damage dialog lets a player: more of its
 * first die, as a spell cast at a higher level throws; that die another size, as a versatile weapon
 * held in two hands, or Toll the Dead at a creature that's hurt; or every die at its highest.
 */

/** How a player changes damage or healing as they roll it. Each changes nothing unless set. */
export type DamageModifiers = {
  /** How many more of its first die. */
  extra?: number
  /** The size its first die is made instead, such as 12 for a d12. */
  faces?: DieSize
  /** Every die at its highest. */
  maximize?: boolean
}

/** The sizes a die of damage may be made. */
export const DIE_SIZES = [4, 6, 8, 10, 12] as const

export type DieSize = (typeof DIE_SIZES)[number]

/** The most of one die a roll of damage may throw, a critical hit's dice doubled. */
export const MOST_DICE = MAX_DICE * 2

/** A part of damage, as rolled: its terms, such as 1d8 and +4. */
type Part = { terms: ExtraTerm[] }

/**
 * What a critical hit adds to each of damage's parts, in order: the extra dice its first die
 * throws, such as Savage Attacks' or Brutal Critical's, and the terms of its critical damage, such
 * as a weapon's 1d6; none, each, where it adds nothing.
 */
export type CriticalAdds = { dice: number[]; damage: ExtraTerm[][] }

/**
 * A critical hit's damage as dnd5e makes it by default, and one rolled here: every die twice, and
 * the extra dice a critical hit adds thrown with them.
 */
export const EVERY_DIE_TWICE: CriticalRule = {
  perDie: 2,
  multiplyNumeric: false,
  powerfulCritical: false,
  altered: false,
  bonusDice: 'rolled',
}

/** Do these change the damage at all? */
export function changes(modifiers?: DamageModifiers): boolean {
  return (
    !!modifiers &&
    ((modifiers.extra ?? 0) > 0 ||
      modifiers.faces !== undefined ||
      modifiers.maximize === true)
  )
}

/** Do these change the damage's dice: more of them, or another size? */
export function reshapes(modifiers?: DamageModifiers): boolean {
  return (modifiers?.extra ?? 0) > 0 || modifiers?.faces !== undefined
}

/**
 * Where damage's first die is, which more dice are added to, or made another size: the first term
 * of dice its first part adds, if any, never the dice of a critical hit's critical damage.
 */
export function firstDie(
  parts: readonly Part[],
): Extract<ExtraTerm, { sides: number }> | undefined {
  const term = parts[0]?.terms.find(
    each => 'sides' in each && each.sign > 0 && !each.added,
  )
  return term && 'sides' in term ? term : undefined
}

/**
 * Damage's parts with its first die changed: more of it, `perDie` more for each one added, as a
 * critical hit's dice the game has already doubled throw two for each; and another size, if chosen.
 * Damage with no first die to change is as it was.
 */
export function withModifiers<P extends Part>(
  parts: P[],
  modifiers: DamageModifiers | undefined,
  perDie = 1,
): P[] {
  const die = firstDie(parts)
  if (!die || !reshapes(modifiers)) return parts
  const [first, ...rest] = parts
  return [
    {
      ...first,
      terms: first.terms.map(term =>
        term === die
          ? {
              ...die,
              count: die.count + (modifiers?.extra ?? 0) * perDie,
              sides: modifiers?.faces ?? die.sides,
            }
          : term,
      ),
    },
    ...rest,
  ]
}

/**
 * The dice an attack's or a use's damage throws, as the game said, changed so: more of its first
 * roll's first die, as many more for each as that roll's `perDie` says, or another size of it;
 * never a die of a critical hit's critical damage, which the game marks. None for damage the game
 * rolls itself; nothing when there's no first die to change.
 */
export function modifiedDice(
  damage: DamagePreview,
  modifiers?: DamageModifiers,
): DamagePreviewRoll['dice'] | undefined {
  const planned = damage.plannable
    ? damage.rolls.flatMap(roll => roll.dice)
    : []
  if (!reshapes(modifiers) || !damage.plannable) return planned
  const [first] = damage.rolls
  // The first roll's dice come first, its first die the first that's its own.
  const at = first?.dice.findIndex(die => !die.added) ?? -1
  if (!first || at < 0) return undefined
  return planned.map((die, index) =>
    index === at
      ? {
          ...die,
          faces: modifiers?.faces ?? die.faces,
          number: die.number + (modifiers?.extra ?? 0) * (first.perDie ?? 1),
        }
      : die,
  )
}

/**
 * The most dice that may be added to damage's first die: as many as keep it within the most one
 * roll may throw, `perDie` for each, as a critical hit's take.
 */
export function mostExtra(parts: readonly Part[], perDie = 1): number {
  const die = firstDie(parts)
  if (!die) return 0
  return Math.max(0, Math.floor((MOST_DICE - die.count) / Math.max(perDie, 1)))
}

/**
 * Damage's parts as a critical hit's, as a world's rules make it: each term of dice thrown
 * `perDie` times; each number twice, where its rules double them; and, under Powerful Critical, the
 * most each part's dice could roll added to it, as dnd5e adds it whatever their sign. Then what a
 * critical hit adds to each part, in dnd5e's order: its extra dice, thrown with its first die, at
 * the size it's made, or the most they could roll added, or left out, as the rules throw them; and
 * its critical damage, as it is, whose dice are never its first die.
 * @param adds - What a critical hit adds to each part; nothing unless said.
 */
export function criticalParts<P extends Part>(
  parts: P[],
  { perDie, multiplyNumeric, powerfulCritical, bonusDice }: CriticalRule,
  adds?: CriticalAdds,
): P[] {
  return parts.map((part, index) => {
    const terms: ExtraTerm[] = part.terms.map(term => {
      if ('sides' in term) return { ...term, count: term.count * perDie }
      return multiplyNumeric ? { ...term, flat: term.flat * 2 } : term
    })
    let most = 0
    if (powerfulCritical) {
      for (const term of part.terms) {
        if ('sides' in term) most += term.count * term.sides
      }
    }
    if (most > 0) terms.push({ sign: 1, flat: most })
    const extra = adds?.dice[index] ?? 0
    const [first] = terms
    if (extra > 0 && first && 'sides' in first && first.sign > 0) {
      if (bonusDice === 'rolled') {
        terms[0] = { ...first, count: first.count + extra }
      } else if (bonusDice === 'maximized') {
        terms.push({ sign: 1, flat: extra * first.sides })
      }
    }
    for (const term of adds?.damage[index] ?? []) {
      terms.push('sides' in term ? { ...term, added: true } : term)
    }
    return { ...part, terms }
  })
}

/**
 * Whether a description's damage may be rolled as a critical hit's, as the world's rules make
 * one, and what a critical hit adds to it, as the game reads its activity: none where nothing is
 * added. Never for healing; for damage the game marks as never one; where the sheet doesn't say how
 * the world makes one; where it adds dice the world's rules don't say how they throw; where it adds
 * extra dice to a part that has no dice of its own first; where a part, or its critical damage,
 * doesn't read; or where it would throw more of one die, or more kinds, than one roll may.
 */
export function criticalOffered(
  link: Pick<DamageLink, 'parts' | 'healing' | 'critical' | 'criticalAdds'>,
  rule: CriticalRule | null | undefined,
): CriticalAdds | false {
  if (link.healing || link.critical === false || !rule) return false
  const parts: Part[] = []
  const dice: number[] = []
  const damage: ExtraTerm[][] = []
  for (const [index, { formula }] of link.parts.entries()) {
    const terms = formulaTerms(formula)
    const added = link.criticalAdds?.damage[index] ?? ''
    const adding = added === '' ? [] : formulaTerms(added)
    if (!terms || !adding) return false
    const extra = link.criticalAdds?.dice[index] ?? 0
    const [first] = terms
    if (extra > 0 && (!('sides' in first) || first.sign < 0)) return false
    parts.push({ terms })
    dice.push(extra)
    damage.push(adding)
  }
  const withDice =
    dice.some(count => count > 0) ||
    damage.some(terms => terms.some(term => 'sides' in term))
  if (withDice && !rule.bonusDice) return false
  const adds = { dice, damage }
  const thrown = criticalParts(parts, rule, adds).flatMap(({ terms }) =>
    terms.filter(term => 'sides' in term),
  )
  if (
    thrown.length > MAX_DAMAGE_TERMS ||
    thrown.some(term => term.count > MOST_DICE)
  ) {
    return false
  }
  return adds
}

/**
 * A description's damage or healing as the game will throw it, as an attack's preview says it: the
 * dice of each of its parts, in order, every one `perDie` times on a critical hit, as the world's
 * rules make it, which take as many more for each die added, with the extra dice a critical hit
 * adds, and then its critical damage's, marked as added. None where a part's formula can't be read,
 * which the app couldn't have rolled.
 * @param critical - How the world rolls a critical hit's, for one; none for damage rolled plainly.
 * @param adds - For a critical hit's, what it adds to each part, as `criticalOffered` has it.
 */
export function linkDamage(
  link: Pick<DamageLink, 'parts' | 'healing'>,
  critical?: CriticalRule,
  adds?: CriticalAdds,
): DamagePreview | undefined {
  const parts: (Part & { formula: string })[] = []
  for (const { formula } of link.parts) {
    const terms = formulaTerms(formula)
    if (!terms) return undefined
    parts.push({ formula, terms })
  }
  const thrown = critical ? criticalParts(parts, critical, adds) : parts
  const rolls: DamagePreviewRoll[] = thrown.map(({ formula, terms }) => ({
    formula,
    // eslint-disable-next-line unicorn/no-null -- the preview's for no kind of its own
    type: null,
    perDie: critical?.perDie ?? 1,
    dice: terms.flatMap(term =>
      'sides' in term
        ? [
            {
              faces: term.sides,
              number: term.count,
              ...(term.added && { added: true as const }),
            },
          ]
        : [],
    ),
  }))
  return {
    critical: critical !== undefined,
    plannable: true,
    healing: link.healing,
    rolls,
  }
}
