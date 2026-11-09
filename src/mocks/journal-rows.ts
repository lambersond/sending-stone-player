import type { HeldBook } from '@/utils/notes/types'
import type { JournalNote, JournalOrder, JournalWrite } from '@prisma/client'

// A book of journal notes as the database holds it (src/db/notes.ts reads it into a `HeldBook`),
// for the notes' rules to be tested without the database: Thorin's personal book, his cave note
// written in the app and mirrored from Foundry, and a change of it waiting.

export const JOURNAL_NOW = Date.parse('2026-10-22T12:00:00Z')
export const journalAgo = (ms: number) => new Date(JOURNAL_NOW - ms)

export const JOURNAL_IDS = {
  thorin: 'thorin',
  vex: 'vex',
  cave: 'goblinCaveNote01',
  session: 'sessionChapter01',
  write: '11111111-1111-4111-8111-111111111111',
  order: '99999999-9999-4999-8999-999999999999',
  revision: 'abcdef00000001',
} as const

/** A note as Foundry last held it: Thorin's cave note, written in the app. */
export function mirrorNote(fields: Partial<JournalNote> = {}): JournalNote {
  return {
    bookId: 'book-1',
    noteId: JOURNAL_IDS.cave,
    role: 'entry',
    chapterId: null,
    title: 'The goblin cave',
    format: 2,
    body: '### Loot',
    html: '<h5>Loot</h5>',
    cut: false,
    secret: false,
    authorActorId: JOURNAL_IDS.thorin,
    authorGm: false,
    authorName: 'Thorin',
    createdAt: journalAgo(3_600_000),
    modifiedAt: journalAgo(1_800_000),
    modifiedBy: 'Thorin',
    modifiedIn: 'app',
    revision: JOURNAL_IDS.revision,
    place: 0,
    ...fields,
  }
}

/** A change made here, waiting for the game: Thorin's edit of his cave note. */
export function journalWrite(fields: Partial<JournalWrite> = {}): JournalWrite {
  return {
    id: JOURNAL_IDS.write,
    seq: 2,
    campaignId: 'c1',
    bookId: 'book-1',
    noteId: JOURNAL_IDS.cave,
    op: 'update',
    role: 'entry',
    chapterId: null,
    title: 'Goblin cave',
    body: '### Loot, all of it',
    html: '<h5>Loot, all of it</h5>',
    authorActorId: JOURNAL_IDS.thorin,
    authorGm: false,
    authorName: 'Thorin',
    noteCreatedAt: journalAgo(3_600_000),
    seat: 'player',
    requestedById: 'user-1',
    writerActorId: JOURNAL_IDS.thorin,
    modifiedAt: journalAgo(60_000),
    modifiedBy: 'Thorin',
    base: JOURNAL_IDS.revision,
    status: 'pending',
    reason: null,
    foundryRev: null,
    claimToken: null,
    claimSession: null,
    claimedAt: null,
    queuedAt: journalAgo(120_000),
    createdAt: journalAgo(120_000),
    updatedAt: journalAgo(60_000),
    ...fields,
  }
}

/** A new order of the notes in no chapter, made here by Thorin, waiting for the game. */
export function journalOrder(fields: Partial<JournalOrder> = {}): JournalOrder {
  return {
    id: JOURNAL_IDS.order,
    seq: 0,
    campaignId: 'c1',
    bookId: 'book-1',
    chapterId: '',
    ids: [],
    was: [],
    seat: 'player',
    requestedById: 'user-1',
    writerActorId: JOURNAL_IDS.thorin,
    modifiedAt: journalAgo(60_000),
    modifiedBy: 'Thorin',
    status: 'pending',
    reason: null,
    claimToken: null,
    claimSession: null,
    claimedAt: null,
    queuedAt: journalAgo(60_000),
    createdAt: journalAgo(60_000),
    updatedAt: journalAgo(60_000),
    ...fields,
  }
}

/**
 * Thorin's personal book as read for a seat: these notes and changes, its game taking notes and
 * orders now.
 */
export function heldBook({
  notes = [],
  writes = [],
  orders = [],
  ...fields
}: Partial<Omit<HeldBook, 'notes' | 'writes' | 'orders'>> & {
  notes?: JournalNote[]
  writes?: JournalWrite[]
  orders?: JournalOrder[]
} = {}): HeldBook {
  return {
    book: {
      campaignId: 'c1',
      kind: 'personal',
      actorId: JOURNAL_IDS.thorin,
      private: false,
    },
    row: {
      id: 'book-1',
      version: 4,
      journalName: "Thorin's notes (Erebor)",
      withheld: null,
    },
    notes: new Map(notes.map(note => [note.noteId, note])),
    writes: new Map(writes.map(write => [write.noteId, write])),
    orders: new Map(orders.map(order => [order.chapterId, order])),
    takesOrders: true,
    connected: true,
    live: true,
    enabled: true,
    origin: 'https://my-game.forge-vtt.com',
    names: new Map([
      [JOURNAL_IDS.thorin, 'Thorin'],
      [JOURNAL_IDS.vex, 'Vex'],
    ]),
    ...fields,
  }
}
