import type { NoteReason, NoteState } from '@/types/notes'
import type { SeatRole } from '@/types/seats'

/** The change the game didn't take, as the view gives it. */
export type Mine = {
  title: string
  html?: string
  deleting?: true
  /** Whose it is, for the Gamemaster's view of another seat's; left out for the viewer's own. */
  by?: string
}

export type NoteProblemProps = {
  state: NoteState
  reason?: NoteReason
  /** Who changed it in Foundry, as its line says. */
  modifiedBy: string
  mine?: Mine
  role: SeatRole
  /** Foundry holds the journal back as too large, so its version isn't here to show. */
  tooLarge: boolean
  /** Offers Edit, for a failed change the seat may still make. */
  onEdit?: () => void
  /** The note or chapter Edit is for, by which focus finds it again after the editor closes. */
  editFor: { note?: string; chapter?: string }
  onResolve: (choice: 'mine' | 'theirs') => void
  /** A choice is on its way. */
  busy?: boolean
}
