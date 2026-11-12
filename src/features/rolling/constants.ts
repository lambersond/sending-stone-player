import type { AgainWords, RollChoice } from '@/features/rolling/types'
import type { GmRollView, LocalFormula } from '@/types/roll'

/** How long a touch must be held to open the roll's menu, in milliseconds. */
export const LONG_PRESS = 500

/** The ways to roll a check, save or attack. */
export const D20_CHOICES: RollChoice[] = ['adv', 'dis', 'modify']

/** Where this browser keeps whether to send the player's rolls to the table. */
export const SEND_KEY = 'sending-stone:send-rolls'

/** And whether to send the Gamemaster's, at a character's sheet (#156): a switch of its own. */
export const GM_SEND_KEY = `${SEND_KEY}:gm`

/**
 * Where this browser keeps whether damage the player rolls goes to the table on its own, with no
 * attack or use made there (module 0.36.0): off until they turn it on; and the Gamemaster's, at a
 * character's sheet, a switch of its own.
 */
export const ALONE_KEY = 'sending-stone:send-damage'

export const GM_ALONE_KEY = `${ALONE_KEY}:gm`

/** What each of those switches is: on or off. End Turn reads Send's too (module 0.36.0). */
export const SEND_CHOICES = ['on', 'off'] as const

/** How many of this page's rolls are kept. */
export const ROLL_HISTORY = 20

/** None of the Gamemaster's rolls, the same each time, for what's worked out from them to keep. */
export const NO_GM_ROLLS: readonly GmRollView[] = []

/** What a roll of the Gamemaster's as the player's character says of itself (#156). */
export const GM_WORDS = 'Rolled by your Gamemaster'

/** The same, after what the roll is called, or what it came to. */
export const GM_WORDS_AFTER = 'rolled by your Gamemaster'

/**
 * What the game made of a die thrown again that the player answered (module 0.44.0), in place of
 * a total, by why it was thrown again: an exploded die is added to its roll; a rerolled one takes
 * the place of the die it rerolls. That roll's own line says the game's total.
 */
export const AGAIN_WORDS: Record<
  NonNullable<LocalFormula['again']>,
  AgainWords
> = {
  explode: {
    made: 'Added to its roll at the table',
    after: 'added to its roll',
  },
  reroll: {
    made: 'In place of the die rerolled at the table',
    after: 'in place of the die rerolled',
  },
}

/**
 * A die the game asked for that the player left to it to roll (module 0.44.0), in place of its
 * number: after its term, as "+1d6 Fire, left to the game"; and among the earlier rolls, and in a
 * toast, in place of the roll's numbers, or after the dice typed, "the rest left to the game".
 */
export const LEFT_WORDS = 'left to the game'
