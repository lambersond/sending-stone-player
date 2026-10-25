'use client'

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { FAVORITE_SETTLE } from '@/constants/sending-stone'
import { isFavorite, targetKey } from '@/utils/favorite-commands'
import { linkedKeys, type FavoriteEntry } from '@/utils/favorites'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { FavoriteTarget } from '@/types/roll'
import type { SheetFavorite } from '@/types/sending-stone'

// What a pane offers of its character's favorites, from module 0.37.0: on each row of an item, one
// of its activities or an effect, Add to favorites or Remove from favorites, as the character's
// favorites say, never as the stars do, which mark no activity and nothing among the favorites.

/** A row's favorites entry: what it does, and whether it waits, as while it's on its way. */
export type FavoriteChoice = {
  op: 'add' | 'remove'
  waiting: boolean
  choose: () => void
}

/** What a pane knows of its character's favorites: none where they can't be changed here. */
type Favorites = {
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

const FavoritingContext = createContext<Favorites>(NO_FAVORITING)

/** What the rows inside offer of the character's favorites. */
export function Favoriting({
  value,
  children,
}: Readonly<{ value: Favorites; children: ReactNode }>) {
  return <FavoritingContext value={value}>{children}</FavoritingContext>
}

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

/** The last of a target's sent from here: its local id, and what it did. */
type Sent = { id: string; op: 'add' | 'remove'; at: number }

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
  const [sent, setSent] = useState<ReadonlyMap<string, Sent>>(() => new Map())
  // The local ids of those sent long enough ago that the sheet should have come.
  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const running = timers.current
    return () => {
      for (const timer of running) clearTimeout(timer)
    }
  }, [])
  const linked = useMemo(() => linkedKeys(entries), [entries])

  const choiceFor = useCallback(
    (target: FavoriteTarget, name: string): FavoriteChoice | undefined => {
      if (!on) return undefined
      const key = targetKey(target)
      if (linked.has(key)) return undefined
      const favorite = isFavorite(target, favorites)
      const op = favorite ? 'remove' : 'add'
      const last = sent.get(key)
      const state = last && states.get(last.id)
      const waiting =
        !!last &&
        !!state &&
        (state.status === 'sending' ||
          state.status === 'rolling' ||
          (state.status === 'done' &&
            state.favorited !== favorite &&
            !settled.has(last.id)))
      return {
        op,
        waiting,
        choose: () => {
          const id = send(target, op, name)
          setSent(held => new Map(held).set(key, { id, op, at: Date.now() }))
          const timer = setTimeout(() => {
            timers.current.delete(timer)
            setSettled(held => new Set(held).add(id))
          }, FAVORITE_SETTLE)
          timers.current.add(timer)
        },
      }
    },
    [on, linked, favorites, sent, states, settled, send],
  )
  return useMemo(() => ({ choiceFor }), [choiceFor])
}
