import { createContext, use } from 'react'
import type { EnchantActions } from './types'

/*
 * Enchantments on the character's items, as dnd5e's enchant activities apply them, from module
 * 0.21.0: marked where the sheet lists the items, each said in full once one is open, and ended
 * from there, as dnd5e's chat card lets its caster end one.
 */

/** Nothing, until it's given, as where the game takes nothing. */
export const Actions = createContext<EnchantActions>({})

/** What the sheet does with enchantments, as it's given. */
export function useEnchanting(): EnchantActions {
  return use(Actions)
}
