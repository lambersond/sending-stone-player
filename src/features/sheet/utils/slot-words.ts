import { ordinal, type SlotPool } from '@/utils/action-groups'

// How a pool of spell slots is named, as the app says it everywhere; the use picker keeps its own
// copy (round 0.42.1 §U, so the items revert apart).

/**
 * A pool of the character's spell slots, as its dots name it: its spellbook section's id, such as
 * "spell1" or "pact", and the level a spell is cast at with one, unknown from an older module.
 */
export type SpellSlotPool = Pick<SlotPool, 'id' | 'level'>

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
