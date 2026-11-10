import { randomUUID } from 'node:crypto'
import {
  Prisma,
  type JournalNote,
  type JournalOrder,
  type JournalWrite,
} from '@prisma/client'
import prisma from '@/clients/prisma'
import {
  MOST_BOOK_TEXT,
  MOST_CHAPTERS,
  MOST_ENTRIES,
  NOTES_PER_MINUTE,
} from '@/constants/notes'
import {
  BRIDGE_POLLED_WITHIN,
  ROLL_ANSWER_WITHIN,
} from '@/constants/sending-stone'
import { noteHtml } from '@/lib/note-html'
import { convertNoteMarkdown, hasBigHeading } from '@/lib/note-markdown'
import { checkChange } from '@/schemas/notes'
import { bigHeadings } from '@/utils/note-headings'
import { newNoteId } from '@/utils/note-id'
import {
  bookCounts,
  chapterKnown,
  current,
  foldedOp,
  mirrorOrder,
  sentAgain,
  writerName,
} from '@/utils/notes/book'
import {
  foundryOnly,
  groupKey,
  groupStamp,
  ordered,
  ordering,
  overlay,
  rightsFor,
  stampOf,
  viewOf,
  waiting,
} from '@/utils/notes/view'
import type { NoteAnswer, Tx } from './types'
import type {
  NoteOrder,
  NoteOrderResolve,
  NoteRole,
  NotesBook,
  NotesSeat,
  NotesView,
} from '@/types/notes'
import type { ConnectedCharacter } from '@/types/sending-stone'
import type { HeldBook } from '@/utils/notes/types'

// A seat's journal notes (round 0.34.0 §8.5-§8.8), from module 0.34.0: a character's own book, or a
// party's, kept here first and sent to Foundry when the Gamemaster's game next takes them. Every
// change is stored at once, whatever Foundry's state, and only the app's own checks refuse one: who
// may change it, what it says and how much there is. Each book holds the module's latest word of
// its journal (`JournalNote`) and, beside it, at most one change waiting per note (`JournalWrite`),
// whose every change is compare-and-set, so two saves at once never both land.
//
// From module 0.35.0 (round 0.35.0 §7) each group of a book's notes, a chapter's or those in none,
// has an order: Foundry's, kept in the mirror as each note's place, and at most one new order made
// here and waiting for it (`JournalOrder`), which anyone who may write the book makes, whoever
// wrote the notes. And the book keeps its last change that leaves no note to show it: a delete, an
// order, or a refused change sent again, here or in Foundry.

/**
 * Whether a change handed to the module has gone unanswered past the time a fetched roll is (§4.3),
 * as when Foundry closed before its result came. It's handed over again when the game is back, and
 * meanwhile is no longer waited for: a late result for that hand-over changes nothing once the
 * change has moved on. An order of a group's notes likewise (round 0.35.0 §4.2).
 */
function lost(write: Pick<JournalWrite, 'status' | 'claimedAt'>): boolean {
  return (
    write.status === 'claimed' &&
    !!write.claimedAt &&
    write.claimedAt.getTime() < Date.now() - ROLL_ANSWER_WITHIN
  )
}

/** Where a change to a write may start from, as its compare-and-set's `where` says it. */
function openFrom(write: JournalWrite): Prisma.JournalWriteWhereInput {
  return lost(write)
    ? {
        status: 'claimed',
        claimedAt: { lt: new Date(Date.now() - ROLL_ANSWER_WITHIN) },
      }
    : { status: { in: ['pending', 'failed'] } }
}

/**
 * Where a change to an order may start from (round 0.35.0 §4.2): the status it was read in, or a
 * claim still thought lost.
 */
function orderFrom(order: JournalOrder): Prisma.JournalOrderWhereInput {
  return lost(order)
    ? {
        status: 'claimed',
        claimedAt: { lt: new Date(Date.now() - ROLL_ANSWER_WITHIN) },
      }
    : { status: order.status }
}

