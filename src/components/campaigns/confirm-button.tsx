'use client'

import { useState, useTransition, type ReactNode } from 'react'
import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'

type Props = {
  /** A rendered icon: a component could not be passed from a Server Component. */
  icon: ReactNode
  label: string
  /** Asked before acting, such as "Remove this campaign and its chat?". */
  question: string
  confirmLabel: string
  onConfirm: () => Promise<void>
  danger?: boolean
}

/** A button for something hard to undo, which asks before acting. */
export function ConfirmButton({
  icon,
  label,
  question,
  confirmLabel,
  onConfirm,
  danger = false,
}: Readonly<Props>) {
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!asking) {
    return (
      <button
        type='button'
        onClick={() => setAsking(true)}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-text-secondary transition-colors',
          danger
            ? 'hover:bg-danger/10 hover:text-danger'
            : 'hover:bg-primary/10 hover:text-text-primary',
        )}
      >
        {icon}
        {label}
      </button>
    )
  }

  return (
    <span
      role='group'
      aria-label={label}
      className='inline-flex flex-wrap items-center gap-2 text-sm'
    >
      <span className='text-text-secondary'>{question}</span>
      <button
        type='button'
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await onConfirm()
            setAsking(false)
          })
        }
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-semibold transition-colors disabled:opacity-60',
          danger
            ? 'bg-danger/10 text-danger hover:bg-danger/20'
            : 'bg-primary/10 text-primary hover:bg-primary/20',
        )}
      >
        {pending && (
          <LoaderCircle aria-hidden className='size-4 animate-spin' />
        )}
        {confirmLabel}
      </button>
      <button
        type='button'
        disabled={pending}
        onClick={() => setAsking(false)}
        className='rounded-lg px-2.5 py-1.5 font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'
      >
        Cancel
      </button>
    </span>
  )
}
