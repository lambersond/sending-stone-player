/* eslint-disable unicorn/no-null -- Prisma and the view use null for an absent value */
import { randomUUID } from 'node:crypto'
import { Prisma, type JournalNote, type JournalWrite } from '@prisma/client'
import prisma from '@/clients/prisma'
import {
  MOST_BOOK_TEXT,
  MOST_CHAPTERS,
  MOST_ENTRIES,
  MOST_NOTE_BODY,
  MOST_NOTE_TITLE,
  NOTES_PER_MINUTE,
} from '@/constants/notes'
import { BRIDGE_POLLED_WITHIN } from '@/constants/sending-stone'
import { noteHtml } from '@/lib/note-html'
import { convertNoteMarkdown, hasBigHeading } from '@/lib/note-markdown'
import { checkChange } from '@/schemas/notes'
import { bigHeadings } from '@/utils/note-headings'
import { newNoteId } from '@/utils/note-id'
import type {
  NoteBookKind,
  NoteChapterView,
  NoteEntryView,
  NoteReason,
  NoteRefusal,
  NoteRole,
  NotesView,
  NoteState,
} from '@/types/notes'
import type { ConnectedCharacter } from '@/types/sending-stone'

// A seat's journal notes (round 0.34.0 §8.5-§8.8), from module 0.34.0: a character's own book, or a
// party's, kept here first and sent to Foundry when the Gamemaster's game next takes them. Every
// change is stored at once, whatever Foundry's state, and only the app's own checks refuse one: who
// may change it, what it says and how much there is. Each book holds the module's latest word of
// its journal (`JournalNote`) and, beside it, at most one change waiting per note (`JournalWrite`),
// whose every change is compare-and-set, so two saves at once never both land.

/**
 * Who is at a book of notes, as its route resolved them from the session and the address alone:
 * the character's player, as their character, or the campaign's Gamemaster, as no character.
 */
export type NotesSeat = {
  role: 'player' | 'gm'
  userId: string
  /** The player's character's actor, which they write as; null for the Gamemaster. */
  actorId: string | null
  /** The character's name, as their seat knows it; the Gamemaster's is "Gamemaster". */
  name: string
}

/** The book a seat is at: a character's or a party's, in one campaign. */
export type NotesBook = {
  campaignId: string
  kind: NoteBookKind
  /** The character's actor, or the party's Group actor. */
  actorId: string
  /** A party no campaign character may see in Foundry, which only its Gamemaster reaches. */
  private: boolean
}

/** What a change answered: done, with the note's id and stamp now, or why not, with a status. */
export type NoteAnswer =
  | { ok: true; id?: string; stamp: string }
  | {
      ok: false
      status: 400 | 403 | 404 | 409 | 422 | 429
      reason: NoteRefusal
      field?: string
      lines?: number[]
    }

/** What a seat may do in a book, and with a note in it (§8.5). */
export type NoteRights = {
  canAdd: boolean
  canRename: boolean
  canEdit: boolean
  canDelete: boolean
}

/** The name the Gamemaster writes as, in both books (Q5). */
const GAMEMASTER = 'Gamemaster'

/** A change waiting or refused: the module hasn't made it, or didn't. */
type Waiting = JournalWrite & {
  status: 'pending' | 'claimed' | 'conflict' | 'failed'
}

/** A change to a note that still means something: one not yet made. */
function waiting(write: JournalWrite | undefined): write is Waiting {
  return !!write && write.status !== 'made'
}

/** What a book holds, as read for a seat, with what decides what the seat may do in it. */
type Held = {
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
  /** The book's actor is still in the campaign: else nothing in it can be changed. */
  connected: boolean
  live: boolean
  enabled: boolean
  origin: string
  /** Each of the campaign's characters' names, by actor, to write as. */
  names: Map<string, string>
}

/** Read a book for a seat: its notes and its changes waiting, and the campaign around it. */
async function readBook(book: NotesBook): Promise<Held | undefined> {
  const [campaign, row] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: book.campaignId },
      select: {
        origin: true,
        characters: true,
        notesEnabled: true,
        bridgePolledAt: true,
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
        notes: true,
        writes: true,
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
    connected:
      book.kind === 'party' || roster.some(({ id }) => id === book.actorId),
    live:
      campaign.notesEnabled &&
      !!polled &&
      Date.now() - polled < BRIDGE_POLLED_WITHIN,
    enabled: campaign.notesEnabled,
    origin: campaign.origin,
    names: new Map(roster.map(({ id, name }) => [id, name])),
  }
}

