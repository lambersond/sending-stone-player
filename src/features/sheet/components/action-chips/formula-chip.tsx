'use client'

import clsx from 'clsx'
import { Dices } from 'lucide-react'
import { formulaRollOf } from './utils'
import { useRollsLocked } from '@/hooks/use-rolls-locked'
import type { SheetFormulaRoll } from '@/types/roll'
import type { SheetAction } from '@/types/sending-stone'

/**
 * An activity's own formula, such as a light's radius or a fall's distance, as a button that
 * rolls it any time, apart from using the activity: in the Gamemaster's game too, while it may be
 * used there. A formula the app can't read is shown, but not rolled.
 */
export function FormulaChip({
  action,
  onRoll,
}: Readonly<{
  action: SheetAction
  onRoll?: (roll: SheetFormulaRoll) => void
}>) {
  // A gone companion's pane rolls nothing (module 0.36.0).
  const locked = useRollsLocked()
  const own = action.rollFormula
  if (!own) return
  const roll = formulaRollOf(action)
  const chip =
    'inline-flex max-w-36 shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-sm font-semibold tabular-nums'
  const content = (
    <>
      <Dices aria-hidden className='size-3.5 shrink-0 text-primary' />
      <span className='truncate'>{own.formula}</span>
    </>
  )
  const title = own.name ?? undefined
  if (!roll || !onRoll) {
    return (
      <span className={chip} title={title ?? own.formula}>
        {content}
      </span>
    )
  }
  return (
    <button
      type='button'
      aria-label={`Roll ${roll.label}, ${own.formula}`}
      title={title}
      disabled={locked}
      onClick={() => onRoll(roll)}
      className={clsx(
        chip,
        'transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent',
      )}
    >
      {content}
    </button>
  )
}
