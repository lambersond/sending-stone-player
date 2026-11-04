import { createElement, type ReactNode } from 'react'
import { ConcentrationLeadRow } from './concentration-lead-row'
import type { ConcentrationActions } from './types'

/**
 * What an effect's row shows once it's open, where the effect is one of the character's
 * concentrations, while the game takes ending it from here: what's concentrated on, and End. None
 * for any other effect.
 */
export function concentrationLead(
  effectId: string,
  actions: ConcentrationActions,
): ReactNode {
  const effect = actions.effects?.find(({ id }) => id === effectId)
  if (!effect || !actions.end) return
  return createElement(ConcentrationLeadRow, { effect })
}
