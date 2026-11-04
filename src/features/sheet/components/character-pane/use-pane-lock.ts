import { useCallback, useLayoutEffect, useRef } from 'react'
import type { UnlessLocked } from './types'

/**
 * Whether a pane's rolls are locked now, as a gone companion's are (module 0.36.0), for what was
 * opened before it went, such as a description's menu, to roll nothing after: `lockedNow` as it
 * is at each call, and `unlessLocked`, a call made only while they aren't, checked as it's made.
 */
export function usePaneLock(locked: boolean) {
  const lockedNow = useRef(locked)
  useLayoutEffect(() => {
    lockedNow.current = locked
  }, [locked])
  const unlessLocked = useCallback<UnlessLocked>(
    run =>
      (...args) => {
        if (lockedNow.current) return
        run(...args)
      },
    [],
  )
  return { lockedNow, unlessLocked }
}
