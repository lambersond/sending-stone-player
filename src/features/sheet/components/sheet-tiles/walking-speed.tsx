'use client'

import { Footprints } from 'lucide-react'
import type { TableSheet } from '@/types/table'

/** The walking speed, as the Speed tile shows it: its value and its units. */
export function WalkingSpeed({
  speed,
}: Readonly<{ speed: NonNullable<TableSheet['speed']> }>) {
  return (
    <span className='inline-flex items-center gap-1'>
      <Footprints aria-hidden className='size-4 text-text-secondary' />
      {speed.value}
      {speed.units && (
        <span className='text-sm font-normal text-text-secondary'>
          {speed.units}
        </span>
      )}
    </span>
  )
}
