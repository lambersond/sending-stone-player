import {
  fromMirror,
  fromWrite,
  groupKey,
  noteIds,
  waiting,
} from '@/utils/notes/view'
import type { NotesSeat } from '@/types/notes'
import type { HeldBook } from '@/utils/notes/types'
import type { JournalNote, JournalWrite } from '@prisma/client'

// What a change to a book of journal notes is made of and checked against (src/db/notes.ts): who
// a seat writes as, what a note says now, what the book holds, and how a change folds into one
// waiting or is sent again.

/** The name the Gamemaster writes as, in both books (Q5). */
const GAMEMASTER = 'Gamemaster'

/** The name a seat writes as: the Gamemaster's, or their character's as the campaign names it. */
export function writerName(held: HeldBook, seat: NotesSeat): string {
  if (seat.role === 'gm') return GAMEMASTER
  return (seat.actorId && held.names.get(seat.actorId)) || seat.name
}

/** What a note says now: the change waiting where there is one, else Foundry's; none if neither. */
export function current(note?: JournalNote, write?: JournalWrite) {
  if (waiting(write) && write.op !== 'delete') return fromWrite(write, note)
  return note ? fromMirror(note) : undefined
}

/** Whether a chapter is the book's: Foundry's, or one made here on its way. */
export function chapterKnown(held: HeldBook, chapter: string): boolean {
  return (
    held.notes.get(chapter)?.role === 'chapter' ||
    [...held.writes.values()].some(
      write =>
        write.noteId === chapter &&
        write.role === 'chapter' &&
        write.op === 'create' &&
        waiting(write),
    )
  )
}

/**
 * The book's entries and chapters as they'll stand, none on its way out counted, and its entries'
 * text but a note's own.
 * @param noteId - The note a change is to, whose own text doesn't count.
 */
export function bookCounts(held: HeldBook, noteId?: string) {
  let entryCount = 0
  let chapterCount = 0
  let text = 0
  for (const id of noteIds(held)) {
    const note = held.notes.get(id)
    const write = held.writes.get(id)
    if (waiting(write) && write.op === 'delete') continue
    const now = current(note, write)
    if (!now) continue
    const itsRole = note?.role ?? write?.role
    if (itsRole === 'chapter') chapterCount++
    if (itsRole === 'entry') {
      entryCount++
      if (id !== noteId) text += now.body.length
    }
  }
  return { entryCount, chapterCount, text }
}

/** A change folded into the one waiting: a delete stays one, and a change undoes one. */
export function foldedOp(
  waiting: JournalWrite['op'],
  change: 'update' | 'delete',
): JournalWrite['op'] {
  if (change === 'delete') return 'delete'
  return waiting === 'delete' ? 'update' : waiting
}

/**
 * A change the game didn't take, sent again as the seat's (§4.5): the note made again where Foundry
 * deleted it; made from Foundry's revision now where Foundry changed it; else as it was.
 * @param withheld - Foundry holds the book back, so the mirror can't say its revision now.
 */
export function sentAgain(
  write: JournalWrite,
  note: JournalNote | undefined,
  withheld: boolean,
): Partial<Pick<JournalWrite, 'op' | 'base'>> {
  if (write.status !== 'conflict') return {}
  if (write.reason === 'gone') return { op: 'create', base: null }
  // Foundry's revision now is the mirror's, which every journal.updated keeps up; but in a book
  // Foundry holds back nothing does, and the refusal's own revision is the latest word of it.
  const now = withheld
    ? (write.foundryRev ?? note?.revision)
    : (note?.revision ?? write.foundryRev)
  return { base: now ?? write.base }
}

/**
 * A group's order as the mirror holds it (round 0.35.0 §7.7): its notes as Foundry last sent them
 * in it, by their place there, then by when each was written, then id. What an order is made from,
 * so that the module can tell whether Foundry's order of those notes changed since.
 */
export function mirrorOrder(
  held: HeldBook,
  chapterId: string | null,
): string[] {
  const group = groupKey(chapterId)
  return [...held.notes.values()]
    .filter(note => note.role === 'entry' && groupKey(note.chapterId) === group)
    .toSorted(
      (a, b) =>
        a.place - b.place ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.noteId.localeCompare(b.noteId),
    )
    .map(({ noteId }) => noteId)
}
