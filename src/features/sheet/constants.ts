/** Proficiency, as a skill's multiplier says it. */
export const PROFICIENCY: Record<string, string> = {
  '0.5': 'half proficiency',
  '1': 'proficient',
  '2': 'expertise',
}

// The sheet's boxes, which the table's skeleton draws too while the table is read (v0.48.0), so
// that its tabs and its first tiles sit where the sheet's will.

/** The row of the sheet's tabs, 44 px tall, 48 from `sm`. */
export const SHEET_TABS_ROW =
  'flex h-11 shrink-0 items-center border-b border-border px-3 sm:h-12 md:px-6 lg:px-7'

/** A tab's page: centred, at most 1024 px wide, its sections 24 px apart. */
export const SHEET_TAB_PAGE =
  'mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'
