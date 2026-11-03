import type { DamageModifiers } from '@/types/roll'

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
