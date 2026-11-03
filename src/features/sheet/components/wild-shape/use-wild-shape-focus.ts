import { useEffect, type RefObject } from 'react'
import { dialogOf } from './utils'
import type { Focus } from './types'

/**
 * Focus, where it was asked to go (`focus`), once what takes it is drawn: after the dialog has
 * closed, which gives focus back to what opened it. The ribbon's heading, the tab's panel, an
 * element, or one in the dialog, else the one standing in for it.
 */
export function useWildShapeFocus({
  focus,
  setFocus,
  heading,
  body,
  panel,
}: Readonly<{
  focus: Focus | undefined
  setFocus: (focus: Focus | undefined) => void
  heading: RefObject<HTMLHeadingElement | null>
  body: RefObject<HTMLDivElement | null>
  panel: () => HTMLElement | null
}>) {
  useEffect(() => {
    if (!focus) return
    setFocus(undefined)
    if (focus === 'heading') {
      heading.current?.focus()
    } else if (focus === 'panel') {
      panel()?.focus()
    } else if (focus instanceof HTMLElement) {
      if (focus.isConnected) focus.focus()
    } else {
      const inside = dialogOf(body)
      const found =
        inside?.querySelector<HTMLElement>(focus.selector) ??
        (focus.or ? inside?.querySelector<HTMLElement>(focus.or) : undefined)
      found?.focus()
    }
  }, [focus, panel, setFocus, heading, body])
}
