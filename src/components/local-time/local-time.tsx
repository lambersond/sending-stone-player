'use client'

import { formatTime } from './utils'
import { useHydrated } from '@/hooks/use-hydrated'
import type { LocalTimeProps } from './types'

/**
 * A time in the viewer's own time zone. The server cannot know it, so the time is filled in
 * once the page has hydrated rather than rendered twice with different results.
 */
export function LocalTime({ value, className }: Readonly<LocalTimeProps>) {
  const hydrated = useHydrated()
  return (
    <time dateTime={value} className={className}>
      {hydrated ? formatTime(new Date(value)) : ''}
    </time>
  )
}
