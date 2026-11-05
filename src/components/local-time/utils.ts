export function formatTime(date: Date, today: string): string {
  return today === date.toDateString()
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
}

/** How long from `now` until the next local midnight, in milliseconds. */
export function untilTomorrow(now: Date): number {
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  )
  return tomorrow.getTime() - now.getTime()
}
