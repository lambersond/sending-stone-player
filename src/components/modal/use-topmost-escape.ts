import { useEffect } from 'react'

/**
 * While a menu or tooltip is open, has Escape close only it, and not a modal dialog it's in too.
 * floating-ui closes it on Escape by stopping the key going further, but the browser still takes
 * the key as a request to close the dialog, unless it's cancelled, as this does.
 * @param open - Whether the menu or tooltip is open.
 */
export function useTopmostEscape(open: boolean): void {
  useEffect(() => {
    if (!open) return
    const keep = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) event.preventDefault()
    }
    // First, before floating-ui's own, whatever has focus.
    document.addEventListener('keydown', keep, true)
    return () => document.removeEventListener('keydown', keep, true)
  }, [open])
}
