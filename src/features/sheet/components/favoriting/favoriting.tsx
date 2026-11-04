'use client'

import { FavoritingContext } from './use-favorite-choice'
import type { Favorites } from './types'
import type { ReactNode } from 'react'

// What a pane offers of its character's favorites, from module 0.37.0: on each row of an item, one
// of its activities or an effect, Add to favorites or Remove from favorites, as the character's
// favorites say, never as the stars do, which mark no activity and nothing among the favorites.

/** What the rows inside offer of the character's favorites. */
export function Favoriting({
  value,
  children,
}: Readonly<{ value: Favorites; children: ReactNode }>) {
  return <FavoritingContext value={value}>{children}</FavoritingContext>
}
