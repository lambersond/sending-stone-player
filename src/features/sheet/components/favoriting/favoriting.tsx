'use client'

import { useCallback, useMemo, type ReactNode } from 'react'
import { FavoritingContext } from './use-favorite-choice'
import { FAVORITE_SETTLE } from '@/constants/sending-stone'
import { useSettle } from '@/features/sheet/hooks/use-settle'
import { isFavorite, targetKey } from '@/utils/favorite-commands'
import { linkedKeys } from '@/utils/favorites'
import type { FavoriteChoice, Favorites, SentFavorite } from './types'
import type { FavoriteTarget, TableRollState } from '@/types/roll'
import type { SheetFavorite, FavoriteEntry } from '@/types/sending-stone'

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

/**
 * What a pane offers of its character's favorites. A row's entry is Remove where the character's
 * favorites have it, else Add; none where the pane doesn't offer them, or for a feature a resource
 * stands for, whose place among the favorites is the resource's. One sent waits while it's on its
 * way, and once made until the sheet says what the game made of it, for up to `FAVORITE_SETTLE`;
 * never once it failed or was refused, so that it can be tried again.
 * @param on - Whether the pane offers them: its seat's player may, and it's no companion's.
 * @param send - Sends one, and logs it among the rolls, returning its local id.
 */
export function useFavorites({
  on,
  favorites,
  entries,
  states,
  send,
}: Readonly<{
  on: boolean
  favorites: SheetFavorite[]
  entries: FavoriteEntry[]
  states: ReadonlyMap<string, TableRollState>
  send: (target: FavoriteTarget, op: 'add' | 'remove', name: string) => string
}>): Favorites {
  const { sent, last, waitingOf } = useSettle<SentFavorite>({
    states,
    settleMs: FAVORITE_SETTLE,
    missing: 'idle',
    agrees: useCallback(
      ({ target }, state) => state.favorited === isFavorite(target, favorites),
      [favorites],
    ),
  })
  const linked = useMemo(() => linkedKeys(entries), [entries])

  const choiceFor = useCallback(
    (target: FavoriteTarget, name: string): FavoriteChoice | undefined => {
      if (!on) return undefined
      const key = targetKey(target)
      if (linked.has(key)) return undefined
      const op = isFavorite(target, favorites) ? 'remove' : 'add'
      return {
        op,
        waiting: waitingOf(last(key)),
        choose: () => {
          sent(key, { id: send(target, op, name), target })
        },
      }
    },
    [on, linked, favorites, last, waitingOf, sent, send],
  )
  return useMemo(() => ({ choiceFor }), [choiceFor])
}
