import { useFavoriteChoice } from '../favoriting/use-favorite-choice'
import { useItemMenu } from '../item-menu/use-item-menu'
import type { OtherActivity } from './types'
import type { FavoriteTarget } from '@/types/roll'

/**
 * The menu of one of an action's other activities, from module 0.37.0: adding the activity itself
 * to the favorites, by its item and its own id, or removing it, where the pane offers them.
 */
export function useActivityMenu(
  other: OtherActivity,
): ReturnType<typeof useItemMenu> {
  const target: FavoriteTarget = {
    type: 'activity',
    id: other.activity.id,
    item: other.action.id,
  }
  return useItemMenu(other.name, {
    favorite: useFavoriteChoice(target, other.name),
  })
}
