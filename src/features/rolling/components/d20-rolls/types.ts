import type { MenuExtra, MenuPoint, RollTarget } from '../../types'

/** The menu of other ways to roll a check, save or attack, while it's open: where, and of what. */
export type D20Menu = {
  anchor: HTMLElement
  target: RollTarget
  point?: MenuPoint
  /** What else it offers of its part of the sheet, after the ways to roll it. */
  extras?: MenuExtra[]
}
