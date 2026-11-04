import type { MenuPoint } from '@/features/rolling/types'

/** Where the menu was opened: the row, and where on it, if a pointer opened it. */
export type Opened = { anchor: HTMLElement; point?: MenuPoint }
