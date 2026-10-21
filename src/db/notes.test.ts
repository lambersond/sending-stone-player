/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- Prisma uses null for an absent value */
import { Prisma, type JournalNote, type JournalWrite } from '@prisma/client'
import { prismaMock } from '../../jest.setup'
import { recordNoteResult } from './note-sync'
import {
  changeNote,
  createNote,
  deleteNote,
  getNotesStatus,
  getNotesView,
  noteRights,
  previewNote,
  resolveNote,
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

describe('db/notes', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    heldCampaign()
    heldBook()
    prismaMock.$transaction.mockImplementation((run: any) => run(prismaMock))
    prismaMock.journalBook.upsert.mockResolvedValue({ id: 'book-1' } as any)
    prismaMock.journalWrite.count.mockResolvedValue(0)
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
        chapters: [],
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
        where: { requestedById: 'user-1', updatedAt: { gte: ago(60_000) } },
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
        where: { requestedById: string; updatedAt: { gte: Date } }
      }) =>
        Promise.resolve(
          rows.filter(
            row =>
              row.requestedById === where.requestedById &&
              row.updatedAt >= where.updatedAt.gte,
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
  })
})
