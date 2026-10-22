/* eslint-disable unicorn/no-null -- Prisma and the protocol use null for an absent value */
import { randomUUID } from 'node:crypto'
import {
  Prisma,
  type JournalNote,
  type JournalOrder,
  type JournalWrite,
} from '@prisma/client'
import prisma from '@/clients/prisma'
import { NOTE_CLAIM_CHARS, NOTE_CLAIM_LIMIT } from '@/constants/notes'
import { ROLL_ANSWER_WITHIN } from '@/constants/sending-stone'
import { noteHtml } from '@/lib/note-html'
import type { NoteBookKind, NoteReason, NoteRole } from '@/types/notes'
import type {
  CommandResult,
  JournalPage,
  JournalUpdated,
} from '@/types/sending-stone'

// The module's side of journal notes (round 0.34.0 §4, §8.9), from module 0.34.0: what Foundry
// holds of each book, as the module sends it, kept as the app's mirror of it; and the changes made
// here, handed to the module to make there. Each change is handed over until a result answers it,
// as Foundry may be closed for days, and the module makes it at most once in effect. Nothing here
// decides between a change made here and one made in Foundry: the module does, as it makes each.
//
// From module 0.35.0 (round 0.35.0 §7.8-§7.10) the mirror keeps each note's place in its group,
// as Foundry sends the journal in its page order; an order of a group's notes made here is handed
// over with the notes' changes, oldest first across both; and the book keeps who last deleted or
// reordered its pages in Foundry, and when, as the module says.

type Tx = Prisma.TransactionClient

/** How long a made change is kept, so the seat's limit has rows to count while Foundry is live. */
export const MADE_KEPT_FOR = 3_600_000

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

/**
 * An order of a group's notes, as the module fetches it (round 0.35.0 §3.4): the group's notes'
 * ids in the new order, and in Foundry's order it was made from.
 */
export type NoteOrderCommand = Omit<NotePageCommand, 'note'> & {
  note: {
    book: NoteBookKind
    op: 'order'
    /** The group: a chapter's page, or null for the notes in no chapter. */
    chapter: string | null
    ids: string[]
    was: string[]
    writer: string | null
    at: number
  }
}

/** A note command, as the module fetches it: a change to one page, or from 0.35.0 an order. */
export type NoteCommand = NotePageCommand | NoteOrderCommand

/**
 * On each hello from module 0.34.0 (§4.6): the books whose journal it no longer lists are emptied,
 * for each of the campaign's characters and parties it names. A book of an actor it doesn't name is
 * left alone, and a book with no journal yet has nothing to empty. Only the app's copy goes: if the
 * module simply failed to find the journal, its next `journal.updated` brings it back.
 * @param characters - The hello's characters, by their actors' ids.
 * @param groups - The hello's groups, by their actors' ids.
 * @param journals - The books whose journal the module says exists, for this campaign.
 */
export async function reconcileJournals(
  tx: Tx,
  campaignId: string,
  characters: string[],
  groups: string[],
  journals: { kind: NoteBookKind; actorId: string }[],
): Promise<void> {
  const named = {
    personal: new Set(characters),
    party: new Set(groups),
  }
  const listed = new Set(
    journals.map(({ kind, actorId }) => `${kind}:${actorId}`),
  )
  const books = await tx.journalBook.findMany({
    where: { campaignId, journalId: { not: null } },
    select: { id: true, kind: true, actorId: true },
  })
  for (const book of books) {
    if (!named[book.kind].has(book.actorId)) continue
    if (listed.has(`${book.kind}:${book.actorId}`)) continue
    await tx.journalNote.deleteMany({ where: { bookId: book.id } })
    await tx.journalBook.update({
      where: { id: book.id },
      data: {
        journalId: null,
        journalName: null,
        version: { increment: 1 },
      },
    })
  }
}

/** A journal's note's Markdown as the mirror keeps it: Foundry's HTML is only drawn, never kept. */
function bodyOf(page: JournalPage): string {
  return page.format === 2 ? (page.markdown ?? '') : ''
}

