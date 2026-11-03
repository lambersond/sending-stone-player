'use client'

import { PawPrint } from 'lucide-react'

/** A form's paw, where its art would be. */
export function Paw() {
  return (
    <span
      aria-hidden
      className='flex size-8 shrink-0 items-center justify-center rounded-full bg-wild-bg text-wild'
    >
      <PawPrint className='size-4' />
    </span>
  )
}
