import type { NotePick } from '@/features/notes/types'
import type { NotesTidyView, NoteTidyView } from '@/types/notes'
import type { ReactNode } from 'react'

export type TidyPaneProps = {
  entry: NoteTidyView
  tidy: NotesTidyView
  /** The book's character. */
  name: string
  /** The reader's Contents button, first in the bar. */
  contents: ReactNode
  /** Another pick, and the arrow it was made from, which keeps focus. */
  onPick: (pick: NotePick, from?: 'previous' | 'next') => void
}
