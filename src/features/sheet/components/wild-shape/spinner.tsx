'use client'

import { LoaderCircle } from 'lucide-react'

/** A spinner, beside a control's words while what it pressed is on its way. */
export function Spinner() {
  return (
    <LoaderCircle
      aria-hidden
      className='size-4 shrink-0 motion-safe:animate-spin'
    />
  )
}
