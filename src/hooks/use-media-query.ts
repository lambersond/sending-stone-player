import { useCallback, useSyncExternalStore } from 'react'

/**
 * Does the window match a media query, such as `(min-width: 64rem)`? False on the server and in
 * the first render in the browser, so that both render the same; then kept up to date as the
 * window changes.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = globalThis.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => globalThis.matchMedia(query).matches,
    () => false,
  )
}
