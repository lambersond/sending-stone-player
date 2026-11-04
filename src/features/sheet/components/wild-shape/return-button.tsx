'use client'

import { use } from 'react'
import { Undo2 } from 'lucide-react'
import { GHOST } from './constants'
import { WildShapeContext } from './context'
import { Spinner } from './spinner'

/**
 * Return, on the ribbon or the row: opens its confirm; "Returning…" while it's on its way. While a
 * change or a Beast learned is on its way, it's not offered either, as the game would refuse it.
 */
export function ReturnButton({ label }: Readonly<{ label: string }>) {
  const { waiting, openReturn } = use(WildShapeContext)
  const returning = waiting === 'revert'
  return (
    <button
      type='button'
      aria-haspopup='dialog'
      aria-disabled={waiting ? true : undefined}
      onClick={event => {
        if (waiting) return
        openReturn(event.currentTarget)
      }}
      className={GHOST}
    >
      {returning ? <Spinner /> : <Undo2 aria-hidden className='size-4' />}
      {returning ? 'Returning…' : label}
    </button>
  )
}
