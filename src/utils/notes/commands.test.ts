import {
  byQueue,
  commandId,
  orderCommand,
  orderOutcome,
  outcome,
  pageCommand,
  placesOf,
} from './commands'
import { NO_DICE } from '@/constants/roll-kinds'
import {
  JOURNAL_IDS,
  journalAgo,
  journalOrder,
  journalWrite,
} from '@/mocks/journal-rows'
import { mockJournalUpdated } from '@/mocks/sending-stone'
import type { CommandResult, JournalPage } from '@/types/sending-stone'

const {
  thorin: THORIN,
  cave: CAVE,
  session: SESSION,
  revision: REV,
} = JOURNAL_IDS
const W1 = JOURNAL_IDS.write
const O1 = JOURNAL_IDS.order

/** A page of a journal, by id, role and chapter, for its place in its group. */
const pageOf = (
  id: string,
  role: 'chapter' | 'entry',
  chapter: string | null = null,
) =>
  ({
    ...mockJournalUpdated('personal').journal!.notes[0],
    id,
    role,
    chapter,
  }) as JournalPage

/** Thorin's book, as a claimed change's row includes it. */
const inBook = { book: { kind: 'personal' as const, actorId: THORIN } }

/** What the module answered of a note command: refused, unless said. */
const answered = (fields: Partial<CommandResult>): CommandResult => ({
  id: `${W1}.2`,
  status: 'failed',
  reason: null,
  error: null,
  messageId: null,
  visible: false,
  rolls: [],
  ...fields,
})

