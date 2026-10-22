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
