import { useLayoutEffect, useRef } from 'react'
import type { Tab } from '@/features/table/types'
import type { TableMessage } from '@/types/table'

/**
 * Keep the chat pinned to the newest message unless the player has scrolled up to read.
 * @param chatInView - Whether the chat is in view now.
 * @param messages - The chat's messages, as the table's view has them.
 * @returns The chat's scroller and its scroll handler; and `pinFor`, which starts the chat from the
 *   newest message again as its tab is shown.
 */
export function useChatScroll(
  chatInView: boolean,
  messages: readonly TableMessage[],
) {
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  useLayoutEffect(() => {
    const element = scroller.current
    if (element && chatInView && pinned.current) {
      element.scrollTop = element.scrollHeight
    }
  }, [chatInView, messages])
  const onScroll = () => {
    const element = scroller.current
    if (element && chatInView) {
      pinned.current =
        element.scrollHeight - element.scrollTop - element.clientHeight < 80
    }
  }
  const pinFor = (next: Tab) => {
    // Back on the chat, start from the newest message.
    if (next === 'chat') pinned.current = true
  }
  return { scroller, onScroll, pinFor }
}
