'use client'

import { Badge } from './badge'
import { Paw } from './paw'
import { formStats } from './utils'
import { badgeOf, ONLY_IN_FOUNDRY, sizeCrWords } from '@/utils/wild-shape-words'
import type { KnownForm } from '@/types/sending-stone'

/** A known form's card's face: its name, size and CR, its statistics, and its badge. */
export function FormFace({
  known,
  acFloor,
  now,
  nameFocus,
}: Readonly<{
  known: KnownForm
  acFloor: number | null
  now: boolean
  /** Its name takes focus, as the manager's card does once it's learned. */
  nameFocus?: boolean
}>) {
  const badge = badgeOf(known)
  const stats = known.pool ? formStats(known, acFloor) : {}
  const line = known.pool ? sizeCrWords(known.size, known.cr) : ''
  return (
    <>
      <span className='flex items-center gap-2.5'>
        <Paw />
        <span className='min-w-0 flex-1'>
          <span
            {...(nameFocus && {
              tabIndex: -1,
              'data-ws-focus': `form:${known.id}`,
            })}
            className='block font-semibold outline-none'
          >
            {known.name}
          </span>
          {line && (
            <span className='block text-xs text-text-secondary'>{line}</span>
          )}
        </span>
        {now && <Badge>Now</Badge>}
        {!now && badge && <Badge>{badge}</Badge>}
      </span>
      {(stats.ac || stats.speeds || stats.attack) && (
        <span className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary'>
          {stats.ac && (
            <span className='font-semibold text-text-primary'>{stats.ac}</span>
          )}
          {stats.speeds && <span>{stats.speeds}</span>}
          {stats.attack && <span>{stats.attack}</span>}
        </span>
      )}
      {!now && badge && (
        <span className='text-xs text-text-secondary'>{ONLY_IN_FOUNDRY}</span>
      )}
    </>
  )
}
