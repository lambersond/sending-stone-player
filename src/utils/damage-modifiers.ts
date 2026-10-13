import { MAX_DAMAGE_TERMS } from '@/constants/sending-stone'
import {
  formulaUnmaximizable,
  readModifier,
  unmaximizableDie,
} from '@/utils/dice-modifiers'
import { formulaTerms } from '@/utils/formulas'
import {
  MAX_DICE,
  type ExtraDice,
  type ExtraTerm,
} from '@/utils/roll-modifiers'
import type {
  CriticalRule,
  DamagePreview,
  DamagePreviewRoll,
} from '@/types/sending-stone'
import type { DamageLink } from '@/utils/description-links'

/*
 * Changing damage or healing as it's rolled, as dnd5e's damage dialog lets a player: more of its
 * first die, as a spell cast at a higher level throws; that die another size, as a versatile weapon
 * held in two hands, or Toll the Dead at a creature that's hurt; or every die at its highest. Its
 * first die is never one it takes away, as Reduce's −1d4: dnd5e itself places the dice it adds
 * (a critical hit's extra dice, a spell's scaling, a versatile die) only on a die damage adds,
 * though a critical hit doubles every die; so more dice never mean less damage, and damage that
 * takes a die away is never at its highest, which would take the most away. Nor is damage whose
 * dice explode, or are rerolled on their highest face, as Foundry may throw them again: its highest
 * isn't known.
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
 * of dice its first part adds, if any, neither one it takes away nor the dice of a critical hit's
 * critical damage.
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
 * Damage's parts with its first die changed, neither one it takes away nor critical damage: more of
 * it, `perDie` more for each one added, as a critical hit's dice the game has already doubled throw
 * two for each; and another size, if chosen. Damage with no first die to change is as it was.
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
 * never a die of a critical hit's critical damage, nor one the damage takes away, which the game
 * marks, as `changedAt` finds it. None for damage the game rolls itself; nothing when there's no
 * first die to change.
 * @param signed - Whether the game changes only a die the damage adds, as `changedAt` takes it.
 */
export function modifiedDice(
  damage: DamagePreview,
  modifiers?: DamageModifiers,
  signed = marksTaken(damage),
): DamagePreviewRoll['dice'] | undefined {
  const planned = damage.plannable
    ? damage.rolls.flatMap(roll => roll.dice)
    : []
  if (!reshapes(modifiers) || !damage.plannable) return planned
  const [first] = damage.rolls
  // The first roll's dice come first, its first die the first that's its own and that it adds.
  const at = changedAt(damage, signed)
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
 * Does any die of damage, as the game said it, carry the mark of one it takes away? Only a module
 * from 0.21.0 marks them, so that one that does marks them all.
 */
export function marksTaken(damage: DamagePreview): boolean {
  return damage.rolls.some(roll =>
    roll.dice.some(die => die.subtracted === true),
  )
}

/**
 * A roll's dice, those it takes away marked: as the game marks them, where it does; else, from a
 * module before 0.21.0, as its formula has them, where the app reads it and it throws those dice,
 * in order; else as they are, every one added.
 * @param marked - Whether the game marks them, as `marksTaken` says of the damage.
 */
export function signedDice(
  roll: DamagePreviewRoll,
  marked: boolean,
): DamagePreviewRoll['dice'] {
  if (marked) return roll.dice
  const thrown = formulaTerms(roll.formula)?.filter(
    (term): term is ExtraDice => 'sides' in term,
  )
  if (!thrown) return roll.dice
  const same =
    thrown.length === roll.dice.length &&
    thrown.every(
      (term, index) =>
        term.count === roll.dice[index].number &&
        term.sides === roll.dice[index].faces,
    )
  if (!same) return roll.dice
  return roll.dice.map((die, index) =>
    thrown[index].sign < 0 ? { ...die, subtracted: true as const } : die,
  )
}

/**
 * Where, among damage's first roll's dice as the game said them, its first die is, which more dice
 * are added to, or made another size: the first that's neither a critical hit's critical damage nor
 * one the damage takes away; -1 for none.
 * @param signed - Whether the game changes only a die the damage adds, as a module from 0.21.0
 *   does: for an attack's or a use's damage, as its preview's marks show; for a description's, as
 *   the hello says (`signedDice`). One before changes its first die that isn't critical damage
 *   whatever its sign: only where that's the same die.
 */
export function changedAt(
  damage: DamagePreview,
  signed = marksTaken(damage),
): number {
  const [first] = damage.rolls
  if (!first) return -1
  const dice = signedDice(first, marksTaken(damage))
  const at = dice.findIndex(die => !die.added && !die.subtracted)
  if (signed) return at
  return dice.findIndex(die => !die.added) === at ? at : -1
}

/**
 * Is damage's first die, which more dice are added to, also the die a module before 0.21.0
 * changes: its first part's first die that isn't critical damage, whatever its sign?
 */
export function sameFirstDie(parts: readonly Part[]): boolean {
  const die = firstDie(parts)
  return (
    die !== undefined &&
    parts[0].terms.find(term => 'sides' in term && !term.added) === die
  )
}

/**
 * Does damage, as the game said it, take any of its dice away, as Reduce's −1d4 does? Such damage
 * isn't rolled at its highest, which would take the most away. Damage the game rolls itself has no
 * dice here to mark: its rolls' formulas say, as `formulaTakesAway` reads them.
 */
export function diceTakenAway(damage: DamagePreview): boolean {
  if (!damage.plannable) {
    return damage.rolls.some(roll => formulaTakesAway(roll.formula))
  }
  const marked = marksTaken(damage)
  return damage.rolls.some(roll =>
    signedDice(roll, marked).some(die => die.subtracted === true),
  )
}

/** A group of a formula's terms, as dnd5e reads their signs: its own text, what's in brackets. */
type FormulaGroup = { negative: boolean; own: string; within: string[] }

/**
 * Does a roll's formula take a die away, read as it's written, for damage whose dice the game
 * can't say beforehand: where a die is in a group of terms that comes out negative, as dnd5e reads
 * the signs of damage, at each depth of brackets, each group's own `-` turning it over, and a `-`
 * after `*`, `/` or `%` or opening it too, as in `1d3 + 3 - 1d4`, or the `(1d4 * -1)` Foundry's
 * parser may make of a leading −1d4. `1d3 - 1` takes none away, nor does `- - 1d4`. A die within a
 * function counts as within brackets. The game reads it so too, and refuses it at its highest.
 */
export function formulaTakesAway(formula: string): boolean {
  return groupTakesAway(formula.replaceAll(/\[[^\]]*\]/g, ''), false)
}

