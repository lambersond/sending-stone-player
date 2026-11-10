import type { NotePick, JournalGroup } from '@/features/notes/types'
import type { NotesTidyView } from '@/types/notes'

export type ContentsProps = {
  /** Its element's id, for the reader's Contents button to name what it opens. */
  id: string
  /** Every group, the loose one too, with its notes; none while the book loads. */
  groups?: JournalGroup[]
  query: string
  onQuery: (query: string) => void
  /** The notes the search finds; none while nothing is searched. */
  hits?: Set<string>
  /** The character's Tidy 5e Sheets entries, listed last (module 0.45.0), and those it finds. */
  tidy?: NotesTidyView
  tidyHits?: Set<string>
  /** What the reader shows. */
  shown?: NotePick
  /** The note the book's draft is a change to, marked as not saved yet. */
  draftNote?: string
  /** The editor or a Reorder fills the reader: nothing else is read till it's saved or dropped. */
  locked?: 'editing' | 'ordering'
  /** The seat may add notes and chapters. */
  canAdd: boolean
  /** The modal is under 640 px wide: the contents are a drawer. */
  narrow: boolean
  /** The drawer is open. */
  drawer: boolean
  onCloseDrawer: () => void
  onPick: (pick: NotePick) => void
  /** A new note, in the chapter given, or none. */
  onNewNote: (chapterId: string | null) => void
  onNewChapter: () => void
}