/**
 * What a seat may do in a book (§8.5): add notes and chapters while the book takes them, its actor
 * still the campaign's and, for a party, one its characters may see; rename any chapter; and
 * change or delete an entry in a character's own book, or in a party's the Gamemaster any, a
 * player only those their character wrote, never one written in Foundry. No chapter is deleted.
 */
export function noteRights(
  book: { kind: NoteBookKind; private: boolean; connected: boolean },
  seat: NotesSeat,
  note?: { role: NoteRole; authorActorId: string | null },
): NoteRights {
  const entry = note?.role === 'entry'
  const mayChange =
    entry &&
    (book.kind === 'personal' ||
      seat.role === 'gm' ||
      (!!note.authorActorId && note.authorActorId === seat.actorId))
  return {
    canAdd: book.connected && !book.private,
    canRename: true,
    canEdit: mayChange,
    canDelete: mayChange,
  }
}

/**
 * Why an entry from Foundry may be changed only there (§8.5): written in its own editor; sent as
 * HTML for a party's secret; or more than the app can save back, cut short or too long.
 */
function foundryOnly(note: JournalNote): NoteEntryView['foundryOnly'] {
  if (note.role !== 'entry') return
  if (note.format !== 2) return note.secret ? 'secret' : 'html'
  if (
    note.cut ||
    note.body.length > MOST_NOTE_BODY ||
    note.title.length > MOST_NOTE_TITLE
  ) {
    return 'long'
  }
}

