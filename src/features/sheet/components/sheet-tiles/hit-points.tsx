'use client'

import clsx from 'clsx'
import type { TableSheet } from '@/types/table'

/**
 * The character's hit points, of how many, and any temporary ones, over a bar of how many are left;
 * the bar at the foot of the tile, should the hit dice beside it make it taller.
 */
export function HitPoints({
  hp,
}: Readonly<{ hp: NonNullable<TableSheet['hp']> }>) {
  const ratio = hp.max ? Math.max(0, Math.min(1, hp.value / hp.max)) : 1
  let bar = 'bg-primary'
  if (ratio <= 0.25) bar = 'bg-danger'
  else if (ratio <= 0.5) bar = 'bg-warning'
  return (
    <span className='flex h-full flex-col justify-between gap-1'>
      <span className='flex flex-wrap items-baseline gap-x-1'>
        <span>{hp.value}</span>
        {hp.max !== null && (
          <span className='font-normal text-text-secondary'> / {hp.max}</span>
        )}
        {hp.temp > 0 && (
          <span className='text-sm text-party'> +{hp.temp} temp</span>
        )}
      </span>
      {hp.max !== null && (
        <span
          aria-hidden
          className='block h-1.5 w-full overflow-hidden rounded-full bg-border'
        >
          <span
            className={clsx('block h-full rounded-full', bar)}
            style={{ width: `${ratio * 100}%` }}
          />
        </span>
      )}
    </span>
  )
}
