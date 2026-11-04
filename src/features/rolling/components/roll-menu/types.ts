import type { MenuPoint } from '../../types'

/** Where a menu opens, and what it's of. */
export type MenuPlace = {
  /** The part of the sheet it opened from. */
  anchor: HTMLElement
  /** Where on it they clicked or pressed. With none, as from a key or a tap, it goes below it. */
  point?: MenuPoint
  /** What it's of, such as "Perception check +7". */
  title: string
  onClose: () => void
}
