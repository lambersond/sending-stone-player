'use client'

import { Marked } from './use-favorite'
import type { ReactNode } from 'react'

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
