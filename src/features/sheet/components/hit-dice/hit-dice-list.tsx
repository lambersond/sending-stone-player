'use client'

import clsx from 'clsx'
import { HitDieIcon } from './hit-die-icon'
import { HitDieUse, leftOf } from './hit-die-use'
import { countOf } from './utils'
import type { HitDieSpending } from './types'
import type { HitDicePool } from '@/types/roll'

/**
 * A character's hit dice, a row for each size, the largest first: its die, its size, how many are
 * left of how many, such as 3/5, in ruby with none left, and a button that spends them; or, where
 * nothing rolls them, no button. Each row is as wide as it can be, side by side where there's room
 * for them; where there's no room for its count beside its size, the count goes under it, the
 * button staying beside them. In a tile too narrow for a die as well as a count such as 10/12 and
 * the button, under 150 pixels, as on a phone under 375 pixels wide, the die is left out: the size
 * beside it says what it shows.
 */
export function HitDiceList({
  pools,
  spending,
}: Readonly<{ pools: HitDicePool[]; spending?: HitDieSpending }>) {
  return (
    <ul className='flex flex-wrap gap-x-4 gap-y-1.5'>
      {pools.map(pool => (
        <li
          key={pool.die}
          className='flex min-w-0 flex-[1_1_9rem] items-center gap-2'
        >
          <HitDieIcon
            die={pool.die}
            className='size-5 text-primary @max-[150px]:hidden'
          />
          {/* What the button says to a screen reader, or the words after it, says too. */}
          <span
            aria-hidden
            className='flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 text-sm'
          >
            <span className='font-semibold'>{pool.die}</span>
            <span
              className={clsx(
                'tabular-nums',
                pool.value === 0
                  ? 'font-semibold text-ruby'
                  : 'font-normal text-text-secondary',
              )}
            >
              {countOf(pool)}
            </span>
          </span>
          {spending ? (
            <HitDieUse pool={pool} spending={spending} />
          ) : (
            <span className='sr-only'>
              {pool.die}, {leftOf(pool, 'an unknown number')}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
