'use client'

import type { ReactNode } from 'react'

/**
 * One of the party's moves' buttons: its words are its name, and it waits, disabled, while coins
 * do; the spinner is the row's.
 */
export function PartyButton({
  className,
  busy,
  onOpen,
  children,
}: Readonly<{
  className: string
  busy: boolean
  onOpen: () => void
  children?: ReactNode
}>) {
  return (
    <button
      type='button'
      aria-haspopup='dialog'
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={event => {
        // Inside a row's summary, it's the dialog that opens, not the row.
        event.preventDefault()
        event.stopPropagation()
        onOpen()
      }}
      className={className}
    >
      {children}
    </button>
  )
}
