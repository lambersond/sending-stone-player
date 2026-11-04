import clsx from 'clsx'
import { dishState } from './utils'
import type { CookbookDishView } from '@/types/cookbook'

const OUTCOMES: Record<CookbookDishView['outcome'], string> = {
  boon: 'Boon',
  bane: 'Bane',
  standard: 'Standard',
}

/** Each outcome's chip: its word says it, its colour adds nothing a reader would miss. */
const CHIPS: Record<CookbookDishView['outcome'], string> = {
  boon: 'border-primary/30 bg-primary/5 text-primary-text',
  bane: 'border-danger/40 bg-danger/5 text-danger',
  standard: 'border-border bg-page text-text-secondary',
}

/**
 * The dishes a character sent from the Magical Recipe Book, newest first, as its player's card
 * lists them (module 0.38.0): each by its recipe and outcome, and what became of it.
 */
export function CookbookDishList({
  dishes,
  live,
}: Readonly<{
  dishes: CookbookDishView[]
  /** Whether the Gamemaster's game is sending, so that a dish waiting for it can say why. */
  live: boolean
}>) {
  return (
    <ul aria-label='Dishes sent' className='grid gap-1.5 text-sm'>
      {dishes.map(dish => (
        <li
          key={dish.id}
          className='flex flex-col gap-1 rounded-lg bg-page px-3 py-2'
        >
          <span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
            <span className='min-w-0 font-medium break-words'>
              {dish.recipe}
            </span>
            <span
              className={clsx(
                'rounded-full border px-2 py-0.5 text-xs font-medium',
                CHIPS[dish.outcome],
              )}
            >
              {OUTCOMES[dish.outcome]}
            </span>
          </span>
          <span className='text-xs break-words text-text-secondary'>
            {dishState(dish, live)}
          </span>
        </li>
      ))}
    </ul>
  )
}
