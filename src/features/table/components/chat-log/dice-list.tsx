import clsx from 'clsx'
import type { TableRoll } from '@/types/roll'

/** A roll's dice, each as it came up, those it dropped struck through. */
export function DiceList({ dice }: Readonly<{ dice: TableRoll['dice'] }>) {
  if (dice.length === 0) return
  return (
    <ul aria-label='Dice' className='flex flex-wrap gap-1'>
      {dice.map((die, index) => (
        <li
          key={index}
          className={clsx(
            'inline-flex h-6.5 min-w-6.5 items-center justify-center rounded-md border border-border bg-card px-1 font-mono text-xs',
            !die.active && 'text-text-secondary line-through',
          )}
        >
          {die.value}
          {!die.active && <span className='sr-only'> (dropped)</span>}
        </li>
      ))}
    </ul>
  )
}
