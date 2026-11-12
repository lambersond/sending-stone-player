import { createContext, useContext } from 'react'

/**
 * How a table page reads the view of the creature whose pane this is again at once (ROADMAP item
 * 39): the character's table, as `useTableView` keeps it, or a companion's own, as its pane's
 * `useCompanionView` does. Unset, it reads nothing.
 */
export const TableReadContext = createContext<() => void>(() => {})

/** Read the view again at once, and once more a moment later, as a roll the game answered ends. */
export function useTableRead(): () => void {
  return useContext(TableReadContext)
}
