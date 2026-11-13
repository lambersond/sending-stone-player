// The list's boxes, which its skeleton draws too while the characters are read (v0.48.0), so that
// its rows sit where the list's will, and stay there as either changes.

/** The player's characters, one to a row, 12 px apart. */
export const CHARACTER_LIST = 'grid grid-cols-1 gap-3'

/** A character's row: the link to its page, then its Delete. */
export const CHARACTER_ROW =
  'flex items-center rounded-2xl border border-border bg-card'

/** The link to a character's page across its row, whose padding and avatar set the row's height. */
export const CHARACTER_ROW_LINK = 'flex min-w-0 flex-1 items-center gap-4 p-4'

/** A character's avatar, 44 px across. */
export const CHARACTER_AVATAR = 'size-11'
