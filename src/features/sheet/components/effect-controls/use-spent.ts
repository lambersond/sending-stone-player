import { use } from 'react'
import { EffectsContext } from './use-effect-choice'
import type { Spent } from './types'

/** What became of each effect a die offered spent, by the sheet's id for it (module 0.42.1). */
export function useSpent(): (id: string) => Spent {
  const effects = use(EffectsContext)
  return (id: string) => {
    const effect = effects.effectOf(id)
    if (!effect) return { gone: true, removing: false, removable: false }
    const choice = effects.choiceFor(effect)
    const removable = choice?.ops.includes('delete') === true
    return { gone: false, removing: removable && !!choice?.waiting, removable }
  }
}