/**
 * Does a formula, or what's within a pair of brackets of one, take a die away: one of its groups of
 * terms, parted by a `+`, a `-` or a function's comma between them, coming out negative with a die
 * of its own, or any brackets within one, read with that group's sign?
 * @param negative - It's taken away, or made negative, as a whole.
 */
function groupTakesAway(text: string, negative: boolean): boolean {
  let group: FormulaGroup = { negative: false, own: '', within: [] }
  const groups = [group]
  let depth = 0
  // What's within the brackets being read.
  let inner = ''
  // The last character read that isn't a space: a sign after a term parts two groups.
  let before = ''
  for (const char of text) {
    if ('({'.includes(char)) {
      if (depth++ > 0) inner += char
    } else if (')}'.includes(char)) {
      if (depth > 1) inner += char
      else if (depth === 1) {
        group.within.push(inner)
        inner = ''
      }
      depth = Math.max(depth - 1, 0)
    } else if (depth > 0) {
      inner += char
    } else if ('+-,'.includes(char)) {
      if (char === ',' || /[\w.)}]/.test(before)) {
        group = { negative: char === '-', own: '', within: [] }
        groups.push(group)
      } else if (char === '-') {
        group.negative = !group.negative
      }
    } else {
      group.own += char
    }
    if (char.trim()) before = char
  }
  return groups.some(({ negative: turned, own, within }) => {
    const sign = negative !== turned
    return (
      (sign && /d\d/i.test(own)) ||
      within.some(each => groupTakesAway(each, sign))
    )
  })
}

/**
 * Can't damage be rolled at its highest, as the game refuses it: where a die of it explodes, or is
 * rerolled on its highest face, as its parts have them; or, as the game said it, as its rolls'
 * formulas have them, read as Foundry reads them, whether the app reads them or not
 * (`formulaUnmaximizable`).
 */
export function unmaximizable(
  damage: readonly Part[] | DamagePreview,
): boolean {
  if (!('rolls' in damage)) {
    return damage.some(part =>
      part.terms.some(term => 'sides' in term && unmaximizableDie(term)),
    )
  }
  return damage.rolls.some(({ formula }) => formulaUnmaximizable(formula))
}

/**
 * Of the changes a player chose for damage before the game said what it throws, those the game
 * takes, as `checkDamage` tests them: at its highest, unless it takes a die away, or a die of it
 * explodes or is rerolled on its highest face (`unmaximizable`); its first die
 * changed, where it has one to change, with no more dice than that die may still take, as many
 * for each as its roll's `perDie`, as a spell cast higher, whose label had fewer, may leave room
 * for. Its dice as chosen for damage the game rolls itself, which says none. Nothing where none is
 * left.
 */
