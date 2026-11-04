import type { DamageModifiers } from '@/types/roll'
import type { SlotPool } from '@/types/sending-stone'

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
 * A pool of the character's spell slots, as its dots name it: its spellbook section's id, such as
 * "spell1" or "pact", and the level a spell is cast at with one, unknown from an older module.
 */
export type SpellSlotPool = Pick<SlotPool, 'id' | 'level'>