/** A journal's note as the mirror keeps it, but for how it's drawn. */
function fieldsOf(
  page: JournalPage,
  place: number,
): Omit<JournalNote, 'bookId' | 'html'> {
  return {
    noteId: page.id,
    role: page.role,
    chapterId: page.role === 'entry' ? page.chapter : null,
    title: page.title,
    format: page.format,
    body: bodyOf(page),
    cut: page.cut === true,
    secret: page.secret === true,
    authorActorId: page.author?.actorId ?? null,
    authorGm: page.author?.gm ?? false,
    authorName: page.author?.name ?? null,
    createdAt: new Date(page.createdAt),
    modifiedAt: new Date(page.modifiedAt),
    modifiedBy: page.modifiedBy,
    modifiedIn: page.modifiedIn,
    revision: page.rev,
    place,
  }
}

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

/** A journal's note as its book draws it: a personal book keeps its secrets, a party's never. */
function drawn(page: JournalPage, origin: string, kind: NoteBookKind): string {
  return noteHtml(
    page.format === 2
      ? { format: 2, body: page.markdown ?? '' }
      : { format: 1, body: page.html ?? '' },
    origin,
    kind === 'personal',
  )
}

/**
 * Whether a note held is drawn again from what Foundry now says of it: where what it says may have
 * changed, by its revision, its form or its text (a chapter's own text isn't in its revision); and
 * each time for Foundry's HTML, which isn't kept. A new name alone keeps its drawing.
 */
function redrawn(
  held: Pick<JournalNote, 'revision' | 'format' | 'body' | 'secret'>,
  page: JournalPage,
): boolean {
  return (
    held.revision !== page.rev ||
    held.format !== page.format ||
    held.body !== bodyOf(page) ||
    held.secret !== (page.secret === true) ||
    page.format === 1
  )
}

/** A book's notes drawn ahead of the transaction that keeps them, by note, for one origin. */
export type JournalDrawings = { origin: string; html: Map<string, string> }

/**
 * Draw a `journal.updated`'s notes ahead (§8.9), before the transaction that keeps them: a large
 * book's Markdown takes seconds to draw, longer than a transaction may stay open. Only those the
 * mirror, as it was just now, would draw again are drawn; the keeping draws any other itself, as
 * where the mirror changed meanwhile.
 * @returns Undefined where nothing is to be drawn.
 */
export async function drawJournal(
  campaignId: string,
  event: JournalUpdated,
): Promise<JournalDrawings | undefined> {
  const pages = event.journal?.notes ?? []
  if (event.withheld || pages.length === 0) return
  const [campaign, book] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { origin: true },
    }),
    prisma.journalBook.findUnique({
      where: {
        campaignBook: { campaignId, kind: event.kind, actorId: event.actorId },
      },
      select: {
        notes: {
          select: {
            noteId: true,
            revision: true,
            format: true,
            body: true,
            secret: true,
          },
        },
      },
    }),
  ])
  if (!campaign) return
  const held = new Map(book?.notes.map(note => [note.noteId, note]))
  const html = new Map<string, string>()
  for (const page of pages) {
    const before = held.get(page.id)
    if (!before || redrawn(before, page)) {
      html.set(page.id, drawn(page, campaign.origin, event.kind))
    }
  }
  return { origin: campaign.origin, html }
}

/** Whether anything kept of a note differs from what Foundry now says of it. */
function differs(
  held: JournalNote,
  next: Omit<JournalNote, 'bookId' | 'html'>,
): boolean {
  return (Object.keys(next) as (keyof typeof next)[]).some(key => {
    const before = held[key]
    const after = next[key]
    return before instanceof Date && after instanceof Date
      ? before.getTime() !== after.getTime()
      : before !== after
  })
}

/**
 * A book as Foundry holds it now (§4.6), from module 0.34.0's `journal.updated`: held back, which
 * keeps the notes as they were; no journal, which empties the mirror; or a journal, whose notes the
 * mirror becomes, each one changed drawn again. The book of an actor the campaign doesn't have is
 * ignored. Changes waiting here are never touched: the module decides each as it makes it.
 * @param drawings - Its notes drawn ahead, outside the transaction (`drawJournal`).
 */
