/** Proficiency, as a skill's multiplier says it. */
export const PROFICIENCY: Record<string, string> = {
  '0.5': 'half proficiency',
  '1': 'proficient',
  '2': 'expertise',
}

// The sheet's boxes, which the table's skeleton draws too while the table is read (v0.48.0), so
// that its tabs, its card of tiles and its abilities sit where the sheet's will.

/** The row of the sheet's tabs, 44 px tall, 48 from `sm`. */
export const SHEET_TABS_ROW =
  'flex h-11 shrink-0 items-center border-b border-border px-3 sm:h-12 md:px-6 lg:px-7'

/** A tab's page: centred, at most 1024 px wide, its sections 24 px apart. */
export const SHEET_TAB_PAGE =
  'mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'

/** The card atop the Character tab, a character's or a creature's: who it is, then its tiles. */
export const SHEET_CARD =
  'flex flex-col gap-4 rounded-2xl border border-border bg-card p-4'

/** One of the card's tiles: its label over its value, a container for its label's widths. */
export const STAT_TILE =
  '@container flex min-w-0 flex-col gap-0.5 rounded-xl bg-page py-2'

/**
 * How many of the card's columns a tile takes: one of a pair, such as the hit points beside the
 * hit dice, one on a phone, where there are two, and two where there are more; two however many
 * there are; or a row of its own, up to four.
 */
export const STAT_WIDE = {
  pair: '@lg:col-span-2',
  double: 'col-span-2',
  row: 'col-span-2 @lg:col-span-4',
} as const

/** The abilities: their heading over their tiles. */
export const ABILITIES_SECTION = 'flex flex-col gap-3'

/** The six abilities' tiles: three to a row, all six from `@xl`. */
export const ABILITIES_GRID = 'grid grid-cols-3 gap-2 @xl:grid-cols-6'

/** An ability's tile: its check over its save. Its border's colour is its own. */
export const ABILITY_TILE =
  'flex flex-col overflow-hidden rounded-2xl border bg-card'

/** An ability's check: its name, its modifier, then its score. */
export const ABILITY_CHECK = 'flex flex-col items-center gap-1 px-2 pt-2.5 pb-2'

/** An ability's save, across its tile's foot. */
export const ABILITY_SAVE =
  'flex items-center justify-center gap-1 border-t border-border py-1.5 text-xs'
