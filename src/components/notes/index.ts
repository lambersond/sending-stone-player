import type { SeatRole } from '@/utils/seat-words'

export { JournalCard } from './journal-card'

/**
 * Where a character's own notes are shown, as the table hands them to its sheet (round 0.34.0
 * §9.3): through the seat's API, as its player or its Gamemaster, under the character's name, and
 * whether they're in view now, and so polled.
 */
export type NotesPlace = {
  api: string
  role: SeatRole
  name: string
  active: boolean
}
