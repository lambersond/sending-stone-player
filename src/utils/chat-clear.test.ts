/**
 * @jest-environment node
 */
import { postedBeforeClear } from './chat-clear'

const CLEARED = new Date('2026-11-04T20:00:00.000Z')

describe('utils/chat-clear', () => {
  it.each([
    ['never cleared', CLEARED.getTime() - 1000, null, false],
    ['posted before the clear', CLEARED.getTime() - 1000, CLEARED, true],
    ['posted as it was cleared', CLEARED.getTime(), CLEARED, true],
    ['posted after the clear', CLEARED.getTime() + 1000, CLEARED, false],
  ])('%s', (_, timestamp, clearedAt, before) => {
    expect(postedBeforeClear(timestamp, clearedAt)).toBe(before)
  })
})
