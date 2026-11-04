import type { Favorites } from './types'

/**
 * None, as wherever a sheet's favorites can't be changed: a party's sheet, a companion's pane, the
 * Gamemaster's page, a game that doesn't take them, and any row drawn outside a pane.
 */
export const NO_FAVORITING: Favorites = {
  choiceFor: () => undefined,
}
