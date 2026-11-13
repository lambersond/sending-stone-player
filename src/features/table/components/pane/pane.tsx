'use client'

import clsx from 'clsx'
import { TABLE_PANE } from '@/features/table/constants'
import type { ReactNode } from 'react'

/**
 * The character's sheet, combat or chat. Its classes say when it is shown.
 * @param focusable - Whether focus may be moved to it, as to combat or the chat on a phone as a
 *   notice above it is dismissed.
 */
export function Pane({
  id,
  label,
  className,
  focusable = false,
  children,
}: Readonly<{
  id: string
  label: string
  className: string
  focusable?: boolean
  children: ReactNode
}>) {
  return (
    <section
      id={id}
      aria-label={label}
      tabIndex={focusable ? -1 : undefined}
      className={clsx(TABLE_PANE, focusable && 'outline-none', className)}
    >
      {children}
    </section>
  )
}
