'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * An element's width in pixels, kept up to date as it changes; 0 until it's measured. It's
 * measured before the browser first paints it, so what depends on it doesn't flicker.
 */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setWidth(element.offsetWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