export function takenModifiers(
  damage: DamagePreview,
  modifiers?: DamageModifiers,
): DamageModifiers | undefined {
  if (!modifiers) return undefined
  const highest =
    modifiers.maximize === true &&
    !diceTakenAway(damage) &&
    !unmaximizable(damage)
  if (!damage.plannable) {
    const kept: DamageModifiers = {
      ...(modifiers.extra !== undefined && { extra: modifiers.extra }),
      ...(modifiers.faces !== undefined && { faces: modifiers.faces }),
      ...(highest && { maximize: true }),
    }
    return changes(kept) ? kept : undefined
  }
  const [first] = damage.rolls
  const at = changedAt(damage)
  const die = at >= 0 ? first?.dice[at] : undefined
  const extra = die
    ? Math.min(
        modifiers.extra ?? 0,
        Math.floor((MOST_DICE - die.number) / Math.max(first.perDie ?? 1, 1)),
      )
    : 0
  const kept: DamageModifiers = {
    ...(highest && { maximize: true }),
    ...(die &&
      reshapes(modifiers) && {
        ...(extra > 0 && { extra }),
        ...(modifiers.faces !== undefined && { faces: modifiers.faces }),
      }),
  }
  return changes(kept) ? kept : undefined
}

/** Do damage's parts take any of their dice away, as Reduce's −1d4 does? */
export function takesAway(parts: readonly Part[]): boolean {
  return parts.some(part =>
    part.terms.some(term => 'sides' in term && term.sign < 0),
  )
}

/** How damage may be changed as it's rolled: at its highest, or with its dice changed first. */
export type DamageChange = 'maximize' | 'modify-damage'

/**
 * The ways damage's parts may be changed as they're rolled, in order: at its highest, unless it
 * takes a die away, which that would take the most of, or a die of it explodes or is rerolled on
 * its highest face (`unmaximizable`); and with its first die changed, where it has one, and it may
 * be.
 * @param fixed - Its dice can't be changed, as the game's preview says.
 * @param takenAway - It takes a die away, or can't be at its highest otherwise: as its parts say,
 *   unless the game said otherwise, as of damage it rolls itself, whose parts have no dice here
 *   (`diceTakenAway`, `unmaximizable`).
 */
export function damageChanges(
  parts: readonly Part[],
  fixed = false,
  takenAway = takesAway(parts),
): DamageChange[] {
  return [
    ...(takenAway || unmaximizable(parts) ? [] : (['maximize'] as const)),
    ...(firstDie(parts) && !fixed ? (['modify-damage'] as const) : []),
  ]
}

/**
 * The most dice that may be added to damage's first die, neither one it takes away nor critical
 * damage: as many as keep it within the most one roll may throw, `perDie` for each, as a critical
 * hit's take.
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
 * critical hit adds to each part, in dnd5e's order: its extra dice, thrown with its first term
 * where that's a die it adds, never one it takes away, at the size it's made, or the most they
 * could roll added, or left out, as the rules throw them; and its critical damage, as it is, whose
 * dice are never its first die.
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
 * extra dice to a part that has no dice of its own first; under Powerful Critical, where a part
 * takes a die away, whose most the world's rules may add or take away, or has a die that's kept,
 * dropped, counted at least or at most so much, or counted as successes or failures, whose most
 * dnd5e works out otherwise; where a part, or its
 * critical damage, doesn't read; or where it would throw more of one die, or more kinds, than one
 * roll may.
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
    // Under Powerful Critical the most a die taken away could roll is added by some rules and
    // taken away by others, which the sheet can't tell apart.
    if (
      rule.powerfulCritical &&
      terms.some(
        term => 'sides' in term && (term.sign < 0 || countsOtherwise(term)),
      )
    ) {
      return false
    }
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
 * Does a die count otherwise than its faces say, by a modifier that keeps or drops some, counts
 * each at least or at most so much, or counts successes or failures?
 */
function countsOtherwise({ sides, modifiers = [] }: ExtraDice): boolean {
  return modifiers.some(text => {
    const kind = readModifier(text, sides)?.kind
    return kind !== undefined && kind !== 'reroll' && kind !== 'explode'
  })
}

/**
 * A description's damage or healing as the game will throw it, as an attack's preview says it: the
 * dice of each of its parts, in order, every one `perDie` times on a critical hit, as the world's
 * rules make it, which take as many more for each die added, with the extra dice a critical hit
 * adds, and then its critical damage's, marked as added; those it takes away marked so, never its
 * first die. None where a part's formula can't be read, which the app couldn't have rolled.
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
              ...(term.sign < 0 && { subtracted: true as const }),
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
