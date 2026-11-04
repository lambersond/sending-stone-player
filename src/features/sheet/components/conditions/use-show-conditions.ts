import { createContext, use } from 'react'
import type { ShowConditions } from './types'

export const Opener = createContext<ShowConditions | undefined>(undefined)

/** Opens the sheet's conditions panel; none outside a sheet that has one. */
export function useShowConditions(): ShowConditions | undefined {
  return use(Opener)
}
