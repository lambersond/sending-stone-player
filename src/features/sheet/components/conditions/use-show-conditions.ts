import { createContext, use } from 'react'

/** Opens the conditions panel, at a condition by its id, or at the top. */
export type ShowConditions = (id?: string) => void

export const Opener = createContext<ShowConditions | undefined>(undefined)

/** Opens the sheet's conditions panel; none outside a sheet that has one. */
export function useShowConditions(): ShowConditions | undefined {
  return use(Opener)
}
