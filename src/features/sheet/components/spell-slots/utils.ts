import { SPELL_SLOT } from '@/constants/sending-stone'
import { ordinal } from '@/utils/action-groups'
import type { ChargeActions } from '../charging/types'
import type { SpellSlotPool } from '@/features/sheet/utils/slot-words'

/** Counts shown as pips up to this many; past it, as a number alone. */
export const MAX_PIPS = 9

/**
 * Whether a pool's dots spend and restore its slots, from module 0.42.1: where the pane offers it
 * (the game takes it from here, and the character isn't transformed), of a pool the app knows by
 * its id, such as "spell1" or "pact", with a dot for each of its slots, one to nine.
 */
export function slotsLive(
  pool: SpellSlotPool | undefined,
  max: number,
  charging: ChargeActions,
): boolean {
  return (
    !!pool &&
    !!charging.slot &&
    SPELL_SLOT.test(pool.id) &&
    max > 0 &&
    max <= MAX_PIPS
  )
}

/**
 * A pool's slots, as its heading names the pool: "1st-level spell slots", or "Pact Magic slots
 * (3rd level)".
 */
export function slotsName({ id, level }: SpellSlotPool): string {
  if (id === 'pact') {
    return level === null
      ? 'Pact Magic slots'
      : `Pact Magic slots (${ordinal(level)} level)`
  }
  return level === null ? 'Spell slots' : `${ordinal(level)}-level spell slots`
}
