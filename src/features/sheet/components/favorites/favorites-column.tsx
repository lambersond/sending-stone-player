'use client'

import { useId } from 'react'
import { Star } from 'lucide-react'
import { FavoritesList } from './favorites-list'
import { Scroller } from '@/components/scroller/scroller'
import type { FavoritesProps } from './types'

/**
 * The character's favorites in a column beside the sheet, as Tidy 5e has them in its sidebar,
 * where the sheet is wide enough for both. It scrolls on its own, so that they stay at hand.
 */
export function FavoritesColumn(props: Readonly<FavoritesProps>) {
  const id = useId()
  return (
    <aside
      aria-labelledby={id}
      className='flex w-90 shrink-0 flex-col border-r border-border'
    >
      <Scroller>
        <div className='flex flex-col gap-2 px-3 py-4 md:py-6'>
          <h2
            id={id}
            className='flex items-center gap-1.5 px-1.5 text-xs font-semibold tracking-wider text-text-secondary uppercase'
          >
            <Star
              aria-hidden
              className='size-3.5 shrink-0 fill-gold text-gold'
            />
            Favorites
          </h2>
          <FavoritesList {...props} />
        </div>
      </Scroller>
    </aside>
  )
}
