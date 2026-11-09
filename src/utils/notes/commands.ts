import { NO_DICE } from '@/constants/roll-kinds'
import type {
  NoteBookKind,
  NoteOrderCommand,
  NotePageCommand,
  NoteReason,
} from '@/types/notes'
import type { CommandResult, JournalPage } from '@/types/sending-stone'
import type { JournalOrder, JournalWrite } from '@prisma/client'

// The module's side of journal notes, from module 0.34.0 (src/db/note-sync.ts): each note's place
// in its group, and the changes and orders made here as the module's note commands, oldest first,
// and where each stands once the module answered it. Prisma's rows are read here for their types
// alone.

/**
 * Each note's place in its group (round 0.35.0 §2.4), from 0, as Foundry sends the journal in its
 * page order: a chapter's among the chapters, an entry's among the entries of its chapter, or of
 * none. So a reorder in Foundry changes the places, and a note added at a group's end no other's.
 */
export function placesOf(pages: JournalPage[]): Map<string, number> {
  const counted = new Map<string, number>()
  const places = new Map<string, number>()
  for (const page of pages) {
    const group =
      page.role === 'chapter' ? 'chapters' : `entries:${page.chapter ?? ''}`
    const place = counted.get(group) ?? 0
    places.set(page.id, place)
    counted.set(group, place + 1)
  }
  return places
}

/** A change's command id: the change's own, then which change of it this is. */
export function commandId(write: { id: string; seq: number }): string {
  return `${write.id}.${write.seq}`
}

/** Which table goes first of a change and an order queued at the same time: the change. */
const TABLE_FIRST = { write: 0, order: 1 } as const

/** Oldest first, a note's change before an order queued at the same time, then by id. */
export function byQueue(
  a: { table: 'write' | 'order'; id: string; queuedAt: Date },
  b: { table: 'write' | 'order'; id: string; queuedAt: Date },
): number {
  return (
    a.queuedAt.getTime() - b.queuedAt.getTime() ||
    TABLE_FIRST[a.table] - TABLE_FIRST[b.table] ||
    a.id.localeCompare(b.id)
  )
}

/** A change to one page as the module's note command (round 0.34.0 §3.4). */
export function pageCommand(
  write: JournalWrite & { book: { kind: NoteBookKind; actorId: string } },
): NotePageCommand {
  const entry = write.role === 'entry'
  const { writer, gm } = handedAs(write)
  return {
    id: commandId(write),
    actorId: write.book.actorId,
    kind: 'note',
    ...(gm && { by: 'gm' as const }),
    note: {
      book: write.book.kind,
      op: write.op,
      id: write.noteId,
      role: write.role,
      base: write.op === 'create' ? null : write.base,
      writer,
      at: write.modifiedAt.getTime(),
      ...(write.op !== 'delete' && { title: write.title }),
      ...(write.op !== 'delete' &&
        entry && { markdown: write.body, chapter: write.chapterId }),
      ...(write.op === 'create' && {
        createdAt: write.noteCreatedAt.getTime(),
      }),
    },
    ...NO_DICE,
  }
}

/**
 * An order of a group's notes as the module's note command (round 0.35.0 §3.4): as whoever last
 * made it, exactly its fields, and nothing a roll names.
 */
export function orderCommand(
  order: JournalOrder & { book: { kind: NoteBookKind; actorId: string } },
): NoteOrderCommand {
  const gm = order.seat === 'gm'
  return {
    id: commandId(order),
    actorId: order.book.actorId,
    kind: 'note',
    ...(gm && { by: 'gm' as const }),
    note: {
      book: order.book.kind,
      op: 'order',
      chapter: order.chapterId || null,
      ids: order.ids,
      was: order.was,
      writer: gm ? null : order.writerActorId,
      at: order.modifiedAt.getTime(),
    },
    ...NO_DICE,
  }
}

/**
 * Who a change is handed over as (§3.4). A create goes as its author, whoever changed it since: the
 * module makes a create's writer its author, and a party member owns, in Foundry and here, only the
 * pages they wrote. So a member's note the Gamemaster fixed while it waited, or made again after
 * Foundry deleted it, stays the member's. A note first written in Foundry has no author to keep,
 * and goes as whoever made it again; any other change goes as whoever made it.
 */
function handedAs(write: {
  op: 'create' | 'update' | 'delete'
  seat: 'player' | 'gm'
  writerActorId: string | null
  authorActorId: string | null
  authorGm: boolean
}): { writer: string | null; gm: boolean } {
  if (write.op === 'create' && write.authorActorId) {
    return { writer: write.authorActorId, gm: false }
  }
  if (write.op === 'create' && write.authorGm) return { writer: null, gm: true }
  return write.seat === 'gm'
    ? { writer: null, gm: true }
    : { writer: write.writerActorId, gm: false }
}

/** The reasons a note command may be refused for, kept as they are; any other is an error. */
const KEPT_REASONS: ReadonlySet<string> = new Set<NoteReason>([
  'not-yours',
  'not-member',
  'private',
  'unknown',
  'headings',
  'full',
  'invalid',
  'foundry-only',
  'off',
  'error',
])

/**
 * Where a change stands once the module answered it: made; waiting for its author to choose, where
 * the note was changed or deleted in Foundry; or failed, for a reason the view knows, else error.
 */
export function outcome(result: CommandResult): {
  status: 'made' | 'conflict' | 'failed'
  reason: string | null
} {
  if (result.status === 'done') return { status: 'made', reason: null }
  const reason = result.reason ?? 'error'
  if (reason === 'changed' || reason === 'gone') {
    return { status: 'conflict', reason }
  }
  return {
    status: 'failed',
    reason: KEPT_REASONS.has(reason) ? reason : 'error',
  }
}

/** Where an order stands once the module answered it, but for a chapter gone. */
export function orderOutcome(result: CommandResult): {
  status: 'made' | 'conflict' | 'failed'
  reason: string | null
} {
  if (result.status === 'done') return { status: 'made', reason: null }
  const reason = result.reason ?? 'error'
  if (reason === 'changed') return { status: 'conflict', reason }
  return {
    status: 'failed',
    reason: KEPT_REASONS.has(reason) ? reason : 'error',
  }
}
