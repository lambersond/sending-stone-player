import type { SheetAction } from '@/types/sending-stone'

/**
 * An action's name for its rolls: an item's, and the activity it's listed for, where it isn't the
 * item's first, such as "Staff (Silvery Barbs)".
 */
export function actionTitle(
  action: Pick<SheetAction, 'name' | 'activityName'>,
): string {
  return action.activityName
    ? `${action.name} (${action.activityName})`
    : action.name
}

/**
 * What using an action in the game is called: casting, for a spell, or one an item casts, but for
 * one of a spell's activities used after it's cast, without spending a slot or the item's uses,
 * such as Spirit Guardians' save each turn; and casting, for a spell cast through an activity that
 * uses another, such as its free casting.
 */
export function verbOf(action: SheetAction): 'Cast' | 'Use' {
  // A spell cast through an activity that uses another, such as its free casting, spends no slot,
  // but is cast all the same.
  if (action.forward) return action.type === 'spell' ? 'Cast' : 'Use'
  if (action.consumesSlot === false) return 'Use'
  return action.type === 'spell' || !!action.cast ? 'Cast' : 'Use'
}
