'use client'

import clsx from 'clsx'
import { WARNS } from './constants'
import { OrderIcon } from './order-icon'
import { orderStateWords } from '@/features/notes/utils/order-words'
import type { NoteOrderState } from '@/types/notes'

/**
 * Where a group's order stands, as a chip of an icon and its words, never colour alone (round
 * 0.35.0 §9.5), as a note's `NoteChip` says a note's. Nothing where it's the same in Foundry.
 */
export function OrderChip({ state }: Readonly<{ state: NoteOrderState }>) {
  const words = orderStateWords(state)
  if (!words) return
  return (
    <span
      className={clsx(
        'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        WARNS.has(state)
          ? 'border-warning/40 bg-warning/10 text-warning'
          : 'border-border text-text-secondary',
      )}
    >
      <OrderIcon state={state} />
      {words}
    </span>
  )
}
