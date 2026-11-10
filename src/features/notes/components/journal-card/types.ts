import type { NoteBookKind } from '@/types/notes'
import type { SeatRole } from '@/types/seats'
import type { SheetForm } from '@/types/sending-stone'

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
  /**
   * How the book's character is transformed now, as its sheet says, where it is (module 0.40.0):
   * its Tidy 5e Sheets entries are read off the character, never its form.
   */
  form?: SheetForm['kind']
}
