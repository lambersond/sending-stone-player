'use client'

import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'

/** The mark that an action opens, turned while it's open. */
export function Chevron({ open }: Readonly<{ open: boolean }>) {
  return (
    <ChevronDown
      aria-hidden
      className={clsx(
        'size-3.5 shrink-0 text-text-secondary transition-transform',
        open && 'rotate-180',
      )}
    />
  )
}
