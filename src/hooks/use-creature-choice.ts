'use client'

import { useCallback, useSyncExternalStore } from 'react'

/*
 * Which creature a seat's Character pane shows (module 0.36.0): its character, 'self', or one of
 * its companions, by key. Kept for the browser tab alone, per seat, so that a reload keeps it and
 * another tab at the same seat chooses its own.
 */

/** Where a seat's choice is kept, for this tab. */
export const CREATURE_KEY = 'sending-stone:creature'

/** Choices kept for this page alone, where the tab keeps none, as in some private windows. */
const unsaved = new Map<string, string>()
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function read(key: string): string | undefined {
  try {
    return globalThis.sessionStorage.getItem(key) ?? undefined
  } catch {
    return unsaved.get(key)
  }
}

function write(key: string, value: string) {
  try {
    globalThis.sessionStorage.setItem(key, value)
  } catch {
    unsaved.set(key, value)
  }
  for (const listener of listeners) listener()
}

/**
 * The creature a seat's Character pane shows, and a way to choose another: 'self' for its
 * character, or a companion's key. Kept per seat for this tab; 'self' until one is chosen, where
 * the tab keeps nothing, and where the one kept isn't among the keys now, as a companion gone.
 * The server, and the first render in the browser, have 'self', so that both render the same.
 * @param seatKey - The seat's key, as its table page has it.
 * @param keys - Its companions' keys, as its view lists them.
 */
export function useCreatureChoice(
  seatKey: string,
  keys: readonly string[],
): [string, (key: string) => void] {
  const key = `${CREATURE_KEY}:${seatKey}`
  const kept = useSyncExternalStore(
    subscribe,
    () => read(key) ?? 'self',
    () => 'self',
  )
  const choose = useCallback((next: string) => write(key, next), [key])
  return [keys.includes(kept) ? kept : 'self', choose]
}
