import { createHash } from 'node:crypto'
import { MOST_NOTE_BODY, MOST_NOTE_TITLE } from '@/constants/notes'
import type {
  NoteBookKind,
  NoteChapterView,
  NoteEntryView,
  NoteGroupView,
  NoteLastChange,
  NoteReason,
  NoteRights,
  NoteRole,
  NotesSeat,
  NotesView,
} from '@/types/notes'
import type {
  HeldBook,
  NoteContent,
  NoteGroup,
  SeenNote,
  WaitingWrite,
} from '@/utils/notes/types'
import type { JournalNote, JournalOrder, JournalWrite } from '@prisma/client'

// A book of journal notes as a seat sees it (round 0.34.0 §8.5-§8.8, round 0.35.0 §7.9;
// src/db/notes.ts): each note as Foundry holds it, or as changed here and waiting, with where it
// stands and what the seat may do with it; its groups in their orders, and what each seat was
// shown of them. Server-side: a group's stamp is a node:crypto digest. Prisma's rows are read here
// for their types alone.

/** A change to a note that still means something: one not yet made. */
export function waiting(
  write: JournalWrite | undefined,
): write is WaitingWrite {
  return !!write && write.status !== 'made'
}

/**
 * What a seat may do in a book (§8.5): add notes and chapters while the book takes them, its actor
 * still the campaign's and, for a party, one its characters may see; rename any chapter; and
 * change or delete an entry in a character's own book, or in a party's the Gamemaster any, a
 * player only those their character wrote, never one written in Foundry. No chapter is deleted.
 * And put the notes of any chapter, or of none, in order, whoever wrote them (module 0.35.0), as
 * the book takes notes.
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
    canReorder: book.connected && !book.private,
  }
}

/**
 * Why an entry from Foundry may be changed only there (§8.5): written in its own editor; sent as
 * HTML for a party's secret; or more than the app can save back, cut short or too long.
 */
