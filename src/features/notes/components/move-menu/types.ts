import type { NoteChapterView, NoteEntryView } from '@/types/notes'

export type MoveMenuProps = {
  entry: NoteEntryView
  /** The book's chapters, oldest first. */
  chapters: NoteChapterView[]
  /** The move is on its way: its button is off, with a spinner. */
  busy: boolean
  /** The card's labelled button, "Move to chapter"; else the note bar's icon button. */
  labelled?: boolean
  onMove: (chapterId: string | null) => void
}
