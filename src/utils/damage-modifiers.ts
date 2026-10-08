import { MAX_DICE, type ExtraTerm } from '@/utils/roll-modifiers'
import type { DamagePreview } from '@/types/sending-stone'

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
 * of dice its first part adds, if any.
 */
export function firstDie(
  parts: readonly Part[],
): Extract<ExtraTerm, { sides: number }> | undefined {
  const term = parts[0]?.terms.find(each => 'sides' in each && each.sign > 0)
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
 * roll's first die, as many more for each as that roll's `perDie` says, or another size of it. None
 * for damage the game rolls itself; nothing when there's no first die to change.
 */
export function modifiedDice(
  damage: DamagePreview,
  modifiers?: DamageModifiers,
): { faces: number; number: number }[] | undefined {
  const planned = damage.plannable
    ? damage.rolls.flatMap(roll => roll.dice)
    : []
  if (!reshapes(modifiers) || !damage.plannable) return planned
  const [first] = damage.rolls
  const [die, ...rest] = planned
  if (!first?.dice.length || !die) return undefined
  return [
    {
      faces: modifiers?.faces ?? die.faces,
      number: die.number + (modifiers?.extra ?? 0) * (first.perDie ?? 1),
    },
    ...rest,
  ]
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
