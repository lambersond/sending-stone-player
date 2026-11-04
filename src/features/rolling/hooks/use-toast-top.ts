import { useLayoutEffect, useState } from 'react'
import { toastTop } from '@/features/rolling/utils/roll-toasts'

/**
 * Where the toasts start, in pixels from the top of the screen (`toastTop`): below the game's
 * prompts beneath the sheet's row of tabs, while it asks any, else below the row, where it's shown,
 * else below the table's header; none where none is. It's measured before the browser first
 * paints, and again as the layout changes: as the window is resized or turned, the prompts come,
 * go or change, or the row, the pane it's in or the header change size, as the pane does when a
 * note above it, such as the Gamemaster's, comes or wraps, and the row when a phone shows another
 * pane; or as what's above the row in that pane, such as the Wild Shape ribbon (module 0.40.0),
 * comes, goes or changes size, which moves the row though neither it nor the pane changes size.
 * Not measured while toasts are off.
 * @param tabs - The sheet's row of tabs, with the rolls' button and the settings' cog.
 * @param header - The table's header.
 * @param prompts - The game's prompts beneath the row, while it asks any.
 */
export function useToastTop(
  on: boolean,
  tabs?: HTMLElement | null,
  header?: HTMLElement | null,
  prompts?: HTMLElement | null,
): number | undefined {
  const [top, setTop] = useState<number>()
  useLayoutEffect(() => {
    if (!on) return
    const measure = () => setTop(toastTop([prompts, tabs, header]))
    measure()
    const observer = new ResizeObserver(measure)
    const pane = tabs?.parentElement
    for (const element of [prompts, tabs, pane, header]) {
      if (element) observer.observe(element)
    }
    // What's above the row in its pane, each watched as it comes, and no longer once it goes.
    const watchAbove = () => {
      for (
        let above = tabs?.previousElementSibling;
        above;
        above = above.previousElementSibling
      ) {
        observer.observe(above)
      }
    }
    watchAbove()
    const children = new MutationObserver(changes => {
      for (const { removedNodes } of changes) {
        for (const node of removedNodes) {
          if (node instanceof Element) observer.unobserve(node)
        }
      }
      watchAbove()
      measure()
    })
    if (pane) children.observe(pane, { childList: true })
    globalThis.addEventListener('resize', measure)
    globalThis.addEventListener('orientationchange', measure)
    return () => {
      observer.disconnect()
      children.disconnect()
      globalThis.removeEventListener('resize', measure)
      globalThis.removeEventListener('orientationchange', measure)
    }
  }, [on, tabs, header, prompts])
  return top
}
