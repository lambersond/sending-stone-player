'use client'

import { useState, type ReactNode } from 'react'
import { ConfirmModal, type Asked } from './confirm-modal'

type Props = Asked & {
  /** What the button that opens it shows. */
  trigger: ReactNode
  /** The button's accessible name, when it shows only an icon. */
  triggerLabel?: string
  triggerClassName: string
}

/** A button for something hard to undo, which asks in a modal before acting. */
export function ConfirmDialog({
  trigger,
  triggerLabel,
  triggerClassName,
  ...asked
}: Readonly<Props>) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type='button'
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <ConfirmModal {...asked} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
