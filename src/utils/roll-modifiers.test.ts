import { formatExtraTerm, parseExtraTerms } from './roll-modifiers'

describe('utils/roll-modifiers', () => {
  describe('parseExtraTerms', () => {
    it.each([
      ['', []],
      [' '.repeat(3), []],
      ['1d4', [{ sign: 1, count: 1, sides: 4 }]],
      ['d8', [{ sign: 1, count: 1, sides: 8 }]],
      ['-1d6', [{ sign: -1, count: 1, sides: 6 }]],
      ['−1d6', [{ sign: -1, count: 1, sides: 6 }]],
      ['+5', [{ sign: 1, flat: 5 }]],
      ['2D6', [{ sign: 1, count: 2, sides: 6 }]],
      [
        '1d4 + 2',
        [
          { sign: 1, count: 1, sides: 4 },
          { sign: 1, flat: 2 },
        ],
      ],
      [
        '1d4, -1d6, +5, 2d6',
        [
          { sign: 1, count: 1, sides: 4 },
          { sign: -1, count: 1, sides: 6 },
          { sign: 1, flat: 5 },
          { sign: 1, count: 2, sides: 6 },
        ],
      ],
      [
        '1d100-1',
        [
          { sign: 1, count: 1, sides: 100 },
          { sign: -1, flat: 1 },
        ],
      ],
    ])('reads %p', (input, terms) => {
      expect(parseExtraTerms(input)).toEqual({ ok: true, terms })
    })

    it.each([
      ['1d4 2', "Couldn't read"],
      ['bless', "Couldn't read “bless”"],
      [', 1d4', "Couldn't read"],
      ['1d4 +', "Couldn't read"],
      ['1d7', "There's no d7. Use d4, d6, d8, d10, d12, d20 or d100."],
      ['0d6', 'Roll between 1 and 20 of a die at once.'],
      ['21d6', 'Roll between 1 and 20 of a die at once.'],
      ['+101', 'Add at most 100 at once.'],
    ])('refuses %p', (input, error) => {
      const result = parseExtraTerms(input)

      expect(result.ok).toBe(false)
      expect(!result.ok && result.error).toContain(error)
    })
  })

  it.each([
    [{ sign: 1 as const, count: 1, sides: 4 as const }, '+1d4'],
    [{ sign: -1 as const, count: 2, sides: 6 as const }, '−2d6'],
    [{ sign: -1 as const, flat: 2 }, '−2'],
  ])('writes %o as %s', (term, text) => {
    expect(formatExtraTerm(term)).toBe(text)
  })
})
