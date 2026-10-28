import { damageRollOf } from '@/hooks/use-table-rolls'
import {
  alonePicks,
  alonePlan,
  aloneSelection,
  type AloneRow,
} from '@/utils/alone-choices'
import type { SheetDamageRoll } from '@/hooks/use-sheet-roller'
import type { DamageModifiers } from '@/utils/damage-modifiers'

/*
 * An action's damage or healing on its own (module 0.36.0): rolled from the dice the game said it
 * throws, as an attack's due damage is, for the game to make dnd5e's card of it with no targets,
 * for the Gamemaster to apply. From module 0.41.0, where the game sends its choices, at the spell
 * slot, in the attack mode and with the ammunition chosen, from the plan of those, and spending
 * what its use would where the player asks.
 */

export {
  alonePicks,
  alonePlan,
  aloneSelection,
  type AlonePicks,
  type AlonePlan,
  type AloneRow,
  type AloneSelection,
} from '@/utils/alone-choices'

/**
 * How the player rolls damage on its own: as a critical hit's, changed, as a kind chosen; and from
 * module 0.41.0 at the slot, in the attack mode and with the ammunition chosen, spending what its
 * use would or not.
 */
export type AloneChoice = {
  critical?: boolean
  modifiers?: DamageModifiers
  /** The kind of damage chosen, such as "fire", for each of its rolls that offers it. */
  type?: string
  /** The spell slot chosen, such as "spell2" or "pact". Module 0.41.0. */
  slot?: string
  /** The weapon's attack mode chosen, such as "twoHanded". Module 0.41.0. */
  attackMode?: string
  /** The ammunition chosen, by its item's id. Module 0.41.0. */
  ammunition?: string
  /** Spend what using it would, as the Spend switch says. Module 0.41.0. */
  consume?: true
}

/**
 * Damage or healing on its own, to roll as the game said it will: each of its rolls a part, with
 * its dice as the game will throw them, a critical hit's already doubled, as the kind chosen, if
 * any, and changed as the player chose, as an attack's due damage is rolled; called "Longsword
 * damage" or "Cure Wounds healing". A critical hit's only where the game makes one of it: a plan
 * with none never makes one. None where the game said nothing of its dice. From module 0.41.0,
 * where the game sends the row's choices and the row is given, from the plan its choices pick,
 * naming them, the slot always where the spell has a pool to cast it with, as `aloneSelection` has
 * it, and spending what its use would where the player asks and it spends anything.
 * @param name - What it's of, such as "Longsword".
 * @param alone - Its item and activity, and the game's plan of its dice.
 * @param row - The row it's of, and the spellbook, for its choices; none rolls the row's own plan.
 */
export function aloneRollOf(
  name: string,
  alone: NonNullable<SheetDamageRoll['alone']>,
  choice: AloneChoice = {},
  row?: AloneRow,
): SheetDamageRoll | undefined {
  const { plan } = alone
  if (!plan) return undefined
  // What the game sends its choices for, from module 0.41.0, with their defaults; none otherwise.
  const chosen = row ? aloneSelection(plan, row, choice) : {}
  const picked = row
    ? alonePlan(plan, alonePicks(row.action, row.spells, chosen))
    : plan
  const critical = choice.critical === true && !!picked.critical
  const damage = critical && picked.critical ? picked.critical : picked.normal
  // As an attack's due damage is rolled, but following no attack or use.
  const roll = damageRollOf(
    name,
    { use: '', damage },
    choice.type,
    choice.modifiers,
  )
  delete roll.use
  const consume =
    choice.consume === true &&
    !!row &&
    !!plan.choices &&
    (plan.spends ?? []).length > 0
  return {
    ...roll,
    alone: {
      item: alone.item,
      activity: alone.activity,
      critical,
      ...(chosen.slot && { slot: chosen.slot }),
      ...(chosen.attackMode && { attackMode: chosen.attackMode }),
      ...(chosen.ammunition && { ammunition: chosen.ammunition }),
      ...(consume && { consume: true as const }),
    },
  }
}
