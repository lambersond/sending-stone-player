/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- Prisma uses null for an absent value */
import {
  Prisma,
  type JournalNote,
  type JournalOrder,
  type JournalWrite,
} from '@prisma/client'
import { prismaMock } from '../../jest.setup'
import { claimNoteWrites, recordNoteResult } from './note-sync'
import {
  changeNote,
  createNote,
  deleteNote,
  getNotesStatus,
  getNotesView,
  noteRights,
  previewNote,
  reorderNotes,
  resolveNote,
  resolveOrder,
  type NotesBook,
  type NotesSeat,
} from './notes'

const NOW = Date.parse('2026-10-22T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)
const ORIGIN = 'https://my-game.forge-vtt.com'

const THORIN = 'thorin'
const VEX = 'vex'
const SESSION = 'sessionChapter01'
const ROAD = 'roadToEreborCh01'
const CAVE = 'goblinCaveNote01'
const RUMOUR = 'rumourInFoundry1'
const W1 = '11111111-1111-4111-8111-111111111111'
const REV = 'abcdef00000001'

const thorin: NotesSeat = {
  role: 'player',
  userId: 'user-1',
  actorId: THORIN,
  name: 'Thorin',
}
const vex: NotesSeat = {
  role: 'player',
  userId: 'user-2',
  actorId: VEX,
  name: 'Vex',
}
const gm: NotesSeat = {
  role: 'gm',
  userId: 'gm-1',
  actorId: null,
  name: 'Gamemaster',
}
const personal: NotesBook = {
  campaignId: 'c1',
  kind: 'personal',
  actorId: THORIN,
  private: false,
}
const party: NotesBook = {
  campaignId: 'c1',
  kind: 'party',
  actorId: 'company',
  private: false,
}

/** A note as Foundry last held it: one of Thorin's, written in the app. */
function mirror(fields: Partial<JournalNote> = {}): JournalNote {
  return {
    bookId: 'book-1',
    noteId: CAVE,
    role: 'entry',
    chapterId: null,
    title: 'The goblin cave',
    format: 2,
    body: '### Loot',
    html: '<h5>Loot</h5>',
    cut: false,
    secret: false,
    authorActorId: THORIN,
    authorGm: false,
    authorName: 'Thorin',
    createdAt: ago(3_600_000),
    modifiedAt: ago(1_800_000),
    modifiedBy: 'Thorin',
    modifiedIn: 'app',
    revision: REV,
    place: 0,
    ...fields,
  }
}

/** A change made here, waiting for the game: Thorin's edit of his note. */
function write(fields: Partial<JournalWrite> = {}): JournalWrite {
  return {
    id: W1,
    seq: 2,
    campaignId: 'c1',
    bookId: 'book-1',
    noteId: CAVE,
    op: 'update',
    role: 'entry',
    chapterId: null,
    title: 'Goblin cave',
    body: '### Loot, all of it',
    html: '<h5>Loot, all of it</h5>',
    authorActorId: THORIN,
    authorGm: false,
    authorName: 'Thorin',
    noteCreatedAt: ago(3_600_000),
    seat: 'player',
    requestedById: 'user-1',
    writerActorId: THORIN,
    modifiedAt: ago(60_000),
    modifiedBy: 'Thorin',
    base: REV,
    status: 'pending',
    reason: null,
    foundryRev: null,
    claimToken: null,
    claimSession: null,
    claimedAt: null,
    queuedAt: ago(120_000),
    createdAt: ago(120_000),
    updatedAt: ago(60_000),
    ...fields,
  }
}

/** The campaign as held: Thorin and Vex in its roster, its game taking notes now. */
const heldCampaign = (fields: object = {}) =>
  prismaMock.campaign.findUnique.mockResolvedValue({
    origin: ORIGIN,
    characters: [
      { id: THORIN, name: 'Thorin' },
      { id: VEX, name: 'Vex' },
    ],
    notesEnabled: true,
    noteFeatures: ['orders'],
    bridgePolledAt: ago(5000),
    ...fields,
  } as any)

/** The book as held, with these notes and changes. */
const heldBook = ({
  notes = [] as JournalNote[],
  writes = [] as JournalWrite[],
  ...fields
}: {
  notes?: JournalNote[]
  writes?: JournalWrite[]
  [field: string]: unknown
} = {}) =>
  prismaMock.journalBook.findUnique.mockResolvedValue({
    id: 'book-1',
    version: 4,
    journalName: "Thorin's notes (Erebor)",
    withheld: null,
    notes,
    writes,
    ...fields,
  } as any)

const taken = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6',
  })

/** The one entry of a party book as an editor (Thorin, its author) and as another (Vex). */
const seenInParty = async (
  note: JournalNote | undefined,
  change: JournalWrite | undefined,
) => {
  heldBook({
    notes: note ? [note] : [],
    writes: change ? [change] : [],
  })
  const [editor, other] = await Promise.all([
    getNotesView(thorin, party),
    getNotesView(vex, party),
  ])
  return { editor: editor?.entries[0], other: other?.entries[0] }
}

/** A change to Thorin’s cave note, from Foundry’s revision. */
const aChange = (fields: object = {}) => ({
  title: 'Goblin cave',
  body: 'Rope and a key.',
  stamp: `n:${REV}`,
  ...fields,
})

/** A change's row as the last compare-and-set left it. */
const after = (row: JournalWrite) =>
  ({
    ...row,
    ...(prismaMock.journalWrite.updateMany.mock.calls.at(-1)![0]
      .data as object),
    seq: row.seq + 1,
  }) as JournalWrite

/** A change's row handed over, as the module fetches it from a party's book. */
const handed = async (row: JournalWrite) => {
  heldCampaign({ helloSession: 's1', ownerId: 'gm-1' })
  prismaMock.journalOrder.findMany.mockResolvedValue([])
  prismaMock.journalWrite.findMany
    .mockResolvedValueOnce([row] as any)
    .mockResolvedValueOnce([
      { ...row, book: { kind: 'party', actorId: 'company' } },
    ] as any)
  const [command] = await claimNoteWrites('c1', 's1')
  return command
}

// The Iron Company's Session 1 holds Thorin's note, Vex's, the Gamemaster's and one written in
// Foundry, in that order in Foundry, though written in another; and two notes in no chapter.
const A = 'aThorinNote00001'
const B = 'bVexNote00000001'
const C = 'cGmNote000000001'
const D = 'dFoundryNote0001'
const L1 = 'looseNote0000001'
const L2 = 'looseNote0000002'
const O1 = '99999999-9999-4999-8999-999999999999'
const MIRRORED = [A, B, C, D]

const chapter = (fields: Partial<JournalNote> = {}) =>
  mirror({
    noteId: SESSION,
    role: 'chapter',
    title: 'Session 1',
    body: '',
    html: '',
    createdAt: ago(86_400_000),
    modifiedAt: ago(86_400_000),
    ...fields,
  })
const partyNotes = () => [
  chapter(),
  mirror({
    noteId: A,
    chapterId: SESSION,
    place: 0,
    createdAt: ago(10_000),
  }),
  mirror({
    noteId: B,
    chapterId: SESSION,
    place: 1,
    authorActorId: VEX,
    authorName: 'Vex',
    modifiedBy: 'Vex',
    createdAt: ago(40_000),
  }),
  mirror({
    noteId: C,
    chapterId: SESSION,
    place: 2,
    authorActorId: null,
    authorGm: true,
    authorName: 'Gamemaster',
    modifiedBy: 'Gamemaster',
    createdAt: ago(30_000),
  }),
  mirror({
    noteId: D,
    chapterId: SESSION,
    place: 3,
    authorActorId: null,
    authorName: null,
    modifiedBy: 'Gamemaster',
    modifiedIn: 'foundry',
    createdAt: ago(20_000),
  }),
  mirror({ noteId: L1, place: 0, createdAt: ago(50_000) }),
  mirror({ noteId: L2, place: 1, createdAt: ago(60_000) }),
]

/** Thorin's order of Session 1, made here: Foundry's note first. */
function order(fields: Partial<JournalOrder> = {}): JournalOrder {
  return {
    id: O1,
    seq: 1,
    campaignId: 'c1',
    bookId: 'book-1',
    chapterId: SESSION,
    ids: [D, C, B, A],
    was: MIRRORED,
    seat: 'player',
    requestedById: 'user-1',
    writerActorId: THORIN,
    modifiedAt: ago(60_000),
    modifiedBy: 'Thorin',
    status: 'pending',
    reason: null,
    claimToken: null,
    claimSession: null,
    claimedAt: null,
    queuedAt: ago(60_000),
    createdAt: ago(120_000),
    updatedAt: ago(60_000),
    ...fields,
  }
}

/** The company's book, with these orders and changes. */
const held = ({
  orders = [] as JournalOrder[],
  notes = partyNotes(),
  writes = [] as JournalWrite[],
  ...fields
}: {
  orders?: JournalOrder[]
  notes?: JournalNote[]
  writes?: JournalWrite[]
  [field: string]: unknown
} = {}) => heldBook({ notes, writes, orders, ...fields })

/** A group as a seat sees it now: Session 1, unless said. */
const groupOf = async (seat: NotesSeat, chapterId: string | null = SESSION) => {
  const view = await getNotesView(seat, party)
  return {
    group: view!.groups.find(group => group.chapterId === chapterId)!,
    ids: view!.entries
      .filter(entry => entry.chapterId === chapterId)
      .map(({ id }) => id),
  }
}

/** A new order of a group from what the seat sees of it now. */
const reorder = async (
  seat: NotesSeat,
  ids: string[],
  chapterId: string | null = SESSION,
) => {
  const { group } = await groupOf(seat, chapterId)
  return reorderNotes(seat, party, { chapterId, ids, stamp: group.stamp })
}

/** What the book's row was last bumped with, made or updated. */
const bumped = () => prismaMock.journalBook.upsert.mock.calls.at(-1)![0]

/** A group's stamp as a seat sees it now: Session 1's. */
async function stampOf(seat: NotesSeat = thorin) {
  const { group } = await groupOf(seat)
  return group.stamp
}

/** What the last compare-and-set of an order was. */
const folded = () => prismaMock.journalOrder.updateMany.mock.calls.at(-1)![0]

/** Thorin's order of Session 1 refused, as Foundry's notes were reordered meanwhile. */
const refused = (fields: Partial<JournalOrder> = {}) =>
  held({
    orders: [order({ status: 'conflict', reason: 'changed', ...fields })],
  })

/** A seat's choice on a group's refused order, from what it sees of the group now. */
async function choose(
  seat: NotesSeat,
  resolve: 'mine' | 'theirs',
  chapterId: string | null = SESSION,
) {
  const view = await getNotesView(seat, party)
  const stamp =
    view?.groups.find(group => group.chapterId === chapterId)?.stamp ?? 'g:0'
  return resolveOrder(seat, party, { chapterId, resolve, stamp })
}

/** A group's notes as a seat sees them now, in the order shown: Session 1's, unless said. */
async function shownIds(seat: NotesSeat, chapterId: string | null = SESSION) {
  const { ids } = await groupOf(seat, chapterId)
  return ids
}

/** A group's view for a seat now: Session 1's, unless said. */
async function groupView(seat: NotesSeat, chapterId: string | null = SESSION) {
  const { group } = await groupOf(seat, chapterId)
  return group
}

/**
 * A read-only book refusing a seat's order of Session 1: a new order, and the order already shown,
 * which would write nothing, refused all the same, before the stamp or the notes are looked at
 * (§7.7 step 3).
 */
async function refusesReadOnly(
  seat: NotesSeat,
  book: NotesBook,
  reason: string,
) {
  const view = await getNotesView(seat, book)
  expect(view?.canReorder).toBe(false)
  const { stamp } = view!.groups.find(group => group.chapterId === SESSION)!
  const shown = view!.entries
    .filter(entry => entry.chapterId === SESSION)
    .map(({ id }) => id)
  expect(shown).toEqual(MIRRORED)
  for (const ids of [[D, C, B, A], shown]) {
    await expect(
      reorderNotes(seat, book, { chapterId: SESSION, ids, stamp }),
    ).resolves.toEqual({ ok: false, status: 409, reason })
  }
}

