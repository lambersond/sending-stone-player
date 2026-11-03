'use client'

import clsx from 'clsx'
import { hpBar } from '@/features/table/utils/combat'
import type { TableCombatant } from '@/types/table'

/**
 * A combatant's hit points, where players may see them: how many, of how many, with any temporary
 * ones; and a bar where it has a maximum.
 */
export function HitPoints({
  hp,
}: Readonly<{ hp: NonNullable<TableCombatant['hp']> }>) {
  const { percent, bar } = hpBar(hp)
  return (
    <>
      <span className='text-sm font-semibold tabular-nums'>
        <span className='sr-only'>Hit points </span>
        {hp.value}
        {hp.max !== null && (
          <span className='font-normal text-text-secondary'> / {hp.max}</span>
        )}
        {hp.temp > 0 && <span className='text-party'> +{hp.temp} temp</span>}
      </span>
      {percent !== undefined && (
        <span
          aria-hidden
          className='block h-1.5 w-24 overflow-hidden rounded-full bg-border'
        >
          <span
            className={clsx('block h-full rounded-full', bar)}
            style={{ width: `${percent}%` }}
          />
        </span>
      )}
    </>
  )
}
