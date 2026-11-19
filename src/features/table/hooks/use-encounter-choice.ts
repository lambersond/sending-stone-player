import { useState } from 'react'
import { shownEncounter } from '@/features/table/utils/combat'
import type { TableCombat } from '@/types/table'

/**
 * The encounter the Combat tab shows, of those under way (item 36), and `choose`, which shows
 * another. The one shown stays shown while it's listed, whatever else comes or goes; the first
 * time, or once it goes, it's the seat's own, else the first. It never follows the game on its own
 * (the owner's Q4): a turn elsewhere is marked on its tab instead.
 * @param combats - The encounters under way, as the view lists them.
 * @param preferred - The seat's own encounter, by id: the view's `combat`.
 */
export function useEncounterChoice(
  combats: readonly TableCombat[] | undefined,
  preferred?: string,
): { shown?: TableCombat; choose: (id: string) => void } {
  const [kept, setKept] = useState<string>()
  const shown = shownEncounter(combats, kept, preferred)
  // Kept as it's shown, so that a new encounter sorting first, or the seat's own changing, moves
  // nothing; adjusted as it renders, as `useTurnSaid` adjusts its own.
  if (shown?.id !== kept) setKept(shown?.id)
  return { shown, choose: setKept }
}