export async function applyJournalUpdated(
  tx: Tx,
  campaignId: string,
  event: JournalUpdated,
  drawings?: JournalDrawings,
): Promise<void> {
  const campaign = await tx.campaign.findUnique({
    where: { id: campaignId },
    select: { origin: true, characters: true, groups: true },
  })
  if (!campaign) return
  const roster =
    event.kind === 'personal' ? campaign.characters : campaign.groups
  const listed =
    Array.isArray(roster) &&
    (roster as ({ id?: unknown } | null)[]).some(
      entry => entry?.id === event.actorId,
    )
  if (!listed) return

  const book = await tx.journalBook.upsert({
    where: {
      campaignBook: { campaignId, kind: event.kind, actorId: event.actorId },
    },
    create: { campaignId, kind: event.kind, actorId: event.actorId },
    update: {},
    select: {
      id: true,
      journalId: true,
      journalName: true,
      withheld: true,
      changedAt: true,
      notes: true,
    },
  })
  const now = new Date()
  let changed = false

  if (event.withheld) {
    changed = JSON.stringify(book.withheld) !== JSON.stringify(event.withheld)
    await tx.journalBook.update({
      where: { id: book.id },
      data: {
        withheld: event.withheld as Prisma.InputJsonObject,
        syncedAt: now,
        ...(changed && { version: { increment: 1 } }),
      },
    })
    return
  }

  const { journal } = event
  const pages = journal?.notes ?? []
  const ahead = drawings?.origin === campaign.origin ? drawings.html : undefined
  const draw = (page: JournalPage) =>
    ahead?.get(page.id) ?? drawn(page, campaign.origin, event.kind)
  const held = new Map(book.notes.map(note => [note.noteId, note]))
  const places = placesOf(pages)
  const sent = new Set(pages.map(({ id }) => id))
  const gone = book.notes.filter(({ noteId }) => !sent.has(noteId))
  if (gone.length > 0) {
    changed = true
    await tx.journalNote.deleteMany({
      where: {
        bookId: book.id,
        noteId: { in: gone.map(({ noteId }) => noteId) },
      },
    })
  }
  // New notes are made in one go, so that a book's first post costs one query, not one a note.
  const made: Prisma.JournalNoteCreateManyInput[] = []
  for (const page of pages) {
    const before = held.get(page.id)
    const fields = fieldsOf(page, places.get(page.id) ?? 0)
    if (!before) {
      made.push({ bookId: book.id, ...fields, html: draw(page) })
      continue
    }
    const html = redrawn(before, page) ? draw(page) : before.html
    if (!differs(before, fields) && html === before.html) continue
    changed = true
    await tx.journalNote.update({
      where: noteKey(book.id, page.id),
      data: { ...fields, html },
    })
  }
  if (made.length > 0) {
    changed = true
    await tx.journalNote.createMany({ data: made })
  }
  const journalId = journal?.id ?? null
  const journalName = journal?.name ?? null
  changed ||=
    book.journalId !== journalId ||
    book.journalName !== journalName ||
    book.withheld !== null
  // Who last deleted or reordered its pages in Foundry, from module 0.35.0, where it's later than
  // the book's last such change: the latest by time wins, so a late post never moves it back.
  const told = journal?.changed
  const later =
    !!told && (!book.changedAt || told.at > book.changedAt.getTime())
  changed ||= later
  await tx.journalBook.update({
    where: { id: book.id },
    data: {
      journalId,
      journalName,
      withheld: Prisma.DbNull,
      syncedAt: now,
      ...(later && {
        changedAt: new Date(told.at),
        changedBy: told.by,
        changedIn: 'foundry',
      }),
      ...(changed && { version: { increment: 1 } }),
    },
  })
}

/** A change's command id: the change's own, then which change of it this is. */
function commandId(write: { id: string; seq: number }): string {
  return `${write.id}.${write.seq}`
}

/** A change or an order the claim may hand over, oldest first across both. */
type Due = {
  table: 'write' | 'order'
  id: string
  seq: number
  queuedAt: Date
  /** Characters of title and text: an order's are none. */
  size: number
}

/** Which table goes first of a change and an order queued at the same time: the change. */
const TABLE_FIRST = { write: 0, order: 1 } as const

