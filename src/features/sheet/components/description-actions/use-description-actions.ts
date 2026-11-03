import { createContext, use } from 'react'
import type { DescriptionActions } from './types'

export const Actions = createContext<DescriptionActions | undefined>(undefined)

/** What a description's links do here; nothing outside a sheet that says. */
export function useDescriptionActions(): DescriptionActions | undefined {
  return use(Actions)
}
