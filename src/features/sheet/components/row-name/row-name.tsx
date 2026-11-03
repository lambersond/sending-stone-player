'use client'

import { LoaderCircle } from 'lucide-react'
import { FavoriteStar } from '../favorite-mark/favorite-star'
import type { ReactNode } from 'react'

/**
 * A row's name, cut short where it's long, with its marks beside it, where they line up from row to
 * row whatever each rolls: a spinner while it's `busy`, a star where it's a favorite, then those
 * given, such as an enchantment's mark and the chevron; and under it, what to say of it.
 */
export function RowName({
  name,
  favorite,
  busy = false,
  detail,
  children,
}: Readonly<{
  name: string
  /** Whether it's among the favorites. */
  favorite: boolean
  /** On a party's sheet, from module 0.33.0's feedback: while it's on its way. */
  busy?: boolean
  detail?: string
  children?: ReactNode
}>) {
  return (
    <span className='min-w-0 flex-1'>
      <span className='flex items-center gap-1'>
        <span className='truncate font-medium'>{name}</span>
        {busy && (
          <LoaderCircle
            aria-hidden
            className='size-3.5 shrink-0 text-text-secondary motion-safe:animate-spin'
          />
        )}
        {favorite && <FavoriteStar />}
        {children}
      </span>
      {detail && (
        <span className='block truncate text-xs text-text-secondary'>
          {detail}
        </span>
      )}
    </span>
  )
}