/**
 * Read a book for a seat: its notes and its changes waiting, and the campaign around it; and where
 * it's to be shown, a personal book's Tidy 5e Sheets journal (module 0.45.0), which no change here
 * reads.
 */
async function readBook(
  book: NotesBook,
  { tidy = false }: { tidy?: boolean } = {},
): Promise<HeldBook | undefined> {
  const withTidy = tidy && book.kind === 'personal'
  const [campaign, row] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: book.campaignId },
      select: {
        origin: true,
        characters: true,
        notesEnabled: true,
        noteFeatures: true,
        bridgePolledAt: true,
        tidyActive: true,
        tidyVersion: true,
      },
    }),
    prisma.journalBook.findUnique({
      where: {
        campaignBook: {
          campaignId: book.campaignId,
          kind: book.kind,
          actorId: book.actorId,
        },
      },
      select: {
        id: true,
        version: true,
        journalName: true,
        withheld: true,
        changedAt: true,
        changedBy: true,
        notes: true,
        writes: true,
        orders: true,
        tidy: withTidy && {
          select: {
            source: true,
            entryId: true,
            title: true,
            html: true,
            sort: true,
            secret: true,
            firstSeenAt: true,
            changedAt: true,
          },
        },
      },
    }),
  ])
  if (!campaign) return undefined
  const roster = Array.isArray(campaign.characters)
    ? (campaign.characters as unknown as (ConnectedCharacter | null)[]).filter(
        (entry): entry is ConnectedCharacter => typeof entry?.id === 'string',
      )
    : []
  const polled = campaign.bridgePolledAt?.getTime()
  return {
    book,
    ...(row && {
      row: {
        id: row.id,
        version: row.version,
        journalName: row.journalName,
        withheld: row.withheld,
      },
    }),
    notes: new Map((row?.notes ?? []).map(note => [note.noteId, note])),
    writes: new Map((row?.writes ?? []).map(write => [write.noteId, write])),
    orders: new Map((row?.orders ?? []).map(order => [order.chapterId, order])),
    ...(row?.changedAt && {
      changed: { at: row.changedAt, by: row.changedBy ?? '' },
    }),
    takesOrders: campaign.noteFeatures.includes('orders'),
    connected:
      book.kind === 'party' || roster.some(({ id }) => id === book.actorId),
    live:
      campaign.notesEnabled &&
      !!polled &&
      Date.now() - polled < BRIDGE_POLLED_WITHIN,
    enabled: campaign.notesEnabled,
    origin: campaign.origin,
    names: new Map(roster.map(({ id, name }) => [id, name])),
    ...(withTidy && {
      tidy: {
        entries: row?.tidy ?? [],
        active: campaign.tidyActive,
        version: campaign.tidyVersion,
      },
    }),
  }
}

/**
 * A book as a seat sees it (§8.8): its chapters, oldest first, and its entries, each as Foundry
 * holds it or as changed here and waiting, with where it stands, what the seat may do with it, and
 * its Markdown only for a seat that may change it. From module 0.35.0 (round 0.35.0 §7.9) its
 * entries are grouped, the notes in no chapter first, each group's in its order, and each group
 * says where its order stands; and the book says who last changed anything in it the seat sees. A
 * book never written in is empty, at version 0; reading it never makes it.
 * @returns Undefined where the campaign isn't there.
 */
export async function getNotesView(
  seat: NotesSeat,
  book: NotesBook,
): Promise<NotesView | undefined> {
  const held = await readBook(book, { tidy: true })
  if (!held) return undefined
  return viewOf(held, seat).view
}

/**
 * Whether anything is new in a book for a page that saw it at a version, live or not: its version,
 * and whether its game is taking notes now, which changes with no new version.
 * @returns Undefined where the campaign isn't there.
 */
