import type { Effects } from './types'

/**
 * None, as wherever a sheet's effects can't be changed: a party's sheet, a companion's pane, the
 * Gamemaster's page, a game that doesn't take them, and any row drawn outside a pane.
 */
export const NO_EFFECTS: Effects = {
  choiceFor: () => undefined,
  effectOf: () => undefined,
  send: () => undefined,
  waitingOf: () => false,
  openAt: () => undefined,
  setOpenAt: () => {},
  focusing: { current: new Map() },
}
