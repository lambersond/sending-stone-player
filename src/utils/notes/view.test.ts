import {
  foundryOnly,
  groupKey,
  groupStamp,
  noteRights,
  ordered,
  ordering,
  overlay,
  rightsFor,
  stampOf,
  viewOf,
  waiting,
} from './view'
import {
  heldBook,
  JOURNAL_IDS,
  journalAgo,
  journalOrder,
  journalWrite,
  mirrorNote,
} from '@/mocks/journal-rows'
import type { NotesSeat } from '@/types/notes'
import type { HeldBook } from '@/utils/notes/types'

const THORIN = JOURNAL_IDS.thorin
const VEX = JOURNAL_IDS.vex
const CAVE = JOURNAL_IDS.cave
const SESSION = JOURNAL_IDS.session
const REV = JOURNAL_IDS.revision
const W1 = JOURNAL_IDS.write

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

describe('utils/notes/view', () => {
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

  describe('waiting', () => {
    it('waits for a change not yet made, refused ones too', () => {
      expect(waiting(undefined)).toBe(false)
      expect(waiting(journalWrite({ status: 'made' }))).toBe(false)
      for (const status of [
        'pending',
        'claimed',
        'conflict',
        'failed',
      ] as const) {
        expect(waiting(journalWrite({ status }))).toBe(true)
      }
    })
  })

  describe('foundryOnly', () => {
    it.each([
      ['a chapter', mirrorNote({ role: 'chapter', format: 1 }), undefined],
      ['an entry in Markdown', mirrorNote(), undefined],
      ['one written in Foundry’s editor', mirrorNote({ format: 1 }), 'html'],
      ["a party's secret", mirrorNote({ format: 1, secret: true }), 'secret'],
      ['one cut short', mirrorNote({ cut: true }), 'long'],
      ['one too long', mirrorNote({ body: 'x'.repeat(200_000) }), 'long'],
      [
        'one with too long a title',
        mirrorNote({ title: 'x'.repeat(1000) }),
        'long',
      ],
    ])('keeps %s to Foundry: %s', (_, note, only) => {
      expect(foundryOnly(note)).toBe(only)
    })
  })

  describe('stampOf', () => {
    it('stamps a note by its change waiting, else by Foundry’s revision', () => {
      expect(stampOf(mirrorNote(), journalWrite())).toBe(`w:${W1}.2`)
      expect(stampOf(mirrorNote(), journalWrite({ status: 'made' }))).toBe(
        `n:${REV}`,
      )
      expect(stampOf(undefined, undefined)).toBe('n:')
    })
  })

  describe('overlay', () => {
    const note = mirrorNote()

    it("shows Foundry's version where nothing waits", () => {
      expect(overlay(note, undefined, true, true, thorin)).toMatchObject({
        role: 'entry',
        state: 'synced',
        mirrored: true,
        content: { title: 'The goblin cave', modifiedIn: 'app' },
        stamp: `n:${REV}`,
      })
      expect(overlay(undefined, undefined, true, true, thorin)).toBeUndefined()
      expect(
        overlay(note, journalWrite({ status: 'made' }), true, true, thorin)
          ?.state,
      ).toBe('synced')
    })

    it('shows a change on its way to every seat, as saving while the game takes notes, else waiting', () => {
      for (const status of ['pending', 'claimed'] as const) {
        const change = journalWrite({ status })
        expect(overlay(note, change, false, true, vex)).toMatchObject({
          state: 'saving',
          mirrored: false,
          content: { title: 'Goblin cave', modifiedIn: 'app' },
          stamp: `w:${W1}.2`,
        })
        expect(overlay(note, change, false, false, vex)?.state).toBe('waiting')
      }
    })

    it('shows a deletion on its way only to a seat that may change the note, as Foundry’s version going', () => {
      const deleting = journalWrite({ op: 'delete' })
      expect(overlay(note, deleting, true, true, thorin)).toMatchObject({
        state: 'deleting',
        mirrored: true,
        content: { title: 'The goblin cave' },
      })
      expect(overlay(note, deleting, false, true, vex)).toBeUndefined()
      expect(overlay(undefined, deleting, true, true, thorin)).toBeUndefined()
    })

    it("shows a change refused as changed in Foundry beside Foundry's version, to a seat that may change it", () => {
      const refused = journalWrite({ status: 'conflict', reason: 'changed' })
      expect(overlay(note, refused, true, true, thorin)).toMatchObject({
        state: 'conflict',
        reason: 'changed',
        mirrored: true,
        content: { title: 'The goblin cave' },
        mine: { title: 'Goblin cave' },
      })
      expect(
        overlay(note, refused, true, true, thorin)?.mine,
      ).not.toHaveProperty('by')
      // To the Gamemaster, named as whose it is.
      expect(overlay(note, refused, true, true, gm)?.mine).toHaveProperty(
        'by',
        'Thorin',
      )
      expect(overlay(note, refused, false, true, vex)).toMatchObject({
        state: 'synced',
        mirrored: true,
      })
    })

    it('shows a change refused as gone in Foundry as its own, only to a seat that may change it', () => {
      const gone = journalWrite({ status: 'conflict', reason: 'gone' })
      expect(overlay(note, gone, true, true, thorin)).toMatchObject({
        state: 'gone',
        reason: 'gone',
        mirrored: false,
        content: { title: 'Goblin cave' },
        mine: { title: 'Goblin cave' },
      })
      expect(overlay(note, gone, false, true, vex)).toBeUndefined()
      expect(
        overlay(
          undefined,
          journalWrite({ status: 'conflict', reason: 'changed' }),
          true,
          true,
          thorin,
        )?.state,
      ).toBe('gone')
    })

    it('shows a change that failed beside Foundry’s version, or as its own where it was to make the note', () => {
      const failed = journalWrite({ status: 'failed', reason: 'headings' })
      expect(overlay(note, failed, true, true, thorin)).toMatchObject({
        state: 'failed',
        reason: 'headings',
        mirrored: true,
        content: { title: 'The goblin cave' },
      })
      const made = journalWrite({
        status: 'failed',
        op: 'create',
        reason: 'odd',
      })
      expect(overlay(undefined, made, true, true, thorin)).toMatchObject({
        state: 'failed',
        // A reason the view doesn't know is an error.
        reason: 'error',
        mirrored: false,
        content: { title: 'Goblin cave' },
      })
      expect(overlay(undefined, made, false, true, vex)).toBeUndefined()
      expect(overlay(note, failed, false, true, vex)?.state).toBe('synced')
    })

    it("marks a deletion the module refused as the seat's own deleting", () => {
      const refused = journalWrite({
        op: 'delete',
        status: 'failed',
        reason: 'off',
      })
      expect(overlay(note, refused, true, true, thorin)?.mine).toMatchObject({
        deleting: true,
      })
    })
  })

  describe('rightsFor', () => {
    it('lets a seat change a chapter by renaming it, an entry by editing it', () => {
      const held = heldBook()
      const party = { ...held, book: { ...held.book, kind: 'party' as const } }
      const chapter = mirrorNote({ role: 'chapter', authorActorId: THORIN })
      expect(rightsFor(party, vex, chapter)).toMatchObject({
        role: 'chapter',
        mayChange: true,
      })
      expect(rightsFor(party, vex, mirrorNote())).toMatchObject({
        role: 'entry',
        mayChange: false,
      })
      expect(rightsFor(party, thorin, undefined, journalWrite())).toMatchObject(
        { role: 'entry', mayChange: true },
      )
    })
  })

  describe('groups', () => {
    it('keys a group by its chapter, or by none', () => {
      expect(groupKey(SESSION)).toBe(SESSION)
      expect(groupKey(null)).toBe('')
    })

    it('stamps what a seat was shown of a group’s order', () => {
      const stamp = groupStamp(null, ['a', 'b'])
      expect(stamp).toMatch(/^g:[\da-f]{16}$/)
      expect(groupStamp(null, ['a', 'b'])).toBe(stamp)
      expect(groupStamp(null, ['b', 'a'])).not.toBe(stamp)
      expect(groupStamp(`${W1}.0`, ['a', 'b'])).not.toBe(stamp)
    })

    it('puts the notes an order waiting lists first, in its order, then the rest', () => {
      const order = journalOrder({ ids: ['c', 'gone', 'a'] })
      expect(ordering(order)).toBe(true)
      expect(ordering(journalOrder({ status: 'claimed' }))).toBe(true)
      expect(ordering(journalOrder({ status: 'made' }))).toBe(false)
      expect(ordering(undefined)).toBe(false)
      expect(ordered(['a', 'b', 'c'], order)).toEqual(['c', 'a', 'b'])
      expect(
        ordered(
          ['a', 'b', 'c'],
          journalOrder({ ids: ['c'], status: 'failed' }),
        ),
      ).toEqual(['a', 'b', 'c'])
    })
  })

  describe('viewOf', () => {
    const chapter = mirrorNote({
      noteId: SESSION,
      role: 'chapter',
      title: 'Session 1',
      body: '',
      html: '<p>The road</p>',
      createdAt: journalAgo(7_200_000),
      modifiedAt: journalAgo(7_200_000),
    })
    const inChapter = (noteId: string, place: number, fields = {}) =>
      mirrorNote({ noteId, chapterId: SESSION, place, ...fields })

    it('shows the chapters oldest first, and the entries by group, each in Foundry’s order', () => {
      const { view } = viewOf(
        heldBook({
          notes: [
            inChapter('second0000000001', 1),
            chapter,
            inChapter('first00000000001', 0),
            mirrorNote(),
          ],
        }),
        thorin,
      )
      expect(view).toMatchObject({
        version: 4,
        kind: 'personal',
        journal: "Thorin's notes (Erebor)",
        live: true,
        enabled: true,
        canAdd: true,
        connected: true,
        canReorder: true,
        orders: true,
      })
      expect(view.chapters.map(({ id }) => id)).toEqual([SESSION])
      expect(view.chapters[0]).toMatchObject({
        html: '<p>The road</p>',
        canRename: true,
      })
      expect(
        view.groups.map(({ chapterId, state }) => [chapterId, state]),
      ).toEqual([
        [null, 'synced'],
        [SESSION, 'synced'],
      ])
      expect(view.entries.map(({ id }) => id)).toEqual([
        CAVE,
        'first00000000001',
        'second0000000001',
      ])
      expect(view.entries[0]).toMatchObject({
        body: '### Loot',
        canEdit: true,
        author: { name: 'Thorin' },
      })
      expect(view.lastChange).toEqual({
        by: 'Thorin',
        at: journalAgo(1_800_000).toISOString(),
      })
    })

    it('puts an entry in a chapter the seat isn’t shown in no chapter, and a new one last', () => {
      const { view } = viewOf(
        heldBook({
          notes: [inChapter('first00000000001', 0)],
          writes: [
            journalWrite({
              noteId: 'made000000000001',
              op: 'create',
              queuedAt: journalAgo(1000),
            }),
          ],
        }),
        thorin,
      )
      expect(view.entries.map(({ id, chapterId }) => [id, chapterId])).toEqual([
        ['first00000000001', null],
        ['made000000000001', null],
      ])
    })

    it('shows an order waiting, saving or waiting as the game takes orders, and a refused one only to its seat and the Gamemaster', () => {
      const notes = [
        mirrorNote({ noteId: 'a000000000000001', place: 0 }),
        mirrorNote({ noteId: 'b000000000000001', place: 1 }),
      ]
      const ids = ['b000000000000001', 'a000000000000001']
      const waitingOrder = journalOrder({ ids })
      const shown = viewOf(heldBook({ notes, orders: [waitingOrder] }), vex)
      expect(shown.view.groups[0].state).toBe('saving')
      expect(shown.view.entries.map(({ id }) => id)).toEqual(ids)
      expect(shown.groups.get('')?.base).toEqual(ids.toReversed())
      expect(
        viewOf(
          heldBook({ notes, orders: [waitingOrder], takesOrders: false }),
          vex,
        ).view.groups[0].state,
      ).toBe('waiting')

      const refused = journalOrder({ ids, status: 'conflict' })
      const own = viewOf(heldBook({ notes, orders: [refused] }), thorin).view
      expect(own.groups[0]).toMatchObject({
        state: 'conflict',
        reason: 'changed',
        mine: { ids },
      })
      expect(own.groups[0].mine).not.toHaveProperty('by')
      expect(
        viewOf(heldBook({ notes, orders: [refused] }), gm).view.groups[0].mine,
      ).toEqual({ ids, by: 'Thorin' })
      const other = viewOf(heldBook({ notes, orders: [refused] }), vex).view
      expect(other.groups[0].state).toBe('synced')
      expect(other.groups[0].stamp).toBe(groupStamp(null, ids.toReversed()))
      expect(
        viewOf(
          heldBook({
            notes,
            orders: [journalOrder({ ids, status: 'failed', reason: 'odd' })],
          }),
          thorin,
        ).view.groups[0],
      ).toMatchObject({ state: 'failed', reason: 'error' })
    })

    it('says why Foundry sends none of the book', () => {
      const party = heldBook()
      expect(
        viewOf(
          { ...party, book: { ...party.book, kind: 'party', private: true } },
          gm,
        ).view.withheld,
      ).toEqual({ reason: 'private' })
      const withheld = (value: NonNullable<HeldBook['row']>['withheld']) =>
        viewOf(heldBook({ row: { ...party.row!, withheld: value } }), thorin)
          .view.withheld
      expect(withheld({ reason: 'private' })).toEqual({ reason: 'private' })
      expect(withheld({ reason: 'tooLarge', bytes: 9, limit: 4 })).toEqual({
        reason: 'tooLarge',
        bytes: 9,
        limit: 4,
      })
      expect(withheld({ reason: 'tooLarge', bytes: '9' })).toEqual({
        reason: 'tooLarge',
      })
      expect(withheld(null)).toBeUndefined()
    })

    it("says the book's own last change where it is the latest, and none in a book never written in", () => {
      const at = journalAgo(10)
      expect(
        viewOf(heldBook({ changed: { at, by: 'Vex' } }), thorin).view
          .lastChange,
      ).toEqual({ by: 'Vex', at: at.toISOString() })
      const empty = viewOf(heldBook({ row: undefined }), thorin).view
      expect(empty).toMatchObject({ version: 0, journal: null })
      expect(empty).not.toHaveProperty('lastChange')
    })
  })
})