/** Oldest first, a note's change before an order queued at the same time, then by id. */
function byQueue(
  a: { table: 'write' | 'order'; id: string; queuedAt: Date },
  b: { table: 'write' | 'order'; id: string; queuedAt: Date },
): number {
  return (
    a.queuedAt.getTime() - b.queuedAt.getTime() ||
    TABLE_FIRST[a.table] - TABLE_FIRST[b.table] ||
    a.id.localeCompare(b.id)
  )
}

/**
 * Hand the module the changes waiting for its game (§4.3, §8.9), oldest first: those waiting, and
 * those handed over but unanswered past the time a fetched roll is, which are handed over again
 * under the same command id. Only to the session whose hello the app holds, and only while it takes
 * notes; the Gamemaster's only where they're the campaign's owner. At most a few at once, and so
 * many characters of titles and text, but always one. Made changes past their hour go first. From
 * module 0.35.0, where its hello says it takes them, the orders of groups' notes go with the
 * changes, oldest first across both (round 0.35.0 §7.10), so that a note an order places, made
 * before the order last changed, reaches Foundry first.
 * @param session - The module session that fetched them.
 */
export async function claimNoteWrites(
  campaignId: string,
  session: string,
): Promise<NoteCommand[]> {
  const now = Date.now()
  const stale = {
    campaignId,
    status: 'made' as const,
    updatedAt: { lt: new Date(now - MADE_KEPT_FOR) },
  }
  await prisma.journalWrite.deleteMany({ where: stale })
  await prisma.journalOrder.deleteMany({ where: stale })
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      helloSession: true,
      notesEnabled: true,
      noteFeatures: true,
      ownerId: true,
    },
  })
  if (
    !campaign ||
    campaign.helloSession !== session ||
    !campaign.notesEnabled
  ) {
    return []
  }
  const due: Prisma.JournalWriteWhereInput & Prisma.JournalOrderWhereInput = {
    OR: [
      { status: 'pending' },
      {
        status: 'claimed',
        claimedAt: { lt: new Date(now - ROLL_ANSWER_WITHIN) },
      },
    ],
  }
  const whose: Prisma.JournalWriteWhereInput & Prisma.JournalOrderWhereInput = {
    OR: [
      { seat: 'player' },
      ...(campaign.ownerId
        ? [{ seat: 'gm' as const, requestedById: campaign.ownerId }]
        : []),
    ],
  }
  const [found, queued] = await Promise.all([
    prisma.journalWrite.findMany({
      where: { campaignId, AND: [due, whose] },
      orderBy: { queuedAt: 'asc' },
      take: NOTE_CLAIM_LIMIT,
      select: { id: true, seq: true, title: true, body: true, queuedAt: true },
    }),
    // A module before 0.35.0 refuses an order it can't read: they wait for one that takes them.
    campaign.noteFeatures.includes('orders')
      ? prisma.journalOrder.findMany({
          where: { campaignId, AND: [due, whose] },
          orderBy: { queuedAt: 'asc' },
          take: NOTE_CLAIM_LIMIT,
          select: { id: true, seq: true, queuedAt: true },
        })
      : [],
  ])
  const waiting: Due[] = [
    ...found.map(({ id, seq, queuedAt, title, body }) => ({
      table: 'write' as const,
      id,
      seq,
      queuedAt,
      size: title.length + body.length,
    })),
    ...queued.map(({ id, seq, queuedAt }) => ({
      table: 'order' as const,
      id,
      seq,
      queuedAt,
      size: 0,
    })),
  ]
    .toSorted(byQueue)
    .slice(0, NOTE_CLAIM_LIMIT)
  const taken: Due[] = []
  let chars = 0
  for (const next of waiting) {
    if (taken.length > 0 && chars + next.size > NOTE_CLAIM_CHARS) break
    taken.push(next)
    chars += next.size
  }
  if (taken.length === 0) return []
  const claimToken = randomUUID()
  const claim = {
    status: 'claimed' as const,
    claimToken,
    claimSession: session,
    claimedAt: new Date(now),
  }
  const of = (table: Due['table']) =>
    taken
      .filter(next => next.table === table)
      .map(({ id, seq }) => ({ id, seq }))
  const writes = of('write')
  const orders = of('order')
  if (writes.length > 0) {
    await prisma.journalWrite.updateMany({
      where: { OR: writes, AND: [due] },
      data: claim,
    })
  }
  if (orders.length > 0) {
    await prisma.journalOrder.updateMany({
      where: { OR: orders, AND: [due] },
      data: claim,
    })
  }
  const book = { book: { select: { kind: true, actorId: true } } }
  const [claimedWrites, claimedOrders] = await Promise.all([
    writes.length > 0
      ? prisma.journalWrite.findMany({
          where: { claimToken },
          orderBy: { queuedAt: 'asc' },
          include: book,
        })
      : [],
    orders.length > 0
      ? prisma.journalOrder.findMany({
          where: { claimToken },
          orderBy: { queuedAt: 'asc' },
          include: book,
        })
      : [],
  ])
  return [
    ...claimedWrites.map(write => ({
      table: 'write' as const,
      id: write.id,
      queuedAt: write.queuedAt,
      command: pageCommand(write),
    })),
    ...claimedOrders.map(order => ({
      table: 'order' as const,
      id: order.id,
      queuedAt: order.queuedAt,
      command: orderCommand(order),
    })),
  ]
    .toSorted(byQueue)
    .map(({ command }) => command)
}

