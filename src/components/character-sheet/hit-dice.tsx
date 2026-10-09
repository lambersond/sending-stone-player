import clsx from 'clsx'
import { HeartPulse } from 'lucide-react'
import type { HitDicePool } from '@/utils/formulas'

/**
 * A button that spends a hit die of one size, rolled with the player's dice for the hit points it
 * gives back, saying how many are left, of how many. None are spent with none left.
 */
export function HitDieButton({
  pool: { die, value, max },
  onSpend,
  className,
  children,
}: Readonly<{
  pool: HitDicePool
  onSpend: (die: string) => void
  /** Its spacing and type; else small, as a chip. */
  className?: string
  /** What it shows; else the hit die's size and how many are left. */
  children?: React.ReactNode
}>) {
  const left = value === null ? '' : `, ${value} of ${max ?? '?'} left`
  return (
    <button
      type='button'
      onClick={() => onSpend(die)}
      disabled={value === 0}
      aria-label={`Spend a ${die} hit die${left}`}
      className={clsx(
        'inline-flex items-center rounded-lg border border-border bg-card tabular-nums transition-colors hover:border-primary hover:bg-primary/5 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-card',
        className ?? 'gap-1 px-2 py-1 text-xs font-semibold',
      )}
    >
      {children ?? (
        <>
          <HeartPulse aria-hidden className='size-3.5 text-primary' />
          {die}
          <span className='font-normal text-text-secondary'>
            {value ?? '–'}/{max ?? '–'}
          </span>
        </>
      )}
    </button>
  )
}
