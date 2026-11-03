'use client'

import { useState } from 'react'
import { ConfirmModal } from './confirm-modal'
import type { ConfirmDialogProps } from './types'

/** A button for something hard to undo, which asks in a modal before acting. */
export function ConfirmDialog({
  trigger,
  triggerLabel,
  triggerClassName,
  ...asked
}: Readonly<ConfirmDialogProps>) {
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
