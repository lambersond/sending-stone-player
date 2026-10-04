import { useSyncExternalStore } from 'react'

// Nothing to listen to: whether the page has hydrated never changes afterwards.
const noop = () => {}
const subscribe = () => noop

/**
 * Has the page hydrated? False on the server and in the first render in the browser, so what
 * only the browser knows (a saved setting, the local time zone) can be shown without the
 * server's render and the browser's disagreeing.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
