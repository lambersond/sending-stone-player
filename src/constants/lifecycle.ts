import type { TableRollState } from '@/types/roll'

/** How often to ask after a roll sent to the Gamemaster's game, in milliseconds. */
export const CHECK_EVERY = 1000

/**
 * How long to ask after it, in milliseconds: past the time the game has to fetch it and then to
 * answer, so that the app has said where it stands by then.
 */
export const FOLLOW_FOR = 110_000

/**
 * How long to go on asking after a roll the game took too long to make, in milliseconds: an
 * attack can wait on the Gamemaster for up to five minutes, then be made after all.
 */
export const LATE_FOLLOW = 330_000

/**
 * Of rolls sent one after another, as hit dice spent at once to a game before module 0.20.0, how
 * long to wait before sending one again that the app turned away as one too many at once, in
 * milliseconds; and how long to go on sending it: past the minute over which the app counts a
 * character's rolls.
 */
export const BUSY_WAIT = 5000

export const BUSY_FOR = 65_000

/** Where a roll's way to the game ends. */
export const SETTLED = new Set<TableRollState['status']>([
  'done',
  'failed',
  'expired',
  'lost',
  'refused',
])

/** How an End Turn's or an Undo's way ends where the turn stays as it was. */
export const NOT_MADE: ReadonlySet<TableRollState['status']> = new Set([
  'refused',
  'failed',
  'expired',
  'lost',
])
