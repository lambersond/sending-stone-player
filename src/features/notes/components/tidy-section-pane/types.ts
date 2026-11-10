import type { NotePick } from '@/features/notes/types'
import type { NotesTidyView } from '@/types/notes'
import type { ReactNode } from 'react'

export type TidySectionPaneProps = {
  tidy: NotesTidyView
  /** Each entry's text, by key, as its card shows it. */
  texts: ReadonlyMap<string, string>
  /** The entries a search finds, by key; none while nothing is searched. */
  hits?: ReadonlySet<string>
  /** The book's character. */
  name: string
  /** The reader's Contents button, first in the bar. */
  contents: ReactNode
  onPick: (pick: NotePick) => void
}
