import type { SpellSlotPool } from '@/features/sheet/utils/types'
import type { HitPointsInput } from '@/types/roll'
import type { SheetCounter, SpellSlotOp } from '@/types/sending-stone'

/**
 * What the sheet does with the character's counters and Heroic Inspiration: spend a counter's
 * charges, by how the sheet names the counter, and what it's called; and use or gain Heroic
 * Inspiration; and from module 0.44.0 set its hit points. Each only while the Gamemaster's game
 * takes it from here.
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
  /**
   * From module 0.44.0, the hit points and temporary hit points set, from the numbers the tile
   * showed, which the game makes it only from: where the campaign lets the player, whatever the
   * rolls, the character's, its form's while shaped, or at a companion's own pane the companion's.
   */
  hitPoints?: (change: HitPointsInput) => void
  /**
   * Whether the hit points wait for the game, as a pool of slots does: from a change sent until
   * the sheet shows what the game made of it.
   */
  hitPointsWaiting?: boolean
}
