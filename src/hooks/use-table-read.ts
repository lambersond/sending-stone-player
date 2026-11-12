import { createContext, useContext } from 'react'

/**
 * How a table page reads a view again at once (ROADMAP item 39). In a creature's pane, the view of
 * the creature whose pane it is: the character's table, as `useTableView` keeps it, or a
 * companion's own, as its pane's `useCompanionView` does. In the party sheet `GameTable` draws over
 * the character's (item 43), the character's table. Unset, as on a party's own page, it reads
 * nothing.
 */
export const TableReadContext = createContext<() => void>(() => {})

/**
 * Read the view again at once, and once more a moment later, as a roll or a move the game answered
 * ends.
 */
export function useTableRead(): () => void {
  return useContext(TableReadContext)
}
