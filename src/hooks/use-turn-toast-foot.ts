import { createContext, useContext } from 'react'

/**
 * Where the turn's toast ends, in pixels from the top of the screen, while one shows (module
 * 0.36.0): the roll toasts start below it.
 */
export const TurnToastContext = createContext<number | undefined>(undefined)

/** Where the turn's toast ends while one shows; undefined while none does. */
export function useTurnToastFoot(): number | undefined {
  return useContext(TurnToastContext)
}
