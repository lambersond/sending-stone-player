import type {
  JournalGroup,
  NotePick,
  ReadingStep,
} from '@/features/notes/types'
import type { NoteChapterView, NoteEntryView } from '@/types/notes'
import type { SeatRole } from '@/types/seats'
import type { ReactNode } from 'react'

export type NotePaneProps = {
  entry: NoteEntryView
  /** The group it's in. */
  group: JournalGroup
  /** Every note of the book in reading order, whatever is searched. */
  order: NoteEntryView[]
  /** What follows its last note in reading order (module 0.45.0): the first Tidy entry. */
  after?: ReadingStep
  /** The book's chapters, oldest first, to move it to one. */
  chapters: NoteChapterView[]
  role: SeatRole
  /** The book takes changes: else nothing here offers one. */
  canAdd: boolean
  /** Foundry holds the journal back as too large. */
  tooLarge: boolean
  /** The reader's Contents button, below 640 px of the modal. */
  contents: ReactNode
  /** Shows another note or its group; from an arrow, focus stays on that arrow. */
  onPick: (pick: NotePick, from?: 'previous' | 'next') => void
  onEdit: (opener: 'edit' | 'problem-edit') => void
  onDelete: () => void
  onMove: (chapterId: string | null) => void
  onResolve: (choice: 'mine' | 'theirs') => void
  /** Its move is on its way. */
  moving: boolean
  /** A choice for it is on its way. */
  busy: boolean
}
