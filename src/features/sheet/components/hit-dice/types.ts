import type { HitDicePool, HitDiceCount } from '@/types/roll'

/**
 * How the sheet spends hit dice: rolled with the player's dice, for the hit points they give back,
 * and spent in the Gamemaster's game too while it takes hit dice.
 */
export type HitDieSpending = {
  /** The character's hit dice by size, largest first, as dnd5e spends them: every class's of it. */
  pools: HitDicePool[]
  /**
   * Spends this many hit dice of each size, thrown together: one alone as a hit die, more as hit
   * dice spent at once.
   */
  onSpend: (counts: HitDiceCount[]) => void
  /** What spending this many of each size gives back, as a formula, such as "2d10 + 1d8 + 9". */
  formula: (counts: HitDiceCount[]) => string
  /** At full hit points, where a die spent would give back nothing, so none is. */
  full: boolean
}