export async function getNotesStatus(
  book: NotesBook,
): Promise<{ version: number; live: boolean } | undefined> {
  const [campaign, row] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: book.campaignId },
      select: { notesEnabled: true, bridgePolledAt: true },
    }),
    prisma.journalBook.findUnique({
      where: {
        campaignBook: {
          campaignId: book.campaignId,
          kind: book.kind,
          actorId: book.actorId,
        },
      },
      select: { version: true },
    }),
  ])
  if (!campaign) return undefined
  const polled = campaign.bridgePolledAt?.getTime()
  return {
    version: row?.version ?? 0,
    live:
      campaign.notesEnabled &&
      !!polled &&
      Date.now() - polled < BRIDGE_POLLED_WITHIN,
  }
}

/** A note's Markdown as a book draws it: a personal book keeps its secrets, a party's never. */
function htmlFor(held: HeldBook, body: string): string {
  return noteHtml(
    { format: 2, body },
    held.origin,
    held.book.kind === 'personal',
  )
}

/** Who a change is from, as each change to a note's waiting row records it. */
function changedBy(held: HeldBook, seat: NotesSeat, now: Date) {
  return {
    seat: seat.role,
    requestedById: seat.userId,
    writerActorId: seat.role === 'gm' ? null : seat.actorId,
    modifiedAt: now,
    modifiedBy: writerName(held, seat),
  }
}

/**
 * Whether a book takes a change at all, and from this seat now (create steps 2-4): its actor still
 * the campaign's, a party its characters may see, and the seat not making too many changes.
 */
async function takes(
  held: HeldBook,
  seat: NotesSeat,
  { limited }: { limited: boolean },
): Promise<NoteAnswer | undefined> {
  if (!held.connected) return { ok: false, status: 409, reason: 'unknown' }
  if (held.book.private) return { ok: false, status: 409, reason: 'private' }
  if (!limited) return
  // The seat's own changes, by when it made them: made ones count too, kept an hour for it, and
  // each note's folded changes once. The module's claims and answers touch the rows, not this, so
  // a backlog made at once when the game comes back costs the seat nothing. From module 0.35.0 its
  // orders count with its notes' changes, each group's refolds once.
  const mine = {
    requestedById: seat.userId,
    modifiedAt: { gte: new Date(Date.now() - 60_000) },
  }
  const [notes, orders] = await Promise.all([
    prisma.journalWrite.count({ where: mine }),
    prisma.journalOrder.count({ where: mine }),
  ])
  if (notes + orders >= NOTES_PER_MINUTE) {
    return { ok: false, status: 429, reason: 'busy' }
  }
}

/**
 * Whether what's written fits (create steps 5-7): an entry's Markdown with no H1 or H2 as Foundry
 * renders it, the scanner only pointing at the lines; its chapter one of the book's; and the book
 * not full.
 * @param noteId - The note it changes, whose own text and place don't count; none for a new one.
 */
function fits(
  held: HeldBook,
  role: NoteRole,
  content: { body: string; chapterId: string | null },
  noteId?: string,
): NoteAnswer | undefined {
  if (role === 'entry' && hasBigHeading(convertNoteMarkdown(content.body))) {
    return {
      ok: false,
      status: 422,
      reason: 'headings',
      lines: bigHeadings(content.body),
    }
  }
  if (
    role === 'entry' &&
    content.chapterId &&
    !chapterKnown(held, content.chapterId)
  ) {
    return { ok: false, status: 422, reason: 'gone' }
  }
  const { entryCount, chapterCount, text } = bookCounts(held, noteId)
  // A change adds no note; a new one may be one too many.
  const most = role === 'entry' ? MOST_ENTRIES : MOST_CHAPTERS
  const count = role === 'entry' ? entryCount : chapterCount
  const full = !noteId && count >= most
  if (full || text + content.body.length > MOST_BOOK_TEXT) {
    return { ok: false, status: 422, reason: 'full' }
  }
}

/** A key the database already holds, as a second change made at once meets. */
const isTaken = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002'

/**
 * The book's last change that leaves no note to show it (round 0.35.0 §2.6): who, when, and
 * where, here or in Foundry.
 */
type BookChange = {
  changedAt: Date
  changedBy: string
  changedIn: 'app' | 'foundry'
}

/** A change made here by a seat, now, as the book records it. */
function changedHere(held: HeldBook, seat: NotesSeat, at: Date): BookChange {
  return { changedAt: at, changedBy: writerName(held, seat), changedIn: 'app' }
}

