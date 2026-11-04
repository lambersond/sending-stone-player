import type { RollChoice } from '@/features/rolling/types'
import type { GmRollView } from '@/types/roll'

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
