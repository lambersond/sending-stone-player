import { useFavoriteChoice } from '../favoriting/use-favorite-choice'
import { useItemMenu } from '../item-menu/use-item-menu'
import { usePrepareChoice } from '../preparing/use-prepare-choice'
import type { FavoriteTarget } from '@/types/roll'
import type { SheetAction } from '@/types/sending-stone'

/**
 * An action's row's own menu, from module 0.37.0: Add to favorites or Remove from favorites, for
 * `target`, or none for null; and for a spell, from module 0.42.1, Prepare or Unprepare, by its
 * id, whichever tab or favorite lists it as an action.
 */
export function useActionMenu(
  action: SheetAction,
  target: FavoriteTarget | null,
): ReturnType<typeof useItemMenu> {
  return useItemMenu(action.name, {
    favorite: useFavoriteChoice(target, action.name),
    prepare: usePrepareChoice(action.type === 'spell' ? action.id : undefined),
  })
}
