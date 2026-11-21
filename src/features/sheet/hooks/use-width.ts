'use client'

import { useLayoutEffect, useState } from 'react'

/**
 * An element's width in pixels, kept up to date as it changes; 0 until it's measured. It's
 * measured before the browser first paints it, so what depends on it doesn't flicker. The
 * element drawn in its place is watched in turn, as the favorites' card is once Reorder closes
 * (ROADMAP item 75); while none is drawn, it keeps the last width it measured.
 * @param element - The element, kept in state by its `ref`, as `useState`'s setter keeps it.
 */
export function useWidth(element: HTMLElement | null): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    if (!element) return
    const measure = () => setWidth(element.offsetWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return width
}
