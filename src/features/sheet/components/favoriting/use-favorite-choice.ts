import { createContext, use } from 'react'
import { NO_FAVORITING, NO_ORDERING } from './constants'
import { targetKey } from '@/utils/favorite-commands'
import type {
  FavoriteChoice,
  FavoriteMoves,
  FavoriteOrder,
  Favorites,
} from './types'
import type { FavoriteTarget } from '@/types/roll'

export const FavoritingContext = createContext<Favorites>(NO_FAVORITING)

/** The favorites put in order from here (module 0.47.0); none outside a pane that offers it. */
export const FavoriteOrderContext = createContext<FavoriteOrder>(NO_ORDERING)

/**
 * Where a row among the favorites may move, by its key and name (module 0.47.0); nowhere outside
 * them.
 */
export const FavoriteMovesContext = createContext<
  (key: string, name: string) => FavoriteMoves | undefined
>(() => undefined)

/**
 * A row's favorites entry, where it has one: Add or Remove, as the character's favorites say; none
 * for a row that names nothing, or outside a pane that offers them. Among the favorites, from
 * module 0.47.0, where it may move up or down.
 * @param name - What the row is called, which the tray's line is named after.
 */
export function useFavoriteChoice(
  target: FavoriteTarget | null | undefined,
  name: string,
): FavoriteChoice | undefined {
  const { choiceFor } = use(FavoritingContext)
  const movesOf = use(FavoriteMovesContext)
  const choice = target ? choiceFor(target, name) : undefined
  // Among the favorites, from module 0.47.0, Move up and Move down where it may move so.
  const moves = choice && target && movesOf(targetKey(target), name)
  return moves ? { ...choice, moves } : choice
}
