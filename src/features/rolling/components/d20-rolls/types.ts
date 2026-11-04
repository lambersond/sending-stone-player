import type { MenuPoint, RollTarget } from '../../types'

/** The menu of other ways to roll a check, save or attack, while it's open: where, and of what. */
export type D20Menu = {
  anchor: HTMLElement
  target: RollTarget
  point?: MenuPoint
}