export function foundryOnly(note: JournalNote): NoteEntryView['foundryOnly'] {
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

export function fromMirror(note: JournalNote): NoteContent {
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

export function fromWrite(
  write: JournalWrite,
  note?: JournalNote,
): NoteContent {
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
export function stampOf(note?: JournalNote, write?: JournalWrite): string {
  return waiting(write)
    ? `w:${write.id}.${write.seq}`
    : `n:${note?.revision ?? ''}`
}

/**
 * A note as a seat sees it (§8.8): Foundry's version, or the change made here while the module
 * hasn't made it yet, which every seat sees; and where the module didn't take a change, Foundry's
 * version with the seat's own beside it, only to a seat that may change it.
 * @param mayChange - The seat may change the note: rename it, or edit or delete it.
 */
export function overlay(
  note: JournalNote | undefined,
  write: JournalWrite | undefined,
  mayChange: boolean,
  live: boolean,
  seat: NotesSeat,
): SeenNote | undefined {
  const stamp = stampOf(note, write)
  if (!waiting(write)) return note && syncedSeen(note, note.role, stamp)
  switch (write.status) {
    case 'pending':
    case 'claimed': {
      return onItsWaySeen(note, write, mayChange, live, stamp)
    }
    case 'conflict': {
      return refusedSeen(note, write, mayChange, seat, stamp)
    }
    case 'failed': {
      return failedSeen(note, write, mayChange, seat, stamp)
    }
  }
}

/** Foundry's version of a note, as a seat sees it. */
function syncedSeen(
  note: JournalNote,
  role: NoteRole,
  stamp: string,
): SeenNote {
  return {
    role,
    content: fromMirror(note),
    state: 'synced',
    mirrored: true,
    stamp,
  }
}

/** The seat's own change beside Foundry's version, where the module didn't take it. */
function mineOf(
  note: JournalNote | undefined,
  write: JournalWrite,
  seat: NotesSeat,
) {
  return {
    ...fromWrite(write, note),
    ...(write.op === 'delete' && { deleting: true as const }),
    ...(write.requestedById !== seat.userId && { by: write.modifiedBy }),
  }
}

/** A note with a change on its way: the change, or for a deletion, Foundry's version, as going. */
function onItsWaySeen(
  note: JournalNote | undefined,
  write: JournalWrite,
  mayChange: boolean,
  live: boolean,
  stamp: string,
): SeenNote | undefined {
  const { role } = write
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

/**
 * A note whose change the module refused as changed in Foundry, or gone there: to a seat that may
 * change it, Foundry's version with its own beside it, or its own where the note is gone.
 */
function refusedSeen(
  note: JournalNote | undefined,
  write: JournalWrite,
  mayChange: boolean,
  seat: NotesSeat,
  stamp: string,
): SeenNote | undefined {
  const { role } = write
  const reason = noteReason(write.reason)
  if (!mayChange) {
    return reason === 'gone' || !note
      ? undefined
      : syncedSeen(note, role, stamp)
  }
  const mine = mineOf(note, write, seat)
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

/**
 * A note whose change failed otherwise: to a seat that may change it, Foundry's version with its
 * own beside it, or its own where it was to make the note.
 */
function failedSeen(
  note: JournalNote | undefined,
  write: JournalWrite,
  mayChange: boolean,
  seat: NotesSeat,
  stamp: string,
): SeenNote | undefined {
  const { role } = write
  if (!mayChange) {
    return write.op === 'create' || !note
      ? undefined
      : syncedSeen(note, role, stamp)
  }
  const shown = write.op === 'create' || !note
  return {
    role,
    content: shown ? fromWrite(write, note) : fromMirror(note),
    state: 'failed',
    reason: noteReason(write.reason),
    mirrored: !shown,
    mine: mineOf(note, write, seat),
    stamp,
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
export function rightsFor(
  held: HeldBook,
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
export function noteIds(held: HeldBook): string[] {
  return [...new Set([...held.notes.keys(), ...held.writes.keys()])]
}

/** Why Foundry sends none of the book now, as the view says it. */
function withheldOf(held: HeldBook): NotesView['withheld'] {
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

/** A group's key, as an order names it: its chapter's id, or '' for the notes in no chapter. */
export const groupKey = (chapterId: string | null) => chapterId ?? ''

/**
 * What a seat was shown of a group's order (§7.9): the order shown, and a refused order's panel
 * where it's shown one, never the order's every step. So a note added or gone, a reorder in
 * Foundry, a new order by anyone and a refusal shown each change it; an order of the seat's going
 * from waiting to made as asked doesn't.
 * @param panel - The refused order shown, as `<id>.<seq>`; null where none is.
 */
export function groupStamp(panel: string | null, ids: string[]): string {
  const hash = createHash('sha256').update(JSON.stringify([panel, ids]))
  return `g:${hash.digest('hex').slice(0, 16)}`
}

/** An order waiting for the game, or on its way to it: the order every seat is shown. */
export function ordering(
  order?: JournalOrder,
): order is JournalOrder & { status: 'pending' | 'claimed' } {
  return order?.status === 'pending' || order?.status === 'claimed'
}

/** A group's order with an order waiting: its notes the order lists first, in its order. */
export function ordered(base: string[], order?: JournalOrder): string[] {
  if (!ordering(order)) return base
  const inGroup = new Set(base)
  const listed = order.ids.filter(id => inGroup.has(id))
  const first = new Set(listed)
  return [...listed, ...base.filter(id => !first.has(id))]
}

/**
 * A group's order as Foundry holds it, or will once what waits is made (§2.5): its notes the
 * mirror holds in it, by their place there, then by when each was written, then id; then those
 * that wait to come into it, made here or moved in, in the order the module will make them, each
 * landing last.
 */
function baseOrder(
  held: HeldBook,
  entries: NoteEntryView[],
  group: string | null,
  shown: ReadonlySet<string>,
): string[] {
  const shownChapter = (id: string | null) => (id && shown.has(id) ? id : null)
  const placed: NoteEntryView[] = []
  const coming: NoteEntryView[] = []
  for (const entry of entries) {
    const note = held.notes.get(entry.id)
    const inMirror =
      note?.role === 'entry' && shownChapter(note.chapterId) === group
    ;(inMirror ? placed : coming).push(entry)
  }
  const place = (entry: NoteEntryView) => held.notes.get(entry.id)!.place
  const queued = (entry: NoteEntryView) => {
    const write = held.writes.get(entry.id)
    return waiting(write)
      ? write.queuedAt.getTime()
      : Date.parse(entry.createdAt)
  }
  return [
    ...placed.toSorted((a, b) => place(a) - place(b) || byAge(a, b)),
    ...coming.toSorted(
      (a, b) => queued(a) - queued(b) || a.id.localeCompare(b.id),
    ),
  ].map(({ id }) => id)
}

/** A group's order as a seat is shown it, where its order stands, and its stamp (§7.9). */
function groupOf(
  held: HeldBook,
  seat: NotesSeat,
  group: string | null,
  base: string[],
): NoteGroup {
  const order = held.orders.get(groupKey(group))
  const ids = ordered(base, order)
  const refused = order?.status === 'conflict' || order?.status === 'failed'
  // A refused order is its own seat's to settle, and the Gamemaster's: anyone else is shown
  // Foundry's order, as for a note.
  const panel =
    refused && (seat.role === 'gm' || order.requestedById === seat.userId)
  const view: NoteGroupView = {
    chapterId: group,
    state: 'synced',
    stamp: groupStamp(panel ? `${order.id}.${order.seq}` : null, ids),
  }
  if (ordering(order)) {
    view.state = held.live && held.takesOrders ? 'saving' : 'waiting'
  } else if (panel) {
    const inGroup = new Set(base)
    view.state = order.status === 'conflict' ? 'conflict' : 'failed'
    view.reason =
      order.status === 'conflict' ? 'changed' : noteReason(order.reason)
    view.mine = {
      ids: order.ids.filter(id => inGroup.has(id)),
      ...(order.requestedById !== seat.userId && { by: order.modifiedBy }),
    }
  }
  return { ids, base, ...(order && { order }), view }
}

/**
 * The journal's last change a seat may be told of (§2.6): the latest of its chapters' and entries'
 * own, as the seat sees them, and of the book's record; the book's where they're at one time.
 */
function lastChangeOf(
  held: HeldBook,
  seen: { modifiedAt: string; modifiedBy: string }[],
): NoteLastChange | undefined {
  let latest: { at: number; by: string } | undefined
  for (const { modifiedAt, modifiedBy } of seen) {
    const at = Date.parse(modifiedAt)
    if (!latest || at > latest.at) latest = { at, by: modifiedBy }
  }
  if (held.changed && (!latest || held.changed.at.getTime() >= latest.at)) {
    latest = { at: held.changed.at.getTime(), by: held.changed.by }
  }
  return latest && { by: latest.by, at: new Date(latest.at).toISOString() }
}

/** What every note's view says of it, as a seat sees it. */
function commonView(id: string, seen: SeenNote) {
  const { content } = seen
  return {
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
}

/** A chapter as a seat sees it: its title, with the seat's own beside it where it's theirs. */
function chapterView(
  id: string,
  seen: SeenNote,
  note: JournalNote | undefined,
  rights: ReturnType<typeof rightsFor>,
): NoteChapterView {
  return {
    ...commonView(id, seen),
    html: note?.html ?? '',
    canRename: rights.canRename,
    ...(seen.mine && {
      mine: {
        title: seen.mine.title,
        ...(seen.mine.by !== undefined && { by: seen.mine.by }),
      },
    }),
  }
}

/**
 * An entry as a seat sees it: its text, its body only where the seat may change it and Foundry
 * holds nothing the app can't write, and the seat's own beside it where it's theirs.
 */
function entryView(
  id: string,
  seen: SeenNote,
  note: JournalNote | undefined,
  rights: ReturnType<typeof rightsFor>,
): NoteEntryView {
  const { content } = seen
  const only = seen.mirrored && note ? foundryOnly(note) : undefined
  const hasAuthor = !!content.authorActorId || content.authorGm
  return {
    ...commonView(id, seen),
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
  }
}

/** A book as a seat sees it, with each of its groups by key, for a change to their order. */
export function viewOf(
  held: HeldBook,
  seat: NotesSeat,
): { view: NotesView; groups: Map<string, NoteGroup> } {
  const { book } = held
  const chapters: NoteChapterView[] = []
  const entries: NoteEntryView[] = []
  for (const id of noteIds(held)) {
    const note = held.notes.get(id)
    const write = held.writes.get(id)
    const rights = rightsFor(held, seat, note, write)
    const seen = overlay(note, write, rights.mayChange, held.live, seat)
    if (!seen) continue
    if (seen.role === 'chapter')
      chapters.push(chapterView(id, seen, note, rights))
    else entries.push(entryView(id, seen, note, rights))
  }
  const sortedChapters = chapters.toSorted(byAge)
  const shown = new Set(chapters.map(({ id }) => id))
  // An entry in a chapter the seat isn't shown is in none, as it reads it.
  const placedEntries = entries.map(entry =>
    entry.chapterId && !shown.has(entry.chapterId)
      ? { ...entry, chapterId: null }
      : entry,
  )
  const byId = new Map(placedEntries.map(entry => [entry.id, entry]))
  const groups = new Map<string, NoteGroup>()
  for (const group of [null, ...sortedChapters.map(({ id }) => id)]) {
    const members = placedEntries.filter(entry => entry.chapterId === group)
    const base = baseOrder(held, members, group, shown)
    groups.set(groupKey(group), groupOf(held, seat, group, base))
  }
  const rights = noteRights(
    { kind: book.kind, private: book.private, connected: held.connected },
    seat,
  )
  const withheld = withheldOf(held)
  const lastChange = lastChangeOf(held, [...chapters, ...entries])
  return {
    view: {
      version: held.row?.version ?? 0,
      kind: book.kind,
      journal: held.row?.journalName ?? null,
      live: held.live,
      enabled: held.enabled,
      canAdd: rights.canAdd,
      connected: held.connected,
      canReorder: rights.canReorder,
      orders: held.takesOrders,
      ...(lastChange && { lastChange }),
      ...(withheld && { withheld }),
      chapters: sortedChapters,
      groups: [...groups.values()].map(({ view }) => view),
      entries: [...groups.values()].flatMap(({ ids }) =>
        ids.map(id => byId.get(id)!),
      ),
    },
    groups,
  }
}
