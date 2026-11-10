import { isLive } from './live'

describe('utils/live', () => {
  describe('isLive', () => {
    const now = Date.parse('2026-10-04T20:00:00Z')

    it('is live for two minutes after anything arrives', () => {
      expect(isLive(new Date(now - 119_000), now)).toBe(true)
      expect(isLive(new Date(now - 120_000), now)).toBe(false)
      expect(isLive(null, now)).toBe(false)
      expect(isLive(undefined, now)).toBe(false)
    })
  })
})
