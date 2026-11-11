import type {
  NoteReason,
  NoteRole,
  NoteState,
  NotesBook,
  NoteGroupView,
} from '@/types/notes'
import type {
  JournalNote,
  JournalOrder,
  JournalTidyEntry,
  JournalWrite,
  Prisma,
} from '@prisma/client'

/** What a book holds, as read for a seat, with what decides what the seat may do in it. */
export type HeldBook = {
  book: NotesBook
  /** The book's own row: none until a change is first made in it, or Foundry sends it. */
  row?: {
    id: string
    version: number
    journalName: string | null
    withheld: Prisma.JsonValue
  }
  notes: Map<string, JournalNote>
  writes: Map<string, JournalWrite>
  /** Each group's order made here, by its chapter's id, '' for the notes in no chapter. */
  orders: Map<string, JournalOrder>
  /** The book's last change that leaves no note to show it, where one was made. */
  changed?: { at: Date; by: string }
  /** The campaign's module takes orders, as its latest hello said (module 0.35.0). */
  takesOrders: boolean
  /** The book's actor is still in the campaign: else nothing in it can be changed. */
  connected: boolean
  live: boolean
  enabled: boolean
  origin: string
  /** Each of the campaign's characters' names, by actor, to write as. */
  names: Map<string, string>
  /**
   * Its character's Tidy 5e Sheets journal (module 0.44.0), read only where it's to be shown: its
   * entries, and Tidy's state as the campaign's latest hello said it, unset where it said nothing.
   */
  tidy?: HeldTidy
}

/** A character's Tidy 5e Sheets journal as held (module 0.44.0). */
export type HeldTidy = {
  entries: Pick<
    JournalTidyEntry,
    | 'source'
    | 'entryId'
    | 'title'
    | 'html'
    | 'sort'
    | 'secret'
    | 'firstSeenAt'
    | 'changedAt'
  >[]
  active: boolean | null
  version: string | null
}

/** A change waiting or refused: the module hasn't made it, or didn't. */
export type WaitingWrite = JournalWrite & {
  status: 'pending' | 'claimed' | 'conflict' | 'failed'
}

/** What a note says, from Foundry's journal or from the change waiting for it. */
export type NoteContent = {
  title: string
  body: string
  html: string
  chapterId: string | null
  authorActorId: string | null
  authorGm: boolean
  authorName: string | null
  createdAt: Date
  modifiedAt: Date
  modifiedBy: string
  modifiedIn: 'app' | 'foundry'
}

/** A note as one seat sees it, or none where it's hidden from them (§8.8). */
export type SeenNote = {
  role: NoteRole
  content: NoteContent
  state: NoteState
  reason?: NoteReason
  /** It shows Foundry's version, and not the change waiting. */
  mirrored: boolean
  mine?: NoteContent & { deleting?: true; by?: string }
  stamp: string
}

/** A group as a seat sees it, with what decides a change to its order. */
export type NoteGroup = {
  /** Its notes as the seat sees them, in the order shown. */
  ids: string[]
  /** Its notes as the seat sees them, in Foundry's order and as what waits will make it. */
  base: string[]
  /** Its order made here, where there is one. */
  order?: JournalOrder
  view: NoteGroupView
}
