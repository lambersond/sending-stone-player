import { createContext, useContext } from 'react'
import type { CreatureFacts } from '@/types/table'

/**
 * The creature a pane is for, where it isn't the character (module 0.36.0): its name, and whose it
 * is, with the name of its character, for words such as why a roll wasn't made. Unset at the
 * character's own pane.
 */
export const CreatureContext = createContext<
  (CreatureFacts & { character: string }) | undefined
>(undefined)

/** The creature this pane is for; undefined at the character's own. */
export function useCreature() {
  return useContext(CreatureContext)
}
