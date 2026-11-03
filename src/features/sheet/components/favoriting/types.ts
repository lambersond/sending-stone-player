import type { FavoriteTarget } from '@/types/roll'

/** A row's favorites entry: what it does, and whether it waits, as while it's on its way. */
export type FavoriteChoice = {
  op: 'add' | 'remove'
  waiting: boolean
  choose: () => void
}

/** The last of a target's sent from here: its line's local id, and which it was. */
export type SentFavorite = { id: string; target: FavoriteTarget }

/** What a pane knows of its character's favorites: none where they can't be changed here. */
export type Favorites = {
  choiceFor: (
    target: FavoriteTarget,
    name: string,
  ) => FavoriteChoice | undefined
}
