import type { useNotes } from '@/features/notes/hooks/use-notes'
import type { NoteBookKind } from '@/types/notes'
import type { SeatRole } from '@/types/seats'

export type JournalNotes = ReturnType<typeof useNotes>

export type JournalModalProps = {
  /** The book, as the card reads it. */
  notes: JournalNotes
  role: SeatRole
  kind: NoteBookKind
  /** The book's character or party, as its words name it. */
  name: string
  open: boolean
  /** Closes it, the draft kept. */
  onClose: () => void
}
