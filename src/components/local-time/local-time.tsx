'use client'

import { useHydrated } from '@/hooks/use-hydrated'

type Props = { value: string; className?: string }

/**
 * A time in the viewer's own time zone. The server cannot know it, so the time is filled in
 * once the page has hydrated rather than rendered twice with different results.
 */
export function LocalTime({ value, className }: Readonly<Props>) {
  const hydrated = useHydrated()
  return (
    <time dateTime={value} className={className}>
      {hydrated ? formatTime(new Date(value)) : ''}
    </time>
  )
}

function formatTime(date: Date): string {
  const today = new Date().toDateString() === date.toDateString()
  return today
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
}
