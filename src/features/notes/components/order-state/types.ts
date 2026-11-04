import type { NoteEntryView, NoteGroupView } from '@/types/notes'
import type { SeatRole } from '@/types/seats'

export type OrderProblemProps = {
  group: NoteGroupView
  /** The group's notes as the seat sees them, to name an order's notes by their titles. */
  entries: NoteEntryView[]
  role: SeatRole
  /** A choice is on its way. */
  busy: boolean
  onResolve: (choice: 'mine' | 'theirs') => void
}
