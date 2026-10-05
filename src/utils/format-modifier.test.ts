import { formatModifier } from './format-modifier'

describe('utils/format-modifier', () => {
  it.each([
    [5, '+5'],
    [0, '+0'],
    [-1, '−1'],
  ])('shows %d as %s', (value, shown) => {
    expect(formatModifier(value)).toBe(shown)
  })
})
