import type { FavoriteOrder, Favorites } from './types'

/**
 * None, as wherever a sheet's favorites can't be changed: a party's sheet, a companion's pane, the
 * Gamemaster's page, a game that doesn't take them, and any row drawn outside a pane.
 */
export const NO_FAVORITING: Favorites = {
  choiceFor: () => undefined,
}

/** No order offered, as wherever favorites can't be changed, or a module before 0.47.0 runs. */
export const NO_ORDERING: FavoriteOrder = {
  on: false,
  arrange: entries => entries,
  save: () => undefined,
}

/** The key the last order sent is kept by, among a pane's commands. */
export const ORDER_KEY = 'order'
