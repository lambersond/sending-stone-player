import { EndConcentrationButton } from './concentration'
import type { ConcentrationActions } from './use-concentrating'
import type { ReactNode } from 'react'

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
  // Not a paragraph: the confirm's dialog, with its heading, is rendered beside its button.
  return (
    <div className='flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs'>
      <span className='min-w-0 flex-1 font-semibold'>
        Concentrating on {effect.name}
      </span>
      <EndConcentrationButton effect={effect} />
    </div>
  )
}
