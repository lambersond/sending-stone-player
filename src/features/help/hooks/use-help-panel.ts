import { useCallback, useEffect, useRef, useState } from 'react'
import type { ShowHelp } from '@/features/help/types'

/**
 * Help, opened from the header's button or the settings menu, and closed: focus goes back to what
 * opened it, once the panel has closed and the page behind it takes focus again, whichever way it
 * closed, by Escape, Close or a tap beside it. A browser gives a dialog's focus back to what had it
 * as it opened; this also covers what had none, as a button tapped in Safari, and the settings'
 * entry, gone with the menu, whose cog takes it instead.
 */
export function useHelpPanel(): {
  open: boolean
  show: ShowHelp
  close: () => void
} {
  // What opened it while it's open: null for nothing to go back to; undefined while closed.
  const [opener, setOpener] = useState<HTMLElement | null>()
  const back = useRef<HTMLElement | null>(null)
  const open = opener !== undefined
  // After the panel's own close, as the page behind it is no longer inert.
  useEffect(() => {
    if (open) return
    const to = back.current
    back.current = null
    to?.focus({ preventScroll: true })
  }, [open])
  const show = useCallback<ShowHelp>(from => setOpener(from), [])
  // Once: the dialog's own close event follows Close's, and a second must not forget the opener.
  const close = () => {
    if (opener === undefined) return
    back.current = opener
    setOpener(undefined)
  }
  return { open, show, close }
}
