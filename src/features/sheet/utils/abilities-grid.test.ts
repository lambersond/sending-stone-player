/**
 * @jest-environment node
 */
import { abilitiesGrid } from './abilities-grid'

describe('abilitiesGrid', () => {
  it.each([
    ['none, as one', 0, 'grid grid-cols-1 gap-2'],
    ['one', 1, 'grid grid-cols-1 gap-2'],
    [
      'four, four to a row from 384 px',
      4,
      'grid grid-cols-2 gap-2 @sm:grid-cols-4',
    ],
    ['five, in a row from 576 px', 5, 'grid grid-cols-3 gap-2 @xl:grid-cols-5'],
    ['six, as ever', 6, 'grid grid-cols-3 gap-2 @xl:grid-cols-6'],
    [
      'seven, four and three, in a row only where widest',
      7,
      'grid grid-cols-3 gap-2 @sm:grid-cols-4 @5xl:grid-cols-7',
    ],
    [
      'eight, four and four, in a row only where widest',
      8,
      'grid grid-cols-3 gap-2 @sm:grid-cols-4 @5xl:grid-cols-8',
    ],
    [
      'nine, in two rows of five and four',
      9,
      'grid grid-cols-3 gap-2 @xl:grid-cols-5',
    ],
    ['ten', 10, 'grid grid-cols-3 gap-2 @sm:grid-cols-4 @xl:grid-cols-5'],
    ['twelve', 12, 'grid grid-cols-3 gap-2 @sm:grid-cols-4 @xl:grid-cols-6'],
    [
      'sixteen, eight to a row only where widest',
      16,
      'grid grid-cols-3 gap-2 @sm:grid-cols-4 @xl:grid-cols-6 @5xl:grid-cols-8',
    ],
  ])('lays out %s', (_name, count, classes) => {
    expect(abilitiesGrid(count)).toBe(classes)
  })
})