/** What a note says, from Foundry's journal or from the change waiting for it. */
type Content = {
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

function fromMirror(note: JournalNote): Content {
  return {
    title: note.title,
    body: note.body,
    html: note.html,
    chapterId: note.chapterId,
    authorActorId: note.authorActorId,
    authorGm: note.authorGm,
    authorName: note.authorName,
    createdAt: note.createdAt,
    modifiedAt: note.modifiedAt,
    modifiedBy: note.modifiedBy,
    modifiedIn: note.modifiedIn === 'app' ? 'app' : 'foundry',
  }
}

function fromWrite(write: JournalWrite, note?: JournalNote): Content {
  return {
    title: write.title,
    body: write.body,
    // A chapter's own text is Foundry's, never changed here.
    html: write.role === 'chapter' ? (note?.html ?? '') : write.html,
    chapterId: write.chapterId,
    authorActorId: write.authorActorId,
    authorGm: write.authorGm,
    authorName: write.authorName,
    createdAt: note?.createdAt ?? write.noteCreatedAt,
    modifiedAt: write.modifiedAt,
    modifiedBy: write.modifiedBy,
    modifiedIn: 'app',
  }
}

/** What the page last saw of a note, sent back with a change: its change waiting, or revision. */
function stampOf(note?: JournalNote, write?: JournalWrite): string {
  return waiting(write)
    ? `w:${write.id}.${write.seq}`
    : `n:${note?.revision ?? ''}`
}

/** A note as one seat sees it, or none where it's hidden from them (§8.8). */
type Seen = {
  role: NoteRole
  content: Content
  state: NoteState
  reason?: NoteReason
  /** It shows Foundry's version, and not the change waiting. */
  mirrored: boolean
  mine?: Content & { deleting?: true; by?: string }
  stamp: string
}

/**
 * A note as a seat sees it (§8.8): Foundry's version, or the change made here while the module
 * hasn't made it yet, which every seat sees; and where the module didn't take a change, Foundry's
 * version with the seat's own beside it, only to a seat that may change it.
 * @param mayChange - The seat may change the note: rename it, or edit or delete it.
 */
function overlay(
  note: JournalNote | undefined,
  write: JournalWrite | undefined,
  mayChange: boolean,
  live: boolean,
  seat: NotesSeat,
): Seen | undefined {
  const stamp = stampOf(note, write)
  if (!waiting(write)) {
    return note
      ? {
          role: note.role,
          content: fromMirror(note),
          state: 'synced',
          mirrored: true,
          stamp,
        }
      : undefined
  }
  const role = write.role
  const mine = {
    ...fromWrite(write, note),
    ...(write.op === 'delete' && { deleting: true as const }),
    ...(write.requestedById !== seat.userId && { by: write.modifiedBy }),
  }
  const synced = (): Seen | undefined =>
    note
      ? {
          role,
          content: fromMirror(note),
          state: 'synced',
          mirrored: true,
          stamp,
        }
      : undefined
  const reason = noteReason(write.reason)
  switch (write.status) {
    case 'pending':
    case 'claimed': {
      if (write.op !== 'delete') {
        return {
          role,
          content: fromWrite(write, note),
          state: live ? 'saving' : 'waiting',
          mirrored: false,
          stamp,
        }
      }
      if (!mayChange || !note) return undefined
      return {
        role,
        content: fromMirror(note),
        state: 'deleting',
        mirrored: true,
        stamp,
      }
    }
    case 'conflict': {
      if (!mayChange) return reason === 'gone' ? undefined : synced()
      if (reason === 'gone' || !note) {
        return {
          role,
          content: fromWrite(write, note),
          state: 'gone',
          reason: 'gone',
          mirrored: false,
          mine,
          stamp,
        }
      }
      return {
        role,
        content: fromMirror(note),
        state: 'conflict',
        reason: 'changed',
        mirrored: true,
        mine,
        stamp,
      }
    }
    case 'failed': {
      if (!mayChange) return write.op === 'create' ? undefined : synced()
      const shown = write.op === 'create' || !note
      return {
        role,
        content: shown ? fromWrite(write, note) : fromMirror(note),
        state: 'failed',
        reason,
        mirrored: !shown,
        mine,
        stamp,
      }
    }
  }
}

/** Why the module refused a change, as the view names it; any other as an error. */
function noteReason(reason: string | null): NoteReason {
  return (REASONS as readonly string[]).includes(reason ?? '')
    ? (reason as NoteReason)
    : 'error'
}

const REASONS = [
  'changed',
  'gone',
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
] as const satisfies readonly NoteReason[]

/** The rights a seat has with a note, by what it is and who wrote it. */
function rightsFor(
  held: Held,
  seat: NotesSeat,
  note?: JournalNote,
  write?: JournalWrite,
): NoteRights & { role: NoteRole; mayChange: boolean } {
  const role = note?.role ?? write?.role ?? 'entry'
  const author = note ?? write
  const rights = noteRights(
    {
      kind: held.book.kind,
      private: held.book.private,
      connected: held.connected,
    },
    seat,
    { role, authorActorId: author?.authorActorId ?? null },
  )
  return {
    ...rights,
    role,
    mayChange: role === 'chapter' ? rights.canRename : rights.canEdit,
  }
}

/** Oldest first, by when each was created, then by id. */
function byAge<T extends { id: string; createdAt: string }>(a: T, b: T) {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

/** The ids of the notes a book holds, Foundry's and those made here alike. */
function noteIds(held: Held): string[] {
  return [...new Set([...held.notes.keys(), ...held.writes.keys()])]
}

/** Why Foundry sends none of the book now, as the view says it. */
function withheldOf(held: Held): NotesView['withheld'] {
  // A party no player may see is said so wherever its book is read, before the module says so.
  if (held.book.kind === 'party' && held.book.private) {
    return { reason: 'private' }
  }
  const withheld = held.row?.withheld as
    { reason?: unknown; bytes?: unknown; limit?: unknown } | null | undefined
  if (withheld?.reason === 'private') return { reason: 'private' }
  if (withheld?.reason === 'tooLarge') {
    return {
      reason: 'tooLarge',
      ...(typeof withheld.bytes === 'number' && { bytes: withheld.bytes }),
      ...(typeof withheld.limit === 'number' && { limit: withheld.limit }),
    }
  }
}

/**
 * A book as a seat sees it (§8.8): its chapters and its entries, oldest first, each as Foundry
 * holds it or as changed here and waiting, with where it stands, what the seat may do with it, and
 * its Markdown only for a seat that may change it. A book never written in is empty, at version 0;
 * reading it never makes it.
 * @returns Undefined where the campaign isn't there.
 */
export async function getNotesView(
  seat: NotesSeat,
  book: NotesBook,
): Promise<NotesView | undefined> {
  const held = await readBook(book)
  if (!held) return undefined
  const chapters: NoteChapterView[] = []
  const entries: NoteEntryView[] = []
  for (const id of noteIds(held)) {
    const note = held.notes.get(id)
    const write = held.writes.get(id)
    const rights = rightsFor(held, seat, note, write)
    const seen = overlay(note, write, rights.mayChange, held.live, seat)
    if (!seen) continue
    const { content } = seen
    const common = {
      id,
      title: content.title,
      createdAt: content.createdAt.toISOString(),
      modifiedAt: content.modifiedAt.toISOString(),
      modifiedBy: content.modifiedBy,
      modifiedIn: content.modifiedIn,
      state: seen.state,
      ...(seen.reason && { reason: seen.reason }),
      stamp: seen.stamp,
    }
    if (seen.role === 'chapter') {
      chapters.push({
        ...common,
        html: note?.html ?? '',
        canRename: rights.canRename,
        ...(seen.mine && {
          mine: {
            title: seen.mine.title,
            ...(seen.mine.by !== undefined && { by: seen.mine.by }),
          },
        }),
      })
      continue
    }
    const only = seen.mirrored && note ? foundryOnly(note) : undefined
    const hasAuthor = !!content.authorActorId || content.authorGm
    entries.push({
      ...common,
      chapterId: content.chapterId,
      html: content.html,
      ...(rights.mayChange && !only && { body: content.body }),
      author: hasAuthor ? { name: content.authorName ?? '' } : null,
      canEdit: rights.canEdit,
      canDelete: rights.canDelete,
      ...(only && { foundryOnly: only }),
      ...(seen.mine && {
        mine: {
          title: seen.mine.title,
          html: seen.mine.html,
          body: seen.mine.body,
          chapterId: seen.mine.chapterId,
          ...(seen.mine.deleting && { deleting: true as const }),
          ...(seen.mine.by !== undefined && { by: seen.mine.by }),
        },
      }),
    })
  }
  const shown = new Set(chapters.map(({ id }) => id))
  const withheld = withheldOf(held)
  return {
    version: held.row?.version ?? 0,
    kind: book.kind,
    journal: held.row?.journalName ?? null,
    live: held.live,
    enabled: held.enabled,
    canAdd: noteRights(
      { kind: book.kind, private: book.private, connected: held.connected },
      seat,
    ).canAdd,
    connected: held.connected,
    ...(withheld && { withheld }),
    chapters: chapters.toSorted(byAge),
    entries: entries
      .map(entry =>
        entry.chapterId && !shown.has(entry.chapterId)
          ? { ...entry, chapterId: null }
          : entry,
      )
      .toSorted(byAge),
  }
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
function htmlFor(held: Held, body: string): string {
  return noteHtml(
    { format: 2, body },
    held.origin,
    held.book.kind === 'personal',
  )
}

/** The name a seat writes as: the Gamemaster's, or their character's as the campaign names it. */
function writerName(held: Held, seat: NotesSeat): string {
  if (seat.role === 'gm') return GAMEMASTER
  return (seat.actorId && held.names.get(seat.actorId)) || seat.name
}

/** Who a change is from, as each change to a note's waiting row records it. */
function changedBy(held: Held, seat: NotesSeat, now: Date) {
  return {
    seat: seat.role,
    requestedById: seat.userId,
    writerActorId: seat.role === 'gm' ? null : seat.actorId,
    modifiedAt: now,
    modifiedBy: writerName(held, seat),
  }
}

/** What a note says now: the change waiting where there is one, else Foundry's; none if neither. */
function current(note?: JournalNote, write?: JournalWrite) {
  if (waiting(write) && write.op !== 'delete') return fromWrite(write, note)
  return note ? fromMirror(note) : undefined
}

/**
 * Whether a book takes a change at all, and from this seat now (create steps 2-4): its actor still
 * the campaign's, a party its characters may see, and the seat not making too many changes.
 */
async function takes(
  held: Held,
  seat: NotesSeat,
  { limited }: { limited: boolean },
): Promise<NoteAnswer | undefined> {
  if (!held.connected) return { ok: false, status: 409, reason: 'unknown' }
  if (held.book.private) return { ok: false, status: 409, reason: 'private' }
  if (!limited) return
  // Made changes count too, kept an hour for it, and each note's folded changes once.
  const changes = await prisma.journalWrite.count({
    where: {
      requestedById: seat.userId,
      updatedAt: { gte: new Date(Date.now() - 60_000) },
    },
  })
  if (changes >= NOTES_PER_MINUTE) {
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
  held: Held,
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
  if (role === 'entry' && content.chapterId) {
    const chapter = content.chapterId
    const known =
      held.notes.get(chapter)?.role === 'chapter' ||
      [...held.writes.values()].some(
        write =>
          write.noteId === chapter &&
          write.role === 'chapter' &&
          write.op === 'create' &&
          waiting(write),
      )
    if (!known) return { ok: false, status: 422, reason: 'gone' }
  }
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

/** The book's row, made where it has none, its version bumped for what changes now. */
async function bumpBook(
  tx: Prisma.TransactionClient,
  book: NotesBook,
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
    },
    update: { version: { increment: 1 } },
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
  const seen = overlay(note, write, true, held.live, seat)
  if (seen?.mirrored && note && foundryOnly(note)) {
    return { ok: false, status: 409, reason: 'foundry-only' }
  }
  if (change.stamp !== stampOf(note, write)) {
    return { ok: false, status: 409, reason: 'changed' }
  }
  if (write?.status === 'claimed') {
    return { ok: false, status: 409, reason: 'saving' }
  }
  if (write?.status === 'conflict') {
    return { ok: false, status: 409, reason: 'conflict' }
  }
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

/** A change folded into the one waiting: a delete stays one, and a change undoes one. */
function foldedOp(
  waiting: JournalWrite['op'],
  change: 'update' | 'delete',
): JournalWrite['op'] {
  if (change === 'delete') return 'delete'
  return waiting === 'delete' ? 'update' : waiting
}

/**
 * A change stored, compare-and-set (§4.2): folded into the note's change waiting or refused, its
 * op kept but a delete's, which becomes this; a made one used again as a new change, from
 * Foundry's revision now; else a new one, from it too.
 * @returns The change's id and number now.
 */
async function saveChange(
  tx: Prisma.TransactionClient,
  held: Held,
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
        where: {
          id: write.id,
          seq: write.seq,
          status: { in: ['pending', 'failed'] },
        },
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
        data: { ...fresh, seq: { increment: 1 } },
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
  if (write?.status === 'claimed') {
    return { ok: false, status: 409, reason: 'saving' }
  }
  if (write?.status === 'conflict') {
    return { ok: false, status: 409, reason: 'conflict' }
  }
  if (write && waiting(write) && write.op === 'create') {
    return guarded(() =>
      prisma.$transaction(async tx => {
        changedOne(
          await tx.journalWrite.deleteMany({
            where: {
              id: write.id,
              seq: write.seq,
              status: { in: ['pending', 'failed'] },
            },
          }),
        )
        await bumpBook(tx, book)
        return { ok: true as const, stamp: `n:${note?.revision ?? ''}` }
      }),
    )
  }
  const refused = await takes(held, seat, { limited: false })
  if (refused) return refused
  const at = new Date()
  return guarded(() =>
    prisma.$transaction(async tx => {
      await bumpBook(tx, book)
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
  const settles =
    write?.status === 'conflict' ||
    write?.status === 'failed' ||
    (resolve === 'theirs' &&
      write?.status === 'pending' &&
      write.op === 'delete')
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
  const where = { id: write.id, seq: write.seq, status: write.status }
  if (resolve === 'theirs') {
    return guarded(() =>
      prisma.$transaction(async tx => {
        changedOne(await tx.journalWrite.deleteMany({ where }))
        await bumpBook(tx, book)
        return { ok: true as const, stamp: `n:${note?.revision ?? ''}` }
      }),
    )
  }
  const again = sentAgain(write, note)
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
      await bumpBook(tx, book)
      return { ok: true as const, stamp: `w:${write.id}.${write.seq + 1}` }
    }),
  )
}

/**
 * A change the game didn't take, sent again as the seat's (§4.5): the note made again where Foundry
 * deleted it; made from Foundry's revision now where Foundry changed it; else as it was.
 */
function sentAgain(
  write: JournalWrite,
  note: JournalNote | undefined,
): Partial<Pick<JournalWrite, 'op' | 'base'>> {
  if (write.status !== 'conflict') return {}
  if (write.reason === 'gone') return { op: 'create', base: null }
  return { base: note?.revision ?? write.base }
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
