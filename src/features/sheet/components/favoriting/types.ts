/** A row's favorites entry: what it does, and whether it waits, as while it's on its way. */
export type FavoriteChoice = {
  op: 'add' | 'remove'
  waiting: boolean
  choose: () => void
}
