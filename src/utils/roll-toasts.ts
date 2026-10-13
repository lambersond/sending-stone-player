import { SETTLED, type TableRollState } from '@/hooks/use-table-rolls'
import type { LocalRoll } from '@/hooks/use-sheet-roller'

/** Where this browser keeps whether the player's rolls pop up as toasts: 'on' or 'off'. */
export const TOASTS_KEY = 'sending-stone:roll-toasts'

export const TOAST_CHOICES = ['on', 'off'] as const

/** How long a toast shows, from popping or from its roll's way to the game ending, in ms. */
export const TOAST_FOR = 4000

/** How long a toast fades for, at the end of its time, where motion is welcome, in ms. */
export const TOAST_FADE = 200

/** How many toasts show at once: one more drops the oldest. */
export const TOAST_CAP = 3

/** A roll's toast: its roll's id, when it popped up, and when it goes. */
export type RollToast = { id: string; poppedAt: number; until: number }

/** The toasts showing, and what's known of every roll met, to pop each up only as it should. */
export type ToastBook = {
  /** Newest first, at most `TOAST_CAP`. */
  shown: RollToast[]
  /** Every roll met, by its id, whether it popped up or not. */
  seen: ReadonlySet<string>
  /** The rolls met while toasts were off, which never pop up. */
  quiet: ReadonlySet<string>
  /** Of each roll, how its way to the game ended, as its toast last said (`settledMark`). */
  told: ReadonlyMap<string, string>
}

export const NO_TOASTS: ToastBook = {
  shown: [],
  seen: new Set(),
  quiet: new Set(),
  told: new Map(),
}

/**
 * How a roll's way to the game ended, as `status:reason`, such as "failed:timeout", or nothing
 * while it's on its way, or never sent. A roll's toast pops up again each time this changes.
 */
export function settledMark(state?: TableRollState): string | undefined {
  if (!state || !SETTLED.has(state.status)) return undefined
  return `${state.status}:${state.reason ?? ''}`
}

/**
 * The toasts once the rolls and their ways to the game are as now: each roll new to the book pops
 * up on top, as do any rolls whose way to the game ended, or ended otherwise than their toasts
 * said, a toast still showing taking its full time again where it is. Rolls met while toasts are
 * off never pop up; and while they're off none show. The same rolls and ways give the same book.
 * @param rolls - Newest first, as the page keeps them.
 * @param on - Whether the player has toasts on.
 */
export function popToasts(
  book: ToastBook,
  rolls: readonly LocalRoll[],
  states: ReadonlyMap<string, TableRollState>,
  now: number,
  on: boolean,
): ToastBook {
  let shown = book.shown
  let seen = book.seen
  let quiet = book.quiet
  let told = book.told
  const pop = (id: string) => {
    shown = [{ id, poppedAt: now, until: now + TOAST_FOR }, ...shown]
  }
  // Oldest first, so that of rolls met at once, the newest ends on top.
  for (const { id } of rolls.toReversed()) {
    const mark = settledMark(states.get(id))
    if (!seen.has(id)) {
      seen = new Set(seen).add(id)
      if (!on) {
        quiet = new Set(quiet).add(id)
        continue
      }
      pop(id)
      if (mark !== undefined) told = new Map(told).set(id, mark)
      continue
    }
    if (quiet.has(id) || mark === undefined || told.get(id) === mark) continue
    told = new Map(told).set(id, mark)
    const at = shown.findIndex(toast => toast.id === id)
    if (at === -1) {
      pop(id)
    } else {
      shown = shown.with(at, { ...shown[at], until: now + TOAST_FOR })
    }
  }
  // A roll the page no longer keeps, among the oldest of many, takes its toast with it.
  const kept = new Set(rolls.map(({ id }) => id))
  const showing = on
    ? shown.filter(({ id }) => kept.has(id)).slice(0, TOAST_CAP)
    : []
  if (
    showing.length === book.shown.length &&
    showing.every((toast, index) => toast === book.shown[index]) &&
    seen === book.seen &&
    quiet === book.quiet &&
    told === book.told
  ) {
    return book
  }
  return { shown: showing, seen, quiet, told }
}

/** The toasts with one gone, as when the player taps it away. */
export function dropToast(book: ToastBook, id: string): ToastBook {
  if (!book.shown.some(toast => toast.id === id)) return book
  return { ...book, shown: book.shown.filter(toast => toast.id !== id) }
}

/** The toasts whose time is up by `now` gone. */
export function dueToasts(book: ToastBook, now: number): ToastBook {
  if (book.shown.every(({ until }) => until > now)) return book
  return { ...book, shown: book.shown.filter(({ until }) => until > now) }
}
