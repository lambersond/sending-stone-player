'use client'

import { type ReactNode } from 'react'

/** The badge of a card not offered, or the current form's. */
export function Badge({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <span className='shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-text-secondary'>
      {children}
    </span>
  )
}