/**
 * The book's row, made where it has none, its version bumped for what changes now; and where the
 * change leaves no note to show it, the book's record of it.
 */
async function bumpBook(
  tx: Tx,
  book: NotesBook,
  changed?: BookChange,
): Promise<string> {
  const { id } = await tx.journalBook.upsert({
    where: {
      campaignBook: {
        campaignId: book.campaignId,
        kind: book.kind,
        actorId: book.actorId,
      },
    },
    create: {
      campaignId: book.campaignId,
      kind: book.kind,
      actorId: book.actorId,
      version: 1,
      ...changed,
    },
    update: { version: { increment: 1 }, ...changed },
    select: { id: true },
  })
  return id
}

/** Run a change, a second made at once from the same stamp answered 409, never 500. */
async function guarded(run: () => Promise<NoteAnswer>): Promise<NoteAnswer> {
  try {
    return await run()
  } catch (error) {
    if (isTaken(error) || error instanceof Changed) {
      return { ok: false, status: 409, reason: 'changed' }
    }
    throw error
  }
}

/** A compare-and-set that found the row changed since it was read: nothing is written. */
class Changed extends Error {}

/** Throw where a compare-and-set changed no row, so its transaction writes nothing. */
function changedOne({ count }: { count: number }) {
  if (count === 0) throw new Changed('The note changed meanwhile')
}

/**
 * Add a note or chapter to a book (§8.7): stored at once, whatever Foundry's state, and sent to it
 * when the Gamemaster's game next takes notes. Its id is made here, never taken from the page, and
 * becomes its page's id in Foundry.
 * @returns The note's id and stamp, or why not.
 */
export async function createNote(
  seat: NotesSeat,
  book: NotesBook,
  input: {
    role: NoteRole
    title: string
    body?: string
    chapterId?: string | null
  },
): Promise<NoteAnswer> {
  const held = await readBook(book)
  if (!held) return { ok: false, status: 404, reason: 'gone' }
  const refused = await takes(held, seat, { limited: true })
  if (refused) return refused
  const body = input.role === 'entry' ? (input.body ?? '') : ''
  const chapterId = input.role === 'entry' ? (input.chapterId ?? null) : null
  const misfit = fits(held, input.role, { body, chapterId })
  if (misfit) return misfit
  const now = new Date()
  const id = randomUUID()
  const noteId = newNoteId()
  const by = changedBy(held, seat, now)
  return guarded(() =>
    prisma.$transaction(async tx => {
      const bookId = await bumpBook(tx, book)
      await tx.journalWrite.create({
        data: {
          id,
          seq: 0,
          campaignId: book.campaignId,
          bookId,
          noteId,
          op: 'create',
          role: input.role,
          chapterId,
          title: input.title.trim(),
          body,
          html: input.role === 'entry' ? htmlFor(held, body) : '',
          authorActorId: seat.role === 'gm' ? null : seat.actorId,
          authorGm: seat.role === 'gm',
          authorName: by.modifiedBy,
          noteCreatedAt: now,
          ...by,
          base: null,
          status: 'pending',
          queuedAt: now,
        },
      })
      return { ok: true as const, id: noteId, stamp: `w:${id}.0` }
    }),
  )
}

/**
 * Change a note or chapter (§8.7), from what the page last saw of it: folded into its change
 * waiting, where there is one, else a change of its own, made from Foundry's revision now.
 * @returns The note's stamp now, or why not.
 */
