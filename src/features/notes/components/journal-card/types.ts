import type { NoteBookKind } from '@/types/notes'
import type { SeatRole } from '@/types/seats'

export type JournalCardProps = {
  /** The seat's API base, such as `/api/characters/<id>`: its book is under it, at `/notes`. */
  api: string
  role: SeatRole
  kind: NoteBookKind
  /** The book's character or party, as its words name it. */
  name: string
  /** Whether it's in view, and so polled. */
  active: boolean
  /** Its heading as the tab it's in draws one: the sheet's, or the party sheet's. */
  look: 'sheet' | 'party'
}
