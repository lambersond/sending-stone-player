import type { RollTarget } from '../types'
import type { SheetRoll } from '@/types/roll'

/**
 * A check, save or attack rolled from the sheet, as it's sent to be rolled: its target's label,
 * modifier and source, with `advantage`, and whether the player chose how to roll it (`explicit`),
 * as in dnd5e's roll dialog; and where given, the extra dice or numbers added, the DC a description
 * names, and what a description's link asks, such as a concentration check.
 */
export function rollOf(
  target: RollTarget,
  advantage: SheetRoll['advantage'],
  explicit: boolean,
  { extras, dc, ask }: Pick<SheetRoll, 'extras' | 'dc' | 'ask'> = {},
): SheetRoll {
  return {
    label: target.label,
    modifier: target.modifier,
    advantage,
    ...(extras && { extras }),
    source: target.source,
    explicit,
    ...(dc !== undefined && { dc }),
    ...(ask && { ask }),
  }
}
