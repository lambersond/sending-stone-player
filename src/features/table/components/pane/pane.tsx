'use client'

import clsx from 'clsx'
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
      className={clsx(
        'min-h-0 min-w-0 flex-1 flex-col',
        focusable && 'outline-none',
        className,
      )}
    >
      {children}
    </section>
  )
}
