import { useId } from 'react'
import { Minus, Plus } from 'lucide-react'
import { TRAY_STEP } from './constants'
import { canStep } from './utils'
import { formatModifier } from '@/utils/format-modifier'
import type { Live } from './types'

/**
 * The number added to the tray's dice, or taken away, one up or down a tap, from −100 to +100: +0
 * until changed.
 * @param live - Whether its change is said, as a step is, or made unsaid, as a clear's is.
 */
export function BonusStepper({
  bonus,
  live,
  onStep,
}: Readonly<{ bonus: number; live: Live; onStep: (by: 1 | -1) => void }>) {
  const label = useId()
  return (
    <div
      role='group'
      aria-labelledby={label}
      className='flex items-center justify-between gap-3'
    >
      <span id={label} className='text-sm text-text-secondary'>
        Modifier
      </span>
      <div className='flex items-center rounded-full border border-border bg-page'>
        <button
          type='button'
          aria-label='Lower the modifier'
          aria-disabled={!canStep(bonus, -1)}
          onClick={() => onStep(-1)}
          className={TRAY_STEP}
        >
          <Minus aria-hidden className='size-4' />
        </button>
        <output
          aria-live={live}
          className='min-w-10 text-center text-sm font-semibold tabular-nums'
        >
          {formatModifier(bonus)}
        </output>
        <button
          type='button'
          aria-label='Raise the modifier'
          aria-disabled={!canStep(bonus, 1)}
          onClick={() => onStep(1)}
          className={TRAY_STEP}
        >
          <Plus aria-hidden className='size-4' />
        </button>
      </div>
    </div>
  )
}
