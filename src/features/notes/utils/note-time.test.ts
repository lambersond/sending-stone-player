import { fullNoteTime, noteTime } from './note-time'

/** A time on the viewer's own clock, whatever the time zone the tests run in. */
const at = (...parts: [number, number, number, number?, number?, number?]) =>
  new Date(...parts).getTime()
const iso = (...parts: [number, number, number, number?, number?, number?]) =>
  new Date(at(...parts)).toISOString()

describe('utils/note-time', () => {
  // 21 October 2026, 10:00 on the viewer's clock.
  const now = at(2026, 9, 21, 10, 0, 0)

  it.each([
    ['the same moment', iso(2026, 9, 21, 10, 0, 0), 'just now'],
    ['59 seconds before', iso(2026, 9, 21, 9, 59, 1), 'just now'],
    ['a time ahead of the clock', iso(2026, 9, 21, 10, 5, 0), 'just now'],
    ['a minute before', iso(2026, 9, 21, 9, 59, 0), '1 minute ago'],
    ['two minutes before', iso(2026, 9, 21, 9, 58, 0), '2 minutes ago'],
    ['59 minutes before', iso(2026, 9, 21, 9, 1, 0), '59 minutes ago'],
    ['an hour before', iso(2026, 9, 21, 9, 0, 0), '1 hour ago'],
    ['23 hours before', iso(2026, 9, 20, 11, 0, 0), '23 hours ago'],
    ['the day before, over a day ago', iso(2026, 9, 20, 8, 0, 0), 'yesterday'],
    ['earlier this year', iso(2026, 9, 19, 23, 0, 0), '19 Oct'],
    ['in another year', iso(2025, 9, 21, 10, 0, 0), '21 Oct 2025'],
    ['early in the year', iso(2026, 0, 2, 12, 0, 0), '2 Jan'],
    ['in September, as it reads everywhere', iso(2026, 8, 5), '5 Sep'],
  ])('says %s as "%s"', (_, value, words) => {
    expect(noteTime(value, now)).toBe(words)
  })

  it('says nothing of a time it can’t read', () => {
    expect(noteTime('not a time', now)).toBe('')
    expect(fullNoteTime('not a time')).toBe('')
  })

  it('gives the time in full, with its year, for its title', () => {
    expect(fullNoteTime(iso(2026, 9, 21, 9, 30, 0))).toMatch(/2026/)
  })

  it('reads the clock where it isn’t told the time', () => {
    jest.useFakeTimers({ now })
    try {
      expect(noteTime(iso(2026, 9, 21, 7, 0, 0))).toBe('3 hours ago')
    } finally {
      jest.useRealTimers()
    }
  })
})
