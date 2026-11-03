'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { isTablePage } from '@/utils/table-pages'

/**
 * Ends full screen on leaving the pages a game fills, as closing a video does: it lasts from a
 * character's sheet to its party's and back, which unmount the table between them, and ends on
 * the way back to the list. Only the page's own full screen ends: an element another feature made
 * full screen is left alone, as is the browser's own, which the page can't see.
 */
export function FullscreenGuard(): undefined {
  const pathname = usePathname()
  useEffect(() => {
    if (
      !isTablePage(pathname) &&
      document.fullscreenElement === document.documentElement
    ) {
      document.exitFullscreen().catch(() => {})
    }
  }, [pathname])
}
