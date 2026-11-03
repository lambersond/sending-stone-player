import { createContext, use } from 'react'
import type { ConcentrationActions } from './types'

/** Nothing, until it's given, as where the module says nothing of them. */
export const Actions = createContext<ConcentrationActions>({})

/** What the sheet does with the character's concentrations, as it's given. */
export function useConcentrating(): ConcentrationActions {
  return use(Actions)
}
