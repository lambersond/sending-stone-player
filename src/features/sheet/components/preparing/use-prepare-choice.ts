import { createContext, use } from 'react'
import type { PrepareChoice } from './types'

/** What a pane offers of its character's spells: none where they can't be changed here. */
export type Preparations = {
  choiceFor: (id: string) => PrepareChoice | undefined
}

/**
 * None, as wherever a sheet's spells can't be prepared from here: a party's sheet, a companion's
 * pane, the Gamemaster's page, a game that doesn't take it, and any row drawn outside a pane.
 */
export const NO_PREPARING: Preparations = {
  // eslint-disable-next-line unicorn/no-useless-undefined -- none, for every row
  choiceFor: () => undefined,
}

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
