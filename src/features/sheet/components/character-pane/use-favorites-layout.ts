import { useActionsLayout } from '../actions-layout/use-actions-layout'
import type { SheetTab } from './types'
import type { FavoriteEntry } from '@/types/sending-stone'

/** The tabs the character's favorites are shown with, as what's used most there. */
const WITH_FAVORITES = new Set<SheetTab>([
  'actions',
  'inventory',
  'spells',
  'effects',
])

/**
 * How wide the sheet must be, in pixels, for the favorites to have a column of their own beside
 * the tab: room for their column, 360 pixels, about a phone's width, and beside it for the
 * Actions tab's table.
 */
const COLUMN_FROM = 936

/** How wide the favorites' column is, in pixels, where they have one. */
const FAVORITES_COLUMN = 360

/**
 * Where the character's favorites are shown: on a phone or tablet, at the top of the tabs they're
 * shown with (`showsFavorites`); where the sheet is wide enough, in a column beside them
 * (`beside`). And how the Actions tab is laid out, as wide as it is, beside the favorites' column
 * where it has one (`actionsLayout`): kept here, so that the settings offer what it shows from
 * every tab.
 * @param width - How wide the sheet is, in pixels.
 */
export function useFavoritesLayout(
  tab: SheetTab,
  entries: FavoriteEntry[],
  width: number,
) {
  const showsFavorites = WITH_FAVORITES.has(tab) && entries.length > 0
  const beside = showsFavorites && width >= COLUMN_FROM
  const actionsLayout = useActionsLayout(
    entries.length > 0 && width >= COLUMN_FROM
      ? width - FAVORITES_COLUMN
      : width,
  )
  return { showsFavorites, beside, actionsLayout }
}