describe('utils/notes/commands', () => {
  describe('placesOf', () => {
    it('places each note in its group as Foundry sends the journal: the chapters, and each group’s notes, counted apart', () => {
      const places = placesOf([
        pageOf('looseNote0000001', 'entry'),
        pageOf('chapterOne000001', 'chapter'),
        pageOf('inOne00000000001', 'entry', 'chapterOne000001'),
        pageOf('looseNote0000002', 'entry'),
        pageOf('chapterTwo000001', 'chapter'),
        pageOf('inOne00000000002', 'entry', 'chapterOne000001'),
        pageOf('inTwo00000000001', 'entry', 'chapterTwo000001'),
      ])
      expect(Object.fromEntries(places)).toEqual({
        looseNote0000001: 0,
        chapterOne000001: 0,
        inOne00000000001: 0,
        looseNote0000002: 1,
        chapterTwo000001: 1,
        inOne00000000002: 1,
        inTwo00000000001: 0,
      })
    })
  })

  describe('commandId and byQueue', () => {
    it('names a command by its change and which change of it this is', () => {
      expect(commandId({ id: W1, seq: 3 })).toBe(`${W1}.3`)
    })

    it('hands over the oldest first, a note’s change before an order queued at the same time, then by id', () => {
      const at = journalAgo(1000)
      const due = [
        { table: 'order' as const, id: 'o2', queuedAt: at },
        { table: 'write' as const, id: 'w2', queuedAt: at },
        { table: 'write' as const, id: 'w1', queuedAt: at },
        { table: 'order' as const, id: 'o1', queuedAt: journalAgo(2000) },
      ]
      expect(due.toSorted(byQueue).map(({ id }) => id)).toEqual([
        'o1',
        'w1',
        'w2',
        'o2',
      ])
    })
  })

  describe('pageCommand', () => {
    it("hands over an entry's change with its title, Markdown and chapter, from Foundry's revision, as whoever made it", () => {
      expect(
        pageCommand({ ...journalWrite({ chapterId: SESSION }), ...inBook }),
      ).toEqual({
        id: `${W1}.2`,
        actorId: THORIN,
        kind: 'note',
        note: {
          book: 'personal',
          op: 'update',
          id: CAVE,
          role: 'entry',
          base: REV,
          writer: THORIN,
          at: journalAgo(60_000).getTime(),
          title: 'Goblin cave',
          markdown: '### Loot, all of it',
          chapter: SESSION,
        },
        ...NO_DICE,
      })
    })

    it('hands over a new note with no revision and when it was made; a chapter with its title alone; a deletion with neither', () => {
      const made = pageCommand({
        ...journalWrite({ op: 'create', role: 'chapter', chapterId: null }),
        ...inBook,
      })
      expect(made.note).toEqual({
        book: 'personal',
        op: 'create',
        id: CAVE,
        role: 'chapter',
        base: null,
        writer: THORIN,
        at: journalAgo(60_000).getTime(),
        title: 'Goblin cave',
        createdAt: journalAgo(3_600_000).getTime(),
      })
      const deleted = pageCommand({
        ...journalWrite({ op: 'delete' }),
        ...inBook,
      })
      expect(deleted.note).not.toHaveProperty('title')
      expect(deleted.note).not.toHaveProperty('markdown')
      expect(deleted.note).not.toHaveProperty('createdAt')
    })

    it.each([
      [
        "a member's note the Gamemaster fixed, as its author",
        { op: 'create', seat: 'gm', writerActorId: null },
        { writer: THORIN },
      ],
      [
        "the Gamemaster's own note, as the Gamemaster",
        {
          op: 'create',
          seat: 'player',
          authorActorId: null,
          authorGm: true,
        },
        { writer: null, by: 'gm' },
      ],
      [
        'a note first written in Foundry, made again, as whoever made it',
        {
          op: 'create',
          seat: 'player',
          authorActorId: null,
          authorGm: false,
          writerActorId: 'vex',
        },
        { writer: 'vex' },
      ],
      [
        "the Gamemaster's change, as the Gamemaster",
        { op: 'update', seat: 'gm', writerActorId: null },
        { writer: null, by: 'gm' },
      ],
    ] as const)('hands over %s', (_, fields, as) => {
      const command = pageCommand({ ...journalWrite(fields), ...inBook })
      expect(command.note.writer).toBe(as.writer)
      expect(command.by).toBe('by' in as ? as.by : undefined)
    })
  })

  describe('orderCommand', () => {
    it("hands over an order of a group's notes, as whoever last made it", () => {
      const order = journalOrder({
        seq: 1,
        ids: ['b', 'a'],
        was: ['a', 'b'],
      })
      expect(orderCommand({ ...order, ...inBook })).toEqual({
        id: `${O1}.1`,
        actorId: THORIN,
        kind: 'note',
        note: {
          book: 'personal',
          op: 'order',
          chapter: null,
          ids: ['b', 'a'],
          was: ['a', 'b'],
          writer: THORIN,
          at: journalAgo(60_000).getTime(),
        },
        ...NO_DICE,
      })
      const gms = orderCommand({
        ...journalOrder({ chapterId: SESSION, seat: 'gm' }),
        ...inBook,
      })
      expect(gms).toMatchObject({
        by: 'gm',
        note: { chapter: SESSION, writer: null },
      })
    })
  })

  describe('outcome and orderOutcome', () => {
    it.each([
      [answered({ status: 'done' }), 'made', null, 'made', null],
      [
        answered({ reason: 'changed' }),
        'conflict',
        'changed',
        'conflict',
        'changed',
      ],
      // A chapter gone fails an order; it waits for a note's author.
      [answered({ reason: 'gone' }), 'conflict', 'gone', 'failed', 'error'],
      [
        answered({ reason: 'headings' }),
        'failed',
        'headings',
        'failed',
        'headings',
      ],
      [
        answered({ reason: 'not-member' }),
        'failed',
        'not-member',
        'failed',
        'not-member',
      ],
      [answered({ reason: 'whatever' }), 'failed', 'error', 'failed', 'error'],
      [answered({}), 'failed', 'error', 'failed', 'error'],
    ])(
      'records %j as %s (%s) for a note, %s (%s) for an order',
      (result, status, reason, orderStatus, orderReason) => {
        expect(outcome(result)).toEqual({ status, reason })
        expect(orderOutcome(result)).toEqual({
          status: orderStatus,
          reason: orderReason,
        })
      },
    )
  })
})
