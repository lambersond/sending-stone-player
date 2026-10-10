'use client'

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
  type Ref,
} from 'react'

/**
 * Where menus and tooltips open: inside the modal dialog they're opened from, as the page behind
 * one is inert and drawn under it; or the page itself, outside any. Null while a dialog's element
 * isn't there yet, for a menu to wait for it rather than open on the page.
 */
const PortalRoot = createContext<HTMLElement | null | undefined>(undefined)

/**
 * The element a menu or tooltip opened here goes in, as floating-ui's `FloatingPortal` takes it:
 * a modal dialog's, inside one; undefined for the page's own body.
 */
export function usePortalRoot(): HTMLElement | null | undefined {
  return use(PortalRoot)
}

/** Has the menus and tooltips opened inside it go in this element: a modal dialog's. */
export function InPortalRoot({
  root,
  children,
}: Readonly<{ root: HTMLElement | null; children: ReactNode }>) {
  return <PortalRoot value={root}>{children}</PortalRoot>
}

/**
 * A modal dialog's element, kept for menus and tooltips opened inside it to go in, with a ref to
 * give the element that also keeps it in `ref`.
 * @param ref - Where the dialog is kept for showing and closing it.
 */
export function useDialogRoot<T extends HTMLElement>(ref: {
  current: T | null
}): { root: T | null; attach: Ref<T> } {
  // eslint-disable-next-line unicorn/no-null -- floating-ui waits for a root that's null
  const [root, setRoot] = useState<T | null>(null)
  const attach = useCallback(
    (node: T | null) => {
      ref.current = node
      setRoot(node)
    },
    [ref],
  )
  return { root, attach }
}

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
