'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

/** Values kept for this page alone, where the browser keeps none, as in some private windows. */
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
 * What this browser keeps under a key, or `fallback` until something is. The server, and the
 * first render in the browser, have the fallback, so that both render the same.
 */
function useStored(key: string, fallback: string): string {
  return useSyncExternalStore(
    subscribe,
    () => read(key) ?? fallback,
    () => fallback,
  )
}

/**
 * A choice this browser remembers, such as how a list is laid out: one of `choices`, or
 * `fallback` until one is made.
 */
export function useStoredChoice<T extends string>(
  key: string,
  choices: readonly T[],
  fallback: T,
): [T, (choice: T) => void] {
  const stored = useStored(key, fallback)
  const choose = useCallback((choice: T) => write(key, choice), [key])
  return [choices.find(choice => choice === stored) ?? fallback, choose]
}

/**
 * A set of names this browser remembers, such as the groups of a list that are closed, with a
 * toggle that adds a name or takes it out. It starts empty.
 */
export function useStoredSet(
  key: string,
): [ReadonlySet<string>, (name: string) => void] {
  const stored = useStored(key, '[]')
  const names = useMemo(() => new Set(parseNames(stored)), [stored])
  const toggle = useCallback(
    (name: string) => {
      const next = new Set(names)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      write(key, JSON.stringify([...next]))
    },
    [key, names],
  )
  return [names, toggle]
}

/** The names kept as JSON, or none for anything else, such as a value from elsewhere. */
function parseNames(stored: string): string[] {
  try {
    const names: unknown = JSON.parse(stored)
    return Array.isArray(names)
      ? names.filter((name): name is string => typeof name === 'string')
      : []
  } catch {
    return []
  }
}
