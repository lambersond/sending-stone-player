import { createContext, use } from 'react'

/** What's a favorite, by keys such as "item:<id>"; nothing, until it's given. */
export const Marked = createContext<ReadonlySet<string>>(new Set())

/** Is what's listed by this key, such as "item:<id>", a favorite? */
export function useFavorite(key: string | undefined): boolean {
  const keys = use(Marked)
  return key !== undefined && keys.has(key)
}
