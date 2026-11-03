import type { NoteBookKind, NoteRole } from '@/types/notes'

/** A note command, as the module fetches it (round 0.34.0 §3.4): a change to one page. */
export type NotePageCommand = {
  id: string
  actorId: string
  kind: 'note'
  by?: 'gm'
  note: {
    book: NoteBookKind
    op: 'create' | 'update' | 'delete'
    id: string
    role: NoteRole
    base: string | null
    writer: string | null
    at: number
    title?: string
    markdown?: string
    chapter?: string | null
    createdAt?: number
  }
  mode: 0
  explicit: false
  extras: []
  dice: []
}
