'use client'

import { useState, useTransition, type ReactNode } from 'react'
import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'
import { Modal } from './modal'

type Asked = {
  title: string
  /** What will happen. */
  children: ReactNode
  confirmLabel: string
  /** What the button that keeps things as they are says. */
  cancelLabel?: string
  onConfirm: () => Promise<void>
  danger?: boolean
}

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

/**
 * The modal a `ConfirmDialog` asks in, opened by whatever its owner has open it, such as an item of
 * a menu: it closes once it has acted, and can't be closed while it's acting.
 */
export function ConfirmModal({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  danger = false,
}: Readonly<Asked & { open: boolean; onClose: () => void }>) {
  const [pending, startTransition] = useTransition()
  const close = () => {
    if (!pending) onClose()
  }
  const confirm = () =>
    startTransition(async () => {
      await onConfirm()
      onClose()
    })

  return (
    <Modal open={open} onClose={close} title={title}>
      <div className='grid gap-6'>
        <div className='grid gap-2 text-sm text-text-secondary'>{children}</div>
        <div className='flex flex-wrap justify-end gap-2'>
          <button
            type='button'
            onClick={close}
            disabled={pending}
            className='h-10 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60'
          >
            {cancelLabel}
          </button>
          <button
            type='button'
            onClick={confirm}
            disabled={pending}
            className={clsx(
              'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-60',
              danger
                ? 'bg-danger text-white hover:bg-danger/90 dark:text-page'
                : 'bg-primary text-on-primary hover:bg-primary-hover',
            )}
          >
            {pending && (
              <LoaderCircle aria-hidden className='size-4 animate-spin' />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
