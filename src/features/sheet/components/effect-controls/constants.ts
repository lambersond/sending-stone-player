import type { Effects } from './types'

/**
 * None, as wherever a sheet's effects can't be changed: a party's sheet, a companion's pane, the
 * Gamemaster's page, a game that doesn't take them, and any row drawn outside a pane.
 */
export const NO_EFFECTS: Effects = {
  // eslint-disable-next-line unicorn/no-useless-undefined -- none, for every row
  choiceFor: () => undefined,
  // eslint-disable-next-line unicorn/no-useless-undefined -- none known
  effectOf: () => undefined,
  // eslint-disable-next-line unicorn/no-useless-undefined -- none sent
  send: () => undefined,
  waitingOf: () => false,
  // eslint-disable-next-line unicorn/no-useless-undefined -- each row keeps its own
  openAt: () => undefined,
  setOpenAt: () => {},
  focusing: { current: new Map() },
}
