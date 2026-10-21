/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- Prisma and the protocol use null for an absent value */
import { Prisma, type JournalNote, type JournalWrite } from '@prisma/client'
import { prismaMock } from '../../jest.setup'
import {
  applyJournalUpdated,
  claimNoteWrites,
  MADE_KEPT_FOR,
  reconcileJournals,
  recordNoteResult,
} from './note-sync'
import { mockJournalUpdated, NOTE_IDS, PARTY } from '@/mocks/sending-stone'
import type { CommandResult, JournalPage } from '@/types/sending-stone'

const NOW = Date.parse('2026-10-22T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)
const ORIGIN = 'https://my-game.forge-vtt.com'
const W1 = '11111111-1111-4111-8111-111111111111'
const W2 = '22222222-2222-4222-8222-222222222222'
const tx = prismaMock as unknown as Prisma.TransactionClient

/** A change made here, as the claim reads it. */
function write(fields: Partial<JournalWrite> = {}): JournalWrite {
  return {
    id: W1,
    seq: 0,
    campaignId: 'c1',
    bookId: 'book-1',
    noteId: NOTE_IDS.cave,
    op: 'create',
    role: 'entry',
    chapterId: NOTE_IDS.session,
    title: 'The goblin cave',
    body: '### Loot',
    html: '<h5>Loot</h5>',
    authorActorId: PARTY.thorin,
    authorGm: false,
    authorName: 'Thorin',
    noteCreatedAt: ago(600_000),
    seat: 'player',
    requestedById: 'user-1',
    writerActorId: PARTY.thorin,
    modifiedAt: ago(60_000),
    modifiedBy: 'Thorin',
    base: null,
    status: 'pending',
    reason: null,
    claimToken: null,
    claimSession: null,
    claimedAt: null,
    queuedAt: ago(600_000),
    createdAt: ago(600_000),
    updatedAt: ago(60_000),
    ...fields,
  }
}

/** A note as the mirror holds it. */
function held(page: JournalPage, html = 'drawn'): JournalNote {
  return {
    bookId: 'book-1',
    noteId: page.id,
    role: page.role,
    chapterId: page.role === 'entry' ? page.chapter : null,
    title: page.title,
    format: page.format,
    body: page.format === 2 ? (page.markdown ?? '') : '',
    html,
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

/** A note command's result, as the module posts it. */
const result = (fields: Partial<CommandResult> = {}): CommandResult => ({
  id: `${W1}.2`,
  status: 'done',
  reason: null,
  error: null,
  messageId: null,
  visible: false,
  rolls: [],
  note: { id: NOTE_IDS.cave, rev: 'abcdef00000009' },
  ...fields,
})

/** The campaign as `journal.updated` reads it: Thorin and Vex, and the company. */
const eventCampaign = (fields: object = {}) =>
  prismaMock.campaign.findUnique.mockResolvedValue({
    origin: ORIGIN,
    characters: [{ id: PARTY.thorin }, { id: PARTY.vex }],
    groups: [{ id: 'company' }],
    ...fields,
  } as any)

/** The book as `journal.updated` finds or makes it. */
const eventBook = (fields: object = {}) =>
  prismaMock.journalBook.upsert.mockResolvedValue({
    id: 'book-1',
    journalId: 'thorinJournal001',
    journalName: "Thorin's notes (Erebor)",
    withheld: null,
    notes: [],
    ...fields,
  } as any)

/** The campaign as the claim reads it: this session’s hello, taking notes, its owner gm-1. */
const claimCampaign = (fields: object = {}) =>
  prismaMock.campaign.findUnique.mockResolvedValue({
    helloSession: 's1',
    notesEnabled: true,
    ownerId: 'gm-1',
    ...fields,
  } as any)

/** The changes the claim finds, then the same as it hands them over, with their book. */
const waitingRows = (rows: Partial<JournalWrite>[]) =>
  prismaMock.journalWrite.findMany
    .mockReset()
    .mockResolvedValueOnce(rows.map(row => write(row)) as any)
    .mockResolvedValueOnce(
      rows.map(row => ({
        ...write(row),
        book: { kind: 'personal', actorId: PARTY.thorin },
      })) as any,
    )

describe('db/note-sync', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    prismaMock.$transaction.mockImplementation((run: any) => run(prismaMock))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('reconcileJournals, on each hello from module 0.34.0', () => {
    beforeEach(() => {
      prismaMock.journalBook.findMany.mockResolvedValue([
        { id: 'b-thorin', kind: 'personal', actorId: 'thorin' },
        { id: 'b-vex', kind: 'personal', actorId: 'vex' },
        { id: 'b-company', kind: 'party', actorId: 'company' },
        { id: 'b-balin', kind: 'personal', actorId: 'balin' },
        { id: 'b-scouts', kind: 'party', actorId: 'scouts' },
      ] as any)
    })

    it('empties the mirror of each book of the hello’s actors whose journal it doesn’t list', async () => {
      await reconcileJournals(
        tx,
        'c1',
        ['thorin', 'vex'],
        ['company', 'vex'],
        [
          { kind: 'personal', actorId: 'thorin' },
          { kind: 'party', actorId: 'scouts' },
        ],
      )

      expect(prismaMock.journalBook.findMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', journalId: { not: null } },
        select: { id: true, kind: true, actorId: true },
      })
      // Vex's own journal and the Company's are gone; Thorin's is listed; Balin and the Scouts
      // aren't in the hello, so theirs are left alone, a party's by the group's id alone.
      expect(prismaMock.journalNote.deleteMany.mock.calls).toEqual([
        [{ where: { bookId: 'b-vex' } }],
        [{ where: { bookId: 'b-company' } }],
      ])
      expect(prismaMock.journalBook.update).toHaveBeenCalledWith({
        where: { id: 'b-vex' },
        data: {
          journalId: null,
          journalName: null,
          version: { increment: 1 },
        },
      })
      expect(prismaMock.journalBook.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('applyJournalUpdated', () => {
    beforeEach(() => {
      eventCampaign()
      eventBook()
    })

    it('makes the mirror the journal’s notes, each drawn for its book, and the book’s version one more', async () => {
      eventBook({ journalId: null, journalName: null })
      const event = mockJournalUpdated('personal')

      await applyJournalUpdated(tx, 'c1', event)

      expect(prismaMock.journalBook.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaignBook: {
              campaignId: 'c1',
              kind: 'personal',
              actorId: PARTY.thorin,
            },
          },
          create: { campaignId: 'c1', kind: 'personal', actorId: PARTY.thorin },
          update: {},
        }),
      )
      expect(prismaMock.journalNote.create).toHaveBeenCalledTimes(5)
      expect(prismaMock.journalNote.create).toHaveBeenCalledWith({
        data: {
          bookId: 'book-1',
          noteId: NOTE_IDS.cave,
          role: 'entry',
          chapterId: NOTE_IDS.session,
          title: 'The goblin cave',
          format: 2,
          body: '### Loot\n- 30 gp\n- a *strange* key',
          html: '<h5>Loot</h5>\n<ul>\n<li>30 gp</li>\n<li>a <em>strange</em> key</li>\n</ul>',
          cut: false,
          secret: false,
          authorActorId: PARTY.thorin,
          authorGm: false,
          authorName: 'Thorin',
          createdAt: new Date(event.journal!.notes[1].createdAt),
          modifiedAt: new Date(event.journal!.notes[1].modifiedAt),
          modifiedBy: 'Thorin',
          modifiedIn: 'app',
          revision: event.journal!.notes[1].rev,
        },
      })
      // Foundry's HTML is drawn, not kept; a note cut short is said so.
      expect(prismaMock.journalNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          noteId: NOTE_IDS.map,
          format: 1,
          body: '',
          html: '<p><strong>North</strong> of the river.</p>',
        }),
      })
      expect(prismaMock.journalNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ noteId: NOTE_IDS.long, cut: true }),
      })
      expect(prismaMock.journalBook.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: {
          journalId: 'thorinJournal001',
          journalName: "Thorin's notes (Erebor)",
          withheld: Prisma.DbNull,
          syncedAt: new Date(NOW),
          version: { increment: 1 },
        },
      })
    })

    it('changes only what changed: a note whose revision moved is drawn again, others kept, those gone deleted', async () => {
      const event = mockJournalUpdated('personal')
      const [chapter, cave, rumour, map] = event.journal!.notes
      eventBook({
        notes: [
          held(chapter),
          held({ ...cave, rev: 'ffffffffffffff' }, 'stale'),
          held(rumour),
          held(map, '<p><strong>North</strong> of the river.</p>'),
          held({ ...rumour, id: 'deletedInFndry1' }),
        ],
      })

      await applyJournalUpdated(tx, 'c1', event)

      expect(prismaMock.journalNote.deleteMany).toHaveBeenCalledWith({
        where: { bookId: 'book-1', noteId: { in: ['deletedInFndry1'] } },
      })
      expect(prismaMock.journalNote.update).toHaveBeenCalledTimes(1)
      expect(prismaMock.journalNote.update).toHaveBeenCalledWith({
        // eslint-disable-next-line camelcase -- Prisma's name for the two-part key
        where: { bookId_noteId: { bookId: 'book-1', noteId: NOTE_IDS.cave } },
        data: expect.objectContaining({
          revision: cave.rev,
          html: expect.stringContaining('<h5>Loot</h5>'),
        }),
      })
      // The long note was never held: it's added.
      expect(prismaMock.journalNote.create).toHaveBeenCalledTimes(1)
    })

    it('replaces a note whose author’s name changed, without drawing it again', async () => {
      const event = mockJournalUpdated('personal')
      const notes = event.journal!.notes.map(page => held(page))
      notes[1] = { ...notes[1], modifiedBy: 'Thorin Oakenshield', html: 'kept' }
      eventBook({ notes })

      await applyJournalUpdated(tx, 'c1', event)

      expect(prismaMock.journalNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ modifiedBy: 'Thorin', html: 'kept' }),
        }),
      )
    })

    it('bumps nothing where nothing changed', async () => {
      const event = mockJournalUpdated('personal')
      eventBook({
        notes: event.journal!.notes.map(page =>
          held(
            page,
            page.format === 1
              ? '<p><strong>North</strong> of the river.</p>'
              : 'drawn',
          ),
        ),
      })

      await applyJournalUpdated(tx, 'c1', event)

      expect(prismaMock.journalNote.update).not.toHaveBeenCalled()
      expect(prismaMock.journalNote.create).not.toHaveBeenCalled()
      expect(prismaMock.journalBook.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: expect.not.objectContaining({ version: expect.anything() }),
      })
    })

    it('draws a party’s notes without their secrets, and a character’s with them', async () => {
      const secret = '<section class="secret"><p>the traitor</p></section>'
      const page = (kind: 'personal' | 'party') => {
        const event = mockJournalUpdated(kind)
        event.journal!.notes = [
          {
            ...event.journal!.notes[1],
            format: 2,
            markdown: `Watch.\n\n${secret}`,
          },
        ]
        return event
      }

      await applyJournalUpdated(tx, 'c1', page('party'))
      expect(prismaMock.journalNote.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          html: expect.not.stringContaining('traitor'),
        }),
      })

      await applyJournalUpdated(tx, 'c1', page('personal'))
      expect(prismaMock.journalNote.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          html: expect.stringContaining('traitor'),
        }),
      })
    })

    it('keeps a party page sent as HTML for its secret marked so', async () => {
      await applyJournalUpdated(tx, 'c1', mockJournalUpdated('party'))

      expect(prismaMock.journalNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          noteId: NOTE_IDS.traitor,
          format: 1,
          secret: true,
          html: '<p>Keep watch at night.</p>',
        }),
      })
    })

    it('keeps the notes of a book held back, marking it so', async () => {
      await applyJournalUpdated(tx, 'c1', {
        kind: 'party',
        actorId: 'company',
        journal: null,
        withheld: { reason: 'private' },
      })

      expect(prismaMock.journalNote.deleteMany).not.toHaveBeenCalled()
      expect(prismaMock.journalBook.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: {
          withheld: { reason: 'private' },
          syncedAt: new Date(NOW),
          version: { increment: 1 },
        },
      })
    })

    it('empties the mirror of a book with no journal in Foundry', async () => {
      const event = mockJournalUpdated('personal')
      eventBook({ notes: event.journal!.notes.map(page => held(page)) })

      await applyJournalUpdated(tx, 'c1', {
        kind: 'personal',
        actorId: PARTY.thorin,
        journal: null,
      })

      expect(prismaMock.journalNote.deleteMany).toHaveBeenCalledWith({
        where: {
          bookId: 'book-1',
          noteId: { in: event.journal!.notes.map(({ id }) => id) },
        },
      })
      expect(prismaMock.journalBook.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: expect.objectContaining({
          journalId: null,
          journalName: null,
          version: { increment: 1 },
        }),
      })
    })

    it('ignores the book of an actor the campaign doesn’t have, of its kind', async () => {
      eventCampaign({ characters: [], groups: [{ id: PARTY.thorin }] })

      await applyJournalUpdated(tx, 'c1', mockJournalUpdated('personal'))
      await applyJournalUpdated(tx, 'c1', mockJournalUpdated('party'))

      expect(prismaMock.journalBook.upsert).not.toHaveBeenCalled()
      expect(prismaMock.journalNote.create).not.toHaveBeenCalled()
    })

    it('never touches a change waiting', async () => {
      await applyJournalUpdated(tx, 'c1', mockJournalUpdated('personal'))

      expect(prismaMock.journalWrite.updateMany).not.toHaveBeenCalled()
      expect(prismaMock.journalWrite.deleteMany).not.toHaveBeenCalled()
    })
  })

  describe('claimNoteWrites', () => {
    beforeEach(() => {
      claimCampaign()
      prismaMock.journalWrite.updateMany.mockResolvedValue({ count: 1 })
    })

    it('deletes made changes past their hour, first', async () => {
      waitingRows([])

      await claimNoteWrites('c1', 's1')

      expect(prismaMock.journalWrite.deleteMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          status: 'made',
          updatedAt: { lt: ago(MADE_KEPT_FOR) },
        },
      })
      expect(MADE_KEPT_FOR).toBe(3_600_000)
    })

    it('hands over the changes waiting, and those unanswered past 75 seconds, oldest first, the Gamemaster’s only the owner’s', async () => {
      waitingRows([{}])

      await claimNoteWrites('c1', 's1')

      const due = {
        OR: [
          { status: 'pending' },
          { status: 'claimed', claimedAt: { lt: ago(75_000) } },
        ],
      }
      expect(prismaMock.journalWrite.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          campaignId: 'c1',
          AND: [
            due,
            {
              OR: [{ seat: 'player' }, { seat: 'gm', requestedById: 'gm-1' }],
            },
          ],
        },
        orderBy: { queuedAt: 'asc' },
        take: 5,
        select: { id: true, seq: true, title: true, body: true },
      })
      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
        where: { OR: [{ id: W1, seq: 0 }], AND: [due] },
        data: {
          status: 'claimed',
          claimToken: expect.any(String),
          claimSession: 's1',
          claimedAt: new Date(NOW),
        },
      })
      expect(prismaMock.journalWrite.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          claimToken:
            prismaMock.journalWrite.updateMany.mock.calls[0][0].data.claimToken,
        },
        orderBy: { queuedAt: 'asc' },
        include: { book: { select: { kind: true, actorId: true } } },
      })
    })

    it('hands only players’ over where the campaign has no owner', async () => {
      claimCampaign({ ownerId: null })
      waitingRows([])

      await claimNoteWrites('c1', 's1')

      expect(
        prismaMock.journalWrite.findMany.mock.calls[0][0]?.where?.AND,
      ).toContainEqual({ OR: [{ seat: 'player' }] })
    })

    it.each([
      ['another session', { helloSession: 's2' }],
      ['a module that keeps no notes', { notesEnabled: false }],
    ])('hands nothing to %s', async (_name, fields) => {
      claimCampaign(fields)

      await expect(claimNoteWrites('c1', 's1')).resolves.toEqual([])
      expect(prismaMock.journalWrite.findMany).not.toHaveBeenCalled()
      expect(prismaMock.journalWrite.updateMany).not.toHaveBeenCalled()
    })

    it('hands nothing where the campaign is gone', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(null)

      await expect(claimNoteWrites('c1', 's1')).resolves.toEqual([])
    })

    it('hands over as many characters as a fetch takes, but always one', async () => {
      waitingRows([
        { id: W1, body: 'a'.repeat(300_000) },
        { id: W2, body: 'b'.repeat(300_000) },
      ])

      await claimNoteWrites('c1', 's1')

      expect(
        prismaMock.journalWrite.updateMany.mock.calls[0][0].where,
      ).toMatchObject({ OR: [{ id: W1, seq: 0 }] })

      waitingRows([{ id: W1, body: 'a'.repeat(600_000) }])
      await claimNoteWrites('c1', 's1')
      expect(
        prismaMock.journalWrite.updateMany.mock.calls[1][0].where,
      ).toMatchObject({ OR: [{ id: W1, seq: 0 }] })
    })

    it('hands each over as the module’s note command, with exactly its fields', async () => {
      waitingRows([
        {},
        {
          id: W2,
          seq: 3,
          noteId: NOTE_IDS.rumour,
          op: 'update',
          base: 'abcdef00000001',
          seat: 'gm',
          writerActorId: null,
          requestedById: 'gm-1',
        },
        {
          id: '33333333-3333-4333-8333-333333333333',
          seq: 1,
          noteId: NOTE_IDS.map,
          op: 'delete',
          base: 'abcdef00000002',
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          noteId: NOTE_IDS.session,
          role: 'chapter',
          title: 'Session 1',
          body: '',
          chapterId: null,
        },
      ])

      const commands = await claimNoteWrites('c1', 's1')

      const common = { mode: 0, explicit: false, extras: [], dice: [] }
      expect(commands).toEqual([
        {
          id: `${W1}.0`,
          actorId: PARTY.thorin,
          kind: 'note',
          note: {
            book: 'personal',
            op: 'create',
            id: NOTE_IDS.cave,
            role: 'entry',
            base: null,
            writer: PARTY.thorin,
            at: NOW - 60_000,
            title: 'The goblin cave',
            markdown: '### Loot',
            chapter: NOTE_IDS.session,
            createdAt: NOW - 600_000,
          },
          ...common,
        },
        {
          id: `${W2}.3`,
          actorId: PARTY.thorin,
          kind: 'note',
          by: 'gm',
          note: {
            book: 'personal',
            op: 'update',
            id: NOTE_IDS.rumour,
            role: 'entry',
            base: 'abcdef00000001',
            writer: null,
            at: NOW - 60_000,
            title: 'The goblin cave',
            markdown: '### Loot',
            chapter: NOTE_IDS.session,
          },
          ...common,
        },
        {
          id: '33333333-3333-4333-8333-333333333333.1',
          actorId: PARTY.thorin,
          kind: 'note',
          note: {
            book: 'personal',
            op: 'delete',
            id: NOTE_IDS.map,
            role: 'entry',
            base: 'abcdef00000002',
            writer: PARTY.thorin,
            at: NOW - 60_000,
          },
          ...common,
        },
        {
          id: '44444444-4444-4444-8444-444444444444.0',
          actorId: PARTY.thorin,
          kind: 'note',
          note: {
            book: 'personal',
            op: 'create',
            id: NOTE_IDS.session,
            role: 'chapter',
            base: null,
            writer: PARTY.thorin,
            at: NOW - 60_000,
            title: 'Session 1',
            createdAt: NOW - 600_000,
          },
          ...common,
        },
      ])
    })
  })

  describe('recordNoteResult', () => {
    beforeEach(() => {
      prismaMock.journalWrite.updateMany.mockResolvedValue({ count: 1 })
      prismaMock.journalWrite.findUnique.mockResolvedValue(
        write({ seq: 2, op: 'update', base: 'abcdef00000001' }),
      )
      prismaMock.journalNote.findUnique.mockResolvedValue({
        revision: 'abcdef00000001',
      } as any)
    })

    it('marks the change handed over under that id and number made, by id, number and campaign', async () => {
      prismaMock.journalNote.findUnique.mockResolvedValue({
        revision: 'abcdef00000009',
      } as any)

      await recordNoteResult('c1', result())

      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
        where: { id: W1, seq: 2, campaignId: 'c1', status: 'claimed' },
        data: { status: 'made', reason: null },
      })
      expect(prismaMock.journalNote.upsert).not.toHaveBeenCalled()
      expect(prismaMock.journalBook.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: { version: { increment: 1 } },
      })
    })

    it('sets the mirror from the change where the book’s post was lost', async () => {
      await recordNoteResult('c1', result())

      expect(prismaMock.journalNote.upsert).toHaveBeenCalledWith({
        where: {
          // eslint-disable-next-line camelcase -- Prisma's name for the two-part key
          bookId_noteId: { bookId: 'book-1', noteId: NOTE_IDS.cave },
        },
        create: expect.objectContaining({
          bookId: 'book-1',
          noteId: NOTE_IDS.cave,
          revision: 'abcdef00000009',
          format: 2,
          modifiedIn: 'app',
          title: 'The goblin cave',
          body: '### Loot',
        }),
        update: expect.objectContaining({
          revision: 'abcdef00000009',
          modifiedIn: 'app',
        }),
      })
    })

    it('sets no mirror where the page’s revision isn’t known', async () => {
      prismaMock.journalNote.findUnique.mockResolvedValue(null)

      await recordNoteResult(
        'c1',
        result({ note: { id: NOTE_IDS.cave, rev: null } }),
      )
      await recordNoteResult('c1', result({ note: undefined }))

      expect(prismaMock.journalNote.upsert).not.toHaveBeenCalled()
    })

    it('deletes the mirror’s note for a delete made', async () => {
      prismaMock.journalWrite.findUnique.mockResolvedValue(
        write({ seq: 2, op: 'delete' }),
      )

      await recordNoteResult(
        'c1',
        result({ note: { id: NOTE_IDS.cave, rev: null, deleted: true } }),
      )

      expect(prismaMock.journalNote.deleteMany).toHaveBeenCalledWith({
        where: { bookId: 'book-1', noteId: NOTE_IDS.cave },
      })
    })

    it.each([
      ['changed', 'conflict', 'changed'],
      ['gone', 'conflict', 'gone'],
      ['not-member', 'failed', 'not-member'],
      ['headings', 'failed', 'headings'],
      ['strange', 'failed', 'error'],
      [null, 'failed', 'error'],
    ])('keeps a refusal for %s as %s', async (reason, status, kept) => {
      await recordNoteResult(
        'c1',
        result({
          status: 'failed',
          reason,
          note: { id: NOTE_IDS.cave, rev: null },
        }),
      )

      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
        where: { id: W1, seq: 2, campaignId: 'c1', status: 'claimed' },
        data: { status, reason: kept },
      })
      expect(prismaMock.journalNote.upsert).not.toHaveBeenCalled()
    })

    it('leaves a change the module took too long with to be handed over again', async () => {
      await recordNoteResult(
        'c1',
        result({ status: 'failed', reason: 'timeout' }),
      )

      expect(prismaMock.journalWrite.updateMany).not.toHaveBeenCalled()
    })

    it('changes nothing for a result for an earlier hand-over, the change since moved on', async () => {
      prismaMock.journalWrite.updateMany.mockResolvedValue({ count: 0 })

      await recordNoteResult('c1', result({ id: `${W1}.0` }))

      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
        where: { id: W1, seq: 0, campaignId: 'c1', status: 'claimed' },
        data: { status: 'made', reason: null },
      })
      expect(prismaMock.journalWrite.findUnique).not.toHaveBeenCalled()
      expect(prismaMock.journalBook.update).not.toHaveBeenCalled()
    })

    it.each([['req-1'], [`${W1}.`], [`${W1}.x`], [`${W1}.-1`], ['.2']])(
      'reads no change from the id %s',
      async id => {
        await recordNoteResult('c1', result({ id }))

        expect(prismaMock.journalWrite.updateMany).not.toHaveBeenCalled()
      },
    )
  })
})
