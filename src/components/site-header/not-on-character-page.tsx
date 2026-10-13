'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/** A character's own page, such as /characters/abc, but not the list of them. */
const CHARACTER_PAGE = /^\/characters\/[^/]+\/?$/

/** A Gamemaster at one of their campaign's characters' sheets (#156), whose game fills it too. */
const GM_CHARACTER_PAGE = /^\/campaigns\/[^/]+\/characters\/[^/]+\/?$/

/**
 * What it holds, on every page but a character's own, whose game takes the whole screen: its own
 * header leads back to the characters, where this is.
 */
export function NotOnCharacterPage({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname()
  if (CHARACTER_PAGE.test(pathname) || GM_CHARACTER_PAGE.test(pathname)) return
  return children
}
