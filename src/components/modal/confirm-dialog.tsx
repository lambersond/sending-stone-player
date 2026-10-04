'use client'

import { useState, useTransition, type ReactNode } from 'react'
import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'
import { Modal } from './modal'

type Props = {
  /** What the button that opens it shows. */
  trigger: ReactNode
  /** The button's accessible name, when it shows only an icon. */
  triggerLabel?: string
  triggerClassName: string
  title: string
  /** What will happen. */
  children: ReactNode
  confirmLabel: string
  onConfirm: () => Promise<void>
  danger?: boolean
}

/** A button for something hard to undo, which asks in a modal before acting. */
export function ConfirmDialog({
  trigger,
  triggerLabel,
  triggerClassName,
  title,
  children,
  confirmLabel,
  onConfirm,
  danger = false,
}: Readonly<Props>) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const close = () => {
    if (!pending) setOpen(false)
  }
  const confirm = () =>
    startTransition(async () => {
      await onConfirm()
      setOpen(false)
    })

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
      <Modal open={open} onClose={close} title={title}>
        <div className='grid gap-6'>
          <div className='grid gap-2 text-sm text-text-secondary'>
            {children}
          </div>
          <div className='flex flex-wrap justify-end gap-2'>
            <button
              type='button'
              onClick={close}
              disabled={pending}
              className='h-10 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60'
            >
              Cancel
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
    </>
  )
}
