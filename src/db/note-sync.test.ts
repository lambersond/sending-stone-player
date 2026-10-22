/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- Prisma and the protocol use null for an absent value */
import {
  Prisma,
  type JournalNote,
  type JournalOrder,
  type JournalWrite,
} from '@prisma/client'
import { prismaMock } from '../../jest.setup'
import {
  applyJournalUpdated,
  claimNoteWrites,
  drawJournal,
  MADE_KEPT_FOR,
  placesOf,
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
const O1 = '99999999-9999-4999-8999-999999999999'
const O2 = '88888888-8888-4888-8888-888888888888'
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
    foundryRev: null,
    claimToken: null,
    claimSession: null,
    claimedAt: null,
    queuedAt: ago(600_000),
    createdAt: ago(600_000),
    updatedAt: ago(60_000),
    ...fields,
  }
}

/** An order of a group's notes made here, as the claim reads it: Thorin's of Session 1. */
function order(fields: Partial<JournalOrder> = {}): JournalOrder {
  return {
    id: O1,
    seq: 0,
    campaignId: 'c1',
    bookId: 'book-1',
    chapterId: NOTE_IDS.session,
    ids: [NOTE_IDS.rumour, NOTE_IDS.cave],
    was: [NOTE_IDS.cave, NOTE_IDS.rumour],
    seat: 'player',
    requestedById: 'user-1',
    writerActorId: PARTY.thorin,
    modifiedAt: ago(30_000),
    modifiedBy: 'Thorin',
    status: 'pending',
    reason: null,
    claimToken: null,
    claimSession: null,
    claimedAt: null,
    queuedAt: ago(300_000),
    createdAt: ago(300_000),
    updatedAt: ago(30_000),
    ...fields,
  }
}

/** Each mock journal's notes' places in their groups, as Foundry sends them. */
const PLACES = new Map([
  ...placesOf(mockJournalUpdated('personal').journal!.notes),
  ...placesOf(mockJournalUpdated('party').journal!.notes),
])

/** A note as the mirror holds it: at its place in the mock journal, unless said. */
function held(
  page: JournalPage,
  html = 'drawn',
  place = PLACES.get(page.id) ?? 0,
): JournalNote {
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
    place,
  }
}

/** The notes `journal.updated` made, all at once. */
const madeNotes = () =>
  prismaMock.journalNote.createMany.mock.calls.flatMap(
    ([args]) => args?.data as Prisma.JournalNoteCreateManyInput[],
  )

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
    noteFeatures: [],
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

/** The personal mock's notes as the mirror holds them, drawn as they would be. */
const mirrored = (event = mockJournalUpdated('personal')) =>
  event.journal!.notes.map(page =>
    held(
      page,
      page.format === 1
        ? '<p><strong>North</strong> of the river.</p>'
        : 'drawn',
    ),
  )

