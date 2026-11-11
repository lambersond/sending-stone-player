import type { NotePick, ReadingStep } from '@/features/notes/types'
import type { NotesTidyView, NoteTidyView } from '@/types/notes'
import type { SheetForm } from '@/types/sending-stone'
import type { ReactNode } from 'react'

export type TidyPaneProps = {
  entry: NoteTidyView
  tidy: NotesTidyView
  /** The book's character. */
  name: string
  /** How it's transformed now, where it is. */
  form?: SheetForm['kind']
  /** What comes before the first entry in reading order: the book's last note. */
  before?: ReadingStep
  /** The reader's Contents button, first in the bar. */
  contents: ReactNode
  /** Another pick, and the arrow it was made from, which keeps focus. */
  onPick: (pick: NotePick, from?: 'previous' | 'next') => void
}
