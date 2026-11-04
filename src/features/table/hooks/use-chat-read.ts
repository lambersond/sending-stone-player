import { useEffect, useRef, useState } from 'react'
import { unreadCount } from '@/features/table/utils/unread'
import type { TableView } from '@/types/table'

/** How far a player has read an empty chat: every message after it is unread. */
const NOTHING_READ = new Date(0).toISOString()

/**
 * Messages from others newer than the newest the player has had in view are unread. How far
 * they have read is kept with the character, so it lasts across visits and devices. On a first
 * visit, what is already there counts as read, and anything after it as unread. The
 * Gamemaster's rolls as the character are the player's to read, though theirs; and at its
 * sheet, the Gamemaster reads all but their own, from the newest when they came, never moving
 * the player's place (#156).
 * @param chatInView - Whether the chat is in view now.
 * @param markChatRead - Saves how far the player has read. A player's page only.
 * @returns How many messages are unread, none while the chat is in view.
 */
export function useChatRead({
  gm,
  initialView,
  view,
  chatInView,
  markChatRead,
}: {
  gm: boolean
  initialView: TableView
  view: TableView
  chatInView: boolean
  markChatRead?: (readAt: string) => Promise<void>
}): number {
  const newest = view.messages.at(-1)?.sentAt ?? ''
  const [seenUpTo, setSeenUpTo] = useState(
    () => (gm ? undefined : initialView.chatReadAt) ?? (newest || NOTHING_READ),
  )
  const readElsewhere = gm ? '' : (view.chatReadAt ?? '')
  if (readElsewhere > seenUpTo) setSeenUpTo(readElsewhere)
  if (chatInView && newest > seenUpTo) setSeenUpTo(newest)
  const unread = chatInView ? 0 : unreadCount(view.messages, gm, seenUpTo)
  const saved = useRef(gm ? seenUpTo : initialView.chatReadAt)
  useEffect(() => {
    if (gm || !markChatRead || seenUpTo === saved.current) return
    saved.current = seenUpTo
    // Failing to save only means those messages count as unread again on another visit.
    markChatRead(seenUpTo).catch(() => {})
  }, [gm, seenUpTo, markChatRead])
  return unread
}
