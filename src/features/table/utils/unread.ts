import type { TableMessage } from '@/types/table'

/**
 * Whether a message counts toward the unread: for the player, any but their own rolls, and the
 * Gamemaster's rolls as their character all the same; for the Gamemaster at the sheet, any but
 * their own rolls there.
 */
function countsAsUnread(message: TableMessage, gm: boolean): boolean {
  if (gm) return message.byGm !== true
  return message.side !== 'me' || message.byGm === true
}

/** How many of the messages count as unread: those after the place read up to that count. */
export function unreadCount(
  messages: readonly TableMessage[],
  gm: boolean,
  seenUpTo: string,
): number {
  return messages.filter(
    message => countsAsUnread(message, gm) && message.sentAt > seenUpTo,
  ).length
}
