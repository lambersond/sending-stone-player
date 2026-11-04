'use client'

import { use } from 'react'
import { PawPrint } from 'lucide-react'
import { PLAIN, SOLID } from './constants'
import { WildShapeContext } from './context'
import { ReturnButton } from './return-button'
import { isRow, rowOf } from './utils'

/**
 * Wild Shape's controls at the end of its row, wherever it's drawn (round 0.40.0 §5.7), beside its
 * chips, never on what opens the row: Change, Return, and on Features, Known forms…. None on any
 * other row, nor where its player can't use it from here.
 */
export function WildShapeRowControls({
  id,
  knownForms = false,
}: Readonly<{ id: string; knownForms?: boolean }>) {
  const ws = use(WildShapeContext)
  const row = isRow(ws, id) ? rowOf(ws) : undefined
  if (!row) return
  const blocked = row.change === 'off'
  return (
    <>
      {row.back && <ReturnButton label='Return' />}
      {row.change && (
        <button
          type='button'
          aria-haspopup='dialog'
          aria-disabled={blocked || undefined}
          onClick={event => {
            if (blocked) return
            ws.openPicker(event.currentTarget)
          }}
          className={SOLID}
        >
          <PawPrint aria-hidden className='size-4' />
          Change
        </button>
      )}
      {knownForms && (
        <button
          type='button'
          aria-haspopup='dialog'
          onClick={event => ws.openKnown(event.currentTarget)}
          className={PLAIN}
        >
          Known forms…
        </button>
      )}
    </>
  )
}
