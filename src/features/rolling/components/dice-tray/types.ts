import type { DieSides } from '@lambersond/3d-dice-core'

/** One size of die in the dice tray and how many of it, as the dice library's tray lists them. */
export type TrayDie = { sides: DieSides; count: number }

/** One of the tray's buttons that focus may be moved to: a size's Add, or its chip's One fewer. */
export type TrayButton = { button: 'add' | 'fewer'; sides: DieSides }

/** Whether a live region's change is said (`polite`) or made unsaid (`off`). */
export type Live = 'polite' | 'off'

/**
 * What the tray's live regions hold: its words, always the tray's whole formula, and whether a
 * change to them is said or follows a modifier's step unsaid; and whether the modifier's own output
 * says its change, as it does a step, or follows a clear unsaid.
 */
export type DiceSaid = { words: string; live: Live; modifier: Live }
