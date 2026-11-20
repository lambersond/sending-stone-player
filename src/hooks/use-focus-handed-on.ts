'use client'

import { useLayoutEffect, type RefObject } from 'react'
import { placesBeside } from '@/utils/focus-beside'

/**
 * Hands focus on as an element goes from the page with focus on it or in its row: once the page
 * has settled, where focus has been lost (to the page's body, or nothing), to the first still on
 * the page of the places beside it as it stood (`placesBeside`), as End Turn hands it to its
 * turn's heading. Never where focus is anywhere else by then. Read as it was drawn first, as End
 * Turn's is.
 * @param ref - The element, as drawn.
 * @param on - Whether it hands focus on at all: a row with no move doesn't.
 */
export function useFocusHandedOn(
  ref: RefObject<HTMLElement | null>,
  on = true,
): void {
  useLayoutEffect(() => {
    const own = ref.current
    if (!on || !own) return
    // Its cleanup runs while it still stands, as it goes: what's beside it is read then.
    return () => {
      const row = own.closest('li') ?? own
      if (!row.contains(document.activeElement)) return
      const beside = placesBeside(own)
      // Once what goes with it has gone, and only where focus went with it.
      queueMicrotask(() => {
        const active = document.activeElement
        if (active && active !== document.body && active.isConnected) return
        beside.find(place => place.isConnected)?.focus()
      })
    }
  }, [ref, on])
}
