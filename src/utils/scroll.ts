/**
 * Scrolls an element to the top of what scrolls it, as a panel's "Go to" chips do: smoothly, unless
 * the device asks for reduced motion, when it's there at once.
 */
export function scrollToStart(element: Element | null | undefined): void {
  const reduced = globalThis.matchMedia?.(
    '(prefers-reduced-motion: reduce)',
  ).matches
  element?.scrollIntoView?.({
    block: 'start',
    behavior: reduced ? 'auto' : 'smooth',
  })
}
