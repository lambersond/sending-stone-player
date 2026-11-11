import { useEffect, useState } from 'react'
import { secondsLeft } from '@/utils/countdown'

/**
 * The whole seconds left until a moment, by this page's clock, ticking down each second until it
 * comes, at none.
 */
export function useSecondsLeft(until: string): number {
  const at = Date.parse(until)
  const [now, setNow] = useState(() => Date.now())
  const left = secondsLeft(at, now)
  useEffect(() => {
    if (left <= 0) return
    // Checked often, to turn with the clock's seconds, but drawn again only as it does.
    const timer = setInterval(() => {
      const moment = Date.now()
      setNow(seen =>
        secondsLeft(at, moment) === secondsLeft(at, seen) ? seen : moment,
      )
    }, 200)
    return () => clearInterval(timer)
  }, [at, left])
  return left
}
