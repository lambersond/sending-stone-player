import {
  bookCounts,
  chapterKnown,
  current,
  foldedOp,
  mirrorOrder,
  sentAgain,
  writerName,
} from './book'
import {
  heldBook,
  JOURNAL_IDS,
  journalAgo,
  journalWrite,
  mirrorNote,
} from '@/mocks/journal-rows'
import type { NotesSeat } from '@/types/notes'

const {
  thorin: THORIN,
  cave: CAVE,
  session: SESSION,
  revision: REV,
} = JOURNAL_IDS

const thorin: NotesSeat = {
  role: 'player',
  userId: 'user-1',
  actorId: THORIN,
  name: 'Thorin (as the seat knows him)',
}

describe('utils/notes/book', () => {
  describe('writerName', () => {
    it("writes as the Gamemaster, or as the character the campaign names, else the seat's", () => {
      const held = heldBook()
      expect(writerName(held, { ...thorin, role: 'gm', actorId: null })).toBe(
        'Gamemaster',
      )
      expect(writerName(held, thorin)).toBe('Thorin')
      expect(writerName(heldBook({ names: new Map() }), thorin)).toBe(
        'Thorin (as the seat knows him)',
      )
    })
  })

  describe('current', () => {
    it("says what a change waiting says, else Foundry's, and nothing of a note going", () => {
      const note = mirrorNote()
      expect(current(note, journalWrite())?.title).toBe('Goblin cave')
      expect(current(note, journalWrite({ status: 'made' }))?.title).toBe(
        'The goblin cave',
      )
      expect(current(note, journalWrite({ op: 'delete' }))?.title).toBe(
        'The goblin cave',
      )
      expect(current(undefined, journalWrite({ op: 'delete' }))).toBeUndefined()
      expect(current()).toBeUndefined()
    })
  })

  describe('chapterKnown', () => {
    it("knows Foundry's chapters, and one made here on its way", () => {
      const chapter = mirrorNote({ noteId: SESSION, role: 'chapter' })
      expect(chapterKnown(heldBook({ notes: [chapter] }), SESSION)).toBe(true)
      expect(chapterKnown(heldBook({ notes: [mirrorNote()] }), CAVE)).toBe(
        false,
      )
      const made = journalWrite({
        noteId: SESSION,
        role: 'chapter',
        op: 'create',
      })
      expect(chapterKnown(heldBook({ writes: [made] }), SESSION)).toBe(true)
      expect(
        chapterKnown(
          heldBook({ writes: [{ ...made, status: 'made' }] }),
          SESSION,
        ),
      ).toBe(false)
    })
  })

  describe('bookCounts', () => {
    it("counts the entries and chapters as they'll stand, and the entries' text but a note's own", () => {
      const held = heldBook({
        notes: [
          mirrorNote(),
          mirrorNote({ noteId: SESSION, role: 'chapter', body: '' }),
          mirrorNote({ noteId: 'goingNote0000001', body: '12345' }),
        ],
        writes: [
          journalWrite({ noteId: 'goingNote0000001', op: 'delete' }),
          journalWrite({
            noteId: 'madeNote00000001',
            op: 'create',
            body: '123',
          }),
        ],
      })
      expect(bookCounts(held)).toEqual({
        entryCount: 2,
        chapterCount: 1,
        text: '### Loot'.length + 3,
      })
      expect(bookCounts(held, CAVE).text).toBe(3)
    })
  })

  describe('foldedOp', () => {
    it.each([
      ['create', 'update', 'create'],
      ['update', 'update', 'update'],
      ['delete', 'update', 'update'],
      ['create', 'delete', 'delete'],
      ['update', 'delete', 'delete'],
    ] as const)('folds a %s and an %s into a %s', (waiting, change, op) => {
      expect(foldedOp(waiting, change)).toBe(op)
    })
  })

  describe('sentAgain', () => {
    const note = mirrorNote({ revision: 'mirrorRev00001' })
    const refused = journalWrite({
      status: 'conflict',
      reason: 'changed',
      foundryRev: 'refusalRev0001',
    })

    it('sends a change that failed otherwise again as it was', () => {
      expect(
        sentAgain(journalWrite({ status: 'failed' }), note, false),
      ).toEqual({})
    })

    it('makes the note again where Foundry deleted it', () => {
      expect(
        sentAgain({ ...refused, reason: 'gone' }, undefined, false),
      ).toEqual({ op: 'create', base: null })
    })

    it("makes it from Foundry's revision now: the mirror's, or the refusal's where Foundry holds the book back", () => {
      expect(sentAgain(refused, note, false)).toEqual({
        base: 'mirrorRev00001',
      })
      expect(sentAgain(refused, note, true)).toEqual({ base: 'refusalRev0001' })
      expect(sentAgain(refused, undefined, false)).toEqual({
        base: 'refusalRev0001',
      })
      expect(
        sentAgain({ ...refused, foundryRev: null }, undefined, true),
      ).toEqual({ base: REV })
    })
  })

  describe('mirrorOrder', () => {
    it('orders a group’s entries by their place, then by when each was written, then id', () => {
      const held = heldBook({
        notes: [
          mirrorNote({ noteId: 'c', place: 1 }),
          mirrorNote({ noteId: 'b', place: 0, createdAt: journalAgo(10) }),
          mirrorNote({ noteId: 'a', place: 0, createdAt: journalAgo(10) }),
          mirrorNote({ noteId: 'z', place: 0, createdAt: journalAgo(20) }),
          mirrorNote({ noteId: 'inChapter0000001', chapterId: SESSION }),
          mirrorNote({ noteId: SESSION, role: 'chapter' }),
        ],
      })
      expect(mirrorOrder(held, null)).toEqual(['z', 'a', 'b', 'c'])
      expect(mirrorOrder(held, SESSION)).toEqual(['inChapter0000001'])
    })
  })
})
