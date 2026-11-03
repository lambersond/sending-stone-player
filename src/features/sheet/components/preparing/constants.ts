import type { Preparations } from './types'

/**
 * None, as wherever a sheet's spells can't be prepared from here: a party's sheet, a companion's
 * pane, the Gamemaster's page, a game that doesn't take it, and any row drawn outside a pane.
 */
export const NO_PREPARING: Preparations = {
  // eslint-disable-next-line unicorn/no-useless-undefined -- none, for every row
  choiceFor: () => undefined,
}