/** A change to one page as the module's note command (round 0.34.0 §3.4). */
function pageCommand(
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
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
  }
}

/**
 * An order of a group's notes as the module's note command (round 0.35.0 §3.4): as whoever last
 * made it, exactly its fields, and nothing a roll names.
 */
function orderCommand(
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
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
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
function outcome(result: CommandResult): {
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

/** A note's key in its book, as Prisma names the pair. */
function noteKey(bookId: string, noteId: string) {
  // eslint-disable-next-line camelcase -- Prisma's name for the table's two-part key
  return { bookId_noteId: { bookId, noteId } }
}

/**
 * What became of a note command (§8.9): only for the change handed over under that id, still on its
 * way, so a late or doubled result for an earlier hand-over changes nothing. Made, the mirror
 * follows, where the module's post of the book was lost: deleted for a delete, or set from the
 * change where the page's revision is known; the change is kept an hour as made. Refused because
 * the note was changed or deleted in Foundry, it waits for its author to choose; refused otherwise,
 * it's failed; and a timeout leaves it to be handed over again.
 */
export async function recordNoteResult(
  campaignId: string,
  result: CommandResult,
): Promise<void> {
  const at = result.id.lastIndexOf('.')
  const seq = Number(result.id.slice(at + 1))
  if (
    at < 1 ||
    !/^\d+$/.test(result.id.slice(at + 1)) ||
    !Number.isSafeInteger(seq)
  ) {
    return
  }
  const id = result.id.slice(0, at)
  if (result.status === 'failed' && result.reason === 'timeout') return
  const { status, reason } = outcome(result)
  await prisma.$transaction(async tx => {
    const { count } = await tx.journalWrite.updateMany({
      where: { id, seq, campaignId, status: 'claimed' },
      // A refusal says the page's revision now, kept for where the mirror can't say it: a book
      // Foundry holds back as too large sends no notes, so Use yours goes again from this.
      data:
        status === 'made'
          ? { status, reason }
          : { status, reason, foundryRev: result.note?.rev ?? null },
    })
    // No change of that id and number on its way: from module 0.35.0, an order's, perhaps.
    if (count === 0) {
      await recordOrderResult(tx, campaignId, id, seq, result)
      return
    }
    const write = await tx.journalWrite.findUnique({ where: { id } })
    if (!write) return
    if (status === 'made') {
      if (write.op === 'delete') {
        await tx.journalNote.deleteMany({
          where: { bookId: write.bookId, noteId: write.noteId },
        })
      } else if (typeof result.note?.rev === 'string') {
        const rev = result.note.rev
        const held = await tx.journalNote.findUnique({
          where: noteKey(write.bookId, write.noteId),
          select: { revision: true, chapterId: true },
        })
        if (held?.revision !== rev) {
          // A note new to its group lands last in it, as the module makes it (round 0.35.0
          // §2.3); one that stays keeps its place. The next book sets each right.
          const comes = !held || held.chapterId !== write.chapterId
          const place = comes ? await lastPlace(tx, write) : undefined
          const mirror = {
            role: write.role,
            chapterId: write.chapterId,
            title: write.title,
            format: 2,
            body: write.body,
            html: write.html,
            cut: false,
            secret: false,
            authorActorId: write.authorActorId,
            authorGm: write.authorGm,
            authorName: write.authorName || null,
            createdAt: write.noteCreatedAt,
            modifiedAt: write.modifiedAt,
            modifiedBy: write.modifiedBy,
            modifiedIn: 'app',
            revision: rev,
            ...(place !== undefined && { place }),
          }
          await tx.journalNote.upsert({
            where: noteKey(write.bookId, write.noteId),
            create: { bookId: write.bookId, noteId: write.noteId, ...mirror },
            update:
              write.role === 'chapter'
                ? { ...mirror, html: undefined, body: undefined }
                : mirror,
          })
        }
      }
    }
    await tx.journalBook.update({
      where: { id: write.bookId },
      data: { version: { increment: 1 } },
    })
  })
}

/** The place after the last of a note's group in the mirror, itself left out. */
async function lastPlace(
  tx: Tx,
  write: Pick<JournalWrite, 'bookId' | 'noteId' | 'role' | 'chapterId'>,
): Promise<number> {
  const { _max: last } = await tx.journalNote.aggregate({
    where: {
      bookId: write.bookId,
      role: write.role,
      chapterId: write.role === 'entry' ? write.chapterId : null,
      noteId: { not: write.noteId },
    },
    _max: { place: true },
  })
  return (last.place ?? -1) + 1
}

/**
 * What became of an order of a group's notes (round 0.35.0 §7.10): only for the order handed over
 * under that id and number, still on its way, so a late result for an earlier hand-over changes
 * nothing. Made, it's kept an hour as made, and where the module's post of the book was lost, the
 * mirror's places follow the group's order the result says. Refused because the same notes were
 * reordered in Foundry, it waits for its seat to choose; refused because its chapter is gone, it's
 * dropped, its notes now in none; refused otherwise, it's failed.
 */
async function recordOrderResult(
  tx: Tx,
  campaignId: string,
  id: string,
  seq: number,
  result: CommandResult,
): Promise<void> {
  const order = await tx.journalOrder.findUnique({
    where: { id },
    select: { bookId: true, chapterId: true },
  })
  if (!order) return
  const where = { id, seq, campaignId, status: 'claimed' as const }
  const reason = result.reason ?? 'error'
  const { count } =
    result.status === 'failed' && reason === 'gone'
      ? await tx.journalOrder.deleteMany({ where })
      : await tx.journalOrder.updateMany({ where, data: orderOutcome(result) })
  if (count === 0) return
  if (result.status === 'done' && result.order) {
    await placeAsOrdered(tx, order, result.order.ids)
  }
  await tx.journalBook.update({
    where: { id: order.bookId },
    data: { version: { increment: 1 } },
  })
}

/** Where an order stands once the module answered it, but for a chapter gone. */
function orderOutcome(result: CommandResult): {
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

/**
 * The mirror's places of a group as an order made them, where the book's post was lost: the notes
 * it names that the mirror holds in that group, 0, 1, 2… in its order, only those that move
 * written. Where the book came first, as it does, nothing moves.
 */
async function placeAsOrdered(
  tx: Tx,
  order: { bookId: string; chapterId: string },
  ids: string[],
): Promise<void> {
  const notes = await tx.journalNote.findMany({
    where: { bookId: order.bookId, noteId: { in: ids } },
    select: { noteId: true, role: true, chapterId: true, place: true },
  })
  const held = new Map(notes.map(note => [note.noteId, note]))
  let place = 0
  for (const id of ids) {
    const note = held.get(id)
    if (note?.role !== 'entry' || (note.chapterId ?? '') !== order.chapterId) {
      continue
    }
    if (note.place !== place) {
      await tx.journalNote.update({
        where: noteKey(order.bookId, id),
        data: { place },
      })
    }
    place += 1
  }
}
