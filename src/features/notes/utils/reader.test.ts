import { showing, tidyCrossing, tidyText } from './reader'
import { noteEntry, tidyJournal } from '@/mocks/notes-server'
import type { NoteTidyView } from '@/types/notes'

describe('utils/reader', () => {
  it('reads a Tidy entry’s text with its paragraphs a space apart, as its card and search take it', () => {
    const [entry] = tidyJournal().entries
    expect(
      tidyText({
        ...entry,
        html: '<p>He sees far.</p><section class="secret"><p>He is the heir of Girion.</p></section>',
      }),
    ).toBe('He sees far. He is the heir of Girion.')
  })

  // Module 0.45.0: the Tidy entries are last in the reading order.
  it('crosses from the book’s last note to the first Tidy entry, and back', () => {
    const notes = [noteEntry({ id: 'first' }), noteEntry({ id: 'last' })]
    const tidy = tidyJournal().entries

    expect(tidyCrossing(notes, tidy)).toEqual({
      after: { pick: { tidy: tidy[0].key }, title: tidy[0].title },
      before: { pick: { note: 'last' }, title: notes[1].title },
    })
    expect(tidyCrossing([], tidy)).toEqual({})
    expect(tidyCrossing(notes, [])).toEqual({})
  })

  describe('a Tidy entry shown, deleted in Foundry', () => {
    const [a, b] = tidyJournal().entries
    const c: NoteTidyView = { ...b, key: 'journal:third', title: 'Third' }

    it.each([
      ['the next as they were', b.key, [a, c], { tidy: c.key }],
      ['the one before, for the last', c.key, [a, b], { tidy: b.key }],
      [
        'their page, for one never drawn',
        'journal:unseen',
        [a],
        { tidy: null },
      ],
    ])('gives way to %s', (_name, gone, left, pick) => {
      expect(
        showing({
          pick: { tidy: gone },
          groups: [],
          order: [],
          before: { order: [], tidy: [a, b, c] },
          tidy: left,
        }),
      ).toMatchObject({ pick, keep: true })
    })
  })
})