describe('db/notes', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    heldCampaign()
    heldBook()
    prismaMock.$transaction.mockImplementation((run: any) => run(prismaMock))
    prismaMock.journalBook.upsert.mockResolvedValue({ id: 'book-1' } as any)
    prismaMock.journalWrite.count.mockResolvedValue(0)
    prismaMock.journalOrder.count.mockResolvedValue(0)
    prismaMock.journalWrite.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.journalWrite.deleteMany.mockResolvedValue({ count: 1 })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('noteRights', () => {
    const book = { kind: 'personal' as const, private: false, connected: true }
    const entry = (authorActorId: string | null) => ({
      role: 'entry' as const,
      authorActorId,
    })

    it('lets the character’s player and the Gamemaster do anything in its own book', () => {
      for (const seat of [thorin, gm]) {
        expect(noteRights(book, seat, entry(null))).toEqual({
          canAdd: true,
          canRename: true,
          canEdit: true,
          canDelete: true,
          canReorder: true,
        })
      }
    })

    it('lets a party member change their own entries, the Gamemaster any, and Foundry’s only the Gamemaster', () => {
      const company = { ...book, kind: 'party' as const }

      expect(noteRights(company, thorin, entry(THORIN)).canEdit).toBe(true)
      expect(noteRights(company, vex, entry(THORIN))).toEqual({
        canAdd: true,
        canRename: true,
        canEdit: false,
        canDelete: false,
        canReorder: true,
      })
      expect(noteRights(company, gm, entry(THORIN)).canDelete).toBe(true)
      expect(noteRights(company, thorin, entry(null)).canEdit).toBe(false)
      expect(noteRights(company, gm, entry(null)).canEdit).toBe(true)
    })

    it('never deletes a chapter, and lets any seat rename one', () => {
      expect(
        noteRights({ ...book, kind: 'party' }, vex, {
          role: 'chapter',
          authorActorId: THORIN,
        }),
      ).toEqual({
        canAdd: true,
        canRename: true,
        canEdit: false,
        canDelete: false,
        canReorder: true,
      })
    })

    it('adds nothing to a private party’s book, or one whose actor left the campaign', () => {
      expect(
        noteRights({ ...book, kind: 'party', private: true }, gm).canAdd,
      ).toBe(false)
      expect(noteRights({ ...book, connected: false }, thorin).canAdd).toBe(
        false,
      )
    })

    it('lets every seat at a book put any group’s notes in order, whoever wrote them, while it takes notes (module 0.35.0)', () => {
      const company = { ...book, kind: 'party' as const }
      for (const seat of [thorin, vex, gm]) {
        for (const author of [THORIN, VEX, null]) {
          expect(noteRights(company, seat, entry(author)).canReorder).toBe(true)
        }
      }
      expect(
        noteRights({ ...company, private: true }, gm, entry(null)).canReorder,
      ).toBe(false)
      expect(noteRights({ ...book, connected: false }, thorin).canReorder).toBe(
        false,
      )
    })
  })

  describe('getNotesView', () => {
    it('is an empty book at version 0 where none was written, and makes none', async () => {
      prismaMock.journalBook.findUnique.mockResolvedValue(null)

      await expect(getNotesView(thorin, personal)).resolves.toEqual({
        version: 0,
        kind: 'personal',
        journal: null,
        live: true,
        enabled: true,
        canAdd: true,
        connected: true,
        canReorder: true,
        orders: true,
        chapters: [],
        groups: [
          {
            chapterId: null,
            state: 'synced',
            stamp: expect.stringMatching(/^g:[\da-f]{16}$/),
          },
        ],
        entries: [],
      })
      expect(prismaMock.journalBook.upsert).not.toHaveBeenCalled()
    })

    it('says whether the game takes notes now, and whether its module keeps them', async () => {
      heldCampaign({ bridgePolledAt: ago(60_000) })
      await expect(getNotesView(thorin, personal)).resolves.toMatchObject({
        live: false,
        enabled: true,
      })
      heldCampaign({ notesEnabled: false })
      await expect(getNotesView(thorin, personal)).resolves.toMatchObject({
        live: false,
        enabled: false,
      })
    })

    it('lists chapters and entries apart, oldest first, an entry in no shown chapter in none', async () => {
      heldBook({
        notes: [
          mirror({ noteId: 'bbbbbbbbbbbbbbb2', createdAt: ago(1000) }),
          mirror({
            noteId: SESSION,
            role: 'chapter',
            title: 'Session 1',
            body: '',
            html: '<p>Under it, in Foundry.</p>',
            createdAt: ago(5000),
          }),
          mirror({ noteId: 'aaaaaaaaaaaaaaa1', createdAt: ago(1000) }),
          mirror({ noteId: 'ccccccccccccccc3', createdAt: ago(9000) }),
          mirror({
            noteId: 'ddddddddddddddd4',
            chapterId: 'nowhereChapter01',
            createdAt: ago(500),
          }),
        ],
      })

      const view = await getNotesView(thorin, personal)

      expect(view?.chapters).toEqual([
        expect.objectContaining({
          id: SESSION,
          title: 'Session 1',
          html: '<p>Under it, in Foundry.</p>',
          state: 'synced',
          canRename: true,
          stamp: `n:${REV}`,
        }),
      ])
      expect(view?.entries.map(({ id }) => id)).toEqual([
        'ccccccccccccccc3',
        'aaaaaaaaaaaaaaa1',
        'bbbbbbbbbbbbbbb2',
        'ddddddddddddddd4',
      ])
      expect(view?.entries[3].chapterId).toBeNull()
      expect(view?.version).toBe(4)
      expect(view?.journal).toBe("Thorin's notes (Erebor)")
    })

    it('describes an entry: who wrote and last changed it, when and where', async () => {
      heldBook({
        notes: [
          mirror(),
          mirror({
            noteId: RUMOUR,
            authorActorId: null,
            authorName: null,
            modifiedIn: 'foundry',
            modifiedBy: 'Gamemaster',
          }),
        ],
      })

      const view = await getNotesView(thorin, personal)

      expect(view?.entries[0]).toEqual({
        id: CAVE,
        chapterId: null,
        title: 'The goblin cave',
        html: '<h5>Loot</h5>',
        body: '### Loot',
        createdAt: ago(3_600_000).toISOString(),
        author: { name: 'Thorin' },
        modifiedAt: ago(1_800_000).toISOString(),
        modifiedBy: 'Thorin',
        modifiedIn: 'app',
        state: 'synced',
        canEdit: true,
        canDelete: true,
        stamp: `n:${REV}`,
      })
      expect(view?.entries[1]).toMatchObject({
        author: null,
        modifiedIn: 'foundry',
        modifiedBy: 'Gamemaster',
      })
    })

    it('gives an entry’s Markdown only to a seat that may change it', async () => {
      heldBook({ notes: [mirror()] })
      const company = { ...party }

      const theirs = await getNotesView(vex, company)
      const own = await getNotesView(thorin, company)
      const gms = await getNotesView(gm, company)

      expect(theirs?.entries[0]).not.toHaveProperty('body')
      expect(theirs?.entries[0]).toMatchObject({
        html: '<h5>Loot</h5>',
        canEdit: false,
        canDelete: false,
      })
      expect(own?.entries[0].body).toBe('### Loot')
      expect(gms?.entries[0].body).toBe('### Loot')
    })

    it.each<[string, Partial<JournalNote>, string]>([
      ['written in Foundry’s own editor', { format: 1, body: '' }, 'html'],
      [
        'sent as HTML for its secret',
        { format: 1, body: '', secret: true },
        'secret',
      ],
      ['cut short', { cut: true }, 'long'],
      ['over 20,000 characters', { body: 'a'.repeat(20_001) }, 'long'],
      ['titled over 200', { title: 't'.repeat(201) }, 'long'],
    ])(
      'shows an entry %s as changed only in Foundry, with no Markdown',
      async (_name, fields, why) => {
        heldBook({ notes: [mirror(fields)] })

        const view = await getNotesView(thorin, personal)

        expect(view?.entries[0].foundryOnly).toBe(why)
        expect(view?.entries[0]).not.toHaveProperty('body')
      },
    )

    it('shows a private party as withheld though Foundry said nothing yet, and takes no notes', async () => {
      heldBook({ notes: [mirror()] })

      const view = await getNotesView(gm, { ...party, private: true })

      expect(view).toMatchObject({
        withheld: { reason: 'private' },
        canAdd: false,
        connected: true,
      })
      expect(view?.entries).toHaveLength(1)
    })

    it('says a book is held back as too large, as Foundry said', async () => {
      heldBook({
        withheld: { reason: 'tooLarge', bytes: 1_200_000, limit: 1_000_000 },
      })

      await expect(getNotesView(thorin, personal)).resolves.toMatchObject({
        withheld: { reason: 'tooLarge', bytes: 1_200_000, limit: 1_000_000 },
      })
    })

    it('reads a character no longer in the campaign as not connected: nothing changes', async () => {
      heldCampaign({ characters: [{ id: VEX, name: 'Vex' }] })

      await expect(getNotesView(thorin, personal)).resolves.toMatchObject({
        connected: false,
        canAdd: false,
      })
    })

    describe('a note and its change, row by row (§8.8)', () => {
      it('none, or made: Foundry’s, synced, to both', async () => {
        for (const change of [undefined, write({ status: 'made' })]) {
          const { editor, other } = await seenInParty(mirror(), change)
          expect(editor).toMatchObject({
            title: 'The goblin cave',
            state: 'synced',
            stamp: `n:${REV}`,
          })
          expect(other).toMatchObject({
            title: 'The goblin cave',
            state: 'synced',
          })
        }
      })

      it('waiting or on its way, a create or a change: the change, to both, as the app’s', async () => {
        for (const status of ['pending', 'claimed'] as const) {
          for (const op of ['create', 'update'] as const) {
            const { editor, other } = await seenInParty(
              op === 'update' ? mirror() : undefined,
              write({ status, op }),
            )
            for (const entry of [editor, other]) {
              expect(entry).toMatchObject({
                title: 'Goblin cave',
                html: '<h5>Loot, all of it</h5>',
                state: 'saving',
                modifiedIn: 'app',
                modifiedBy: 'Thorin',
                modifiedAt: ago(60_000).toISOString(),
                stamp: `w:${W1}.2`,
              })
            }
            expect(editor?.body).toBe('### Loot, all of it')
            expect(other).not.toHaveProperty('body')
          }
        }
      })

      it('waits, rather than saves, while the game isn’t taking notes', async () => {
        heldCampaign({ bridgePolledAt: null })
        const { editor } = await seenInParty(mirror(), write())
        expect(editor?.state).toBe('waiting')
      })

      it('a delete waiting: Foundry’s, deleting, to the editor; hidden from another', async () => {
        const { editor, other } = await seenInParty(
          mirror(),
          write({ op: 'delete' }),
        )
        expect(editor).toMatchObject({
          title: 'The goblin cave',
          state: 'deleting',
          stamp: `w:${W1}.2`,
        })
        expect(other).toBeUndefined()
      })

      it('changed in Foundry: Foundry’s, with the change beside it, to the editor; Foundry’s to another', async () => {
        const { editor, other } = await seenInParty(
          mirror(),
          write({ status: 'conflict', reason: 'changed' }),
        )
        expect(editor).toMatchObject({
          title: 'The goblin cave',
          state: 'conflict',
          reason: 'changed',
          mine: {
            title: 'Goblin cave',
            html: '<h5>Loot, all of it</h5>',
            body: '### Loot, all of it',
            chapterId: null,
          },
        })
        expect(editor?.mine).not.toHaveProperty('by')
        expect(other).toMatchObject({
          title: 'The goblin cave',
          state: 'synced',
        })
        expect(other).not.toHaveProperty('mine')
      })

      it('a delete that met a change in Foundry: the change marked deleting', async () => {
        const { editor } = await seenInParty(
          mirror(),
          write({ op: 'delete', status: 'conflict', reason: 'changed' }),
        )
        expect(editor?.mine).toMatchObject({ deleting: true })
      })

      it('deleted in Foundry: the change, gone, to the editor; hidden from another', async () => {
        const { editor, other } = await seenInParty(
          undefined,
          write({ status: 'conflict', reason: 'gone' }),
        )
        expect(editor).toMatchObject({
          title: 'Goblin cave',
          state: 'gone',
          reason: 'gone',
          mine: { title: 'Goblin cave' },
        })
        expect(other).toBeUndefined()
      })

      it('refused: Foundry’s, failed, with why, to the editor; Foundry’s to another', async () => {
        const { editor, other } = await seenInParty(
          mirror(),
          write({ status: 'failed', reason: 'not-member' }),
        )
        expect(editor).toMatchObject({
          title: 'The goblin cave',
          state: 'failed',
          reason: 'not-member',
          mine: { title: 'Goblin cave' },
        })
        expect(other).toMatchObject({ state: 'synced' })
      })

      it('a refused create: the change, failed, to the editor; hidden from another', async () => {
        const { editor, other } = await seenInParty(
          undefined,
          write({ op: 'create', status: 'failed', reason: 'mystery' }),
        )
        expect(editor).toMatchObject({
          title: 'Goblin cave',
          state: 'failed',
          reason: 'error',
        })
        expect(other).toBeUndefined()
      })

      it('names whose change it is for the Gamemaster, and not for its own seat', async () => {
        heldBook({
          notes: [mirror()],
          writes: [write({ status: 'conflict', reason: 'changed' })],
        })
        const view = await getNotesView(gm, party)
        expect(view?.entries[0].mine).toMatchObject({ by: 'Thorin' })
      })

      it('shows a chapter renamed and waiting, keeping its own text from Foundry', async () => {
        heldBook({
          notes: [
            mirror({
              noteId: ROAD,
              role: 'chapter',
              title: 'Road',
              body: '',
              html: '<p>Its text.</p>',
            }),
          ],
          writes: [
            write({
              noteId: ROAD,
              role: 'chapter',
              title: 'Road to Erebor',
              body: '',
              html: '',
              status: 'failed',
              reason: 'error',
              requestedById: 'user-2',
              modifiedBy: 'Vex',
            }),
          ],
        })

        const view = await getNotesView(gm, party)

        expect(view?.chapters[0]).toMatchObject({
          title: 'Road',
          html: '<p>Its text.</p>',
          state: 'failed',
          mine: { title: 'Road to Erebor', by: 'Vex' },
        })
      })
    })
  })

  describe('getNotesStatus', () => {
    it('says the book’s version, and whether the game takes notes now', async () => {
      await expect(getNotesStatus(personal)).resolves.toEqual({
        version: 4,
        live: true,
      })
      prismaMock.journalBook.findUnique.mockResolvedValue(null)
      heldCampaign({ bridgePolledAt: null })
      await expect(getNotesStatus(personal)).resolves.toEqual({
        version: 0,
        live: false,
      })
      prismaMock.campaign.findUnique.mockResolvedValue(null)
      await expect(getNotesStatus(personal)).resolves.toBeUndefined()
    })
  })

  describe('createNote (§8.7)', () => {
    it('stores an entry at once, made here with its own id, and bumps the book', async () => {
      heldBook({ notes: [mirror({ noteId: SESSION, role: 'chapter' })] })

      const answer = await createNote(thorin, personal, {
        role: 'entry',
        title: 'Wolves',
        body: '### Three',
        chapterId: SESSION,
      })

      expect(answer).toEqual({
        ok: true,
        id: expect.stringMatching(/^[A-Za-z0-9]{16}$/),
        stamp: expect.stringMatching(/^w:[\da-f-]{36}\.0$/),
      })
      const id = answer.ok ? answer.id : ''
      expect(prismaMock.journalBook.upsert).toHaveBeenCalledWith({
        where: {
          campaignBook: { campaignId: 'c1', kind: 'personal', actorId: THORIN },
        },
        create: {
          campaignId: 'c1',
          kind: 'personal',
          actorId: THORIN,
          version: 1,
        },
        update: { version: { increment: 1 } },
        select: { id: true },
      })
      expect(prismaMock.journalWrite.create).toHaveBeenCalledWith({
        data: {
          id: expect.stringMatching(/^[\da-f-]{36}$/),
          seq: 0,
          campaignId: 'c1',
          bookId: 'book-1',
          noteId: id,
          op: 'create',
          role: 'entry',
          chapterId: SESSION,
          title: 'Wolves',
          body: '### Three',
          html: '<h5>Three</h5>',
          authorActorId: THORIN,
          authorGm: false,
          authorName: 'Thorin',
          noteCreatedAt: new Date(NOW),
          seat: 'player',
          requestedById: 'user-1',
          writerActorId: THORIN,
          modifiedAt: new Date(NOW),
          modifiedBy: 'Thorin',
          base: null,
          status: 'pending',
          queuedAt: new Date(NOW),
        },
      })
    })

    it('stores the Gamemaster’s as the Gamemaster’s, a chapter with no body', async () => {
      await createNote(gm, party, { role: 'chapter', title: 'Road to Erebor' })

      expect(prismaMock.journalWrite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'chapter',
          title: 'Road to Erebor',
          body: '',
          html: '',
          chapterId: null,
          authorActorId: null,
          authorGm: true,
          authorName: 'Gamemaster',
          seat: 'gm',
          requestedById: 'gm-1',
          writerActorId: null,
          modifiedBy: 'Gamemaster',
        }),
      })
    })

    it('stores a party’s entry drawn without its secrets, and a character’s with them', async () => {
      const body = 'Seen.\n\n<section class="secret">\n\nThe key.\n\n</section>'

      await createNote(vex, party, { role: 'entry', title: 'Door', body })
      await createNote(thorin, personal, { role: 'entry', title: 'Door', body })

      const [[toParty], [toOwn]] = prismaMock.journalWrite.create.mock.calls
      expect(toParty.data).toMatchObject({ body, html: '<p>Seen.</p>\n' })
      expect(toOwn.data.body).toBe(body)
      expect(toOwn.data.html).toContain('<section class="secret">')
      expect(toOwn.data.html).toContain('The key.')
    })

    it('takes a note whatever Foundry’s state: closed, or a module that keeps none', async () => {
      heldCampaign({ notesEnabled: false, bridgePolledAt: null })

      await expect(
        createNote(thorin, personal, { role: 'entry', title: 'Offline' }),
      ).resolves.toMatchObject({ ok: true })
    })

    it('refuses a character no longer in the campaign, 409 unknown', async () => {
      heldCampaign({ characters: [] })

      await expect(
        createNote(thorin, personal, { role: 'entry', title: 'a' }),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'unknown' })
      expect(prismaMock.journalWrite.create).not.toHaveBeenCalled()
    })

    it('refuses a private party, 409 private', async () => {
      await expect(
        createNote(
          gm,
          { ...party, private: true },
          { role: 'entry', title: 'a' },
        ),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'private' })
    })

    it('refuses a seat making its 30th change in a minute, 429 busy', async () => {
      prismaMock.journalWrite.count.mockResolvedValue(30)

      await expect(
        createNote(thorin, personal, { role: 'entry', title: 'a' }),
      ).resolves.toEqual({ ok: false, status: 429, reason: 'busy' })
      expect(prismaMock.journalWrite.count).toHaveBeenCalledWith({
        where: { requestedById: 'user-1', modifiedAt: { gte: ago(60_000) } },
      })
    })

    it('refuses a # or ## heading as Foundry renders it, 422, with the lines it can name', async () => {
      await expect(
        createNote(thorin, personal, {
          role: 'entry',
          title: 'Loot',
          body: 'Found:\n#loot\n\nTitle\n-',
        }),
      ).resolves.toEqual({
        ok: false,
        status: 422,
        reason: 'headings',
        lines: [2, 4],
      })
    })

    it('stores a raw HTML block holding #x, which showdown leaves as text, though the scanner points at it', async () => {
      await expect(
        createNote(thorin, personal, {
          role: 'entry',
          title: 'Markup',
          body: '<div>\n#x\n</div>',
        }),
      ).resolves.toMatchObject({ ok: true })
    })

    it('refuses a chapter the book doesn’t have, 422 gone; one waiting to be made is the book’s', async () => {
      await expect(
        createNote(thorin, personal, {
          role: 'entry',
          title: 'a',
          chapterId: SESSION,
        }),
      ).resolves.toEqual({ ok: false, status: 422, reason: 'gone' })

      heldBook({
        writes: [
          write({ noteId: SESSION, role: 'chapter', op: 'create', body: '' }),
        ],
      })
      await expect(
        createNote(thorin, personal, {
          role: 'entry',
          title: 'a',
          chapterId: SESSION,
        }),
      ).resolves.toMatchObject({ ok: true })
    })

    it('refuses a full book, 422 full: 300 entries, 50 chapters, or a million characters', async () => {
      const entries = Array.from({ length: 300 }, (_, n) =>
        mirror({ noteId: `entry${String(n).padStart(11, '0')}` }),
      )
      heldBook({ notes: entries })
      await expect(
        createNote(thorin, personal, { role: 'entry', title: 'a' }),
      ).resolves.toEqual({ ok: false, status: 422, reason: 'full' })

      // One waiting to be deleted leaves room for one more.
      heldBook({
        notes: entries,
        writes: [write({ noteId: entries[0].noteId, op: 'delete' })],
      })
      await expect(
        createNote(thorin, personal, { role: 'entry', title: 'a' }),
      ).resolves.toMatchObject({ ok: true })

      heldBook({
        notes: Array.from({ length: 50 }, (_, n) =>
          mirror({
            noteId: `chapter${String(n).padStart(9, '0')}`,
            role: 'chapter',
          }),
        ),
      })
      await expect(
        createNote(thorin, personal, { role: 'chapter', title: 'a' }),
      ).resolves.toEqual({ ok: false, status: 422, reason: 'full' })
      await expect(
        createNote(thorin, personal, { role: 'entry', title: 'a' }),
      ).resolves.toMatchObject({ ok: true })

      heldBook({
        notes: Array.from({ length: 50 }, (_, n) =>
          mirror({
            noteId: `entry${String(n).padStart(11, '0')}`,
            body: 'a'.repeat(19_999),
          }),
        ),
      })
      await expect(
        createNote(thorin, personal, {
          role: 'entry',
          title: 'a',
          body: 'b'.repeat(51),
        }),
      ).resolves.toEqual({ ok: false, status: 422, reason: 'full' })
    })

    it('still takes changes in a full book: a change adds no note, as the module counts only creates', async () => {
      const entries = Array.from({ length: 300 }, (_, n) =>
        mirror({ noteId: `entry${String(n).padStart(11, '0')}` }),
      )
      heldBook({ notes: entries })
      await expect(
        changeNote(thorin, personal, entries[0].noteId, aChange()),
      ).resolves.toMatchObject({ ok: true })
      expect(prismaMock.journalWrite.create).toHaveBeenCalled()

      const chapters = Array.from({ length: 50 }, (_, n) =>
        mirror({
          noteId: `chapter${String(n).padStart(9, '0')}`,
          role: 'chapter',
          body: '',
        }),
      )
      heldBook({ notes: chapters })
      await expect(
        changeNote(vex, party, chapters[0].noteId, {
          title: 'Session one',
          stamp: `n:${REV}`,
        }),
      ).resolves.toMatchObject({ ok: true })
    })
  })

  describe('changeNote (§8.7)', () => {
    it('makes a change of its own from Foundry’s revision, its author and age kept', async () => {
      heldBook({ notes: [mirror({ chapterId: SESSION })] })
      prismaMock.journalBook.findUnique.mockResolvedValueOnce({
        id: 'book-1',
        version: 4,
        journalName: null,
        withheld: null,
        notes: [
          mirror({ chapterId: SESSION }),
          mirror({ noteId: SESSION, role: 'chapter' }),
        ],
        writes: [],
      } as any)

      const answer = await changeNote(thorin, personal, CAVE, aChange())

      expect(answer).toEqual({
        ok: true,
        stamp: expect.stringMatching(/^w:[\da-f-]{36}\.0$/),
      })
      expect(prismaMock.journalWrite.create).toHaveBeenCalledWith({
        data: {
          id: expect.any(String),
          seq: 0,
          campaignId: 'c1',
          bookId: 'book-1',
          noteId: CAVE,
          seat: 'player',
          requestedById: 'user-1',
          modifiedAt: new Date(NOW),
          modifiedBy: 'Thorin',
          op: 'update',
          role: 'entry',
          title: 'Goblin cave',
          body: 'Rope and a key.',
          html: '<p>Rope and a key.</p>',
          chapterId: SESSION,
          authorActorId: THORIN,
          authorGm: false,
          authorName: 'Thorin',
          noteCreatedAt: ago(3_600_000),
          base: REV,
          status: 'pending',
          reason: null,
          claimToken: null,
          claimSession: null,
          claimedAt: null,
          queuedAt: new Date(NOW),
          writerActorId: THORIN,
        },
      })
      expect(prismaMock.journalBook.upsert).toHaveBeenCalled()
    })

    it('folds a change into the one waiting, compare-and-set, keeping its op, base and place', async () => {
      heldBook({ notes: [mirror()], writes: [write()] })

      await expect(
        changeNote(vex, personal, CAVE, aChange({ stamp: `w:${W1}.2` })),
      ).resolves.toEqual({ ok: true, stamp: `w:${W1}.3` })
      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
        where: { id: W1, seq: 2, status: { in: ['pending', 'failed'] } },
        data: {
          title: 'Goblin cave',
          body: 'Rope and a key.',
          html: '<p>Rope and a key.</p>',
          chapterId: null,
          seat: 'player',
          requestedById: 'user-2',
          writerActorId: VEX,
          modifiedAt: new Date(NOW),
          modifiedBy: 'Vex',
          op: 'update',
          seq: { increment: 1 },
          status: 'pending',
          reason: null,
        },
      })
      expect(prismaMock.journalWrite.create).not.toHaveBeenCalled()
    })

    it('keeps a create a create, and makes a waiting delete a change again', async () => {
      heldBook({ writes: [write({ op: 'create', base: null })] })
      await changeNote(thorin, personal, CAVE, aChange({ stamp: `w:${W1}.2` }))
      expect(prismaMock.journalWrite.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ op: 'create' }),
        }),
      )

      heldBook({ notes: [mirror()], writes: [write({ op: 'delete' })] })
      await changeNote(thorin, personal, CAVE, aChange({ stamp: `w:${W1}.2` }))
      expect(prismaMock.journalWrite.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ op: 'update' }),
        }),
      )
    })

    it('sends a refused change again once changed', async () => {
      heldBook({
        notes: [mirror()],
        writes: [write({ status: 'failed', reason: 'error' })],
      })

      await expect(
        changeNote(thorin, personal, CAVE, aChange({ stamp: `w:${W1}.2` })),
      ).resolves.toMatchObject({ ok: true })
      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending', reason: null }),
        }),
      )
    })

    it('uses a made change’s row again as a new change, its number one more', async () => {
      heldBook({
        notes: [mirror()],
        writes: [write({ status: 'made', op: 'create', base: null })],
      })

      await expect(
        changeNote(thorin, personal, CAVE, aChange()),
      ).resolves.toEqual({ ok: true, stamp: `w:${W1}.3` })
      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
        where: { id: W1, seq: 2, status: 'made' },
        data: expect.objectContaining({
          op: 'update',
          base: REV,
          status: 'pending',
          queuedAt: new Date(NOW),
          seq: { increment: 1 },
          title: 'Goblin cave',
        }),
      })
    })

    it('answers 404 for a note the book doesn’t have', async () => {
      await expect(
        changeNote(thorin, personal, CAVE, aChange()),
      ).resolves.toEqual({ ok: false, status: 404, reason: 'gone' })
      heldBook({ writes: [write({ status: 'made', op: 'delete' })] })
      await expect(
        changeNote(thorin, personal, CAVE, aChange()),
      ).resolves.toEqual({ ok: false, status: 404, reason: 'gone' })
    })

    it('takes a chapter’s title alone, 400 for more', async () => {
      heldBook({ notes: [mirror({ noteId: SESSION, role: 'chapter' })] })

      await expect(
        changeNote(thorin, personal, SESSION, aChange()),
      ).resolves.toEqual({
        ok: false,
        status: 400,
        reason: 'invalid',
        field: 'body',
      })
      await expect(
        changeNote(vex, party, SESSION, {
          title: 'Session one',
          stamp: `n:${REV}`,
        }),
      ).resolves.toMatchObject({ ok: true })
    })

    it('refuses another member’s party entry, and one written in Foundry, 403 not-yours', async () => {
      heldBook({ notes: [mirror()] })
      await expect(changeNote(vex, party, CAVE, aChange())).resolves.toEqual({
        ok: false,
        status: 403,
        reason: 'not-yours',
      })
      heldBook({ notes: [mirror({ authorActorId: null })] })
      await expect(changeNote(thorin, party, CAVE, aChange())).resolves.toEqual(
        {
          ok: false,
          status: 403,
          reason: 'not-yours',
        },
      )
      await expect(
        changeNote(gm, party, CAVE, aChange()),
      ).resolves.toMatchObject({ ok: true })
    })

    it('refuses an entry changed only in Foundry, 409 foundry-only, unless a change waiting gives it', async () => {
      heldBook({ notes: [mirror({ format: 1, body: '' })] })
      await expect(
        changeNote(thorin, personal, CAVE, aChange()),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'foundry-only' })

      heldBook({
        notes: [mirror({ cut: true })],
        writes: [write()],
      })
      await expect(
        changeNote(thorin, personal, CAVE, aChange({ stamp: `w:${W1}.2` })),
      ).resolves.toMatchObject({ ok: true })
    })

    it('refuses a change from a stamp the note has moved on from, 409 changed', async () => {
      heldBook({ notes: [mirror()], writes: [write()] })

      for (const stamp of [`n:${REV}`, `w:${W1}.1`, `w:${W1}.3`, 'n:']) {
        await expect(
          changeNote(thorin, personal, CAVE, aChange({ stamp })),
        ).resolves.toEqual({ ok: false, status: 409, reason: 'changed' })
      }
      expect(prismaMock.journalWrite.updateMany).not.toHaveBeenCalled()
    })

    it('refuses a change while the last is on its way, 409 saving, or the game didn’t take it, 409 conflict', async () => {
      heldBook({ notes: [mirror()], writes: [write({ status: 'claimed' })] })
      await expect(
        changeNote(thorin, personal, CAVE, aChange({ stamp: `w:${W1}.2` })),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'saving' })

      heldBook({
        notes: [mirror()],
        writes: [write({ status: 'conflict', reason: 'changed' })],
      })
      await expect(
        changeNote(thorin, personal, CAVE, aChange({ stamp: `w:${W1}.2` })),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'conflict' })
    })

    it('checks the change as a new note is checked: who, how often, headings, chapter and room', async () => {
      heldBook({ notes: [mirror()] })
      heldCampaign({ characters: [] })
      await expect(
        changeNote(thorin, personal, CAVE, aChange()),
      ).resolves.toMatchObject({ status: 409, reason: 'unknown' })

      heldCampaign()
      await expect(
        changeNote(gm, { ...party, private: true }, CAVE, aChange()),
      ).resolves.toMatchObject({ status: 409, reason: 'private' })

      prismaMock.journalWrite.count.mockResolvedValueOnce(30)
      await expect(
        changeNote(thorin, personal, CAVE, aChange()),
      ).resolves.toMatchObject({ status: 429, reason: 'busy' })

      await expect(
        changeNote(thorin, personal, CAVE, aChange({ body: '## x' })),
      ).resolves.toMatchObject({ status: 422, reason: 'headings', lines: [1] })

      await expect(
        changeNote(thorin, personal, CAVE, aChange({ chapterId: ROAD })),
      ).resolves.toMatchObject({ status: 422, reason: 'gone' })

      heldBook({
        notes: [
          mirror(),
          mirror({ noteId: RUMOUR, body: 'a'.repeat(999_990) }),
        ],
      })
      await expect(
        changeNote(thorin, personal, CAVE, aChange({ body: 'b'.repeat(11) })),
      ).resolves.toMatchObject({ status: 422, reason: 'full' })
      // The note's own text doesn't count against it.
      await expect(
        changeNote(thorin, personal, CAVE, aChange({ body: 'b'.repeat(10) })),
      ).resolves.toMatchObject({ ok: true })
    })

    it('keeps the body and chapter where a change leaves them out', async () => {
      heldBook({
        notes: [
          mirror({ chapterId: SESSION }),
          mirror({ noteId: SESSION, role: 'chapter' }),
        ],
      })

      await changeNote(thorin, personal, CAVE, {
        title: 'Renamed',
        stamp: `n:${REV}`,
      })

      expect(prismaMock.journalWrite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Renamed',
          body: '### Loot',
          chapterId: SESSION,
        }),
      })
    })

    describe('two changes at once', () => {
      it('lands only the first of two from the same stamp: the second is told 409 changed', async () => {
        heldBook({ notes: [mirror()], writes: [write()] })
        prismaMock.journalWrite.updateMany
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 })

        const [first, second] = await Promise.all([
          changeNote(
            thorin,
            personal,
            CAVE,
            aChange({ stamp: `w:${W1}.2`, title: 'First' }),
          ),
          changeNote(
            thorin,
            personal,
            CAVE,
            aChange({ stamp: `w:${W1}.2`, title: 'Second' }),
          ),
        ])

        expect(first).toEqual({ ok: true, stamp: `w:${W1}.3` })
        expect(second).toEqual({ ok: false, status: 409, reason: 'changed' })
        // Each made the same compare-and-set: only one row moved on from 2.
        expect(prismaMock.journalWrite.updateMany).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            where: { id: W1, seq: 2, status: { in: ['pending', 'failed'] } },
            data: expect.objectContaining({ title: 'First' }),
          }),
        )
        expect(prismaMock.journalWrite.updateMany).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            where: { id: W1, seq: 2, status: { in: ['pending', 'failed'] } },
          }),
        )
        expect(prismaMock.journalWrite.update).not.toHaveBeenCalled()
      })

      it('answers the second of two first changes of one note 409 changed, never 500', async () => {
        heldBook({ notes: [mirror()] })
        prismaMock.journalWrite.create
          .mockResolvedValueOnce({} as any)
          .mockRejectedValueOnce(taken())

        const [first, second] = await Promise.all([
          changeNote(thorin, personal, CAVE, aChange()),
          changeNote(thorin, personal, CAVE, aChange()),
        ])

        expect(first).toMatchObject({ ok: true })
        expect(second).toEqual({ ok: false, status: 409, reason: 'changed' })
      })

      it('passes any other failure on', async () => {
        heldBook({ notes: [mirror()] })
        prismaMock.journalWrite.create.mockRejectedValueOnce(new Error('down'))

        await expect(
          changeNote(thorin, personal, CAVE, aChange()),
        ).rejects.toThrow('down')
      })
    })
  })

  describe('deleteNote (§8.7)', () => {
    it('makes a delete of its own from Foundry’s revision', async () => {
      heldBook({ notes: [mirror()] })

      await expect(
        deleteNote(thorin, personal, CAVE, `n:${REV}`),
      ).resolves.toEqual({
        ok: true,
        stamp: expect.stringMatching(/^w:.+\.0$/),
      })
      expect(prismaMock.journalWrite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          op: 'delete',
          base: REV,
          title: 'The goblin cave',
          body: '### Loot',
          html: '<h5>Loot</h5>',
          modifiedBy: 'Thorin',
          queuedAt: new Date(NOW),
        }),
      })
    })

    it('drops a create still waiting outright, as it never reached Foundry', async () => {
      heldBook({ writes: [write({ op: 'create', base: null })] })

      await expect(
        deleteNote(thorin, personal, CAVE, `w:${W1}.2`),
      ).resolves.toEqual({ ok: true, stamp: 'n:' })
      expect(prismaMock.journalWrite.deleteMany).toHaveBeenCalledWith({
        where: { id: W1, seq: 2, status: { in: ['pending', 'failed'] } },
      })
      expect(prismaMock.journalWrite.updateMany).not.toHaveBeenCalled()
      expect(prismaMock.journalWrite.create).not.toHaveBeenCalled()
      expect(prismaMock.journalBook.upsert).toHaveBeenCalled()
    })

    it('answers 409 changed where a create waiting changed meanwhile', async () => {
      heldBook({ writes: [write({ op: 'create', base: null })] })
      prismaMock.journalWrite.deleteMany.mockResolvedValue({ count: 0 })

      await expect(
        deleteNote(thorin, personal, CAVE, `w:${W1}.2`),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'changed' })
    })

    it('makes a change waiting its deletion, keeping its base', async () => {
      heldBook({ notes: [mirror()], writes: [write()] })

      await expect(
        deleteNote(thorin, personal, CAVE, `w:${W1}.2`),
      ).resolves.toEqual({ ok: true, stamp: `w:${W1}.3` })
      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
        where: { id: W1, seq: 2, status: { in: ['pending', 'failed'] } },
        data: expect.objectContaining({
          op: 'delete',
          seq: { increment: 1 },
          status: 'pending',
        }),
      })
      expect(
        prismaMock.journalWrite.updateMany.mock.calls[0][0].data,
      ).not.toHaveProperty('base')
    })

    it('uses a made row again as the delete', async () => {
      heldBook({ notes: [mirror()], writes: [write({ status: 'made' })] })

      await deleteNote(thorin, personal, CAVE, `n:${REV}`)

      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
        where: { id: W1, seq: 2, status: 'made' },
        data: expect.objectContaining({
          op: 'delete',
          base: REV,
          title: 'The goblin cave',
          queuedAt: new Date(NOW),
        }),
      })
    })

    it('refuses: no note 404, a chapter 409, another’s 403, a stale stamp 409, on its way 409, in conflict 409', async () => {
      await expect(deleteNote(thorin, personal, CAVE, 'n:')).resolves.toEqual({
        ok: false,
        status: 404,
        reason: 'gone',
      })

      heldBook({ notes: [mirror({ noteId: SESSION, role: 'chapter' })] })
      await expect(
        deleteNote(gm, personal, SESSION, `n:${REV}`),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'chapter' })

      heldBook({ notes: [mirror()] })
      await expect(deleteNote(vex, party, CAVE, `n:${REV}`)).resolves.toEqual({
        ok: false,
        status: 403,
        reason: 'not-yours',
      })
      await expect(deleteNote(thorin, party, CAVE, 'n:old')).resolves.toEqual({
        ok: false,
        status: 409,
        reason: 'changed',
      })

      heldBook({ notes: [mirror()], writes: [write({ status: 'claimed' })] })
      await expect(
        deleteNote(thorin, personal, CAVE, `w:${W1}.2`),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'saving' })

      heldBook({
        notes: [mirror()],
        writes: [write({ status: 'conflict', reason: 'gone' })],
      })
      await expect(
        deleteNote(thorin, personal, CAVE, `w:${W1}.2`),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'conflict' })

      heldBook({ notes: [mirror()] })
      heldCampaign({ characters: [] })
      await expect(
        deleteNote(thorin, personal, CAVE, `n:${REV}`),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'unknown' })
      heldCampaign()
      await expect(
        deleteNote(gm, { ...party, private: true }, CAVE, `n:${REV}`),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'private' })
    })
  })

  describe('resolveNote (§4.5, §8.7)', () => {
    it('sends a change Foundry changed meanwhile again, from Foundry’s revision now', async () => {
      heldBook({
        notes: [mirror({ revision: 'abcdef00000002' })],
        writes: [write({ status: 'conflict', reason: 'changed' })],
      })

      await expect(
        resolveNote(thorin, personal, CAVE, {
          resolve: 'mine',
          stamp: `w:${W1}.2`,
        }),
      ).resolves.toEqual({ ok: true, stamp: `w:${W1}.3` })
      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
        where: { id: W1, seq: 2, status: 'conflict' },
        data: {
          base: 'abcdef00000002',
          status: 'pending',
          reason: null,
          seq: { increment: 1 },
        },
      })
    })

    it('makes a note Foundry deleted again, with the same id', async () => {
      heldBook({ writes: [write({ status: 'conflict', reason: 'gone' })] })

      await resolveNote(thorin, personal, CAVE, {
        resolve: 'mine',
        stamp: `w:${W1}.2`,
      })

      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
        where: { id: W1, seq: 2, status: 'conflict' },
        data: {
          op: 'create',
          base: null,
          status: 'pending',
          reason: null,
          seq: { increment: 1 },
        },
      })
    })

    it('tries a refused change again as it was', async () => {
      heldBook({
        notes: [mirror()],
        writes: [write({ status: 'failed', reason: 'error' })],
      })

      await resolveNote(thorin, personal, CAVE, {
        resolve: 'mine',
        stamp: `w:${W1}.2`,
      })

      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
        where: { id: W1, seq: 2, status: 'failed' },
        data: { status: 'pending', reason: null, seq: { increment: 1 } },
      })
    })

    it('drops the change for theirs, as a waiting delete’s Keep it does', async () => {
      for (const change of [
        write({ status: 'conflict', reason: 'changed' }),
        write({ status: 'failed', reason: 'not-member' }),
        write({ op: 'delete' }),
      ]) {
        heldBook({ notes: [mirror()], writes: [change] })

        await expect(
          resolveNote(thorin, personal, CAVE, {
            resolve: 'theirs',
            stamp: `w:${W1}.2`,
          }),
        ).resolves.toEqual({ ok: true, stamp: `n:${REV}` })
        expect(prismaMock.journalWrite.deleteMany).toHaveBeenLastCalledWith({
          where: { id: W1, seq: 2, status: change.status },
        })
      }
    })

    it('settles nothing that isn’t waiting on a choice, 409 changed', async () => {
      for (const change of [
        write(),
        write({ status: 'claimed' }),
        write({ status: 'made' }),
      ]) {
        heldBook({ notes: [mirror()], writes: [change] })
        await expect(
          resolveNote(thorin, personal, CAVE, {
            resolve: 'mine',
            stamp: `w:${W1}.2`,
          }),
        ).resolves.toEqual({ ok: false, status: 409, reason: 'changed' })
      }
      heldBook({ notes: [mirror()], writes: [write({ op: 'delete' })] })
      await expect(
        resolveNote(thorin, personal, CAVE, {
          resolve: 'mine',
          stamp: `w:${W1}.2`,
        }),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'changed' })
    })

    it('never drops a waiting change the game hasn’t refused for theirs, 409 changed', async () => {
      for (const change of [
        write(),
        write({ op: 'create', base: null }),
        write({ status: 'claimed', claimedAt: ago(10_000) }),
      ]) {
        heldBook({ notes: [mirror()], writes: [change] })
        for (const seat of [thorin, gm]) {
          await expect(
            resolveNote(seat, personal, CAVE, {
              resolve: 'theirs',
              stamp: `w:${W1}.2`,
            }),
          ).resolves.toEqual({ ok: false, status: 409, reason: 'changed' })
        }
      }
      expect(prismaMock.journalWrite.deleteMany).not.toHaveBeenCalled()
    })

    it('sends Use yours and Delete anyway from the revision the refusal said, in a book Foundry holds back', async () => {
      // Foundry changed the note after its book grew too large to send: only the refusal says so.
      const claimed = write({ status: 'claimed', claimedAt: ago(1000) })
      await recordNoteResult('c1', {
        id: `${W1}.2`,
        status: 'failed',
        reason: 'changed',
        error: null,
        messageId: null,
        visible: false,
        rolls: [],
        note: { id: CAVE, rev: 'abcdef0000000b' },
      })
      const refused = {
        ...claimed,
        ...(prismaMock.journalWrite.updateMany.mock.calls[0][0].data as object),
      } as JournalWrite
      expect(refused).toMatchObject({ status: 'conflict', reason: 'changed' })
      const tooLarge = {
        reason: 'tooLarge',
        bytes: 4_100_000,
        limit: 4_000_000,
      }
      const mine = { resolve: 'mine' as const, stamp: `w:${W1}.2` }

      for (const change of [refused, { ...refused, op: 'delete' as const }]) {
        prismaMock.journalWrite.updateMany.mockClear()
        heldBook({ withheld: tooLarge, notes: [mirror()], writes: [change] })
        await expect(
          resolveNote(thorin, personal, CAVE, mine),
        ).resolves.toEqual({ ok: true, stamp: `w:${W1}.3` })
        expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
          where: { id: W1, seq: 2, status: 'conflict' },
          data: {
            base: 'abcdef0000000b',
            status: 'pending',
            reason: null,
            seq: { increment: 1 },
          },
        })
      }

      // A book Foundry sends has its revision now in the mirror, newer than any refusal's.
      prismaMock.journalWrite.updateMany.mockClear()
      heldBook({
        notes: [mirror({ revision: 'abcdef0000000c' })],
        writes: [refused],
      })
      await resolveNote(thorin, personal, CAVE, mine)
      expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ base: 'abcdef0000000c' }),
        }),
      )
    })

    it('lets the Gamemaster settle anyone’s, a player only their own or one on a note they may change', async () => {
      const stuck = write({
        status: 'failed',
        reason: 'not-member',
        requestedById: 'user-2',
        authorActorId: VEX,
        modifiedBy: 'Vex',
      })
      heldBook({ notes: [mirror({ authorActorId: VEX })], writes: [stuck] })
      const theirs = { resolve: 'theirs' as const, stamp: `w:${W1}.2` }

      await expect(resolveNote(thorin, party, CAVE, theirs)).resolves.toEqual({
        ok: false,
        status: 403,
        reason: 'not-yours',
      })
      await expect(resolveNote(gm, party, CAVE, theirs)).resolves.toMatchObject(
        {
          ok: true,
        },
      )
      await expect(
        resolveNote(vex, party, CAVE, theirs),
      ).resolves.toMatchObject({
        ok: true,
      })
    })

    it('refuses a stale stamp, and one changed meanwhile, 409 changed', async () => {
      heldBook({
        notes: [mirror()],
        writes: [write({ status: 'conflict', reason: 'changed' })],
      })
      await expect(
        resolveNote(thorin, personal, CAVE, {
          resolve: 'mine',
          stamp: `w:${W1}.1`,
        }),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'changed' })

      prismaMock.journalWrite.updateMany.mockResolvedValue({ count: 0 })
      await expect(
        resolveNote(thorin, personal, CAVE, {
          resolve: 'mine',
          stamp: `w:${W1}.2`,
        }),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'changed' })
    })
  })

  describe('a change thought lost on its way, as when Foundry closed before its result came', () => {
    /** Handed over two days ago, and never answered. */
    const lostClaim = (fields: Partial<JournalWrite> = {}) =>
      write({ status: 'claimed', claimedAt: ago(2 * 86_400_000), ...fields })
    const lostFrom = { status: 'claimed', claimedAt: { lt: ago(75_000) } }

    it('takes a change or a delete as one waiting, compare-and-set on the claim still lost', async () => {
      heldBook({ notes: [mirror()], writes: [lostClaim()] })

      await expect(
        changeNote(thorin, personal, CAVE, aChange({ stamp: `w:${W1}.2` })),
      ).resolves.toEqual({ ok: true, stamp: `w:${W1}.3` })
      expect(prismaMock.journalWrite.updateMany).toHaveBeenLastCalledWith({
        where: { id: W1, seq: 2, ...lostFrom },
        data: expect.objectContaining({
          op: 'update',
          status: 'pending',
          seq: { increment: 1 },
        }),
      })

      await expect(
        deleteNote(gm, personal, CAVE, `w:${W1}.2`),
      ).resolves.toEqual({ ok: true, stamp: `w:${W1}.3` })
      expect(prismaMock.journalWrite.updateMany).toHaveBeenLastCalledWith({
        where: { id: W1, seq: 2, ...lostFrom },
        data: expect.objectContaining({ op: 'delete', status: 'pending' }),
      })
    })

    it('still waits for one handed over just now, 409 saving', async () => {
      heldBook({
        notes: [mirror()],
        writes: [write({ status: 'claimed', claimedAt: ago(10_000) })],
      })

      await expect(
        changeNote(thorin, personal, CAVE, aChange({ stamp: `w:${W1}.2` })),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'saving' })
      await expect(
        deleteNote(thorin, personal, CAVE, `w:${W1}.2`),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'saving' })
    })

    it('waits for a create however long, but drops it for a delete or theirs: what Foundry made of it comes back', async () => {
      heldBook({ writes: [lostClaim({ op: 'create', base: null })] })

      await expect(
        changeNote(thorin, personal, CAVE, aChange({ stamp: `w:${W1}.2` })),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'saving' })
      await expect(
        resolveNote(gm, personal, CAVE, {
          resolve: 'mine',
          stamp: `w:${W1}.2`,
        }),
      ).resolves.toEqual({ ok: false, status: 409, reason: 'changed' })

      await expect(
        deleteNote(thorin, personal, CAVE, `w:${W1}.2`),
      ).resolves.toEqual({ ok: true, stamp: 'n:' })
      expect(prismaMock.journalWrite.deleteMany).toHaveBeenLastCalledWith({
        where: { id: W1, seq: 2, ...lostFrom },
      })

      // The Gamemaster clears a player's stuck chapter, which no one may delete.
      heldBook({
        writes: [
          lostClaim({
            noteId: SESSION,
            op: 'create',
            role: 'chapter',
            body: '',
            base: null,
          }),
        ],
      })
      await expect(
        resolveNote(gm, personal, SESSION, {
          resolve: 'theirs',
          stamp: `w:${W1}.2`,
        }),
      ).resolves.toEqual({ ok: true, stamp: 'n:' })
      expect(prismaMock.journalWrite.deleteMany).toHaveBeenLastCalledWith({
        where: { id: W1, seq: 2, ...lostFrom },
      })
    })

    it('lets Keep it drop a delete thought lost', async () => {
      heldBook({ notes: [mirror()], writes: [lostClaim({ op: 'delete' })] })

      await expect(
        resolveNote(thorin, personal, CAVE, {
          resolve: 'theirs',
          stamp: `w:${W1}.2`,
        }),
      ).resolves.toEqual({ ok: true, stamp: `n:${REV}` })
    })
  })

  describe('a member’s note the Gamemaster changed, still the member’s in Foundry (§3.4)', () => {
    const vexWrote = {
      authorActorId: VEX,
      authorName: 'Vex',
      requestedById: 'user-2',
      writerActorId: VEX,
      modifiedBy: 'Vex',
    }

    it('hands a waiting note the Gamemaster fixed over as its author’s, who may still change it', async () => {
      const waiting = write({ ...vexWrote, op: 'create', base: null })
      heldBook({ writes: [waiting] })

      await expect(
        changeNote(gm, party, CAVE, aChange({ stamp: `w:${W1}.2` })),
      ).resolves.toMatchObject({ ok: true })
      const fixed = after(waiting)
      expect(fixed).toMatchObject({ op: 'create', seat: 'gm' })

      const command = await handed(fixed)
      expect(command).not.toHaveProperty('by')
      expect(command.note).toMatchObject({ op: 'create', writer: VEX })

      heldBook({ writes: [fixed] })
      const view = await getNotesView(vex, party)
      expect(view?.entries[0]).toMatchObject({
        author: { name: 'Vex' },
        canEdit: true,
        canDelete: true,
      })
    })

    it('makes a member’s note again as theirs where Foundry deleted it while the Gamemaster’s change waited', async () => {
      const gone = write({
        ...vexWrote,
        seat: 'gm',
        requestedById: 'gm-1',
        writerActorId: null,
        modifiedBy: 'Gamemaster',
        status: 'conflict',
        reason: 'gone',
      })
      heldBook({ writes: [gone] })

      await expect(
        resolveNote(vex, party, CAVE, { resolve: 'mine', stamp: `w:${W1}.2` }),
      ).resolves.toMatchObject({ ok: true })
      const again = after(gone)
      expect(again).toMatchObject({ op: 'create', base: null })

      const command = await handed(again)
      expect(command).not.toHaveProperty('by')
      expect(command.note).toMatchObject({ op: 'create', writer: VEX })
    })
  })

  it('previews a note as its book draws it, its secrets as the book keeps them', async () => {
    const body =
      '### Loot\n\n<section class="secret">\n\nkey\n\n</section>\n\n#x'

    await expect(previewNote(personal, body)).resolves.toEqual({
      html: expect.stringContaining('<section class="secret">'),
      headings: [9],
    })
    const preview = await previewNote(party, body)
    expect(preview?.html).toContain('<h5>Loot</h5>')
    expect(preview?.html).not.toContain('key')
    prismaMock.campaign.findUnique.mockResolvedValue(null)
    await expect(previewNote(party, body)).resolves.toBeUndefined()
  })

  describe('the seat’s limit, 30 changes a minute', () => {
    /** The changes table as the database would hold it, for both sides at once. */
    let rows: JournalWrite[]

    beforeEach(() => {
      rows = []
      heldBook()
      prismaMock.journalWrite.create.mockImplementation((({
        data,
      }: {
        data: JournalWrite
      }) => {
        rows.push({ ...data, updatedAt: new Date(Date.now()) })
        return Promise.resolve(data)
      }) as any)
      prismaMock.journalWrite.count.mockImplementation((({
        where,
      }: {
        where: { requestedById: string; modifiedAt: { gte: Date } }
      }) =>
        Promise.resolve(
          rows.filter(
            row =>
              row.requestedById === where.requestedById &&
              row.modifiedAt >= where.modifiedAt.gte,
          ).length,
        )) as any)
      prismaMock.journalWrite.updateMany.mockImplementation((({
        where,
        data,
      }: {
        where: { id: string; seq: number; status: string }
        data: Partial<JournalWrite>
      }) => {
        const row = rows.find(
          ({ id, seq, status }) =>
            id === where.id && seq === where.seq && status === where.status,
        )
        if (row) Object.assign(row, data, { updatedAt: new Date(Date.now()) })
        return Promise.resolve({ count: row ? 1 : 0 })
      }) as any)
      prismaMock.journalWrite.deleteMany.mockImplementation((({
        where,
      }: {
        where: { id: string }
      }) => {
        const before = rows.length
        rows = rows.filter(({ id }) => id !== where.id)
        return Promise.resolve({ count: before - rows.length })
      }) as any)
      prismaMock.journalWrite.findUnique.mockImplementation((({
        where,
      }: {
        where: { id: string }
      }) =>
        Promise.resolve(rows.find(({ id }) => id === where.id) ?? null)) as any)
      prismaMock.journalNote.findUnique.mockResolvedValue(null)
    })

    it('counts changes made at once in the game too, kept as made: the 31st in a minute is 429', async () => {
      for (let n = 0; n < 30; n++) {
        const answer = await createNote(thorin, personal, {
          role: 'entry',
          title: `Note ${n}`,
        })
        expect(answer).toMatchObject({ ok: true })
        // Claimed, then made by the game at once.
        const row = rows.at(-1)!
        row.status = 'claimed'
        await recordNoteResult('c1', {
          id: `${row.id}.0`,
          status: 'done',
          reason: null,
          error: null,
          messageId: null,
          visible: false,
          rolls: [],
          note: { id: row.noteId, rev: null },
        })
        expect(row.status).toBe('made')
      }

      await expect(
        createNote(thorin, personal, { role: 'entry', title: 'One more' }),
      ).resolves.toEqual({ ok: false, status: 429, reason: 'busy' })
      // A minute on, the seat may write again.
      jest.setSystemTime(NOW + 61_000)
      await expect(
        createNote(thorin, personal, { role: 'entry', title: 'One more' }),
      ).resolves.toMatchObject({ ok: true })
    })

    it('counts only what the seat changed in the minute: thirty notes written an hour ago and made now cost nothing', async () => {
      // Written while Foundry was closed...
      jest.setSystemTime(NOW - 3_600_000)
      for (let n = 0; n < 30; n++) {
        await createNote(thorin, personal, {
          role: 'entry',
          title: `Note ${n}`,
        })
      }
      // ...and handed over and made at once when the game came back, which touches every row.
      jest.setSystemTime(NOW)
      for (const row of rows) {
        row.status = 'claimed'
        await recordNoteResult('c1', {
          id: `${row.id}.0`,
          status: 'done',
          reason: null,
          error: null,
          messageId: null,
          visible: false,
          rolls: [],
          note: { id: row.noteId, rev: null },
        })
      }
      expect(rows).toHaveLength(30)
      expect(
        rows.every(
          ({ status, updatedAt }) =>
            status === 'made' && updatedAt.getTime() === NOW,
        ),
      ).toBe(true)

      await expect(
        createNote(thorin, personal, { role: 'entry', title: 'Back' }),
      ).resolves.toMatchObject({ ok: true })
    })
  })

  describe('orders of a group’s notes (round 0.35.0)', () => {
    beforeEach(() => {
      held()
      prismaMock.journalOrder.create.mockResolvedValue({} as any)
      prismaMock.journalOrder.updateMany.mockResolvedValue({ count: 1 })
      prismaMock.journalOrder.deleteMany.mockResolvedValue({ count: 1 })
    })

    describe('the view (§2.5, §7.9)', () => {
      it('orders each group by Foundry’s places, not by when its notes were written; the notes in no chapter first', async () => {
        const view = await getNotesView(thorin, party)

        expect(view?.groups.map(({ chapterId }) => chapterId)).toEqual([
          null,
          SESSION,
        ])
        expect(view?.entries.map(({ id }) => id)).toEqual([L1, L2, ...MIRRORED])
      })

      it('lists every chapter’s group, oldest chapter first, with notes or none, and each in its own order', async () => {
        const LATER = 'laterChapter0001'
        const E = 'eLaterNote000001'
        held({
          notes: [
            ...partyNotes(),
            chapter({ noteId: LATER, title: 'Later', createdAt: ago(1000) }),
            chapter({ noteId: 'emptyChapter0001', createdAt: ago(500) }),
            mirror({ noteId: E, chapterId: LATER, place: 0 }),
          ],
        })

        const view = await getNotesView(thorin, party)

        expect(view?.groups.map(({ chapterId }) => chapterId)).toEqual([
          null,
          SESSION,
          LATER,
          'emptyChapter0001',
        ])
        expect(view?.entries.map(({ id }) => id)).toEqual([
          L1,
          L2,
          ...MIRRORED,
          E,
        ])
      })

      it('puts notes waiting to come into a group after its notes in Foundry, in the order they’ll be made: last', async () => {
        const NEW1 = 'newNoteWaiting01'
        const NEW2 = 'newNoteWaiting02'
        held({
          writes: [
            // Two notes written here, the later written first in Foundry's queue.
            write({
              id: '11111111-1111-4111-8111-111111111111',
              noteId: NEW1,
              op: 'create',
              chapterId: SESSION,
              noteCreatedAt: ago(5000),
              queuedAt: ago(4000),
            }),
            write({
              id: '22222222-2222-4222-8222-222222222222',
              noteId: NEW2,
              op: 'create',
              chapterId: SESSION,
              noteCreatedAt: ago(90_000),
              queuedAt: ago(3000),
            }),
            // A note in no chapter moved into Session 1, the oldest of them all.
            write({
              id: '33333333-3333-4333-8333-333333333333',
              noteId: L2,
              op: 'update',
              chapterId: SESSION,
              noteCreatedAt: ago(60_000),
              queuedAt: ago(2000),
            }),
          ],
        })

        const { ids } = await groupOf(thorin)

        expect(ids).toEqual([...MIRRORED, NEW1, NEW2, L2])
        expect(await shownIds(thorin, null)).toEqual([L1])
      })

      it('shows an order waiting, its notes first, and a note added since after them', async () => {
        const NEW = 'newNoteWaiting01'
        held({
          orders: [order({ ids: [D, C, A] })],
          writes: [
            write({
              noteId: NEW,
              op: 'create',
              chapterId: SESSION,
              queuedAt: ago(1000),
            }),
          ],
        })

        for (const seat of [thorin, vex, gm]) {
          // B came back meanwhile: it's after the order's notes, as Foundry will place it.
          expect(await shownIds(seat)).toEqual([D, C, A, B, NEW])
        }
      })

      it('shows of an order waiting only its notes still in the group as the seat sees it: not one moved out since, nor one hidden from the seat', async () => {
        const HIDDEN = 'vexFailedCreate1'
        held({
          orders: [order({ ids: [B, HIDDEN, D, C, A] })],
          writes: [
            // Vex moves her note out of Session 1 while the order waits (§4.4).
            write({
              noteId: B,
              op: 'update',
              chapterId: null,
              requestedById: 'user-2',
              writerActorId: VEX,
              authorActorId: VEX,
              authorName: 'Vex',
              modifiedBy: 'Vex',
              queuedAt: ago(1000),
            }),
            // Vex's own failed note, which Thorin never sees (§5.3).
            write({
              id: '22222222-2222-4222-8222-222222222222',
              noteId: HIDDEN,
              op: 'create',
              status: 'failed',
              reason: 'not-member',
              chapterId: SESSION,
              requestedById: 'user-2',
              writerActorId: VEX,
              authorActorId: VEX,
            }),
          ],
        })

        // B once, last in no chapter where it's going; an id shown that the seat has no note for
        // would be no entry at all.
        const view = await getNotesView(thorin, party)
        expect(view?.entries.map(entry => entry?.id)).toEqual([
          L1,
          L2,
          B,
          D,
          C,
          A,
        ])
        // Those who see Vex's failed note see it where the order puts it, with B skipped.
        for (const seat of [vex, gm]) {
          expect(await shownIds(seat)).toEqual([HIDDEN, D, C, A])
        }
      })

      it('says where each group’s order stands, the same to every seat while it waits or saves', async () => {
        for (const [status, fields, state] of [
          ['pending', {}, 'saving'],
          ['claimed', {}, 'saving'],
          ['pending', { bridgePolledAt: ago(60_000) }, 'waiting'],
          ['pending', { noteFeatures: [] }, 'waiting'],
          ['made', {}, 'synced'],
        ] as const) {
          heldCampaign(fields)
          held({ orders: [order({ status })] })
          for (const seat of [thorin, vex, gm]) {
            const { group } = await groupOf(seat)
            expect(group).toEqual({
              chapterId: SESSION,
              state,
              stamp: expect.stringMatching(/^g:[\da-f]{16}$/),
            })
          }
        }
        heldCampaign()
        held()
        await expect(groupView(vex, null)).resolves.toMatchObject({
          state: 'synced',
        })
      })

      it('shows a refused order to its own seat and the Gamemaster, Foundry’s order to anyone else', async () => {
        for (const [status, reason, shown] of [
          ['conflict', 'changed', 'changed'],
          ['failed', 'not-member', 'not-member'],
          ['failed', 'strange', 'error'],
        ] as const) {
          held({ orders: [order({ status, reason })] })

          const own = await groupOf(thorin)
          expect(own.group).toEqual({
            chapterId: SESSION,
            state: status,
            reason: shown,
            stamp: expect.any(String),
            mine: { ids: [D, C, B, A] },
          })
          expect(own.ids).toEqual(MIRRORED)
          expect(await groupView(gm)).toMatchObject({
            state: status,
            mine: { ids: [D, C, B, A], by: 'Thorin' },
          })
          const other = await groupOf(vex)
          expect(other.group).toEqual({
            chapterId: SESSION,
            state: 'synced',
            stamp: expect.any(String),
          })
          expect(other.ids).toEqual(MIRRORED)
        }
      })

      it('names in a refused order only the notes the seat sees in the group', async () => {
        const HIDDEN = 'vexFailedCreate1'
        held({
          orders: [
            order({
              status: 'conflict',
              reason: 'changed',
              ids: [HIDDEN, D, 'goneFromFoundry1', A],
            }),
          ],
          writes: [
            // Vex's own failed note, which Thorin never sees.
            write({
              noteId: HIDDEN,
              op: 'create',
              status: 'failed',
              reason: 'not-member',
              chapterId: SESSION,
              requestedById: 'user-2',
              writerActorId: VEX,
              authorActorId: VEX,
            }),
          ],
        })

        await expect(groupView(thorin)).resolves.toMatchObject({
          mine: { ids: [D, A] },
        })
        await expect(groupView(thorin)).resolves.not.toHaveProperty('mine.by')
        await expect(groupView(gm)).resolves.toMatchObject({
          mine: { ids: [HIDDEN, D, A], by: 'Thorin' },
        })
      })

      it('says whether the seat may reorder, and whether the module takes orders', async () => {
        await expect(getNotesView(vex, party)).resolves.toMatchObject({
          canReorder: true,
          orders: true,
        })
        heldCampaign({ noteFeatures: [] })
        await expect(getNotesView(vex, party)).resolves.toMatchObject({
          canReorder: true,
          orders: false,
        })
        await expect(
          getNotesView(gm, { ...party, private: true }),
        ).resolves.toMatchObject({ canReorder: false })
      })

      describe('a group’s stamp: what the seat was shown', () => {
        it('stays while nothing shown changes: a poll, a title, the seat’s own order on its way and made as asked, a made order gone after its hour', async () => {
          const before = await stampOf()
          expect(await stampOf()).toBe(before)

          const titled = partyNotes()
          titled[1] = { ...titled[1], title: 'Renamed' }
          held({ notes: titled })
          expect(await stampOf()).toBe(before)

          held({ orders: [order()] })
          const pending = await stampOf()
          expect(pending).not.toBe(before)
          held({ orders: [order({ status: 'claimed', claimedAt: ago(1000) })] })
          expect(await stampOf()).toBe(pending)
          // Made, Foundry's book follows: the order it shows is the same.
          const made = partyNotes().map(note =>
            note.chapterId === SESSION
              ? { ...note, place: [D, C, B, A].indexOf(note.noteId) }
              : note,
          )
          held({ orders: [order({ status: 'made', seq: 2 })], notes: made })
          expect(await stampOf()).toBe(pending)
          held({ notes: made })
          expect(await stampOf()).toBe(pending)
        })

        it('moves with what’s shown: another’s new order, a note added, a reorder in Foundry, a refusal shown', async () => {
          const seen = new Set([await stampOf()])
          const shows = async () => {
            const now = await stampOf()
            expect(seen.has(now)).toBe(false)
            seen.add(now)
          }

          held({ orders: [order({ ids: [B, A, C, D] })] })
          await shows()
          held({ orders: [order({ ids: [B, A, D, C], seq: 2 })] })
          await shows()
          held({
            writes: [
              write({
                noteId: 'newNoteWaiting01',
                op: 'create',
                chapterId: SESSION,
              }),
            ],
          })
          await shows()
          // The Gamemaster dragged the Gamemaster's note above Vex's in Foundry.
          const swapped = partyNotes()
          swapped[2] = { ...swapped[2], place: 2 }
          swapped[3] = { ...swapped[3], place: 1 }
          held({ notes: swapped })
          await shows()
          held({ orders: [order({ status: 'conflict', reason: 'changed' })] })
          await shows()
          // To anyone not shown the refusal, it's Foundry's order.
          expect(await stampOf(vex)).toBe(await stampOf(vex))
          held()
          const plain = await stampOf(vex)
          held({ orders: [order({ status: 'conflict', reason: 'changed' })] })
          expect(await stampOf(vex)).toBe(plain)
        })
      })

      describe('the journal’s last change (§2.6)', () => {
        it('is the latest of its notes’, its chapters’ and the book’s own record, the book’s at a tie', async () => {
          const notes = partyNotes()
          notes[3] = {
            ...notes[3],
            modifiedAt: ago(1000),
            modifiedBy: 'Gamemaster',
          }
          held({ notes })
          await expect(getNotesView(thorin, party)).resolves.toMatchObject({
            lastChange: { by: 'Gamemaster', at: ago(1000).toISOString() },
          })

          notes[0] = { ...notes[0], modifiedAt: ago(500), modifiedBy: 'Vex' }
          held({ notes })
          await expect(getNotesView(thorin, party)).resolves.toMatchObject({
            lastChange: { by: 'Vex', at: ago(500).toISOString() },
          })

          held({ notes, changedAt: ago(500), changedBy: 'Thorin' })
          await expect(getNotesView(thorin, party)).resolves.toMatchObject({
            lastChange: { by: 'Thorin', at: ago(500).toISOString() },
          })
          held({ notes, changedAt: ago(100), changedBy: 'Gamemaster' })
          await expect(getNotesView(thorin, party)).resolves.toMatchObject({
            lastChange: { by: 'Gamemaster', at: ago(100).toISOString() },
          })
        })

        it('never names a change the seat isn’t shown: another member’s refused note', async () => {
          held({
            writes: [
              write({
                noteId: 'vexFailedCreate1',
                op: 'create',
                status: 'failed',
                reason: 'not-member',
                requestedById: 'user-2',
                writerActorId: VEX,
                authorActorId: VEX,
                modifiedBy: 'Vex',
                modifiedAt: ago(10),
              }),
            ],
          })

          await expect(getNotesView(thorin, party)).resolves.toMatchObject({
            lastChange: { by: 'Thorin' },
          })
          await expect(getNotesView(gm, party)).resolves.toMatchObject({
            lastChange: { by: 'Vex', at: ago(10).toISOString() },
          })
        })

        it('is none in a journal with nothing in it', async () => {
          prismaMock.journalBook.findUnique.mockResolvedValue(null)

          await expect(getNotesView(thorin, party)).resolves.not.toHaveProperty(
            'lastChange',
          )
        })
      })
    })

    describe('reorderNotes (§7.7)', () => {
      it('takes any member’s order of notes written by another, the Gamemaster and Foundry, stored at once from the mirror’s order', async () => {
        const answer = await reorder(vex, [D, C, A, B])

        expect(answer).toEqual({
          ok: true,
          stamp: expect.stringMatching(/^g:/),
        })
        expect(prismaMock.journalOrder.create).toHaveBeenCalledWith({
          data: {
            id: expect.stringMatching(/^[\da-f-]{36}$/),
            seq: 0,
            campaignId: 'c1',
            bookId: 'book-1',
            chapterId: SESSION,
            was: MIRRORED,
            ids: [D, C, A, B],
            seat: 'player',
            requestedById: 'user-2',
            writerActorId: VEX,
            modifiedAt: new Date(NOW),
            modifiedBy: 'Vex',
            status: 'pending',
            reason: null,
            queuedAt: new Date(NOW),
          },
        })
        // On the journal's line, by whoever reordered it.
        expect(bumped().update).toEqual({
          version: { increment: 1 },
          changedAt: new Date(NOW),
          changedBy: 'Vex',
          changedIn: 'app',
        })
        // The stamp is what every seat is now shown.
        held({
          orders: [
            order({ ids: [D, C, A, B], seq: 0, requestedById: 'user-2' }),
          ],
        })
        expect(await stampOf(vex)).toBe(answer.ok ? answer.stamp : undefined)
      })

      it('orders the notes in no chapter as the group ’’, as the Gamemaster', async () => {
        await expect(reorder(gm, [L2, L1], null)).resolves.toMatchObject({
          ok: true,
        })
        expect(prismaMock.journalOrder.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            chapterId: '',
            was: [L1, L2],
            seat: 'gm',
            writerActorId: null,
            modifiedBy: 'Gamemaster',
          }),
        })
      })

      it('answers 404 for a group the seat isn’t shown, or a campaign gone', async () => {
        for (const chapterId of ['noSuchChapter001', A]) {
          await expect(
            reorderNotes(thorin, party, { chapterId, ids: [A], stamp: 'g:0' }),
          ).resolves.toEqual({ ok: false, status: 404, reason: 'gone' })
        }
        prismaMock.campaign.findUnique.mockResolvedValue(null)
        await expect(
          reorderNotes(thorin, party, {
            chapterId: null,
            ids: [L1],
            stamp: 'g:0',
          }),
        ).resolves.toEqual({ ok: false, status: 404, reason: 'gone' })
      })

      it('refuses a read-only book, 409: a private party, or a character no longer in the campaign', async () => {
        await refusesReadOnly(gm, { ...party, private: true }, 'private')
        // Thorin's own book, his character gone from the campaign: a party's is always its own.
        heldCampaign({ characters: [{ id: VEX, name: 'Vex' }] })
        await refusesReadOnly(thorin, personal, 'unknown')
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
      })

      it('refuses an order made from what the seat no longer sees, 409 changed: a stale stamp, a note left out, one not in the group', async () => {
        const { group } = await groupOf(thorin)
        for (const [ids, stamp] of [
          [[D, C, B, A], 'g:0000000000000000'],
          [[D, C, B], group.stamp],
          [[D, C, B, A, L1], group.stamp],
          [[D, C, B, L1], group.stamp],
        ] as const) {
          await expect(
            reorderNotes(thorin, party, {
              chapterId: SESSION,
              ids: [...ids],
              stamp,
            }),
          ).resolves.toEqual({ ok: false, status: 409, reason: 'changed' })
        }
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
      })

      it('waits for an order on its way, 409 saving, unless it’s thought lost', async () => {
        held({ orders: [order({ status: 'claimed', claimedAt: ago(5000) })] })
        await expect(reorder(thorin, [A, B, C, D])).resolves.toEqual({
          ok: false,
          status: 409,
          reason: 'saving',
        })
        held({ orders: [order({ status: 'claimed', claimedAt: ago(80_000) })] })
        await expect(reorder(thorin, [A, B, C, D])).resolves.toMatchObject({
          ok: true,
        })
      })

      it('writes nothing for the order already shown', async () => {
        held({ orders: [order()] })
        const { group } = await groupOf(thorin)

        await expect(
          reorderNotes(thorin, party, {
            chapterId: SESSION,
            ids: [D, C, B, A],
            stamp: group.stamp,
          }),
        ).resolves.toEqual({ ok: true, stamp: group.stamp })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
      })

      it('counts toward the seat’s 30 changes a minute, with its notes’ changes: 429 busy', async () => {
        prismaMock.journalWrite.count.mockResolvedValue(29)
        await expect(reorder(thorin, [D, C, B, A])).resolves.toMatchObject({
          ok: true,
        })
        prismaMock.journalOrder.count.mockResolvedValue(1)
        await expect(reorder(thorin, [B, C, D, A])).resolves.toEqual({
          ok: false,
          status: 429,
          reason: 'busy',
        })
        await expect(
          createNote(thorin, party, { role: 'entry', title: 'One more' }),
        ).resolves.toEqual({ ok: false, status: 429, reason: 'busy' })
        const mine = {
          where: {
            requestedById: 'user-1',
            modifiedAt: { gte: new Date(NOW - 60_000) },
          },
        }
        expect(prismaMock.journalWrite.count).toHaveBeenLastCalledWith(mine)
        expect(prismaMock.journalOrder.count).toHaveBeenLastCalledWith(mine)
      })

      describe('folded into the group’s order (§4.2), compare-and-set', () => {
        it.each([
          ['waiting', { status: 'pending' }, { status: 'pending' }],
          [
            'thought lost on its way',
            { status: 'claimed', claimedAt: ago(80_000) },
            { status: 'claimed', claimedAt: { lt: ago(75_000) } },
          ],
        ] as const)(
          'keeps the order in Foundry it was first made from, %s',
          async (_name, fields, from) => {
            held({ orders: [order({ ...fields, was: [B, A, C, D] })] })

            await expect(reorder(vex, [A, B, C, D])).resolves.toMatchObject({
              ok: true,
            })
            expect(folded()).toEqual({
              where: { id: O1, seq: 1, ...from },
              data: {
                ids: [A, B, C, D],
                seat: 'player',
                requestedById: 'user-2',
                writerActorId: VEX,
                modifiedAt: new Date(NOW),
                modifiedBy: 'Vex',
                status: 'pending',
                reason: null,
                queuedAt: new Date(NOW),
                seq: { increment: 1 },
              },
            })
          },
        )

        it.each([
          [
            'refused for Foundry’s order',
            { status: 'conflict', reason: 'changed' },
          ],
          ['failed', { status: 'failed', reason: 'not-member' }],
        ] as const)(
          'makes one %s afresh, from Foundry’s order now',
          async (_name, fields) => {
            held({ orders: [order({ ...fields, was: [B, A, C, D] })] })

            await expect(reorder(vex, [A, C, B, D])).resolves.toMatchObject({
              ok: true,
            })
            expect(folded()).toEqual({
              where: { id: O1, seq: 1, status: fields.status },
              data: expect.objectContaining({
                ids: [A, C, B, D],
                was: MIRRORED,
                requestedById: 'user-2',
                status: 'pending',
                reason: null,
                queuedAt: new Date(NOW),
              }),
            })
          },
        )

        it('uses a made order’s row again as a new order, from Foundry’s order now, its claim cleared', async () => {
          held({
            orders: [
              order({
                status: 'made',
                claimToken: 'token',
                claimSession: 's1',
                claimedAt: ago(70_000),
                was: [B, A, C, D],
              }),
            ],
          })

          await expect(reorder(thorin, [B, A, C, D])).resolves.toMatchObject({
            ok: true,
          })
          expect(folded()).toEqual({
            where: { id: O1, seq: 1, status: 'made' },
            data: expect.objectContaining({
              ids: [B, A, C, D],
              was: MIRRORED,
              status: 'pending',
              claimToken: null,
              claimSession: null,
              claimedAt: null,
              seq: { increment: 1 },
            }),
          })
        })

        it('queues it again with every fold, so a note it places, written after it was first queued, reaches Foundry first', async () => {
          const NEW = 'newNoteWaiting01'
          const note = write({
            noteId: NEW,
            op: 'create',
            chapterId: SESSION,
            queuedAt: ago(30_000),
          })
          held({ orders: [order({ queuedAt: ago(60_000) })], writes: [note] })

          await expect(
            reorder(thorin, [NEW, D, C, B, A]),
          ).resolves.toMatchObject({ ok: true })
          const { queuedAt } = folded().data as { queuedAt: Date }
          expect(queuedAt).toEqual(new Date(NOW))

          // Handed over oldest first: the note, then the order that places it.
          heldCampaign({ helloSession: 's1', ownerId: 'gm-1' })
          const refolded = order({ seq: 2, ids: [NEW, D, C, B, A], queuedAt })
          prismaMock.journalWrite.findMany
            .mockResolvedValueOnce([note] as any)
            .mockResolvedValueOnce([
              { ...note, book: { kind: 'party', actorId: 'company' } },
            ] as any)
          prismaMock.journalOrder.findMany
            .mockResolvedValueOnce([refolded] as any)
            .mockResolvedValueOnce([
              { ...refolded, book: { kind: 'party', actorId: 'company' } },
            ] as any)
          const commands = await claimNoteWrites('c1', 's1')
          expect(commands.map(({ note }) => note.op)).toEqual([
            'create',
            'order',
          ])
        })
      })

      describe('two orders at once', () => {
        it('lands only the first of two from the same stamp: the second is told 409 changed', async () => {
          held({ orders: [order()] })
          prismaMock.journalOrder.updateMany
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 0 })
          const { group } = await groupOf(thorin)
          const send = (ids: string[]) =>
            reorderNotes(thorin, party, {
              chapterId: SESSION,
              ids,
              stamp: group.stamp,
            })

          const [first, second] = await Promise.all([
            send([A, B, C, D]),
            send([B, A, C, D]),
          ])

          expect(first).toMatchObject({ ok: true })
          expect(second).toEqual({ ok: false, status: 409, reason: 'changed' })
        })

        it('answers the second of two first orders of a group 409 changed, never 500', async () => {
          prismaMock.journalOrder.create
            .mockResolvedValueOnce({} as any)
            .mockRejectedValueOnce(taken())

          const [first, second] = await Promise.all([
            reorder(thorin, [B, A, C, D]),
            reorder(vex, [D, A, B, C]),
          ])

          expect(first).toMatchObject({ ok: true })
          expect(second).toEqual({ ok: false, status: 409, reason: 'changed' })
        })
      })
    })

    describe('resolveOrder (§4.3, §7.7)', () => {
      it('sends the seat’s refused order again from Foundry’s order now, on the journal’s line', async () => {
        refused({ was: [B, A, C, D] })

        const answer = await choose(thorin, 'mine')

        expect(answer).toEqual({
          ok: true,
          stamp: expect.stringMatching(/^g:/),
        })
        expect(prismaMock.journalOrder.updateMany).toHaveBeenCalledWith({
          where: { id: O1, seq: 1, status: 'conflict' },
          data: {
            was: MIRRORED,
            status: 'pending',
            reason: null,
            seq: { increment: 1 },
            queuedAt: new Date(NOW),
          },
        })
        expect(bumped().update).toEqual({
          version: { increment: 1 },
          changedAt: new Date(NOW),
          changedBy: 'Thorin',
          changedIn: 'app',
        })
        held({ orders: [order({ seq: 2 })] })
        expect(await stampOf(thorin)).toBe(answer.ok ? answer.stamp : undefined)
      })

      it('tries a failed order again as it was, the Gamemaster another seat’s', async () => {
        refused({ status: 'failed', reason: 'error' })

        await expect(choose(gm, 'mine')).resolves.toMatchObject({ ok: true })
        expect(prismaMock.journalOrder.updateMany).toHaveBeenCalledWith({
          where: { id: O1, seq: 1, status: 'failed' },
          data: {
            status: 'pending',
            reason: null,
            seq: { increment: 1 },
            queuedAt: new Date(NOW),
          },
        })
        expect(bumped().update).toMatchObject({ changedBy: 'Gamemaster' })
      })

      it('drops it for theirs, Foundry’s order staying, recording no change', async () => {
        refused()

        const answer = await choose(thorin, 'theirs')

        expect(prismaMock.journalOrder.deleteMany).toHaveBeenCalledWith({
          where: { id: O1, seq: 1, status: 'conflict' },
        })
        expect(bumped().update).toEqual({ version: { increment: 1 } })
        held()
        expect(await stampOf(thorin)).toBe(answer.ok ? answer.stamp : undefined)
      })

      it('drops an order thought lost on its way for theirs, never for mine', async () => {
        held({ orders: [order({ status: 'claimed', claimedAt: ago(80_000) })] })

        await expect(choose(thorin, 'mine')).resolves.toEqual({
          ok: false,
          status: 409,
          reason: 'changed',
        })
        await expect(choose(thorin, 'theirs')).resolves.toMatchObject({
          ok: true,
        })
        expect(prismaMock.journalOrder.deleteMany).toHaveBeenCalledWith({
          where: {
            id: O1,
            seq: 1,
            status: 'claimed',
            claimedAt: { lt: ago(75_000) },
          },
        })
      })

      it('refuses: a group not shown 404, nothing refused 409, another member’s 403, a stale stamp 409, one settled meanwhile 409', async () => {
        await expect(
          choose(thorin, 'mine', 'noSuchChapter001'),
        ).resolves.toEqual({ ok: false, status: 404, reason: 'gone' })
        await expect(choose(thorin, 'theirs')).resolves.toEqual({
          ok: false,
          status: 409,
          reason: 'changed',
        })
        held({ orders: [order()] })
        await expect(choose(thorin, 'theirs')).resolves.toEqual({
          ok: false,
          status: 409,
          reason: 'changed',
        })
        refused()
        await expect(choose(vex, 'mine')).resolves.toEqual({
          ok: false,
          status: 403,
          reason: 'not-yours',
        })
        await expect(
          resolveOrder(thorin, party, {
            chapterId: SESSION,
            resolve: 'mine',
            stamp: 'g:0000000000000000',
          }),
        ).resolves.toEqual({ ok: false, status: 409, reason: 'changed' })
        prismaMock.journalOrder.updateMany.mockResolvedValue({ count: 0 })
        await expect(choose(thorin, 'mine')).resolves.toEqual({
          ok: false,
          status: 409,
          reason: 'changed',
        })
        expect(prismaMock.journalOrder.deleteMany).not.toHaveBeenCalled()
      })
    })

    describe('the journal’s line, from changes that leave no note (§2.6)', () => {
      it('records a delete by its seat', async () => {
        await expect(
          deleteNote(thorin, party, A, `n:${REV}`),
        ).resolves.toMatchObject({ ok: true })
        expect(bumped().update).toEqual({
          version: { increment: 1 },
          changedAt: new Date(NOW),
          changedBy: 'Thorin',
          changedIn: 'app',
        })
      })

      it('records a note dropped before it reached Foundry only where every seat saw it', async () => {
        const NEW = 'newNoteWaiting01'
        for (const [status, recorded] of [
          ['pending', true],
          ['claimed', true],
          ['failed', false],
        ] as const) {
          prismaMock.journalBook.upsert.mockClear()
          held({
            writes: [
              write({
                noteId: NEW,
                op: 'create',
                status,
                claimedAt: status === 'claimed' ? ago(80_000) : null,
              }),
            ],
          })

          await expect(
            deleteNote(thorin, party, NEW, `w:${W1}.2`),
          ).resolves.toMatchObject({ ok: true })
          expect(bumped().update).toEqual(
            recorded
              ? {
                  version: { increment: 1 },
                  changedAt: new Date(NOW),
                  changedBy: 'Thorin',
                  changedIn: 'app',
                }
              : { version: { increment: 1 } },
          )
        }
      })

      it('records a refused change sent again, mine, and never theirs', async () => {
        held({
          writes: [write({ noteId: A, status: 'conflict', reason: 'changed' })],
        })

        await expect(
          resolveNote(thorin, party, A, {
            resolve: 'mine',
            stamp: `w:${W1}.2`,
          }),
        ).resolves.toMatchObject({ ok: true })
        expect(bumped().update).toMatchObject({ changedBy: 'Thorin' })

        await expect(
          resolveNote(thorin, party, A, {
            resolve: 'theirs',
            stamp: `w:${W1}.2`,
          }),
        ).resolves.toMatchObject({ ok: true })
        expect(bumped().update).toEqual({ version: { increment: 1 } })
      })
    })
  })
})
