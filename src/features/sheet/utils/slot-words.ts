import { ordinal } from '@/utils/action-groups'
import type { SpellSlotPool } from './types'

// How a pool of spell slots is named, as the app says it everywhere; the use picker keeps its own
// copy (round 0.42.1 §U, so the items revert apart).

/**
 * One of a pool's slots, in words: "1st-level spell slot", or pact magic's "pact slot (3rd
 * level)"; "spell slot" where the level isn't known.
 */
export function slotName({ id, level }: SpellSlotPool): string {
  if (level === null) return 'spell slot'
  return id === 'pact'
    ? `pact slot (${ordinal(level)} level)`
    : `${ordinal(level)}-level spell slot`
}

/** The same, as one of them: "a 1st-level spell slot", "a pact slot (3rd level)". */
export function slotWords(pool: SpellSlotPool): string {
  return `a ${slotName(pool)}`
}
