'use client'

import { usePathname } from 'next/navigation'
import { isTablePage } from '@/utils/table-pages'
import type { ReactNode } from 'react'

/**
 * What it holds, on every page but a character's own or its party's, whose game takes the whole
 * screen: its own header leads back to the characters, where this is.
 */
export function NotOnCharacterPage({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname()
  if (isTablePage(pathname)) return
  return children
}
