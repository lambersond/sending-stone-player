'use client'

import { OrderIcon } from './order-icon'
import { orderStateWords } from '@/features/notes/utils/order-words'
import type { NoteOrderState } from '@/types/notes'

/**
 * An order on its way, as the contents' mark beside its group: the chip's icon alone, its words
 * as its title and for a screen reader. Nothing otherwise: a refused order shows as the group's
 * warning, which the contents draw themselves.
 */
export function OrderMark({ state }: Readonly<{ state: NoteOrderState }>) {
  if (state !== 'waiting' && state !== 'saving') return
  const words = orderStateWords(state)
  return (
    <span title={words} className='inline-flex text-text-secondary'>
      <OrderIcon state={state} />
      <span className='sr-only'>{words}</span>
    </span>
  )
}
