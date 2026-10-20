import { useId, type ReactNode } from 'react'
import clsx from 'clsx'

/**
 * A fact on the sheet in a card of its own, such as the character's coin or spell save DC; with
 * what's done with it on its label's row, pushed right, as a group named by the label, such as Send
 * to for a character's coin.
 */
export function SheetFact({
  label,
  className,
  action,
  children,
}: Readonly<{
  label: string
  className?: string
  /** On its label's row, so that it's no part of the fact's name, in a group the label names. */
  action?: ReactNode
  children: ReactNode
}>) {
  const labelId = useId()
  if (action) {
    // The label at the left and what's done with it at the right, which wraps under the label,
    // still at the right, on a narrow card; the fact has a row of its own.
    return (
      <div
        className={clsx(
          'flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-2xl border border-border bg-card px-4 py-3',
          className,
        )}
      >
        <dt
          id={labelId}
          className='min-w-0 truncate text-xs font-semibold tracking-wider text-text-secondary uppercase'
        >
          {label}
        </dt>
        <dd className='ml-auto'>
          <div
            role='group'
            aria-labelledby={labelId}
            className='flex flex-wrap items-center justify-end gap-1.5'
          >
            {action}
          </div>
        </dd>
        <dd className='min-w-0 basis-full'>{children}</dd>
      </div>
    )
  }
  return (
    <div
      className={clsx(
        'flex min-w-0 flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-3',
        className,
      )}
    >
      <dt className='truncate text-xs font-semibold tracking-wider text-text-secondary uppercase'>
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  )
}
