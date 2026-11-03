import { createContext, use } from 'react'
import type { SheetConcentrationEffect } from '@/types/sending-stone'

/**
 * What the sheet does with the character's concentrations: what they are, as the sheet says; and
 * end one, while the Gamemaster's game takes it from here.
 */
export type ConcentrationActions = {
  effects?: SheetConcentrationEffect[]
  end?: (effect: SheetConcentrationEffect) => void
}

/** Nothing, until it's given, as where the module says nothing of them. */
export const Actions = createContext<ConcentrationActions>({})

/** What the sheet does with the character's concentrations, as it's given. */
export function useConcentrating(): ConcentrationActions {
  return use(Actions)
}
