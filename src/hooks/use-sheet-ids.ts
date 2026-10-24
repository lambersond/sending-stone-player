import { createContext, useContext } from 'react'

/**
 * What the ids in a sheet's pane begin with (module 0.36.0), so that no two panes on one page share
 * one: none at the character's own pane, `creature-<key>-` at a companion's. Its headings are named
 * by id, and the Actions tab's are numbered by place, so a duplicate would take its name from
 * another pane's section.
 */
export const SheetIdPrefix = createContext('')

/** An id in this sheet's pane, after its pane's prefix. */
export function useSheetId(id: string): string {
  return `${useContext(SheetIdPrefix)}${id}`
}