export async function changeNote(
  seat: NotesSeat,
  book: NotesBook,
  noteId: string,
  change: {
    title: string
    body?: string
    chapterId?: string | null
    stamp: string
  },
): Promise<NoteAnswer> {
  const held = await readBook(book)
  const note = held?.notes.get(noteId)
  const write = held?.writes.get(noteId)
  const now = held && current(note, write)
  if (!held || !now || (!note && !waiting(write))) {
    return { ok: false, status: 404, reason: 'gone' }
  }
  const rights = rightsFor(held, seat, note, write)
  // A chapter's change is its title alone.
  const misshapen = checkChange(change, rights.role)
  if (misshapen) {
    return { ok: false, status: 400, reason: 'invalid', field: misshapen.field }
  }
  if (!rights.mayChange) return { ok: false, status: 403, reason: 'not-yours' }
  const standing = changeStanding(held, seat, note, write, change.stamp)
  if (standing) return standing
  const refused = await takes(held, seat, { limited: true })
  if (refused) return refused
  const entry = rights.role === 'entry'
  const body = entry ? (change.body ?? now.body) : ''
  const moved =
    change.chapterId === undefined ? now.chapterId : change.chapterId
  const chapterId = entry ? moved : null
  const misfit = fits(held, rights.role, { body, chapterId }, noteId)
  if (misfit) return misfit
  const at = new Date()
  const content = {
    title: change.title.trim(),
    body,
    html: entry ? htmlFor(held, body) : '',
    chapterId,
    ...changedBy(held, seat, at),
  }
  return guarded(() =>
    prisma.$transaction(async tx => {
      await bumpBook(tx, book)
      const seq = await saveChange(tx, held, noteId, note, write, {
        content,
        op: 'update',
        at,
      })
      return { ok: true as const, stamp: `w:${seq.id}.${seq.seq}` }
    }),
  )
}

/**
 * Why a note can't be changed now, as it stands: Foundry holds what the app can't write, the page
 * saw it otherwise than it is, or a change of it is on its way or refused.
 */
function changeStanding(
  held: HeldBook,
  seat: NotesSeat,
  note: JournalNote | undefined,
  write: JournalWrite | undefined,
  stamp: string,
): NoteAnswer | undefined {
  const seen = overlay(note, write, true, held.live, seat)
  if (seen?.mirrored && note && foundryOnly(note)) {
    return { ok: false, status: 409, reason: 'foundry-only' }
  }
  if (stamp !== stampOf(note, write)) {
    return { ok: false, status: 409, reason: 'changed' }
  }
  // On its way: waited for, unless it's thought lost. A create is waited for however long, as made
  // again with new text it could find its page already made, which keeps the old.
  if (write?.status === 'claimed' && (write.op === 'create' || !lost(write))) {
    return { ok: false, status: 409, reason: 'saving' }
  }
  if (write?.status === 'conflict') {
    return { ok: false, status: 409, reason: 'conflict' }
  }
  return undefined
}

/**
 * A change stored, compare-and-set (§4.2): folded into the note's change waiting or refused, its
 * op kept but a delete's, which becomes this; a made one used again as a new change, from
 * Foundry's revision now; else a new one, from it too.
 * @returns The change's id and number now.
 */
async function saveChange(
  tx: Tx,
  held: HeldBook,
  noteId: string,
  note: JournalNote | undefined,
  write: JournalWrite | undefined,
  {
    content,
    op,
    at,
  }: {
    content: Partial<JournalWrite>
    op: 'update' | 'delete'
    at: Date
  },
): Promise<{ id: string; seq: number }> {
  if (write && waiting(write)) {
    changedOne(
      await tx.journalWrite.updateMany({
        where: { id: write.id, seq: write.seq, ...openFrom(write) },
        data: {
          ...content,
          op: foldedOp(write.op, op),
          seq: { increment: 1 },
          status: 'pending',
          reason: null,
        },
      }),
    )
    return { id: write.id, seq: write.seq + 1 }
  }
  const mirror = note!
  const fresh = {
    op,
    role: mirror.role,
    title: mirror.title,
    body: mirror.body,
    html: mirror.html,
    chapterId: mirror.chapterId,
    authorActorId: mirror.authorActorId,
    authorGm: mirror.authorGm,
    authorName: mirror.authorName ?? '',
    noteCreatedAt: mirror.createdAt,
    base: mirror.revision,
    status: 'pending' as const,
    reason: null,
    claimToken: null,
    claimSession: null,
    claimedAt: null,
    queuedAt: at,
    ...content,
  }
  if (write) {
    // Made, and kept only for the limit: it becomes this change.
    changedOne(
      await tx.journalWrite.updateMany({
        where: { id: write.id, seq: write.seq, status: 'made' },
        data: { ...fresh, foundryRev: null, seq: { increment: 1 } },
      }),
    )
    return { id: write.id, seq: write.seq + 1 }
  }
  const id = randomUUID()
  await tx.journalWrite.create({
    data: {
      id,
      seq: 0,
      campaignId: held.book.campaignId,
      bookId: held.row!.id,
      noteId,
      seat: 'player',
      requestedById: '',
      modifiedAt: at,
      modifiedBy: '',
      ...fresh,
    },
  })
  return { id, seq: 0 }
}

