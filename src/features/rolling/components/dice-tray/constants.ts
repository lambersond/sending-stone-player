/**
 * The tray's − and + buttons: 44 px square at every width, a finger's width, as the tray is used on
 * a phone most of all; dimmed where they can't step, by `aria-disabled`.
 */
export const TRAY_STEP =
  'flex size-11 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent'

/** Why no more dice may be added, as the die buttons and every + say once there are as many. */
export const AT_MOST = 'At most 20 dice'
