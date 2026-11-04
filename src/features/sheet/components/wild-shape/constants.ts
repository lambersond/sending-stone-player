import clsx from 'clsx'

/** Where this browser keeps the last form taken from it, after which the seat's key. */
export const LAST_FORM_KEY = 'sending-stone:wild-shape-form'

/** Where this browser keeps the last ending dismissed, by when, after which the seat's key. */
export const ENDED_KEY = 'sending-stone:wild-shape-ended'

/** How long an ending is told of on a page opened since, in milliseconds: twelve hours. */
export const ENDED_FOR = 12 * 60 * 60 * 1000

/** A Wild Shape button: solid, or a ghost; a finger's height on a phone, a chip's from `sm`. */
const BUTTON =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60 sm:min-h-9'

export const SOLID = clsx(BUTTON, 'bg-wild text-on-wild hover:bg-wild/90')

export const GHOST = clsx(
  BUTTON,
  'border border-wild/50 text-wild hover:bg-wild/10 aria-disabled:hover:bg-transparent',
)

export const PLAIN = clsx(
  BUTTON,
  'border border-border text-text-primary hover:bg-primary/5',
)
