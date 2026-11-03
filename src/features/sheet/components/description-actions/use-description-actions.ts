import { createContext, use } from 'react'
import type { DescriptionActions } from './types'

/*
 * What the links in the sheet's descriptions do: a saving throw or check a description calls for,
 * the table asked for it or the player's own rolled; its damage or healing and its own rolls,
 * rolled with the player's dice, and in the Gamemaster's game too, where it takes them, damage as a
 * critical hit's or changed too; and a condition it names, its rules shown. The sheet gives them
 * once, for every tab, favorite and dialog in it.
 */

export const Actions = createContext<DescriptionActions | undefined>(undefined)

/** What a description's links do here; nothing outside a sheet that says. */
export function useDescriptionActions(): DescriptionActions | undefined {
  return use(Actions)
}
