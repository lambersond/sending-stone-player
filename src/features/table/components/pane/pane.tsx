'use client'

import clsx from 'clsx'
import type { ReactNode } from 'react'

/** The character's sheet, combat or chat. Its classes say when it is shown. */
export function Pane({
  id,
  label,
  className,
  children,
}: Readonly<{
  id: string
  label: string
  className: string
  children: ReactNode
}>) {
  return (
    <section
      id={id}
      aria-label={label}
      className={clsx('min-h-0 min-w-0 flex-1 flex-col', className)}
    >
      {children}
    </section>
  )
}
