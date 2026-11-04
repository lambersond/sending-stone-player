'use client'

import { Clock, LoaderCircle, TriangleAlert } from 'lucide-react'
import { WARNS } from './constants'
import type { NoteOrderState } from '@/types/notes'

/** The icon of an order's state, beside its words: a spinner while it's on its way. */
export function OrderIcon({ state }: Readonly<{ state: NoteOrderState }>) {
  if (state === 'saving') {
    return (
      <LoaderCircle
        aria-hidden
        className='size-3.5 shrink-0 motion-safe:animate-spin'
      />
    )
  }
  if (WARNS.has(state)) {
    return <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
  }
  return <Clock aria-hidden className='size-3.5 shrink-0' />
}