/**
 * Delete an entry (§8.7): a change waiting that was to make it is dropped, as it never reached
 * Foundry; any other becomes its deletion, from Foundry's revision. No chapter is deleted here.
 * @returns The note's stamp now, or why not.
 */
export async function deleteNote(
  seat: NotesSeat,
  book: NotesBook,
  noteId: string,
  stamp: string,
): Promise<NoteAnswer> {
  const held = await readBook(book)
  const note = held?.notes.get(noteId)
  const write = held?.writes.get(noteId)
  if (!held || (!note && !waiting(write))) {
    return { ok: false, status: 404, reason: 'gone' }
  }
  const rights = rightsFor(held, seat, note, write)
  if (rights.role === 'chapter') {
    return { ok: false, status: 409, reason: 'chapter' }
  }
  if (!rights.canDelete) return { ok: false, status: 403, reason: 'not-yours' }
  if (stamp !== stampOf(note, write)) {
    return { ok: false, status: 409, reason: 'changed' }
  }
  if (write?.status === 'claimed' && !lost(write)) {
    return { ok: false, status: 409, reason: 'saving' }
  }
  if (write?.status === 'conflict') {
    return { ok: false, status: 409, reason: 'conflict' }
  }
  // A create thought lost on its way is dropped too: if Foundry made its page after all, the page
  // comes back with the journal, as Foundry's. It's on the journal's line only where every seat
  // saw it: a failed one only its seat and the Gamemaster see (round 0.35.0 §2.6).
  if (write && waiting(write) && write.op === 'create') {
    const seen = write.status === 'pending' || write.status === 'claimed'
    return guarded(() =>
      prisma.$transaction(async tx => {
        changedOne(
          await tx.journalWrite.deleteMany({
            where: { id: write.id, seq: write.seq, ...openFrom(write) },
          }),
        )
        await bumpBook(
          tx,
          book,
          seen ? changedHere(held, seat, new Date()) : undefined,
        )
        return { ok: true as const, stamp: `n:${note?.revision ?? ''}` }
      }),
    )
  }
  const refused = await takes(held, seat, { limited: false })
  if (refused) return refused
  const at = new Date()
  return guarded(() =>
    prisma.$transaction(async tx => {
      await bumpBook(tx, book, changedHere(held, seat, at))
      const seq = await saveChange(tx, held, noteId, note, write, {
        content: changedBy(held, seat, at),
        op: 'delete',
        at,
      })
      return { ok: true as const, stamp: `w:${seq.id}.${seq.seq}` }
    }),
  )
}

/**
 * Settle a change the game didn't take (§4.5, §8.7): the seat's own, or for the Gamemaster
 * anyone's in the book. Theirs drops it, Foundry's version staying, as a waiting delete's "Keep
 * it" does; mine sends it again, from Foundry's revision now, or as the note made again where
 * Foundry deleted it.
 * @returns The note's stamp now, or why not.
 */
