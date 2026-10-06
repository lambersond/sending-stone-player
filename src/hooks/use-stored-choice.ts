'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** Choices kept for this page alone, where the browser keeps none, as in some private windows. */
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
    return globalThis.localStorage.getItem(key) ?? undefined
  } catch {
    return unsaved.get(key)
  }
}

function write(key: string, value: string) {
  try {
    globalThis.localStorage.setItem(key, value)
  } catch {
    unsaved.set(key, value)
  }
  for (const listener of listeners) listener()
}

/**
 * A choice this browser remembers, such as how a list is laid out: one of `choices`, or
 * `fallback` until one is made. The server, and the first render in the browser, have the
 * fallback, so that both render the same.
 */
export function useStoredChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): [T, (choice: T) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => read(key) ?? fallback,
    () => fallback,
  )
  const choose = useCallback((choice: T) => write(key, choice), [key])
  return [choices.find(choice => choice === stored) ?? fallback, choose]
}
