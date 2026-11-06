import { useLayoutEffect, useRef } from 'react'
import type { Tab } from '@/features/table/types'
import type { TableMessage } from '@/types/table'

/**
 * Keep the chat pinned to the newest message unless the player has scrolled up to read: as
 * messages come, and as the chat grows or shrinks, as when the dice tray beneath it opens (v0.44).
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
  useLayoutEffect(() => {
    const element = scroller.current
    if (!element || !chatInView) return
    const observer = new ResizeObserver(() => {
      if (pinned.current) element.scrollTop = element.scrollHeight
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [chatInView])
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
