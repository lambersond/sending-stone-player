'use client'

import { NO_ORDERING } from './constants'
import { FavoriteOrderContext, FavoritingContext } from './use-favorite-choice'
import type { FavoriteOrder, Favorites } from './types'
import type { ReactNode } from 'react'

// What a pane offers of its character's favorites, from module 0.37.0: on each row of an item, one
// of its activities or an effect, Add to favorites or Remove from favorites, as the character's
// favorites say, never as the stars do, which mark no activity and nothing among the favorites.

/**
 * What the rows inside offer of the character's favorites, and from module 0.47.0 how the
 * favorites are put in order.
 */
export function Favoriting({
  value,
  ordering = NO_ORDERING,
  children,
}: Readonly<{
  value: Favorites
  ordering?: FavoriteOrder
  children: ReactNode
}>) {
  return (
    <FavoritingContext value={value}>
      <FavoriteOrderContext value={ordering}>{children}</FavoriteOrderContext>
    </FavoritingContext>
  )
}
