import { createContext, useContext } from 'react'

/**
 * Whether nothing in this pane may roll (module 0.36.0): a companion no longer the seat's
 * character's, whose sheet shows as it was. Its tabs, rows and descriptions still open; every
 * control that would throw dice is disabled. Unlocked unless a pane says so.
 */
export const RollsLocked = createContext(false)

/** Whether this pane's rolls are locked, as a companion's that has gone. */
export function useRollsLocked(): boolean {
  return useContext(RollsLocked)
}
