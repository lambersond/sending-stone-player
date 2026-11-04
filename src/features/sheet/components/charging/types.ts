import type { SpellSlotPool } from '@/features/sheet/utils/types'
import type { SheetCounter, SpellSlotOp } from '@/types/sending-stone'

/**
 * What the sheet does with the character's counters and Heroic Inspiration: spend a counter's
 * charges, by how the sheet names the counter, and what it's called; and use or gain Heroic
 * Inspiration. Each only while the Gamemaster's game takes it from here.
 */
export type ChargeActions = {
  spend?: (counter: SheetCounter, count: number, name: string) => void
  inspire?: (inspiration: 'use' | 'gain') => void
  /**
   * From module 0.42.1, one of a pool's spell slots spent or restored, from the count of it the
   * dots showed, which the game makes it only from: where the game takes it from here, never
   * while the character is transformed.
   */
  slot?: (pool: SpellSlotPool, op: SpellSlotOp, from: number) => void
  /**
   * Whether a pool's dots wait for the game, by the pool's id, as an effect's controls do: from a
   * spend or restore sent until the sheet shows what the game made of it.
   */
  slotWaiting?: (id: string) => boolean
}
