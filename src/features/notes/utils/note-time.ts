/*
 * When a note was changed, as its list says it (round 0.34.0 §9.5): how long ago while that's
 * hours, then yesterday, then the day. Pure, so the list renders it only once it's in the browser,
 * whose clock and time zone are the viewer's own.
 */

/** A month's short name, the same in every locale, as "21 Oct" reads. */
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * How long ago a time was, in words: `just now` under a minute, then minutes, then hours for a
 * day, `yesterday` for the day before today, and else the day, with its year where it isn't this
 * one. A time ahead of the clock, as another device's may be, is just now.
 * @param iso - The time, as an ISO string.
 * @param now - The time now, in milliseconds.
 */
export function noteTime(iso: string, now: number = Date.now()): string {
  const at = new Date(iso)
  const ago = now - at.getTime()
  if (Number.isNaN(ago)) return ''
  if (ago < MINUTE) return 'just now'
  if (ago < HOUR) return count(Math.floor(ago / MINUTE), 'minute')
  if (ago < DAY) return count(Math.floor(ago / HOUR), 'hour')
  const today = new Date(now)
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1,
  )
  if (sameDay(at, yesterday)) return 'yesterday'
  const day = `${at.getDate()} ${MONTHS[at.getMonth()]}`
  return at.getFullYear() === today.getFullYear()
    ? day
    : `${day} ${at.getFullYear()}`
}

/** The time in full, in the viewer's own words for it: what the short one's `title` says. */
export function fullNoteTime(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleString(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  })
}

function count(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
