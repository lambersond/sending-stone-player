import {
  marksTaken,
  takenModifiers,
  changes,
  changedAt,
  signedDice,
} from '@/utils/damage-modifiers'
import { formulaTerms } from '@/utils/formulas'
import type { DueDamage } from '@/features/rolling/types'
import type {
  DamageModifiers,
  SheetDamageRoll,
  LocalRoll,
  TableRollState,
  ExtraTerm,
} from '@/types/roll'
import type { DamagePreview } from '@/types/sending-stone'

/**
 * An attack's or a use's damage or healing, to roll as the game said it will: each of its rolls a
 * part, with its dice as the game will throw them, a critical hit's already doubled, those it takes
 * away with their signs, and its numbers where the app can read them, as the kind of damage
 * chosen, if any, and changed as the player chose. Damage the game can't say beforehand has no
 * dice here: the game rolls them. Damage whose dice the game won't change is marked `fixed`: one
 * with no first die to change, or, from a module before 0.21.0, one whose first die it would
 * change is one it takes away. Changes chosen as it was used that the game's damage can't take
 * are left out, and it's rolled without them: its highest where it takes a die away, its formula
 * saying so for damage the game rolls itself; more dice where it has no first die to change; and
 * more than its first die may still take, as a spell cast higher than its label has, down to as
 * many as it may.
 * @param label - What the attack or use was made with, such as "Longsword".
 * @param type - The kind of damage chosen, such as "fire", for each roll that offers it.
 * @param modifiers - How the player changes it now; else as they chose as they used it.
 */
export function damageRollOf(
  label: string,
  { use, damage, modifiers: chosen }: DueDamage,
  type?: string,
  modifiers: DamageModifiers | undefined = chosen,
): SheetDamageRoll {
  const healing = damage.healing === true
  const types = type ? typesFor(damage, type) : undefined
  const marked = marksTaken(damage)
  const kept = takenModifiers(damage, modifiers)
  const rolls = damage.rolls.map(roll =>
    damage.plannable ? termsOf(roll, marked) : { terms: [], read: true },
  )
  return {
    label: `${label} ${healing ? 'healing' : 'damage'}`,
    critical: damage.critical,
    healing,
    exact: true,
    use,
    ...(types && { types }),
    ...(kept && changes(kept) && { modifiers: kept }),
    perDie: damage.rolls[0]?.perDie ?? 1,
    ...(damage.plannable && changedAt(damage) < 0 && { fixed: true as const }),
    // A formula whose numbers the app can't read, as one a module writes in a way of its own for
    // a critical hit, adds up as the game says, rather than as its bare dice.
    ...(rolls.some(({ read }) => !read) && { gameTotal: true as const }),
    parts: damage.rolls.map((roll, index) => ({
      type: chosenLabel(roll, types?.[index]) ?? roll.type,
      terms: rolls[index].terms,
    })),
  }
}

/** The kinds of damage among which a roll of damage lets its roller choose, if any. */
export function choicesOf(damage: DamagePreview) {
  return damage.rolls.find(roll => (roll.types?.length ?? 0) > 1)?.types ?? []
}

/**
 * Whether a roll's damage is due: an attack the game made, whose damage is still to roll, or a use
 * whose damage or healing waits for its kind to be chosen, or, while its player types in their own
 * dice, for them to roll it, as any other use's is rolled at once. The tray offers that damage to
 * roll while it is, after a miss too, for what deals damage on one.
 */
export function damageDue(roll: LocalRoll, state?: TableRollState): boolean {
  if (state?.status !== 'done' || !state.damage || state.damaged) return false
  if (!state.requestId) return false
  if (roll.kind === 'check') return true
  return (
    roll.kind === 'use' &&
    (choicesOf(state.damage).length > 0 || state.offer === true)
  )
}

/**
 * Whether a roll waits for its player, its toast staying until they act: its damage is due
 * (`damageDue`), and it isn't an attack that missed, whose toast goes as any other's does, its
 * damage still offered where it's due. A use has no hit or miss, and an attack the game says
 * nothing of counts as a hit.
 */
export function needsPlayer(roll: LocalRoll, state?: TableRollState): boolean {
  if (!damageDue(roll, state)) return false
  return roll.kind !== 'check' || !missed(state)
}

/**
 * Whether an attack the game made missed: its target, or everyone in its area the game says of,
 * as the tray's "Hit 0 of 2". Not where the game says nothing of it.
 */
export function missed(state?: TableRollState): boolean {
  const attack = state?.attack
  if (!attack) return false
  const told = (attack.targets ?? []).filter(({ outcome }) => outcome !== null)
  if (attack.targets && attack.targets.length > 1 && told.length > 0) {
    return told.every(({ outcome }) => outcome === 'miss')
  }
  return attack.outcome === 'miss'
}

/** The kind chosen for each of damage's rolls: this one, for each roll that offers it. */
function typesFor(damage: DamagePreview, type: string): (string | null)[] {
  return damage.rolls.map(roll =>
    roll.types?.some(({ key }) => key === type) ? type : null,
  )
}

/** A kind of damage chosen, as the game labels it. */
function chosenLabel(
  roll: DamagePreview['rolls'][number],
  type: string | null | undefined,
): string | undefined {
  return roll.types?.find(({ key }) => key === type)?.label
}

/**
 * A roll's terms, as its formula has them, when they throw the dice the game said, with their
 * signs, each die with what Foundry does with it, such as 2d6r<=2's reroll; otherwise its dice
 * alone. Either way, its dice have their signs, as the game marks them,
 * or as its formula has them for a module before 0.21.0; and the dice of a critical hit's critical
 * damage are marked added, as the game marks them, so that none is ever its first die. Whether its
 * formula was read, `read`: not where its dice alone are left, its numbers lost.
 * @param marked - Whether the game marks the dice the damage takes away.
 */
function termsOf(
  roll: DamagePreview['rolls'][number],
  marked: boolean,
): { terms: ExtraTerm[]; read: boolean } {
  const dice = signedDice(roll, marked).map(
    ({ faces, number, added, subtracted }) => ({
      sign: subtracted ? (-1 as const) : (1 as const),
      count: number,
      sides: faces as Extract<ExtraTerm, { sides: number }>['sides'],
      ...(added && { added }),
    }),
  )
  const terms = formulaTerms(roll.formula)
  if (!terms) return { terms: dice, read: false }
  const thrown = terms.filter(term => 'sides' in term)
  const same =
    thrown.length === dice.length &&
    thrown.every(
      (term, index) =>
        term.sign === dice[index].sign &&
        term.count === dice[index].count &&
        term.sides === dice[index].sides,
    )
  if (!same) return { terms: dice, read: false }
  // Its terms of dice are its dice, in order.
  let index = 0
  return {
    terms: terms.map(term => {
      if (!('sides' in term)) return term
      const { added } = dice[index++]
      return added ? { ...term, added } : term
    }),
    read: true,
  }
}
