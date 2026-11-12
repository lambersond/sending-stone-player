import type { NoteEntryView } from '@/types/notes'

/**
 * The journal's icon buttons, 44 pixels square: its panes' and contents' own controls, and its
 * Close, as Reorder's arrows are. A caller adds to it what its button needs more, such as how it
 * looks while disabled.
 */
export { SQUARE_ICON_BUTTON as JOURNAL_ICON_BUTTON } from '@/constants/buttons'

/** The loose group's title, in the contents and over its page. */
export const LOOSE_TITLE = 'Not in a chapter'

/** The title of a character's Tidy 5e Sheets entries, last in the contents (module 0.44.0). */
export const TIDY_TITLE = 'From Tidy 5e Sheets'

/** Why a note is changed only in Foundry, said where its Edit would be. */
export const FOUNDRY_ONLY: Record<
  NonNullable<NoteEntryView['foundryOnly']>,
  string
> = {
  html: 'Written in Foundry’s own editor: change it there.',
  long: 'Too long to change here: change it in Foundry.',
  secret: 'It holds a Gamemaster’s secret: change it in Foundry.',
}

/** A field's look: 16px text, so iOS doesn't zoom into it as it takes focus. */
export const FIELD =
  'rounded-xl border border-border bg-page px-3 text-base font-normal outline-none focus:ring-2 focus:ring-primary/40'
