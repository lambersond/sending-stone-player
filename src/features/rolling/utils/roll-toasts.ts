import { NOT_MADE, SETTLED } from '@/constants/lifecycle'
import { needsPlayer } from '@/features/rolling/utils/damage-due'
import type { RollToast, ToastBook, ToastDraft } from '@/features/rolling/types'
import type { LocalRoll, TableRollState } from '@/types/roll'

/**
 * Where this browser keeps how the player's rolls are shown: 'on' for toasts, 'off' for the banner
 * at the bottom of the sheet, as when it was a switch for toasts alone.
 */
export const TOASTS_KEY = 'sending-stone:roll-toasts'

export const TOAST_CHOICES = ['on', 'off'] as const

/** How long a toast shows, from popping or from its roll's way to the game ending, in ms. */
export const TOAST_FOR = 4000

/** How long a toast fades for, at the end of its time, where motion is welcome, in ms. */
export const TOAST_FADE = 200

/**
 * How many toasts show at once: one more drops the oldest that doesn't wait for the player. Those
 * that do are never dropped, nor one just popped up, so that more may show while they all wait.
 */
export const TOAST_CAP = 3

/** How far below the sheet's tabs, or the table's header, the toasts start, in pixels. */
export const TOAST_GAP = 8

/**
 * Where the toasts start, in pixels from the top of the screen: under the first of these on screen,
 * the game's prompts beneath the sheet's row of tabs, say, then the row, then the table's header,
 * so that what's in them stays to hand. None where none is, as before the page is laid out, for the
 * toasts to keep to the top of the screen.
 */
export function toastTop(
  under: readonly (Element | null | undefined)[],
): number | undefined {
  for (const element of under) {
    if (!element) continue
    const { top, bottom } = element.getBoundingClientRect()
    // Not laid out, as the sheet's tabs on a phone showing combat or the chat, which then end at
    // the top of the screen; or out of sight, above it or below it.
    if (bottom <= 0 || top >= globalThis.innerHeight) continue
    return Math.ceil(bottom) + TOAST_GAP
  }
  return undefined
}

/**
 * Where the toasts start, from module 0.36.0, while the turn's toast shows, which sits under the
 * table's header: below it, where that's lower than their own start (`toastTop`); else their own.
 */
export function belowTurn(
  own: number | undefined,
  turnFoot: number | undefined,
): number | undefined {
  return turnFoot === undefined ? own : Math.max(own ?? 0, turnFoot + TOAST_GAP)
}

export const NO_TOASTS: ToastBook = {
  shown: [],
  seen: new Set(),
  quiet: new Set(),
  told: new Map(),
  opened: false,
  drawn: new Set(),
}

/**
 * How a roll's way to the game ended, as `status:reason`, such as "failed:timeout", or nothing
 * while it's on its way, or never sent. A roll's toast pops up again each time this changes.
 */
export function settledMark(state?: TableRollState): string | undefined {
  if (!state || !SETTLED.has(state.status)) return undefined
  return `${state.status}:${state.reason ?? ''}`
}

/** Whether a roll is a favorite moved a place from its own menu, from module 0.47.0. */
function isStep(roll: LocalRoll): boolean {
  return roll.kind === 'use' && roll.step === true
}

/**
 * Whether a roll's toast is drawn, as every one is but a favorite moved a place from its own menu:
 * its row shows the move, with focus on it, where a toast could lie over it, as first of the second
 * of two lists (ROADMAP item 104). That one is said in the log and not drawn while its order is on
 * its way or made; drawn once it isn't made, as the row goes back.
 */
function showsToast(roll: LocalRoll, state?: TableRollState): boolean {
  return !isStep(roll) || (state !== undefined && NOT_MADE.has(state.status))
}

/** A favorite's own move whose toast is drawn now, kept so that it stays drawn (item 104). */
function noteDrawn(draft: ToastDraft, roll: LocalRoll, unseen: boolean) {
  if (!isStep(roll) || unseen || draft.drawn.has(roll.id)) return
  draft.drawn = new Set(draft.drawn).add(roll.id)
}

