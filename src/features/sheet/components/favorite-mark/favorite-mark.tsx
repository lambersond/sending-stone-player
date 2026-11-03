'use client'

import { createContext, use, type ReactNode } from 'react'
import { Star } from 'lucide-react'

/** What's a favorite, by keys such as "item:<id>"; nothing, until it's given. */
const Marked = createContext<ReadonlySet<string>>(new Set())

/** Marks nothing, as inside the favorites themselves, where every one is one. */
export const NO_MARKS: ReadonlySet<string> = new Set()

/**
 * Has what's a favorite marked with a star wherever the sheet lists it, by keys such as
 * "item:<id>", "effect:<id>" or "skill:<id>".
 */
export function FavoriteMarks({
  keys,
  children,
}: Readonly<{ keys: ReadonlySet<string>; children: ReactNode }>) {
  return <Marked value={keys}>{children}</Marked>
}

/** Is what's listed by this key, such as "item:<id>", a favorite? */
export function useFavorite(key: string | undefined): boolean {
  const keys = use(Marked)
  return key !== undefined && keys.has(key)
}

/** The star by a favorite's name, which a screen reader says as "favorite". */
export function FavoriteStar() {
  return (
    <>
      <Star aria-hidden className='size-3 shrink-0 fill-gold text-gold' />
      <span className='sr-only'>, favorite</span>
    </>
  )
}
