import type { FavoriteChoice } from './types'
import type { FavoriteTarget } from '@/types/roll'

/** What a pane knows of its character's favorites: none where they can't be changed here. */
export type Favorites = {
  choiceFor: (
    target: FavoriteTarget,
    name: string,
  ) => FavoriteChoice | undefined
}

/**
 * None, as wherever a sheet's favorites can't be changed: a party's sheet, a companion's pane, the
 * Gamemaster's page, a game that doesn't take them, and any row drawn outside a pane.
 */
export const NO_FAVORITING: Favorites = {
  // eslint-disable-next-line unicorn/no-useless-undefined -- none, for every row
  choiceFor: () => undefined,
}
