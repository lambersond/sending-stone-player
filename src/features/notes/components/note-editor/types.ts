import type { DraftChange, NoteDraft } from '@/features/notes/types'
import type { NoteChapterView, NoteWriteAnswer } from '@/types/notes'

export type NoteEditorProps = {
  draft: NoteDraft
  setDraft: (change: DraftChange) => void
  /** The book's chapters, oldest first, for the note to be put in one. */
  chapters: NoteChapterView[]
  /** The book's character or party, as a refusal names it. */
  name: string
  preview: (
    body: string,
  ) => Promise<{ html: string; headings: number[] } | undefined>
  /** Sends the note; the journal clears the draft once it's answered ok. */
  onSave: (draft: NoteDraft) => Promise<NoteWriteAnswer>
  /** Closes it, its changes discarded. */
  onCancel: () => void
}

/** What's previewed: the text asked about, and the server's render of it once it comes. */
export type Shown = { body: string; html?: string; failed?: true }
