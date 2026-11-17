import { use } from 'react'
import { FavoriteMovesContext } from './use-favorite-choice'
import type { FavoriteMoves } from './types'

/**
 * Where a row among the favorites may move, by its key there, for one with no favorites entry of
 * its own: a skill, a tool or spell slots, which are made favorites in Foundry, so that its menu
 * has Move up and Move down all the same (ROADMAP item 47). None outside the favorites, or where
 * they aren't put in order.
 * @param name - What the row is called, which the tray's line is named after.
 */
export function useFavoriteMoves(
  key: string,
  name: string,
): FavoriteMoves | undefined {
  return use(FavoriteMovesContext)(key, name)
}
