'use client'

import { useId } from 'react'
import clsx from 'clsx'
import { ChevronDown, Star } from 'lucide-react'
import { FavoritesList } from './favorites-list'
import { useStoredChoice } from '@/hooks/use-stored'
import type { FavoritesProps } from './types'

/** Where this browser keeps whether the favorites are shown, after which the character's id. */
const SHOWN_KEY = 'sending-stone:favorites-shown'
const SHOWN = ['open', 'closed'] as const

/**
 * The character's favorites at the top of a tab, as on a phone or tablet: under a heading that
 * hides them, or shows them again, which this browser remembers for the character.
 */
export function FavoritesStrip(props: Readonly<FavoritesProps>) {
  const { characterId, entries } = props
  const [shown, show] = useStoredChoice(
    `${SHOWN_KEY}:${characterId}`,
    SHOWN,
    'open',
  )
  const open = shown === 'open'
  const id = useId()
  const count = entries.length
  return (
    <section aria-labelledby={`${id}-heading`} className='flex flex-col gap-2'>
      <h2>
        <button
          type='button'
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onClick={() => show(open ? 'closed' : 'open')}
          className='-mx-1.5 flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-primary/5'
        >
          <ChevronDown
            aria-hidden
            className={clsx(
              'size-3.5 shrink-0 text-text-secondary transition-transform',
              !open && '-rotate-90',
            )}
          />
          <Star aria-hidden className='size-3.5 shrink-0 fill-gold text-gold' />
          <span
            id={`${id}-heading`}
            className='text-xs font-semibold tracking-wider text-text-secondary uppercase'
          >
            Favorites
          </span>
          <span className='text-xs text-text-secondary tabular-nums opacity-70'>
            <span aria-hidden>{count}</span>
            <span className='sr-only'>, {count}</span>
          </span>
        </button>
      </h2>
      {/* Hidden, its favorites are kept, each as open as it was. */}
      <div id={`${id}-list`} hidden={!open}>
        <FavoritesList {...props} />
      </div>
    </section>
  )
}