export async function resolveNote(
  seat: NotesSeat,
  book: NotesBook,
  noteId: string,
  { resolve, stamp }: { resolve: 'mine' | 'theirs'; stamp: string },
): Promise<NoteAnswer> {
  const held = await readBook(book)
  const note = held?.notes.get(noteId)
  const write = held?.writes.get(noteId)
  if (!held || (!note && !waiting(write))) {
    return { ok: false, status: 404, reason: 'gone' }
  }
  // Theirs also drops a change thought lost on its way, as the Gamemaster clears a stuck one (Q5):
  // whatever Foundry made of it comes back with the journal.
  const settles =
    write?.status === 'conflict' ||
    write?.status === 'failed' ||
    (resolve === 'theirs' &&
      !!write &&
      ((write.status === 'pending' && write.op === 'delete') || lost(write)))
  if (!write || !settles) return { ok: false, status: 409, reason: 'changed' }
  const rights = rightsFor(held, seat, note, write)
  const may =
    seat.role === 'gm' ||
    write.requestedById === seat.userId ||
    (write.op === 'delete' ? rights.canDelete : rights.mayChange)
  if (!may) return { ok: false, status: 403, reason: 'not-yours' }
  if (stamp !== stampOf(note, write)) {
    return { ok: false, status: 409, reason: 'changed' }
  }
  const where = {
    id: write.id,
    seq: write.seq,
    ...(lost(write) ? openFrom(write) : { status: write.status }),
  }
  if (resolve === 'theirs') {
    return guarded(() =>
      prisma.$transaction(async tx => {
        changedOne(await tx.journalWrite.deleteMany({ where }))
        await bumpBook(tx, book)
        return { ok: true as const, stamp: `n:${note?.revision ?? ''}` }
      }),
    )
  }
  const again = sentAgain(write, note, !!held.row?.withheld)
  return guarded(() =>
    prisma.$transaction(async tx => {
      changedOne(
        await tx.journalWrite.updateMany({
          where,
          data: {
            ...again,
            status: 'pending',
            reason: null,
            seq: { increment: 1 },
          },
        }),
      )
      // Sent again, it's a change to the journal by whoever chose it (round 0.35.0 §2.6).
      await bumpBook(tx, book, changedHere(held, seat, new Date()))
      return { ok: true as const, stamp: `w:${write.id}.${write.seq + 1}` }
    }),
  )
}

/**
 * Put the notes of a chapter, or of none, in a new order (round 0.35.0 §4.2, §7.7), from what the
 * page last saw of the group: by anyone who may write the book, whoever wrote the notes, as it
 * changes no note's title, text or chapter. Stored at once, whatever Foundry's state, and shown to
 * everyone at once: folded into the group's order waiting, where there is one, else an order of its
 * own, made from the mirror's order of the group now.
 * @returns The group's stamp now, or why not.
 */
export async function reorderNotes(
  seat: NotesSeat,
  book: NotesBook,
  { chapterId, ids, stamp }: NoteOrder,
): Promise<NoteAnswer> {
  const held = await readBook(book)
  const group = held && viewOf(held, seat).groups.get(groupKey(chapterId))
  if (!held || !group) return { ok: false, status: 404, reason: 'gone' }
  const refused = await takes(held, seat, { limited: false })
  if (refused) return refused
  if (stamp !== group.view.stamp) {
    return { ok: false, status: 409, reason: 'changed' }
  }
  // Every note of the group the seat sees, once: none it doesn't, and none left out.
  const members = new Set(group.ids)
  if (ids.length !== members.size || ids.some(id => !members.has(id))) {
    return { ok: false, status: 409, reason: 'changed' }
  }
  const { order } = group
  if (order?.status === 'claimed' && !lost(order)) {
    return { ok: false, status: 409, reason: 'saving' }
  }
  if (ids.every((id, n) => id === group.ids[n])) return { ok: true, stamp }
  const limited = await takes(held, seat, { limited: true })
  if (limited) return limited
  const now = new Date()
  // Every fold queues it again, so that a note it places, made after it was first queued, reaches
  // Foundry before it does.
  const fields = {
    ids,
    ...changedBy(held, seat, now),
    status: 'pending' as const,
    reason: null,
    queuedAt: now,
  }
  return guarded(() =>
    prisma.$transaction(async tx => {
      const bookId = await bumpBook(tx, book, changedHere(held, seat, now))
      if (!order) {
        await tx.journalOrder.create({
          data: {
            id: randomUUID(),
            seq: 0,
            campaignId: book.campaignId,
            bookId,
            chapterId: groupKey(chapterId),
            was: mirrorOrder(held, chapterId),
            ...fields,
          },
        })
        return { ok: true as const, stamp: groupStamp(null, ids) }
      }
      // One waiting, or thought lost on its way, keeps the order in Foundry it was first made
      // from. One refused or made is made afresh from Foundry's order now, which every seat but
      // its own and the Gamemaster was shown, and the new order was made from.
      const afresh = !ordering(order)
      changedOne(
        await tx.journalOrder.updateMany({
          where: { id: order.id, seq: order.seq, ...orderFrom(order) },
          data: {
            ...fields,
            seq: { increment: 1 },
            ...(afresh && { was: mirrorOrder(held, chapterId) }),
            ...(order.status === 'made' && {
              claimToken: null,
              claimSession: null,
              claimedAt: null,
            }),
          },
        }),
      )
      return { ok: true as const, stamp: groupStamp(null, ids) }
    }),
  )
}

