'use client'

import { ConfirmModal } from '@/components/modal/confirm-modal'

/** Asks before what was written is thrown away. */
export function DiscardModal({
  open,
  onClose,
  onDiscard,
}: Readonly<{ open: boolean; onClose: () => void; onDiscard: () => void }>) {
  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      title='Discard your changes?'
      confirmLabel='Discard'
      cancelLabel='Keep editing'
      onConfirm={async () => onDiscard()}
      danger
    >
      <p>What you wrote here isn’t saved.</p>
    </ConfirmModal>
  )
}
