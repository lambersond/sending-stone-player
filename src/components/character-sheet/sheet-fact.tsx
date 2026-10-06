import clsx from 'clsx'
import type { ReactNode } from 'react'

/** A fact on the sheet in a card of its own, such as the character's coin or spell save DC. */
export function SheetFact({
  label,
  className,
  children,
}: Readonly<{ label: string; className?: string; children: ReactNode }>) {
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
