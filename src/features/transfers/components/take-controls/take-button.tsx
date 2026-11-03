'use client'

import { ROW_BUTTON } from '@/features/transfers/constants'
import type { ReactNode } from 'react'

/** Take: while what it takes is on its way, disabled, the spinner by the item's name. */
export function TakeButton({
  label,
  busy,
  onTake,
}: Readonly<{ label: string; busy: boolean; onTake: () => void }>): ReactNode {
  return (
    <button
      type='button'
      aria-haspopup='dialog'
      aria-label={label}
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={event => {
        // Inside a row's summary, it's the dialog that opens, not the row.
        event.preventDefault()
        event.stopPropagation()
        onTake()
      }}
      className={ROW_BUTTON}
    >
      Take
    </button>
  )
}
