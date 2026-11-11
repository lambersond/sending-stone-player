import { createContext, useContext } from 'react'
import type { ShowHelp } from '@/features/help/types'

/**
 * Opens Help, on a character's page, which provides it: so that the settings menu's How to use
 * Sending Stone, in every pane's cog, opens the page's one Help. Unset elsewhere.
 */
export const ShowHelpContext = createContext<ShowHelp | undefined>(undefined)

/** Opens the page's Help; undefined where no page provides it. */
export function useShowHelp(): ShowHelp | undefined {
  return useContext(ShowHelpContext)
}
