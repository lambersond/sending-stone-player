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

/** The header's bar: back, the character's name and its line, then its buttons. */
export const TABLE_HEADER_BAR =
  'flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-8'

/** The tabs below 1024 px: a bar at the bottom of a phone, a rail beside a tablet. */
export const TABLE_NAV_BAR =
  'flex shrink-0 gap-1 border-t border-border bg-card px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:w-24 md:flex-col md:gap-2 md:border-t-0 md:border-l md:p-2.5 lg:hidden'

/** Combat and the chat's column beside the sheet from 1024 px. */
export const ASIDE_BESIDE =
  'lg:w-[clamp(320px,40%,500px)] lg:flex-none lg:border-l lg:border-border'
