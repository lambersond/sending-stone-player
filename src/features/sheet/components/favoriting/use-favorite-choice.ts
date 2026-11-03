import { createContext, use } from 'react'
import { NO_FAVORITING, type Favorites } from './constants'
import type { FavoriteChoice } from './types'
import type { FavoriteTarget } from '@/types/roll'

export const FavoritingContext = createContext<Favorites>(NO_FAVORITING)

/**
 * A row's favorites entry, where it has one: Add or Remove, as the character's favorites say; none
 * for a row that names nothing, or outside a pane that offers them.
 * @param name - What the row is called, which the tray's line is named after.
 */
export function useFavoriteChoice(
  target: FavoriteTarget | null | undefined,
  name: string,
): FavoriteChoice | undefined {
  const { choiceFor } = use(FavoritingContext)
  return target ? choiceFor(target, name) : undefined
}
