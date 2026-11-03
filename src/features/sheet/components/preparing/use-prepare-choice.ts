import { createContext, use } from 'react'
import { NO_PREPARING } from './constants'
import type { PrepareChoice, Preparations } from './types'

export const PreparingContext = createContext<Preparations>(NO_PREPARING)

/**
 * A spell row's Prepare or Unprepare, where it has one: none for a row that names no spell, or
 * outside a pane that offers them. Called whatever the row is, as a hook is called each render.
 * @param id - The spell's id on the sheet, as an action of it names it too.
 */
export function usePrepareChoice(id?: string): PrepareChoice | undefined {
  const { choiceFor } = use(PreparingContext)
  return id ? choiceFor(id) : undefined
}
