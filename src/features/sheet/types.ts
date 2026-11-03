import type { OfferSpend, TableRollState } from '@/types/roll'

/** Something of the character's an enchantment may be put on, as the sheet lists it. */
export type Belonging = { name: string; img: string | null }

/** What a settle follows of a command sent from a pane: its line's local id, at least. */
export type Settling = { id: string }

/**
 * How a pane's command waits for the game (`useSettle`): what's said of one whose way isn't yet
 * heard of, `'waiting'` as on its way, or `'idle'` as not sent; and whether the sheet says what
 * the game made of one made.
 */
export type SettleOptions<T extends Settling> = {
  states: ReadonlyMap<string, TableRollState>
  /** How long after its send a command is waited for, at most, once its way is heard of. */
  settleMs: number
  missing: 'waiting' | 'idle'
  agrees: (sent: T, state: TableRollState) => boolean
}

/** A pane's commands, by what each is for, and whether each waits for the game. */
export type Settle<T extends Settling> = {
  /** Keeps the command sent for a key, and settles it `settleMs` from now. */
  sent: (key: string, sent: T) => void
  /** The last command sent for a key. */
  last: (key: string) => T | undefined
  /** Whether a command waits: on its way, or made and not yet as the sheet says, until settled. */
  waitingOf: (sent: T | undefined) => boolean
  /** Settles a command now, by its local id, as one made and handled. */
  settleNow: (id: string) => void
  /** Waits for a command again, by its local id, as afresh from now. */
  unsettle: (id: string) => void
}

/** A roll a die offered was added to: what adding it spent, and when the roll was made. */
export type Spending = { spends: readonly OfferSpend[]; at: number }
