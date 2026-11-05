import { useSyncExternalStore } from 'react'
import { untilTomorrow } from './utils'

// Every time shown shares one timer: set as the first subscribes, cleared as the last leaves.
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

/** Sets the timer for the next local midnight, which tells every listener and sets it again. */
function arm(): void {
  timer = setTimeout(() => {
    arm()
    for (const onDayTurn of listeners) onDayTurn()
  }, untilTomorrow(new Date()))
}

/** Tells `onDayTurn` at each local midnight, until unsubscribed. */
function subscribe(onDayTurn: () => void): () => void {
  listeners.add(onDayTurn)
  if (listeners.size === 1) arm()
  return () => {
    listeners.delete(onDayTurn)
    if (listeners.size === 0) clearTimeout(timer)
  }
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
