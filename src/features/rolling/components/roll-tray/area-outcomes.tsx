import clsx from 'clsx'
import type { TableRollState } from '@/types/roll'

/**
 * Whom an area attack at more than one hit, and whom it missed, by name, as the game shows
 * players; nothing of one the game says nothing of.
 */
export function AreaOutcomes({ state }: Readonly<{ state: TableRollState }>) {
  const targets = state.attack?.targets ?? []
  if (targets.length < 2 || targets.every(({ outcome }) => outcome === null)) {
    return
  }
  return (
    <ul aria-label='Targets' className='mt-0.5 flex flex-wrap gap-x-3 text-xs'>
      {targets.map(({ combatantId, outcome }) => (
        <li key={combatantId} className='text-text-secondary'>
          {state.targetNames?.[combatantId] ?? 'A target'}
          {outcome && (
            <span
              className={clsx(
                'font-semibold',
                outcome === 'hit' ? 'text-text-primary' : 'text-text-secondary',
              )}
            >
              {': '}
              {outcome === 'hit' ? 'Hit' : 'Miss'}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
