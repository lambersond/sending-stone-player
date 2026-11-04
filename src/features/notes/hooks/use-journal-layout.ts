import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

/** Below this width of the modal, the contents are a drawer. */
const NARROW = 640

/**
 * Below this height of the modal, its header, a pane's bar and its footer leave the fields between
 * too little room, as above a phone's keyboard turned sideways: it scrolls as a whole instead,
 * the reader as tall as this, its footer kept in view.
 */
const SHORT = 320

/**
 * The journal's layout by the modal's own size: below NARROW wide its contents are a drawer, open
 * or not, and closed once it's grown past it; below SHORT tall it scrolls as a whole, the field
 * being typed in brought back into view as it turns short.
 */
export function useJournalLayout(container: RefObject<HTMLDivElement | null>) {
  const [drawer, setDrawer] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [short, setShort] = useState(false)
  // The modal's own size, not the screen's: below 640 px wide the contents are a drawer, inert
  // while it's closed; below 320 px tall it scrolls as a whole. Measured as it's drawn, and as it
  // changes, as a phone turns or a keyboard comes up.
  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const measure = ({ width, height }: { width: number; height: number }) => {
      // Not laid out yet: nothing to go by.
      if (width > 0) setNarrow(width < NARROW)
      if (height > 0) setShort(height < SHORT)
    }
    measure(element.getBoundingClientRect())
    const observer = new ResizeObserver(([entry]) => {
      if (entry) measure(entry.contentRect)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [container])
  // Grown past it, the contents are a pane again, and no drawer is open.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a commit after it grew, as ever
    if (!narrow) setDrawer(false)
  }, [narrow])
  // Turned short, as a keyboard comes up under the field being typed in, the journal scrolls from
  // its top: the field is brought back into view, above the footer.
  useLayoutEffect(() => {
    const focused = document.activeElement
    if (short && focused && container.current?.contains(focused)) {
      focused.scrollIntoView?.({ block: 'nearest' })
    }
  }, [short, container])

  return { drawer, setDrawer, narrow, short }
}
