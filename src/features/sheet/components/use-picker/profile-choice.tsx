'use client'

import { useId } from 'react'
import clsx from 'clsx'
import { Chip } from './chip'
import { ChipRow } from './chip-row'
import type { ProfileOption } from './types'

/**
 * The most ways to enchant, or creatures to summon, shown as chips, side by side; more are listed
 * one under another, as a phone has room for only so many long names.
 */
const MOST_PROFILE_CHIPS = 4

/**
 * The ways an enchant activity may enchant at the level chosen, or from module 0.54.0 the creatures
 * a summon activity may summon there, one of which is chosen, under its `label`: as chips, each
 * name cut short where it's long, the whole of it said; or, for more than a row's worth, listed one
 * under another. That none is offered at that level is said, in its `empty` words, where none is.
 */
export function ProfileChoice({
  label,
  empty,
  profiles,
  chosen,
  onChoose,
}: Readonly<{
  label: string
  empty: string
  profiles: ProfileOption[]
  chosen?: string
  onChoose: (id: string) => void
}>) {
  const legend = useId()
  if (profiles.length === 0) {
    return <p className='text-sm text-text-secondary'>{empty}</p>
  }
  if (profiles.length <= MOST_PROFILE_CHIPS) {
    return (
      <ChipRow label={label}>
        {profiles.map(({ id, name, label: said }) => (
          <Chip
            key={id}
            selected={id === chosen}
            onSelect={() => onChoose(id)}
            label={said ?? name}
          >
            <span className='block truncate'>{name}</span>
          </Chip>
        ))}
      </ChipRow>
    )
  }
  return (
    <div>
      <p
        id={legend}
        className='mb-1.5 text-xs font-semibold text-text-secondary'
      >
        {label}
      </p>
      <div
        role='radiogroup'
        aria-labelledby={legend}
        className='flex flex-col gap-1.5'
      >
        {profiles.map(({ id, name, label: said }) => (
          <button
            key={id}
            type='button'
            role='radio'
            aria-checked={id === chosen}
            aria-label={said ?? name}
            onClick={() => onChoose(id)}
            className={clsx(
              'flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-1.5 text-left text-sm font-semibold transition-colors',
              id === chosen
                ? 'border-primary bg-primary/10 text-primary-text'
                : 'border-border hover:bg-primary/5',
            )}
          >
            <span
              aria-hidden
              className={clsx(
                'size-3.5 shrink-0 rounded-full border',
                id === chosen ? 'border-4 border-primary' : 'border-border',
              )}
            />
            <span className='min-w-0 flex-1 truncate'>{name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
