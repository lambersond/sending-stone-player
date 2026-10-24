import { damageRollOf } from '@/hooks/use-table-rolls'
import type { SheetDamageRoll } from '@/hooks/use-sheet-roller'
import type { DamageModifiers } from '@/utils/damage-modifiers'

/*
 * An action's damage or healing on its own (module 0.36.0): rolled from the dice the game said it
 * throws, as an attack's due damage is, for the game to make dnd5e's card of it with no targets,
 * for the Gamemaster to apply.
 */

/** How the player rolls damage on its own: as a critical hit's, changed, as a kind chosen. */
export type AloneChoice = {
  critical?: boolean
  modifiers?: DamageModifiers
  /** The kind of damage chosen, such as "fire", for each of its rolls that offers it. */
  type?: string
}

/**
 * Damage or healing on its own, to roll as the game said it will: each of its rolls a part, with
 * its dice as the game will throw them, a critical hit's already doubled, as the kind chosen, if
 * any, and changed as the player chose, as an attack's due damage is rolled; called "Longsword
 * damage" or "Cure Wounds healing". A critical hit's only where the game makes one of it: a plan
 * with none never makes one. None where the game said nothing of its dice.
 * @param name - What it's of, such as "Longsword".
 * @param alone - Its item and activity, and the game's plan of its dice.
 */
export function aloneRollOf(
  name: string,
  alone: NonNullable<SheetDamageRoll['alone']>,
  choice: AloneChoice = {},
): SheetDamageRoll | undefined {
  const { plan } = alone
  if (!plan) return undefined
  const critical = choice.critical === true && !!plan.critical
  const damage = critical && plan.critical ? plan.critical : plan.normal
  // As an attack's due damage is rolled, but following no attack or use.
  const roll = damageRollOf(
    name,
    { use: '', damage },
    choice.type,
    choice.modifiers,
  )
  delete roll.use
  return {
    ...roll,
    alone: { item: alone.item, activity: alone.activity, critical },
  }
}
