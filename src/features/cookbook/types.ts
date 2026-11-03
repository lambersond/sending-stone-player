import type { CookbookView } from '@/types/cookbook'

/** What a page holds of one character's Magical Recipe Book card. */
export type Card = {
  /** What it last read of the card. */
  view?: CookbookView
  /** The link code just made, shown until its player is done with it. */
  fresh?: string
  /**
   * The read the code just made is checked after: the next begun once it was made, its card's own
   * read for the link the make wrote, so the read that comes with showing the code never takes it
   * back.
   */
  checkAfter?: number
}
