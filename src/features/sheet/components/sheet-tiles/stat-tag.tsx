'use client'

import { PawPrint } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Whose a number is on a shaped sheet (module 0.40.0), after its label: the form's name, or the
 * Circle of the Moon's, in the wild colour, with a paw; its words read as they're written.
 */
export function StatTag({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className='ml-1.5 inline-flex items-center gap-0.5 text-[10px] tracking-wide text-wild'>
      <PawPrint aria-hidden className='size-2.5 shrink-0' />
      {children}
    </span>
  )
}
