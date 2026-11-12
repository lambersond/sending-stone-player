import type { FavoriteTarget } from '@/types/roll'
import type { FavoriteEntry } from '@/types/sending-stone'

/**
 * A row's favorites entry: what it does, and whether it waits, as while it's on its way; and
 * among the favorites, from module 0.47.0, where it may move.
 */
export type FavoriteChoice = {
  op: 'add' | 'remove'
  waiting: boolean
  choose: () => void
  moves?: FavoriteMoves
}

/** What a favorite's own entries in a row's menu are: Add or Remove, and from 0.47.0 the moves. */
export type FavoriteChoiceId = 'favorite' | 'up' | 'down'

/** Where a favorite may move among them, from module 0.47.0: none past either end. */
export type FavoriteMoves = { up?: () => void; down?: () => void }

/**
 * The favorites put in order from here, from module 0.47.0: whether they may be now; the order
 * they're shown in, the one on its way while it is; and `save`, which sends the order of those
 * the page moves, by key, named for what's moved.
 */
export type FavoriteOrder = {
  on: boolean
  arrange: (entries: FavoriteEntry[]) => FavoriteEntry[]
  save: (keys: string[], label: string) => void
}

/** The last order sent from here: its line's local id, and the order, every favorite's key. */
export type SentOrder = { id: string; keys: string[] }

/** The last of a target's sent from here: its line's local id, and which it was. */
export type SentFavorite = { id: string; target: FavoriteTarget }

/** What a pane knows of its character's favorites: none where they can't be changed here. */
export type Favorites = {
  choiceFor: (
    target: FavoriteTarget,
    name: string,
  ) => FavoriteChoice | undefined
}