/** The orders the claim finds, then the same as it hands them over, with their book. */
const waitingOrders = (rows: Partial<JournalOrder>[]) =>
  prismaMock.journalOrder.findMany
    .mockReset()
    .mockResolvedValueOnce(rows.map(row => order(row)) as any)
    .mockResolvedValueOnce(
      rows.map(row => ({
        ...order(row),
        book: { kind: 'party', actorId: 'company' },
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
      // In one go.
      expect(prismaMock.journalNote.createMany).toHaveBeenCalledTimes(1)
      expect(prismaMock.journalNote.create).not.toHaveBeenCalled()
      expect(madeNotes()).toHaveLength(5)
      expect(madeNotes()).toContainEqual({
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
        place: 0,
      })
      // Foundry's HTML is drawn, not kept; a note cut short is said so.
      expect(madeNotes()).toContainEqual(
        expect.objectContaining({
          noteId: NOTE_IDS.map,
          format: 1,
          body: '',
          html: '<p><strong>North</strong> of the river.</p>',
        }),
      )
      expect(madeNotes()).toContainEqual(
        expect.objectContaining({ noteId: NOTE_IDS.long, cut: true }),
      )
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
      expect(madeNotes()).toEqual([
        expect.objectContaining({ noteId: NOTE_IDS.long }),
      ])
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
      expect(prismaMock.journalNote.createMany).not.toHaveBeenCalled()
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
      expect(madeNotes().at(-1)).toEqual(
        expect.objectContaining({
          html: expect.not.stringContaining('traitor'),
        }),
      )

      await applyJournalUpdated(tx, 'c1', page('personal'))
      expect(madeNotes().at(-1)).toEqual(
        expect.objectContaining({
          html: expect.stringContaining('traitor'),
        }),
      )
    })

    it('keeps a party page sent as HTML for its secret marked so', async () => {
      await applyJournalUpdated(tx, 'c1', mockJournalUpdated('party'))

      expect(madeNotes()).toContainEqual(
        expect.objectContaining({
          noteId: NOTE_IDS.traitor,
          format: 1,
          secret: true,
          html: '<p>Keep watch at night.</p>',
        }),
      )
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
      expect(prismaMock.journalNote.createMany).not.toHaveBeenCalled()
    })

    it('never touches a change waiting', async () => {
      await applyJournalUpdated(tx, 'c1', mockJournalUpdated('personal'))

      expect(prismaMock.journalWrite.updateMany).not.toHaveBeenCalled()
      expect(prismaMock.journalWrite.deleteMany).not.toHaveBeenCalled()
    })

    it('keeps the notes drawn ahead, drawing in the transaction only what wasn’t', async () => {
      const event = mockJournalUpdated('personal')
      const [chapter, cave] = event.journal!.notes
      eventBook({ notes: [held({ ...cave, rev: 'ffffffffffffff' }, 'stale')] })
      const drawings = {
        origin: ORIGIN,
        html: new Map([
          [chapter.id, 'chapter drawn ahead'],
          [cave.id, 'cave drawn ahead'],
        ]),
      }

      await applyJournalUpdated(tx, 'c1', event, drawings)

      expect(prismaMock.journalNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ html: 'cave drawn ahead' }),
        }),
      )
      expect(madeNotes()).toContainEqual(
        expect.objectContaining({
          noteId: chapter.id,
          html: 'chapter drawn ahead',
        }),
      )
      // One not drawn ahead is drawn here.
      expect(madeNotes()).toContainEqual(
        expect.objectContaining({
          noteId: NOTE_IDS.map,
          html: '<p><strong>North</strong> of the river.</p>',
        }),
      )

      // Drawn for another origin, as when the campaign's game moved meanwhile: drawn again.
      prismaMock.journalNote.createMany.mockClear()
      eventBook()
      await applyJournalUpdated(tx, 'c1', event, {
        ...drawings,
        origin: 'https://elsewhere.example',
      })
      expect(madeNotes()).toContainEqual(
        expect.objectContaining({
          noteId: chapter.id,
          html: expect.not.stringContaining('ahead'),
        }),
      )
    })
  })

  describe('drawJournal, before the transaction', () => {
    it('draws what the mirror as it is would draw again: new notes, changed ones, and Foundry’s HTML', async () => {
      const event = mockJournalUpdated('personal')
      const [chapter, cave, rumour, map] = event.journal!.notes
      prismaMock.campaign.findUnique.mockResolvedValue({
        origin: ORIGIN,
      } as any)
      prismaMock.journalBook.findUnique.mockResolvedValue({
        notes: [
          held(chapter),
          held({ ...cave, rev: 'ffffffffffffff' }),
          held(rumour),
          held(map),
        ],
      } as any)

      const drawings = await drawJournal('c1', event)

      expect(prismaMock.journalBook.findUnique).toHaveBeenCalledWith({
        where: {
          campaignBook: {
            campaignId: 'c1',
            kind: 'personal',
            actorId: PARTY.thorin,
          },
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
      })
      expect(drawings?.origin).toBe(ORIGIN)
      expect([...drawings!.html.keys()].toSorted()).toEqual(
        [cave.id, map.id, NOTE_IDS.long].toSorted(),
      )
      expect(drawings!.html.get(cave.id)).toContain('<h5>Loot</h5>')
    })

    it('draws nothing for a book held back, or with no journal, or a campaign gone', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        origin: ORIGIN,
      } as any)
      await expect(
        drawJournal('c1', {
          kind: 'party',
          actorId: 'company',
          journal: null,
          withheld: { reason: 'private' },
        }),
      ).resolves.toBeUndefined()
      await expect(
        drawJournal('c1', {
          kind: 'personal',
          actorId: PARTY.thorin,
          journal: null,
        }),
      ).resolves.toBeUndefined()
      prismaMock.campaign.findUnique.mockResolvedValue(null)
      await expect(
        drawJournal('c1', mockJournalUpdated('personal')),
      ).resolves.toBeUndefined()
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
        select: {
          id: true,
          seq: true,
          title: true,
          body: true,
          queuedAt: true,
        },
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

    it('hands a create over as its author, whoever changed it since: the module makes its writer its author', async () => {
      waitingRows([
        // A member's party note still waiting, which the Gamemaster fixed.
        {
          seat: 'gm',
          requestedById: 'gm-1',
          writerActorId: null,
          authorActorId: PARTY.vex,
          authorName: 'Vex',
          modifiedBy: 'Gamemaster',
        },
        // The Gamemaster's note in Thorin's book, which Thorin's player changed.
        {
          id: W2,
          authorActorId: null,
          authorGm: true,
          authorName: 'Gamemaster',
        },
        // A note first written in Foundry, made again after Foundry deleted it: no author to keep.
        {
          id: '33333333-3333-4333-8333-333333333333',
          authorActorId: null,
          authorName: '',
          seat: 'gm',
          requestedById: 'gm-1',
          writerActorId: null,
        },
        {
          id: '44444444-4444-4444-8444-444444444444',
          authorActorId: null,
          authorName: '',
        },
        // A change is the changer's own: the Gamemaster's of Vex's note goes as the Gamemaster's.
        {
          id: '55555555-5555-4555-8555-555555555555',
          op: 'update',
          base: 'abcdef00000001',
          seat: 'gm',
          requestedById: 'gm-1',
          writerActorId: null,
          authorActorId: PARTY.vex,
        },
      ])

      const commands = await claimNoteWrites('c1', 's1')

      expect(
        commands.map(command => [command.by, command.note.writer]),
      ).toEqual([
        [undefined, PARTY.vex],
        ['gm', null],
        ['gm', null],
        [undefined, PARTY.thorin],
        ['gm', null],
      ])
      expect(commands[0]).not.toHaveProperty('by')
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
        chapterId: NOTE_IDS.session,
      } as any)
      prismaMock.journalNote.aggregate.mockResolvedValue({
        _max: { place: 3 },
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

    it('keeps a chapter’s own text from Foundry, where a rename’s book post was lost', async () => {
      prismaMock.journalWrite.findUnique.mockResolvedValue(
        write({
          seq: 2,
          op: 'update',
          noteId: NOTE_IDS.session,
          role: 'chapter',
          chapterId: null,
          title: 'Session one',
          body: '',
          html: '',
          base: 'abcdef00000001',
        }),
      )

      await recordNoteResult(
        'c1',
        result({ note: { id: NOTE_IDS.session, rev: 'abcdef00000009' } }),
      )

      const { update } = prismaMock.journalNote.upsert.mock.calls[0][0]
      expect(update).toMatchObject({
        title: 'Session one',
        revision: 'abcdef00000009',
        modifiedIn: 'app',
      })
      // The text the Gamemaster wrote under it in Foundry stays.
      expect(update.html).toBeUndefined()
      expect(update.body).toBeUndefined()
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
        data: { status, reason: kept, foundryRev: null },
      })
      expect(prismaMock.journalNote.upsert).not.toHaveBeenCalled()
    })

    it('keeps the page’s revision a refusal says, for Use yours where the mirror can’t say it', async () => {
      await recordNoteResult(
        'c1',
        result({
          status: 'failed',
          reason: 'changed',
          note: { id: NOTE_IDS.cave, rev: 'abcdef0000000b' },
        }),
      )

      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
        where: { id: W1, seq: 2, campaignId: 'c1', status: 'claimed' },
        data: {
          status: 'conflict',
          reason: 'changed',
          foundryRev: 'abcdef0000000b',
        },
      })
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

  describe('the order of a group’s notes, from module 0.35.0', () => {
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

    describe('kept from journal.updated', () => {
      beforeEach(() => {
        eventCampaign()
      })

      it('keeps a reorder made in Foundry as new places, and the book’s version one more', async () => {
        const event = mockJournalUpdated('personal')
        eventBook({ notes: mirrored() })
        // The Gamemaster dragged A rumour above The goblin cave in Foundry.
        const [chapter, cave, rumour, ...rest] = event.journal!.notes
        event.journal!.notes = [chapter, rumour, cave, ...rest]

        await applyJournalUpdated(tx, 'c1', event)

        expect(
          prismaMock.journalNote.update.mock.calls.map(([args]) => [
            args.where,
            args.data.place,
          ]),
        ).toEqual([
          // eslint-disable-next-line camelcase -- Prisma's name for the two-part key
          [{ bookId_noteId: { bookId: 'book-1', noteId: NOTE_IDS.rumour } }, 0],
          // eslint-disable-next-line camelcase -- Prisma's name for the two-part key
          [{ bookId_noteId: { bookId: 'book-1', noteId: NOTE_IDS.cave } }, 1],
        ])
        expect(prismaMock.journalBook.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ version: { increment: 1 } }),
          }),
        )
      })

      it('records who last deleted or reordered a page in Foundry, where it’s later than the book’s record', async () => {
        const event = mockJournalUpdated('personal')
        const at = Date.parse('2026-10-22T11:59:00Z')
        event.journal!.changed = { what: 'delete', by: 'Gamemaster', at }

        for (const changedAt of [null, new Date(at - 1)]) {
          prismaMock.journalBook.update.mockClear()
          eventBook({ notes: mirrored(), changedAt })

          await applyJournalUpdated(tx, 'c1', event)

          expect(prismaMock.journalBook.update).toHaveBeenCalledWith({
            where: { id: 'book-1' },
            data: {
              journalId: 'thorinJournal001',
              journalName: "Thorin's notes (Erebor)",
              withheld: Prisma.DbNull,
              syncedAt: new Date(NOW),
              changedAt: new Date(at),
              changedBy: 'Gamemaster',
              changedIn: 'foundry',
              version: { increment: 1 },
            },
          })
        }
      })

      it('records nothing older than the book’s record, or none at all, bumping nothing', async () => {
        const event = mockJournalUpdated('personal')
        const at = Date.parse('2026-10-22T11:59:00Z')

        for (const [changed, changedAt] of [
          [{ what: 'order', by: 'Gamemaster', at }, new Date(at)],
          [{ what: 'order', by: 'Gamemaster', at }, new Date(at + 60_000)],
          [undefined, new Date(at)],
          [undefined, null],
        ] as const) {
          prismaMock.journalBook.update.mockClear()
          event.journal!.changed = changed
          eventBook({ notes: mirrored(), changedAt })

          await applyJournalUpdated(tx, 'c1', event)

          expect(prismaMock.journalBook.update).toHaveBeenCalledWith({
            where: { id: 'book-1' },
            data: {
              journalId: 'thorinJournal001',
              journalName: "Thorin's notes (Erebor)",
              withheld: Prisma.DbNull,
              syncedAt: new Date(NOW),
            },
          })
        }
      })
    })

    describe('handed over with the notes’ changes', () => {
      beforeEach(() => {
        claimCampaign({ noteFeatures: ['orders'] })
        prismaMock.journalWrite.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.journalOrder.updateMany.mockResolvedValue({ count: 1 })
      })

      it('deletes made orders past their hour, first, as made changes are', async () => {
        waitingRows([])
        waitingOrders([])

        await claimNoteWrites('c1', 's1')

        expect(prismaMock.journalOrder.deleteMany).toHaveBeenCalledWith({
          where: {
            campaignId: 'c1',
            status: 'made',
            updatedAt: { lt: ago(MADE_KEPT_FOR) },
          },
        })
      })

      it('hands orders over only to a module whose hello says it takes them', async () => {
        claimCampaign({ noteFeatures: [] })
        waitingRows([{}])
        waitingOrders([{}])

        const commands = await claimNoteWrites('c1', 's1')

        expect(prismaMock.journalOrder.findMany).not.toHaveBeenCalled()
        expect(prismaMock.journalOrder.updateMany).not.toHaveBeenCalled()
        expect(commands.map(({ id }) => id)).toEqual([`${W1}.0`])
      })

      it('finds those waiting, and those unanswered past 75 seconds, the Gamemaster’s only the owner’s, and claims them with the changes’ token', async () => {
        waitingRows([{}])
        waitingOrders([{}])

        await claimNoteWrites('c1', 's1')

        const due = {
          OR: [
            { status: 'pending' },
            { status: 'claimed', claimedAt: { lt: ago(75_000) } },
          ],
        }
        expect(prismaMock.journalOrder.findMany).toHaveBeenNthCalledWith(1, {
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
          select: { id: true, seq: true, queuedAt: true },
        })
        const token =
          prismaMock.journalWrite.updateMany.mock.calls[0][0].data.claimToken
        expect(prismaMock.journalOrder.updateMany).toHaveBeenCalledWith({
          where: { OR: [{ id: O1, seq: 0 }], AND: [due] },
          data: {
            status: 'claimed',
            claimToken: token,
            claimSession: 's1',
            claimedAt: new Date(NOW),
          },
        })
        expect(prismaMock.journalOrder.findMany).toHaveBeenNthCalledWith(2, {
          where: { claimToken: token },
          orderBy: { queuedAt: 'asc' },
          include: { book: { select: { kind: true, actorId: true } } },
        })
      })

      it('hands changes and orders over oldest first across both, a change before an order queued with it', async () => {
        waitingRows([
          { id: W1, queuedAt: ago(600_000) },
          { id: W2, queuedAt: ago(100_000) },
          {
            id: '33333333-3333-4333-8333-333333333333',
            queuedAt: ago(200_000),
          },
        ])
        waitingOrders([
          { id: O1, queuedAt: ago(300_000) },
          { id: O2, queuedAt: ago(200_000) },
        ])

        const commands = await claimNoteWrites('c1', 's1')

        expect(commands.map(({ id }) => id)).toEqual([
          `${W1}.0`,
          `${O1}.0`,
          '33333333-3333-4333-8333-333333333333.0',
          `${O2}.0`,
          `${W2}.0`,
        ])
      })

      it('hands at most five over across both, and counts an order’s characters as none', async () => {
        waitingRows(
          ['1', '2', '3', '4'].map((n, at) => ({
            id: `${n.repeat(8)}-1111-4111-8111-111111111111`,
            queuedAt: ago(600_000 - at),
          })),
        )
        waitingOrders([
          { id: O1, queuedAt: ago(700_000) },
          { id: O2, queuedAt: ago(1000) },
        ])

        await claimNoteWrites('c1', 's1')

        expect(
          prismaMock.journalWrite.updateMany.mock.calls[0][0].where?.OR,
        ).toHaveLength(4)
        expect(
          prismaMock.journalOrder.updateMany.mock.calls[0][0].where?.OR,
        ).toEqual([{ id: O1, seq: 0 }])

        // A change of 300,000 characters, an order, and another: the order costs nothing, the
        // second change is one too many.
        prismaMock.journalWrite.updateMany.mockClear()
        prismaMock.journalOrder.updateMany.mockClear()
        waitingRows([
          { id: W1, body: 'a'.repeat(300_000), queuedAt: ago(600_000) },
          { id: W2, body: 'b'.repeat(300_000), queuedAt: ago(100_000) },
        ])
        waitingOrders([{ id: O1, queuedAt: ago(300_000) }])
        await claimNoteWrites('c1', 's1')
        expect(
          prismaMock.journalWrite.updateMany.mock.calls[0][0].where?.OR,
        ).toEqual([{ id: W1, seq: 0 }])
        expect(
          prismaMock.journalOrder.updateMany.mock.calls[0][0].where?.OR,
        ).toEqual([{ id: O1, seq: 0 }])
      })

      it('hands an order over alone, where no change waits', async () => {
        waitingRows([])
        waitingOrders([{}])

        const commands = await claimNoteWrites('c1', 's1')

        expect(prismaMock.journalWrite.updateMany).not.toHaveBeenCalled()
        expect(commands.map(({ id }) => id)).toEqual([`${O1}.0`])
      })

      it('hands each order over as the module’s note command, with exactly its fields', async () => {
        waitingRows([])
        waitingOrders([
          { seq: 3 },
          {
            id: O2,
            chapterId: '',
            ids: [NOTE_IDS.long, NOTE_IDS.map],
            was: [],
            seat: 'gm',
            requestedById: 'gm-1',
            writerActorId: null,
            modifiedBy: 'Gamemaster',
            queuedAt: ago(100_000),
          },
        ])

        const commands = await claimNoteWrites('c1', 's1')

        const common = { mode: 0, explicit: false, extras: [], dice: [] }
        expect(commands).toEqual([
          {
            id: `${O1}.3`,
            actorId: 'company',
            kind: 'note',
            note: {
              book: 'party',
              op: 'order',
              chapter: NOTE_IDS.session,
              ids: [NOTE_IDS.rumour, NOTE_IDS.cave],
              was: [NOTE_IDS.cave, NOTE_IDS.rumour],
              writer: PARTY.thorin,
              at: NOW - 30_000,
            },
            ...common,
          },
          {
            id: `${O2}.0`,
            actorId: 'company',
            kind: 'note',
            by: 'gm',
            note: {
              book: 'party',
              op: 'order',
              chapter: null,
              ids: [NOTE_IDS.long, NOTE_IDS.map],
              was: [],
              writer: null,
              at: NOW - 30_000,
            },
            ...common,
          },
        ])
        expect(commands[0]).not.toHaveProperty('by')
      })
    })

    describe('what became of an order', () => {
      /** An order's result, as the module posts it. */
      const ordered = (fields: Partial<CommandResult> = {}): CommandResult => ({
        id: `${O1}.2`,
        status: 'done',
        reason: null,
        error: null,
        messageId: null,
        visible: false,
        rolls: [],
        order: {
          chapter: NOTE_IDS.session,
          ids: [NOTE_IDS.rumour, NOTE_IDS.cave],
        },
        ...fields,
      })
      const where = { id: O1, seq: 2, campaignId: 'c1', status: 'claimed' }

      beforeEach(() => {
        // No change of a note has that id: it's an order's.
        prismaMock.journalWrite.updateMany.mockResolvedValue({ count: 0 })
        prismaMock.journalOrder.findUnique.mockResolvedValue({
          bookId: 'book-1',
          chapterId: NOTE_IDS.session,
        } as any)
        prismaMock.journalOrder.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.journalOrder.deleteMany.mockResolvedValue({ count: 1 })
        prismaMock.journalNote.findMany.mockResolvedValue([])
      })

      it('marks the order handed over under that id and number made, by id, number and campaign, and bumps its book', async () => {
        await recordNoteResult('c1', ordered())

        expect(prismaMock.journalOrder.updateMany).toHaveBeenCalledWith({
          where,
          data: { status: 'made', reason: null },
        })
        expect(prismaMock.journalBook.update).toHaveBeenCalledWith({
          where: { id: 'book-1' },
          data: { version: { increment: 1 } },
        })
      })

      it('sets the mirror’s places of the group from the order made, where the book’s post was lost', async () => {
        prismaMock.journalNote.findMany.mockResolvedValue([
          {
            noteId: NOTE_IDS.cave,
            role: 'entry',
            chapterId: NOTE_IDS.session,
            place: 0,
          },
          {
            noteId: NOTE_IDS.rumour,
            role: 'entry',
            chapterId: NOTE_IDS.session,
            place: 1,
          },
          // Moved out of the group since, and a chapter: neither is placed.
          { noteId: NOTE_IDS.map, role: 'entry', chapterId: null, place: 0 },
        ] as any)

        await recordNoteResult(
          'c1',
          ordered({
            order: {
              chapter: NOTE_IDS.session,
              ids: [
                NOTE_IDS.rumour,
                NOTE_IDS.map,
                NOTE_IDS.cave,
                NOTE_IDS.long,
              ],
            },
          }),
        )

        expect(prismaMock.journalNote.findMany).toHaveBeenCalledWith({
          where: {
            bookId: 'book-1',
            noteId: {
              in: [NOTE_IDS.rumour, NOTE_IDS.map, NOTE_IDS.cave, NOTE_IDS.long],
            },
          },
          select: { noteId: true, role: true, chapterId: true, place: true },
        })
        expect(prismaMock.journalNote.update.mock.calls).toEqual([
          [
            {
              where: {
                // eslint-disable-next-line camelcase -- Prisma's name for the two-part key
                bookId_noteId: { bookId: 'book-1', noteId: NOTE_IDS.rumour },
              },
              data: { place: 0 },
            },
          ],
          [
            {
              where: {
                // eslint-disable-next-line camelcase -- Prisma's name for the two-part key
                bookId_noteId: { bookId: 'book-1', noteId: NOTE_IDS.cave },
              },
              data: { place: 1 },
            },
          ],
        ])
      })

      it('moves no place where the book came first, as it does', async () => {
        prismaMock.journalNote.findMany.mockResolvedValue([
          {
            noteId: NOTE_IDS.rumour,
            role: 'entry',
            chapterId: NOTE_IDS.session,
            place: 0,
          },
          {
            noteId: NOTE_IDS.cave,
            role: 'entry',
            chapterId: NOTE_IDS.session,
            place: 1,
          },
        ] as any)

        await recordNoteResult('c1', ordered())
        await recordNoteResult('c1', ordered({ order: undefined }))

        expect(prismaMock.journalNote.update).not.toHaveBeenCalled()
        expect(prismaMock.journalNote.findMany).toHaveBeenCalledTimes(1)
      })

      it.each([
        ['changed', 'conflict', 'changed'],
        ['not-member', 'failed', 'not-member'],
        ['off', 'failed', 'off'],
        ['invalid', 'failed', 'invalid'],
        ['unknown', 'failed', 'unknown'],
        ['private', 'failed', 'private'],
        ['error', 'failed', 'error'],
        ['strange', 'failed', 'error'],
        [null, 'failed', 'error'],
      ])('keeps a refusal for %s as %s', async (reason, status, kept) => {
        await recordNoteResult(
          'c1',
          ordered({ status: 'failed', reason, order: undefined }),
        )

        expect(prismaMock.journalOrder.updateMany).toHaveBeenCalledWith({
          where,
          data: { status, reason: kept },
        })
        expect(prismaMock.journalOrder.deleteMany).not.toHaveBeenCalled()
        expect(prismaMock.journalNote.update).not.toHaveBeenCalled()
        expect(prismaMock.journalBook.update).toHaveBeenCalledTimes(1)
      })

      it('drops an order whose chapter is gone, with nothing to choose', async () => {
        await recordNoteResult(
          'c1',
          ordered({ status: 'failed', reason: 'gone' }),
        )

        expect(prismaMock.journalOrder.deleteMany).toHaveBeenCalledWith({
          where,
        })
        expect(prismaMock.journalOrder.updateMany).not.toHaveBeenCalled()
        expect(prismaMock.journalBook.update).toHaveBeenCalledWith({
          where: { id: 'book-1' },
          data: { version: { increment: 1 } },
        })
      })

      it('changes nothing for a result for an earlier hand-over, the order since moved on', async () => {
        prismaMock.journalOrder.updateMany.mockResolvedValue({ count: 0 })
        prismaMock.journalOrder.deleteMany.mockResolvedValue({ count: 0 })

        await recordNoteResult('c1', ordered())
        await recordNoteResult(
          'c1',
          ordered({ status: 'failed', reason: 'gone' }),
        )

        expect(prismaMock.journalNote.findMany).not.toHaveBeenCalled()
        expect(prismaMock.journalBook.update).not.toHaveBeenCalled()
      })

      it('changes nothing for a result neither a change nor an order has, nor for a timeout', async () => {
        prismaMock.journalOrder.findUnique.mockResolvedValue(null)
        await recordNoteResult('c1', ordered())
        expect(prismaMock.journalOrder.updateMany).not.toHaveBeenCalled()

        await recordNoteResult(
          'c1',
          ordered({ status: 'failed', reason: 'timeout' }),
        )
        expect(prismaMock.journalOrder.findUnique).toHaveBeenCalledTimes(1)
        expect(prismaMock.journalBook.update).not.toHaveBeenCalled()
      })
    })

    describe('a note made where the book’s post was lost', () => {
      beforeEach(() => {
        prismaMock.journalWrite.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.journalNote.aggregate.mockResolvedValue({
          _max: { place: 3 },
        } as any)
      })

      it('lands a new note last in its group', async () => {
        prismaMock.journalWrite.findUnique.mockResolvedValue(write({ seq: 2 }))
        prismaMock.journalNote.findUnique.mockResolvedValue(null)

        await recordNoteResult('c1', result())

        expect(prismaMock.journalNote.aggregate).toHaveBeenCalledWith({
          where: {
            bookId: 'book-1',
            role: 'entry',
            chapterId: NOTE_IDS.session,
            noteId: { not: NOTE_IDS.cave },
          },
          _max: { place: true },
        })
        const { create, update } =
          prismaMock.journalNote.upsert.mock.calls[0][0]
        expect(create).toMatchObject({ place: 4 })
        expect(update).toMatchObject({ place: 4 })
      })

      it('lands a note moved last in its new group, the first there at 0, and leaves one that stays where it is', async () => {
        prismaMock.journalWrite.findUnique.mockResolvedValue(
          write({
            seq: 2,
            op: 'update',
            base: 'abcdef00000001',
            chapterId: null,
          }),
        )
        prismaMock.journalNote.findUnique.mockResolvedValue({
          revision: 'abcdef00000001',
          chapterId: NOTE_IDS.session,
        } as any)
        prismaMock.journalNote.aggregate.mockResolvedValue({
          _max: { place: null },
        } as any)

        await recordNoteResult('c1', result())

        expect(prismaMock.journalNote.aggregate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ chapterId: null }),
          }),
        )
        expect(
          prismaMock.journalNote.upsert.mock.calls[0][0].update,
        ).toMatchObject({
          place: 0,
        })

        // Changed in place: its place stays.
        prismaMock.journalNote.aggregate.mockClear()
        prismaMock.journalNote.upsert.mockClear()
        prismaMock.journalWrite.findUnique.mockResolvedValue(
          write({ seq: 2, op: 'update', base: 'abcdef00000001' }),
        )
        await recordNoteResult('c1', result())
        expect(prismaMock.journalNote.aggregate).not.toHaveBeenCalled()
        expect(
          prismaMock.journalNote.upsert.mock.calls[0][0].update,
        ).not.toHaveProperty('place')
      })
    })
  })
})