/**
 * The toasts once the rolls and their ways to the game are as now: each roll new to the book pops
 * up on top, as do any rolls whose way to the game ended, or ended otherwise than their toasts
 * said, a toast still showing taking its full time again where it is. A roll that waits for the
 * player, as for its damage to be rolled, keeps its toast until it no longer does: then it goes at
 * once, as its damage is rolled, or else takes its full time from then. Over the cap as toasts pop
 * up, the oldest that doesn't wait for the player goes, never one popping up. Rolls met while
 * toasts are off never pop up; and while they're off none show. A roll the Gamemaster made as the
 * character (#156), which the player didn't make here, pops up only once its way to the game ends,
 * as the game makes it, or doesn't; never one whose way had ended before the page opened. A
 * favorite's own move is said in the log and not drawn while its order is on its way or made, and
 * drawn from when it isn't (item 104). The same rolls and ways give the same book.
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
  const draft = draftOf(book)
  // Oldest first, so that of rolls met at once, the newest ends on top.
  for (const roll of rolls.toReversed()) {
    meet(draft, roll, states.get(roll.id), now, on)
  }
  const showing = capped(draft, rolls, on)
  const same =
    showing.length === book.shown.length &&
    showing.every((toast, index) => toast === book.shown[index]) &&
    draft.seen === book.seen &&
    draft.quiet === book.quiet &&
    draft.told === book.told &&
    draft.drawn === book.drawn &&
    book.opened
  if (same) return book
  const { seen, quiet, told, drawn } = draft
  return { shown: showing, seen, quiet, told, opened: true, drawn }
}

/**
 * The book as `popToasts` writes it, from the one it's given, which it never changes: each change
 * is made to a copy; and the toasts popped up now, which the cap leaves be, so that every roll
 * shows.
 */
function draftOf(book: ToastBook): ToastDraft {
  return { ...book, popped: new Set<RollToast>() }
}

/** A roll's toast popped up on top, now, to go at `until`: said and not drawn, where `unseen`. */
function pop(
  draft: ToastDraft,
  id: string,
  { now, until, unseen }: { now: number; until: number; unseen: boolean },
) {
  const toast: RollToast = {
    id,
    poppedAt: now,
    until,
    ...(unseen && { unseen: true as const }),
  }
  draft.popped.add(toast)
  draft.shown = [toast, ...draft.shown]
}

/**
 * A roll met as the rolls are now: popped up, or its toast kept, as `popToasts` says, by whether
 * the book has met it, how its way to the game ended, and whether it waits for the player.
 */
function meet(
  draft: ToastDraft,
  roll: LocalRoll,
  state: TableRollState | undefined,
  now: number,
  on: boolean,
) {
  const mark = settledMark(state)
  const waits = needsPlayer(roll, state)
  const until = waits ? Number.POSITIVE_INFINITY : now + TOAST_FOR
  const unseen = !showsToast(roll, state) && !draft.drawn.has(roll.id)
  if (!draft.seen.has(roll.id)) {
    meetNew(draft, roll, mark, { now, until, on, unseen })
    return
  }
  const at = draft.shown.findIndex(toast => toast.id === roll.id)
  if (
    !draft.quiet.has(roll.id) &&
    mark !== undefined &&
    draft.told.get(roll.id) !== mark
  ) {
    draft.told = new Map(draft.told).set(roll.id, mark)
    popAgain(draft, roll, at, { now, until, unseen })
    return
  }
  // A toast showing whose roll comes to wait for the player, or stops waiting.
  if (at === -1) return
  const held = draft.shown[at].until === Number.POSITIVE_INFINITY
  if (waits && !held) {
    draft.shown = draft.shown.with(at, { ...draft.shown[at], until })
  } else if (!waits && held) {
    const next = state?.damaged ? now + TOAST_FADE : until
    draft.shown = draft.shown.with(at, { ...draft.shown[at], until: next })
  }
}

