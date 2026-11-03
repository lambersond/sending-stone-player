/**
 * @jest-environment node
 */
import { retryDelay } from './polling'

describe('utils/polling', () => {
  it.each([
    [0, 3000],
    [1, 6000],
    [2, 12_000],
    [3, 24_000],
    [4, 30_000],
    [10, 30_000],
  ])(
    'waits, every 3 s and at most 30 s, after %i failed attempts in a row, %i ms',
    (failures, delay) => {
      expect(retryDelay(3000, failures, 30_000)).toBe(delay)
    },
  )
})
