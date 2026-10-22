/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- an entry in no chapter is null */
import {
  checkChange,
  noteChangeSchema,
  noteInputSchema,
  noteOrderResolveSchema,
  noteOrderSchema,
  notePreviewSchema,
  noteResolveSchema,
} from './notes'

const CHAPTER = 'sessionChapter01'

/** A note's id, 16 letters and digits, by its number. */
const id = (n: number) => `note${String(n).padStart(12, '0')}`
const ids = (count: number) => Array.from({ length: count }, (_, n) => id(n))

describe('schemas/notes', () => {
  describe('noteInputSchema', () => {
    it('takes an entry, its title trimmed, its body empty and in no chapter unless given', () => {
      expect(
        noteInputSchema.parse({ role: 'entry', title: '  Wolves ' }),
      ).toEqual({
        role: 'entry',
        title: 'Wolves',
        body: '',
        chapterId: null,
      })
      expect(
        noteInputSchema.parse({
          role: 'entry',
          title: 'Wolves',
          body: 'Three of them.',
          chapterId: CHAPTER,
        }),
      ).toEqual({
        role: 'entry',
        title: 'Wolves',
        body: 'Three of them.',
        chapterId: CHAPTER,
      })
    })

    it('takes a chapter, with its title alone', () => {
      expect(
        noteInputSchema.parse({ role: 'chapter', title: 'Session 1' }),
      ).toEqual({ role: 'chapter', title: 'Session 1' })
    })

    it.each([
      [
        'a chapter with a body',
        { role: 'chapter', title: 'a', body: '' },
        'body',
      ],
      [
        'a chapter in a chapter',
        { role: 'chapter', title: 'a', chapterId: CHAPTER },
        'chapterId',
      ],
      ['an empty title', { role: 'entry', title: ' '.repeat(3) }, 'title'],
      ['a title of 201', { role: 'entry', title: 'a'.repeat(201) }, 'title'],
      ['a title of two lines', { role: 'entry', title: 'a\nb' }, 'title'],
      ['a title with a return', { role: 'entry', title: 'a\rb' }, 'title'],
      [
        'a body of 20,001',
        { role: 'entry', title: 'a', body: 'a'.repeat(20_001) },
        'body',
      ],
      [
        'a chapter of another shape',
        { role: 'entry', title: 'a', chapterId: 'session-chapter1' },
        'chapterId',
      ],
      ['another role', { role: 'page', title: 'a' }, 'role'],
      [
        'the note’s id',
        { role: 'entry', title: 'a', id: 'goblinCaveNote01' },
        undefined,
      ],
    ])('refuses %s', (_name, input, field) => {
      const result = noteInputSchema.safeParse(input)

      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path[0]).toBe(field)
    })

    it('takes a title of 200 and a body of 20,000', () => {
      expect(
        noteInputSchema.safeParse({
          role: 'entry',
          title: 'a'.repeat(200),
          body: 'b'.repeat(20_000),
        }).success,
      ).toBe(true)
    })
  })

  describe('noteChangeSchema', () => {
    it('takes a change from a stamp, and nothing else', () => {
      expect(
        noteChangeSchema.parse({
          title: ' Wolves ',
          stamp: 'n:00000000000001',
        }),
      ).toEqual({ title: 'Wolves', stamp: 'n:00000000000001' })
      expect(
        noteChangeSchema.safeParse({ title: 'a', stamp: '' }).success,
      ).toBe(false)
      expect(
        noteChangeSchema.safeParse({ title: 'a', stamp: 'x'.repeat(81) })
          .success,
      ).toBe(false)
      expect(
        noteChangeSchema.safeParse({ title: 'a', stamp: 'n:', role: 'chapter' })
          .success,
      ).toBe(false)
    })

    it('takes a chapter’s title alone, as only the note’s role tells', () => {
      const change = { title: 'a', body: '', stamp: 'n:' }

      expect(checkChange(change, 'chapter')).toEqual({ field: 'body' })
      expect(
        checkChange({ title: 'a', chapterId: null, stamp: 'n:' }, 'chapter'),
      ).toEqual({ field: 'chapterId' })
      expect(checkChange(change, 'entry')).toBeUndefined()
      expect(
        checkChange({ title: 'a', stamp: 'n:' }, 'chapter'),
      ).toBeUndefined()
    })
  })

  it('takes the seat’s choice, and a preview’s body, and nothing more', () => {
    expect(
      noteResolveSchema.parse({ resolve: 'mine', stamp: 'w:a.1' }),
    ).toEqual({
      resolve: 'mine',
      stamp: 'w:a.1',
    })
    expect(
      noteResolveSchema.safeParse({ resolve: 'both', stamp: 'w:a.1' }).success,
    ).toBe(false)
    expect(notePreviewSchema.parse({ body: '### a' })).toEqual({
      body: '### a',
    })
    expect(
      notePreviewSchema.safeParse({ body: 'a'.repeat(20_001) }).success,
    ).toBe(false)
    expect(notePreviewSchema.safeParse({ body: 'a', role: 'x' }).success).toBe(
      false,
    )
  })

  describe('noteOrderSchema (module 0.35.0)', () => {
    /** The first field a refused order names. */
    const field = (order: unknown) => {
      const parsed = noteOrderSchema.safeParse(order)
      return parsed.success ? undefined : parsed.error.issues[0]?.path[0]
    }

    it('takes a group’s notes in a new order, one to 400 of them, a chapter’s or those in none', () => {
      for (const [chapterId, count] of [
        [CHAPTER, 1],
        [null, 400],
      ] as const) {
        const order = {
          chapterId,
          ids: ids(count),
          stamp: 'g:0123456789abcdef',
        }
        expect(noteOrderSchema.parse(order)).toEqual(order)
      }
    })

    it.each([
      ['no notes', { ids: [] }, 'ids'],
      ['401 notes', { ids: ids(401) }, 'ids'],
      ['a note twice', { ids: [id(1), id(2), id(1)] }, 'ids'],
      ['a 15-character id', { ids: [id(1), 'note00000000000'] }, 'ids'],
      ['another field', { title: 'Wolves' }, undefined],
      ['no chapter said', { chapterId: undefined }, 'chapterId'],
      ['a chapter that’s no note’s id', { chapterId: 'a b' }, 'chapterId'],
      ['no stamp', { stamp: '' }, 'stamp'],
    ])('refuses %s, naming its field', (_name, fields, named) => {
      const order = {
        chapterId: CHAPTER,
        ids: [id(1), id(2)],
        stamp: 'g:0123456789abcdef',
        ...fields,
      }
      expect(noteOrderSchema.safeParse(order).success).toBe(false)
      expect(field(order)).toBe(named)
    })

    it('takes the seat’s choice on a refused order, and nothing more', () => {
      const choice = {
        chapterId: null,
        resolve: 'theirs',
        stamp: 'g:0123456789abcdef',
      }
      expect(noteOrderResolveSchema.parse(choice)).toEqual(choice)
      for (const wrong of [
        { ...choice, resolve: 'both' },
        { ...choice, chapterId: undefined },
        { ...choice, stamp: 's'.repeat(81) },
        { ...choice, ids: [id(1)] },
      ]) {
        expect(noteOrderResolveSchema.safeParse(wrong).success).toBe(false)
      }
    })
  })
})
