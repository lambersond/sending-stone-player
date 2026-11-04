import { useSyncExternalStore } from 'react'
import { untilTomorrow } from './utils'

/** Tells `onDayTurn` at each local midnight, until unsubscribed. */
function subscribe(onDayTurn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const arm = () => {
    timer = setTimeout(() => {
      onDayTurn()
      arm()
    }, untilTomorrow(new Date()))
  }
  arm()
  return () => clearTimeout(timer)
}

const today = () => new Date().toDateString()

/** What a server render knows of the viewer's day: nothing. */
const onServer = () => ''

/**
 * The viewer's own day, as `Date.toDateString` names it, which changes at their midnight, so what
 * reads it is rendered again then, though nothing else is. Empty on the server and until the page
 * has hydrated, as the server cannot know the viewer's time zone.
 */
export function useToday(): string {
  return useSyncExternalStore(subscribe, today, onServer)
}
