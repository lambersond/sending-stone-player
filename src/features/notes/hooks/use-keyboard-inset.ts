'use client'

import { useEffect, useState, type CSSProperties } from 'react'

/** From this width of screen the journal is a bordered window, not the whole screen (`sm`). */
const BORDERED = '(min-width: 640px)'

/** How far a bordered window stays from the top of what's left above the keyboard, in pixels. */
const GAP = 8

/**
 * Where the journal's dialog goes while an on-screen keyboard is up (round 0.35.0 §8.4): an iPhone
 * or Android phone, upright or turned sideways, or a tablet, shortens the visual viewport rather
 * than the window, so a dialog sized by the window has its bottom, and the editor's Save, under
 * the keyboard. While `active` and the browser says how much of the window shows, the dialog is
 * placed in that: full screen, as tall as it is; bordered, at most that tall, a little in from its
 * top and bottom. With no keyboard up it's left to its own classes.
 * @param active - The dialog is open.
 * @returns The style to set on the dialog, or none.
 */
export function useKeyboardInset(active: boolean): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>()

  useEffect(() => {
    const viewport = globalThis.visualViewport
    if (!active || !viewport) {
      setStyle(undefined)
      return
    }
    const fit = () => {
      // A keyboard shortens what shows of the window; a rounding pixel isn't one.
      if (globalThis.innerHeight - viewport.height <= 1) {
        setStyle(undefined)
        return
      }
      const bordered = globalThis.matchMedia(BORDERED).matches
      const height = `${viewport.height - (bordered ? GAP * 2 : 0)}px`
      setStyle({
        marginBlock: 0,
        bottom: 'auto',
        minHeight: 0,
        top: `${viewport.offsetTop + (bordered ? GAP : 0)}px`,
        ...(bordered ? { maxHeight: height } : { height }),
      })
    }
    fit()
    viewport.addEventListener('resize', fit)
    viewport.addEventListener('scroll', fit)
    return () => {
      viewport.removeEventListener('resize', fit)
      viewport.removeEventListener('scroll', fit)
    }
  }, [active])

  return active ? style : undefined
}
