import { createContext, use } from 'react'
import type { ChargeActions } from '@/features/sheet/components/charging/types'

/** Nothing, until it's given, as where the game takes neither. */
export const Actions = createContext<ChargeActions>({})

/** What the sheet does with the character's counters, as it's given. */
export function useCharging(): ChargeActions {
  return use(Actions)
}