/**
 * A roll's toast popped up again as its way to the game ends: on top, where it had gone; else kept
 * where it is (`at`), for its full time again, and drawn from now if it's a favorite's own move
 * whose order wasn't made (item 104), which then takes a place among the three as one popping up
 * does, so that the cap makes room for it.
 */
function popAgain(
  draft: ToastDraft,
  roll: LocalRoll,
  at: number,
  { now, until, unseen }: { now: number; until: number; unseen: boolean },
) {
  if (at === -1) pop(draft, roll.id, { now, until, unseen })
  else {
    const was = draft.shown[at]
    const toast: RollToast = {
      id: roll.id,
      poppedAt: was.poppedAt,
      until,
      ...(unseen && { unseen: true as const }),
    }
    if (was.unseen && !unseen) draft.popped.add(toast)
    draft.shown = draft.shown.with(at, toast)
  }
  noteDrawn(draft, roll, unseen)
}

/**
 * A roll new to the book: met, and popped up, but while toasts are off, which leaves it quiet for
 * good; and but one of the Gamemaster's as the character (#156) while it's on its way, or whose way
 * had ended before the page opened, which stays quiet.
 */
function meetNew(
  draft: ToastDraft,
  roll: LocalRoll,
  mark: string | undefined,
  {
    now,
    until,
    on,
    unseen,
  }: { now: number; until: number; on: boolean; unseen: boolean },
) {
  const { id } = roll
  draft.seen = new Set(draft.seen).add(id)
  const gm = roll.kind === 'gm'
  if (!on || (gm && !draft.opened && mark !== undefined)) {
    draft.quiet = new Set(draft.quiet).add(id)
    return
  }
  // On its way, it's in the banner or the rolls' history only, until the game says.
  if (gm && mark === undefined) return
  pop(draft, id, { now, until, unseen })
  noteDrawn(draft, roll, unseen)
  if (mark !== undefined) draft.told = new Map(draft.told).set(id, mark)
}

/** How many of these toasts are drawn, as those said and not drawn take no place (item 104). */
const drawnCount = (toasts: readonly RollToast[]) =>
  toasts.filter(toast => !toast.unseen).length

/**
 * The toasts that show: none while toasts are off; none of a roll the page no longer keeps, among
 * the oldest of many, which takes its toast with it; and over the cap as toasts pop up, the oldest
 * that doesn't wait for the player gone, until none more need to, but never one popped up now,
 * which would then never show, as where all the others wait. More than the cap then show, each
 * going in its own time, until the next pops up. One said and not drawn takes no place, and is
 * never dropped; one drawn now where it is, as its order wasn't made, counts as one popping up
 * (ROADMAP item 104).
 */
function capped(
  draft: ToastDraft,
  rolls: readonly LocalRoll[],
  on: boolean,
): RollToast[] {
  const kept = new Set(rolls.map(({ id }) => id))
  let showing = on ? draft.shown.filter(({ id }) => kept.has(id)) : []
  // Only a drawn toast popping up drops another.
  const poppedDrawn = [...draft.popped].some(toast => !toast.unseen)
  while (poppedDrawn && drawnCount(showing) > TOAST_CAP) {
    const oldest = showing.findLastIndex(
      toast =>
        !toast.unseen &&
        toast.until !== Number.POSITIVE_INFINITY &&
        !draft.popped.has(toast),
    )
    if (oldest === -1) break
    showing = showing.toSpliced(oldest, 1)
  }
  return showing
}

/** The toasts with one gone, as when the player taps it away, or closes one that waits for them. */
export function dropToast(book: ToastBook, id: string): ToastBook {
  if (!book.shown.some(toast => toast.id === id)) return book
  return { ...book, shown: book.shown.filter(toast => toast.id !== id) }
}

/** The toasts whose time is up by `now` gone. */
export function dueToasts(book: ToastBook, now: number): ToastBook {
  if (book.shown.every(({ until }) => until > now)) return book
  return { ...book, shown: book.shown.filter(({ until }) => until > now) }
}
