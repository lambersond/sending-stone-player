import {
  byTheGame,
  leftAgain,
  rechargeWord,
  savedAt,
  thrownAgainThere,
  verdictWord,
} from '../../utils/tray-words'
import type { LocalRoll, TableRollState } from '@/types/roll'

/**
 * Whether all the tray lists is items and coins moved, from module 0.31.0, or items removed, from
 * module 0.33.0, the player's or the Gamemaster's as the character: each is sent to the game, and
 * made or turned down there, whatever the game takes of the player's rolls and whether this device
 * sends them, so that what's said of rolls reaching it, or not, isn't said of them.
 */
export function movesAlone(rolls: readonly LocalRoll[]): boolean {
  return (
    rolls.length > 0 &&
    rolls.every(roll =>
      roll.kind === 'gm'
        ? roll.rolled === 'transfer' || roll.rolled === 'remove'
        : roll.kind === 'use' && !!roll.move,
    )
  )
}

/**
 * The roll whose damage the latest in full offers: the latest; or, where that's one of the
 * Gamemaster's as the character (#156), which has none, the player's own latest, as it offered
 * it before theirs came, so that the Gamemaster's arriving takes nothing from the player.
 */
export function offersDamage(
  rolls: readonly LocalRoll[],
): LocalRoll | undefined {
  return rolls.find(roll => roll.kind !== 'gm')
}

/** The DC a description names for a saving throw or check rolled against it, if any. */
export function dcOf(roll: LocalRoll): number | undefined {
  return roll.kind === 'check' ? roll.dc : undefined
}

/**
 * What came of a roll the game made, in a word, after its total among the earlier rolls: a
 * recharge's, and damage on its own's, from module 0.36.0, in place of a save's word; else whether
 * a saving throw or check against a DC made it. Nothing where the game hid it.
 */
export function madeWord(
  roll: LocalRoll,
  state: TableRollState,
): string | undefined {
  if (state.recharge) return state.visible ? rechargeWord(state) : undefined
  if (state.alone && state.visible) return 'on its own'
  const saved = state.visible ? savedAt(state, dcOf(roll)) : undefined
  const verdict = roll.kind === 'check' ? roll.verdict : undefined
  return saved === undefined ? undefined : verdictWord(saved, verdict)
}

/**
 * The total an earlier roll shows after its dice: a check's, a formula's, or damage's thrown here;
 * none for a use, an ask or one of the Gamemaster's, for damage the game rolls itself, for a roll
 * the game throws dice again for, whose total here isn't the game's, nor for a die thrown again
 * that the player left to the game (module 0.44.0).
 */
export function earlierTotal(
  roll: LocalRoll,
  state?: TableRollState,
): number | undefined {
  if (thrownAgainThere(roll, state) || leftAgain(roll)) return undefined
  if (roll.kind === 'check' || roll.kind === 'formula') return roll.total
  if (roll.kind === 'damage' && !byTheGame(roll)) return roll.total
  return undefined
}
