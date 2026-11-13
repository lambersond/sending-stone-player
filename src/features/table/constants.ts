/** No keys, the same each time. */
export const NO_KEYS: ReadonlySet<string> = new Set()

/**
 * The GM pill after the character's name at the Gamemaster's seat (#156): in the table's header,
 * and in its skeleton's while the table is read (v0.48.0).
 */
export const GM_PILL =
  'shrink-0 self-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary-text'

// The table's frame, the boxes its skeleton draws too while the table is read (v0.48.0), so that
// the skeleton's regions sit where the table's will, at every width, and stay there as either
// changes.

/** The table filling the screen: its tabs beneath it on a phone, beside it from 768 px. */
export const TABLE_FRAME = 'flex h-dvh flex-col md:flex-row'

/** The header, then the sheet and the column beside it, filling the frame beside the tabs. */
export const TABLE_COLUMN = 'flex min-h-0 min-w-0 flex-1 flex-col'

/** The header's bar: back, the character's name and its line, then its buttons. */
export const TABLE_HEADER_BAR =
  'flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-8'

/** The header's lead: back, then the character's name over its line. */
export const TABLE_HEADER_LEAD = 'flex min-w-0 items-center gap-2'

/** The header's row with the character's name, and after it what a wide screen shows there. */
export const TABLE_NAME_ROW = 'flex items-baseline gap-2 overflow-hidden'

/**
 * At the Gamemaster's seat, the name and its GM pill, standing where the name alone does, the name
 * cut short within it, so a long one on a phone never pushes the pill out of view.
 */
export const GM_NAME_PAIR = 'flex max-w-full shrink-0 items-baseline gap-2'

/** The header's buttons: the live state, Help, full screen and, at the player's seat, Delete. */
export const TABLE_HEADER_BUTTONS = 'flex shrink-0 items-center gap-1'

/** The character's name in the header, cut short where it's too long. */
export const TABLE_NAME = 'truncate text-lg leading-tight font-semibold'

/**
 * The Gamemaster's note under the header (#156), where their rolls go: its box, the same whatever
 * it says, and its skeleton's while the table is read. Its colours are its own.
 */
export const GM_NOTE = 'shrink-0 border-b px-4 py-2.5 text-sm md:px-8'

/** The sheet and the column beside it, under the header. */
export const TABLE_BODY = 'flex min-h-0 flex-1'

/** The sheet's, combat's or the chat's pane. Its display is its own, as it's shown or not. */
export const TABLE_PANE = 'min-h-0 min-w-0 flex-1 flex-col'

/** The tabs below 1024 px: a bar at the bottom of a phone, a rail beside a tablet. */
export const TABLE_NAV_BAR =
  'flex shrink-0 gap-1 border-t border-border bg-card px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:w-24 md:flex-col md:gap-2 md:border-t-0 md:border-l md:p-2.5 lg:hidden'

/** One of the bar's or the rail's tabs: its icon over its label. */
export const TABLE_NAV_TAB =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 md:min-h-18 md:w-full md:flex-none'

/** Combat and the chat's column: a tab below 1024 px, beside the sheet from 1024. */
export const ASIDE_COLUMN = 'min-h-0 min-w-0 flex-1 flex-col lg:flex'

/** Combat and the chat's column beside the sheet from 1024 px. */
export const ASIDE_BESIDE =
  'lg:w-[clamp(320px,40%,500px)] lg:flex-none lg:border-l lg:border-border'

/** The column's tabs, Combat and Chat, in a bar atop it. Its display is its own. */
export const ASIDE_TABS_BAR =
  'h-12 shrink-0 items-center gap-3 border-b border-border px-3'
