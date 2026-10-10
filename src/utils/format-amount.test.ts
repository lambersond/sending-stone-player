import { compactAmount } from './format-amount'

describe('utils/format-amount', () => {
  describe('compactAmount', () => {
    it.each([
      [1000, '1k'],
      [1050, '1k'],
      [1100, '1.1k'],
      [1999, '1.9k'],
      [12_877, '12.8k'],
      [41_500, '41.5k'],
      [999_999, '999.9k'],
      [1_000_000, '1M'],
      [1_250_000, '1.2M'],
      [1_299_999, '1.2M'],
      [999_999_999, '999.9M'],
      [1_234_567_890, '1,234.5M'],
    ])('shortens %d to %s, rounding down', (value, shown) => {
      expect(compactAmount(value)).toBe(shown)
    })

    it.each([
      [-1000, '-1k'],
      [-12_877, '-12.8k'],
      [-1_250_000, '-1.2M'],
    ])('shortens a debt of %d to %s, rounding towards zero', (value, shown) => {
      expect(compactAmount(value)).toBe(shown)
    })

    it.each([0, 1, 41.5, 999, 999.99, -999, Number.NaN, Infinity])(
      'leaves %d as it is',
      value => {
        expect(compactAmount(value)).toBeUndefined()
      },
    )
  })
})
