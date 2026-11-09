import type { DieSides } from '@lambersond/3d-dice-core'

/** One size of die in the dice tray and how many of it, as the dice library's tray lists them. */
export type TrayDie = { sides: DieSides; count: number }

/** One of the tray's buttons that focus may be moved to: a size's Add, or its chip's One fewer. */
export type TrayButton = { button: 'add' | 'fewer'; sides: DieSides }
