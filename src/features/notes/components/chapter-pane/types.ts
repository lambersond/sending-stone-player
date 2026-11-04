import type { JournalGroup, NotePick } from '@/features/notes/types'
import type { NoteChapterView, NoteEntryView } from '@/types/notes'
import type { SeatRole } from '@/types/seats'
import type { ReactNode } from 'react'

export type ChapterPaneProps = {
  group: JournalGroup
  /** What's searched, if anything: its notes shown are then only the hits. */
  query: string
  /** Its notes the search finds, in its order; all of them while nothing is searched. */
  shown: NoteEntryView[]
  /** The book's chapters, oldest first. */
  chapters: NoteChapterView[]
  role: SeatRole
  /** The book takes changes: else nothing here offers one. */
  canAdd: boolean
  /** The seat may put the notes of a group in order. */
  canReorder: boolean
  /** Something is being written in the book, which is saved or cancelled first. */
  drafting: boolean
  /** Foundry holds the journal back as too large. */
  tooLarge: boolean
  /** The reader's Contents button, below 640 px of the modal. */
  contents: ReactNode
  onPick: (pick: NotePick) => void
  onRename: (opener: 'rename' | 'problem-edit') => void
  onNewIn: () => void
  onReorder: () => void
  /** The chapter's own choice, where the game didn't take its rename. */
  onResolve: (choice: 'mine' | 'theirs') => void
  onResolveOrder: (choice: 'mine' | 'theirs') => void
  onMove: (entry: NoteEntryView, chapterId: string | null) => void
  /** The note whose move is on its way. */
  moving?: string
  /** A choice for the chapter is on its way. */
  busy: boolean
  /** A choice for its order is on its way. */
  orderBusy: boolean
}
