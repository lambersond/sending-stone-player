'use client'

import { useToday } from './use-today'
import { formatTime } from './utils'
import type { LocalTimeProps } from './types'

/**
 * A time in the viewer's own time zone. The server cannot know it, so the time is filled in
 * once the page has hydrated rather than rendered twice with different results; and again when
 * the viewer's day turns, so an earlier day's time says its date.
 */
export function LocalTime({ value, className }: Readonly<LocalTimeProps>) {
  const today = useToday()
  return (
    <time dateTime={value} className={className}>
      {today ? formatTime(new Date(value), today) : ''}
    </time>
  )
}
