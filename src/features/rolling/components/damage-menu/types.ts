import type { DamageSubject, MenuPoint } from '../../types'

/** The menu of ways to roll damage or healing, while it's open: where, and of what. */
export type DamageMenu = {
  anchor: HTMLElement
  subject: DamageSubject
  point?: MenuPoint
}
