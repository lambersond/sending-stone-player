import type {
  NoteRole,
  NotesView,
  NoteChapterView,
  NoteEntryView,
  NoteGroupView,
} from '@/types/notes'
import type { SeatRole } from '@/types/seats'
/**
 * Where a character's own notes are shown, as the table hands them to its sheet (round 0.34.0
 * §9.3): through the seat's API, as its player or its Gamemaster, under the character's name, and
 * whether they're in view now, and so polled.
 */
export type NotesPlace = {
  api: string
  role: SeatRole
  name: string
  active: boolean
}

/**
 * What's being written: a new note ('new'), a new chapter ('new-chapter'), or a change to the note
 * or chapter of that id, from the stamp it started at (§8.8); what it started as, so that a
 * change can be told from none; what opened it; and where focus was in it as it last unmounted.
 */
export type NoteDraft = {
  key: string
  role: NoteRole
  title: string
  body: string
  chapterId: string | null
  stamp?: string
  started: { title: string; body: string; chapterId: string | null }
  /** The control that opened it, found again to give focus back to (§9.6). */
  opener: 'new' | 'new-in' | 'new-chapter' | 'edit' | 'problem-edit' | 'rename'
  /**
   * Where focus was, inside the editor, as it unmounted: put back once it's mounted again (§9.6).
   */
  focus?: { field: 'chapter' | 'title' | 'body'; start?: number; end?: number }
  /**
   * Sent, and not yet answered: its fields hold still and Cancel waits till then, so what's kept is
   * what was typed. Kept here rather than in the editor, so an editor mounted again meanwhile, as
   * when another tab is chosen and this one again, can't send it a second time.
   */
  saving?: true
}

/**
 * A draft as it's set: the draft itself, none, or what it becomes from the one held now, which
 * the change is given at once, as the store holds it then.
 */
export type DraftChange =
  | NoteDraft
  | undefined
  | ((held: NoteDraft | undefined) => NoteDraft | undefined)

export type NotesState = 'loading' | 'ready' | 'gone' | 'failed'

/**
 * What the journal's reader shows: a note, or a group's page, the loose group's as null; or, from
 * module 0.45.0, one of the character's Tidy 5e Sheets entries, by its key, or their section's page
 * as null.
 */
export type NotePick =
  { note: string } | { group: string | null } | { tidy: string | null }

/**
 * Where the reader steps across the journal's reading order, past the end of one part of it: the
 * book's notes, then the character's Tidy 5e Sheets entries (module 0.45.0). What it shows, and
 * its title, for the arrow and the link to it.
 */
export type ReadingStep = { pick: NotePick; title: string }

/**
 * What a page holds of one book: what it last saw of it, what's being written in it, and whether
 * its journal is open, with what its reader shows (round 0.35.0 §8.2).
 */
export type Book = {
  view?: NotesView
  draft?: NoteDraft
  open?: { pick?: NotePick }
}

/**
 * One group of the journal's notes, as its contents and reader show it (round 0.35.0 §8.6): a
 * chapter's, or those in no chapter, with its notes in their order and where that order stands.
 */
export type JournalGroup = {
  /** The chapter; null for the notes in no chapter. */
  chapterId: string | null
  chapter?: NoteChapterView
  /** The chapter's place among the chapters, oldest first, from 1. */
  n?: number
  title: string
  /** Its notes, in its order. */
  entries: NoteEntryView[]
  /** Where its order stands. */
  order: NoteGroupView
}

/**
 * What the header says last: what was done, or why it wasn't, which is drawn as a warning, not
 * with a success's check. `n` counts what's said, so the same words said again are new.
 */
export type Said = { words: string; refused: boolean; n: number }

/** Where focus goes once what it goes to is drawn. */
export type FocusTo =
  | { heading: true }
  | { contents: true }
  | { reorder: true }
  | { arrow: 'previous' | 'next' }
  | { opener: NoteDraft['opener']; key: string; chapterId: string | null }

/** A Reorder open: its group, and the group's stamp as it opened, which the new order is from. */
export type Ordering = { chapterId: string | null; stamp: string }
