import type { useNotes } from '@/features/notes/hooks/use-notes'
import type { NoteBookKind } from '@/types/notes'
import type { SeatRole } from '@/types/seats'
import type { SheetForm } from '@/types/sending-stone'

export type JournalNotes = ReturnType<typeof useNotes>

export type JournalModalProps = {
  /** The book, as the card reads it. */
  notes: JournalNotes
  role: SeatRole
  kind: NoteBookKind
  /** The book's character or party, as its words name it. */
  name: string
  /**
   * How the book's character is transformed now, as its sheet says, where it is (module 0.40.0):
   * its Tidy 5e Sheets entries are read off the character, never its form.
   */
  form?: SheetForm['kind']
  open: boolean
  /** Closes it, the draft kept. */
  onClose: () => void
}
