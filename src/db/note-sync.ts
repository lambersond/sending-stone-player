/* eslint-disable unicorn/no-null -- Prisma and the protocol use null for an absent value */
import { randomUUID } from 'node:crypto'
import { Prisma, type JournalNote } from '@prisma/client'
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

type Tx = Prisma.TransactionClient

/** How long a made change is kept, so the seat's limit has rows to count while Foundry is live. */
export const MADE_KEPT_FOR = 3_600_000

/** A note command, as the module fetches it (round 0.34.0 §3.4): a change to one page. */
export type NoteCommand = {
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

/** A journal's note as the mirror keeps it, but for how it's drawn. */
function fieldsOf(page: JournalPage): Omit<JournalNote, 'bookId' | 'html'> {
  return {
    noteId: page.id,
    role: page.role,
    chapterId: page.role === 'entry' ? page.chapter : null,
    title: page.title,
    format: page.format,
    // Foundry's HTML is only drawn, never changed here, so only Markdown is kept.
    body: page.format === 2 ? (page.markdown ?? '') : '',
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
  }
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
 */
export async function applyJournalUpdated(
  tx: Tx,
  campaignId: string,
  event: JournalUpdated,
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
  const held = new Map(book.notes.map(note => [note.noteId, note]))
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
  for (const page of pages) {
    const before = held.get(page.id)
    const fields = fieldsOf(page)
    if (!before) {
      changed = true
      await tx.journalNote.create({
        data: {
          bookId: book.id,
          ...fields,
          html: drawn(page, campaign.origin, event.kind),
        },
      })
      continue
    }
    // Drawn again only where what it says may have changed: its revision, its form or its text,
    // as a chapter's own text isn't in its revision; and Foundry's HTML, which isn't kept, each
    // time, kept only where it draws otherwise now. A new name alone keeps its drawing.
    const html =
      before.revision !== page.rev ||
      before.format !== fields.format ||
      before.body !== fields.body ||
      before.secret !== fields.secret ||
      page.format === 1
        ? drawn(page, campaign.origin, event.kind)
        : before.html
    if (!differs(before, fields) && html === before.html) continue
    changed = true
    await tx.journalNote.update({
      where: noteKey(book.id, page.id),
      data: { ...fields, html },
    })
  }
  const journalId = journal?.id ?? null
  const journalName = journal?.name ?? null
  changed ||=
    book.journalId !== journalId ||
    book.journalName !== journalName ||
    book.withheld !== null
  await tx.journalBook.update({
    where: { id: book.id },
    data: {
      journalId,
      journalName,
      withheld: Prisma.DbNull,
      syncedAt: now,
      ...(changed && { version: { increment: 1 } }),
    },
  })
}

/** A change's command id: the change's own, then which change of it this is. */
function commandId(write: { id: string; seq: number }): string {
  return `${write.id}.${write.seq}`
}

/**
 * Hand the module the changes waiting for its game (§4.3, §8.9), oldest first: those waiting, and
 * those handed over but unanswered past the time a fetched roll is, which are handed over again
 * under the same command id. Only to the session whose hello the app holds, and only while it takes
 * notes; the Gamemaster's only where they're the campaign's owner. At most a few at once, and so
 * many characters of titles and text, but always one. Made changes past their hour go first.
 * @param session - The module session that fetched them.
 */
export async function claimNoteWrites(
  campaignId: string,
  session: string,
): Promise<NoteCommand[]> {
  const now = Date.now()
  await prisma.journalWrite.deleteMany({
    where: {
      campaignId,
      status: 'made',
      updatedAt: { lt: new Date(now - MADE_KEPT_FOR) },
    },
  })
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { helloSession: true, notesEnabled: true, ownerId: true },
  })
  if (
    !campaign ||
    campaign.helloSession !== session ||
    !campaign.notesEnabled
  ) {
    return []
  }
  const due: Prisma.JournalWriteWhereInput = {
    OR: [
      { status: 'pending' },
      {
        status: 'claimed',
        claimedAt: { lt: new Date(now - ROLL_ANSWER_WITHIN) },
      },
    ],
  }
  const whose: Prisma.JournalWriteWhereInput = {
    OR: [
      { seat: 'player' },
      ...(campaign.ownerId
        ? [{ seat: 'gm' as const, requestedById: campaign.ownerId }]
        : []),
    ],
  }
  const found = await prisma.journalWrite.findMany({
    where: { campaignId, AND: [due, whose] },
    orderBy: { queuedAt: 'asc' },
    take: NOTE_CLAIM_LIMIT,
    select: { id: true, seq: true, title: true, body: true },
  })
  const taken: typeof found = []
  let chars = 0
  for (const write of found) {
    const size = write.title.length + write.body.length
    if (taken.length > 0 && chars + size > NOTE_CLAIM_CHARS) break
    taken.push(write)
    chars += size
  }
  if (taken.length === 0) return []
  const claimToken = randomUUID()
  await prisma.journalWrite.updateMany({
    where: {
      OR: taken.map(({ id, seq }) => ({ id, seq })),
      AND: [due],
    },
    data: {
      status: 'claimed',
      claimToken,
      claimSession: session,
      claimedAt: new Date(now),
    },
  })
  const claimed = await prisma.journalWrite.findMany({
    where: { claimToken },
    orderBy: { queuedAt: 'asc' },
    include: { book: { select: { kind: true, actorId: true } } },
  })
  return claimed.map(write => {
    const entry = write.role === 'entry'
    return {
      id: commandId(write),
      actorId: write.book.actorId,
      kind: 'note',
      ...(write.seat === 'gm' && { by: 'gm' as const }),
      note: {
        book: write.book.kind,
        op: write.op,
        id: write.noteId,
        role: write.role,
        base: write.op === 'create' ? null : write.base,
        writer: write.writerActorId,
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
  })
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
      data: { status, reason },
    })
    if (count === 0) return
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
          select: { revision: true },
        })
        if (held?.revision !== rev) {
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
