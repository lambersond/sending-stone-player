import clsx from 'clsx'
import type { ReactNode } from 'react'

/**
 * A fact on the sheet in a card of its own, such as the character's coin or spell save DC; with
 * what's done with it beside it, such as Take for a party's coin, apart from its name.
 */
export function SheetFact({
  label,
  className,
  action,
  children,
}: Readonly<{
  label: string
  className?: string
  /** In its value, so that it's no part of the fact's name. */
  action?: ReactNode
  children: ReactNode
}>) {
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
      {action ? (
        <dd className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>{children}</div>
          {action}
        </dd>
      ) : (
        <dd>{children}</dd>
      )}
    </div>
  )
}
