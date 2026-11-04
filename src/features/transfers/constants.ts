import type { TransferControls } from '@/features/transfers/types'

/** Nothing to move with, as where the game takes no moves, or a sheet resets them. */
export const NO_TRANSFERS: TransferControls = {}

/** What's pending, for coins rather than an item. */
export const PENDING_COINS = 'coins'

/** A move's button on a Currency row, or beside an item, as End is beside a concentration. */
export const ROW_BUTTON =
  'shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold transition-colors hover:bg-primary/5 disabled:opacity-60'

/** A move's pill in an opened item, on a line of its own, apart from the row's own buttons. */
export const ITEM_BUTTON =
  'self-start rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-primary/5 disabled:opacity-60'