/**
 * Settle an order the game didn't take (round 0.35.0 §4.3, §7.7): the seat's own, or for the
 * Gamemaster anyone's. Theirs drops it, Foundry's order staying, as it does one thought lost on its
 * way; mine sends it again, where Foundry's order changed meanwhile from Foundry's order now.
 * @returns The group's stamp now, or why not.
 */
export async function resolveOrder(
  seat: NotesSeat,
  book: NotesBook,
  { chapterId, resolve, stamp }: NoteOrderResolve,
): Promise<NoteAnswer> {
  const held = await readBook(book)
  const group = held && viewOf(held, seat).groups.get(groupKey(chapterId))
  if (!held || !group) return { ok: false, status: 404, reason: 'gone' }
  const { order } = group
  const settles =
    order?.status === 'conflict' ||
    order?.status === 'failed' ||
    (resolve === 'theirs' && !!order && lost(order))
  if (!order || !settles) return { ok: false, status: 409, reason: 'changed' }
  if (seat.role !== 'gm' && order.requestedById !== seat.userId) {
    return { ok: false, status: 403, reason: 'not-yours' }
  }
  if (stamp !== group.view.stamp) {
    return { ok: false, status: 409, reason: 'changed' }
  }
  const where = { id: order.id, seq: order.seq, ...orderFrom(order) }
  if (resolve === 'theirs') {
    // Keeping Foundry's order changes nothing in the journal: no one's change to record.
    return guarded(() =>
      prisma.$transaction(async tx => {
        changedOne(await tx.journalOrder.deleteMany({ where }))
        await bumpBook(tx, book)
        return { ok: true as const, stamp: groupStamp(null, group.base) }
      }),
    )
  }
  const now = new Date()
  return guarded(() =>
    prisma.$transaction(async tx => {
      changedOne(
        await tx.journalOrder.updateMany({
          where,
          data: {
            ...(order.status === 'conflict' && {
              was: mirrorOrder(held, chapterId),
            }),
            status: 'pending',
            reason: null,
            seq: { increment: 1 },
            queuedAt: now,
          },
        }),
      )
      await bumpBook(tx, book, changedHere(held, seat, now))
      const again = { ...order, status: 'pending' as const }
      return {
        ok: true as const,
        stamp: groupStamp(null, ordered(group.base, again)),
      }
    }),
  )
}

/**
 * A note's Markdown as the book will draw it, for the editor's preview, and the lines the scanner
 * points at: rendered for the book, its secrets as it keeps them; nothing stored.
 * @returns Undefined where the campaign isn't there.
 */
export async function previewNote(
  book: NotesBook,
  body: string,
): Promise<{ html: string; headings: number[] } | undefined> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: book.campaignId },
    select: { origin: true },
  })
  if (!campaign) return undefined
  return {
    html: noteHtml(
      { format: 2, body },
      campaign.origin,
      book.kind === 'personal',
    ),
    headings: bigHeadings(body),
  }
}
