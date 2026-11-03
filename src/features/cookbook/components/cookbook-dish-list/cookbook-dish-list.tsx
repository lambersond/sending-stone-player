import clsx from 'clsx'
import { DISH_ATTEMPTS } from '@/constants/cookbook'
import { formatModifier } from '@/utils/format-modifier'
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

/** What became of a dish, in its player's words. */
function dishState(dish: CookbookDishView, live: boolean): string {
  switch (dish.state) {
    case 'queued':
    case 'claimed': {
      return live
        ? 'Waiting for Foundry'
        : 'Waiting for Foundry · your Gamemaster’s game isn’t open'
    }
    case 'delivered': {
      return 'With your Gamemaster'
    }
    case 'applied': {
      // Served before the Gamemaster's choice of who ate it is heard of, the names come later.
      const who =
        dish.eatenBy.length > 0
          ? `Eaten by ${namesOf(dish.eatenBy)}`
          : 'Served in Foundry'
      return [who, ...dish.rolled.map(rolled => rolledWords(rolled))].join(
        ' · ',
      )
    }
    case 'dismissed': {
      return dish.reason === 'deleted'
        ? 'Removed in Foundry'
        : 'Set aside by your Gamemaster'
    }
    case 'failed': {
      if (dish.reason === 'undeliverable') {
        return `Couldn’t reach the game: Foundry didn’t answer after ${DISH_ATTEMPTS} tries.`
      }
      if (dish.reason === 'invalid') {
        return 'Couldn’t reach the game: your Gamemaster’s Foundry couldn’t read this dish.'
      }
      return `Couldn’t reach the game: Foundry refused it (${dish.reason}).`
    }
  }
}

/** Names as a sentence lists them: "Thorin", "Thorin and Vex", "Thorin, Vex and Rook". */
function namesOf(names: string[]): string {
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** A value its dice rolled once in the cookbook: "Max HP +7 (3+1d6)". */
function rolledWords({
  type,
  value,
  formula,
}: CookbookDishView['rolled'][number]): string {
  const kind = type === 'maxHitPoints' ? 'Max HP' : type
  return `${kind} ${formatModifier(value)}${formula ? ` (${formula})` : ''}`
}
