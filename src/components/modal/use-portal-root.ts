import { createContext, use } from 'react'

/**
 * Where menus and tooltips open: inside the modal dialog they're opened from, as the page behind
 * one is inert and drawn under it; or the page itself, outside any. Null while a dialog's element
 * isn't there yet, for a menu to wait for it rather than open on the page.
 */
export const PortalRoot = createContext<HTMLElement | null | undefined>(
  undefined,
)

/**
 * The element a menu or tooltip opened here goes in, as floating-ui's `FloatingPortal` takes it:
 * a modal dialog's, inside one; undefined for the page's own body.
 */
export function usePortalRoot(): HTMLElement | null | undefined {
  return use(PortalRoot)
}
