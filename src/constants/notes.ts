/** A note's title, at most, in characters: one line, the same at both ends (round 0.34.0 §5.4). */
export const MOST_NOTE_TITLE = 200
/** A note's Markdown, at most, in characters. */
export const MOST_NOTE_BODY = 20_000
/** A note's text from Foundry, at most, as the module cuts it. */
export const MOST_NOTE_TEXT = 100_000
export const MOST_ENTRIES = 300
export const MOST_CHAPTERS = 50
/** A book's text, at most: every entry's Markdown, and every change waiting. */
export const MOST_BOOK_TEXT = 1_000_000
/** The most notes one journal.updated lists. */
export const MOST_NOTES = 400
/** A note write's request body, at most, in bytes. */
export const MAX_NOTE_BYTES = 65_536
/** The changes one seat may make in a minute. */
export const NOTES_PER_MINUTE = 30
/** The changes one fetch hands over, at most, by count and by characters of titles and bodies. */
export const NOTE_CLAIM_LIMIT = 5
export const NOTE_CLAIM_CHARS = 500_000

/**
 * Where a Tidy 5e Sheets journal entry is kept on its character (module 0.44.0): an entry of Tidy's
 * current sheet's Journal tab, or one of its Classic sheet's five boxes.
 */
export const TIDY_SOURCES = ['journal', 'classic'] as const
/** The most entries one journal.tidy lists. */
export const MOST_TIDY_ENTRIES = 400
/**
 * The Classic sheet's five boxes, in its Journal tab's order, each by its key and the heading Tidy
 * shows it under until it's named; Journal Entries is never named.
 */
export const TIDY_CLASSIC = {
  notes1: 'Persons of Interest',
  notes2: 'Locations of Interest',
  notes3: 'Quests',
  notes4: 'Miscellaneous',
  notes: 'Journal Entries',
} as const
/** The first Tidy 5e Sheets release that no longer shows the Classic sheet's boxes. */
export const TIDY_CLASSIC_GONE = 14
