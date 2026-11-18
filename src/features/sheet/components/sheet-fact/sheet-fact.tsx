import { useId, type ReactNode } from 'react'
import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'

/**
 * A fact on the sheet in a card of its own, such as the character's coin or spell save DC; with
 * what's done with it below the fact, at its left, as a group named by the label, such as Give for
 * a character's coins.
 */
export function SheetFact({
  label,
  className,
  action,
  busy = false,
  children,
}: Readonly<{
  label: string
  className?: string
  /** Below the fact, in a group the label names. */
  action?: ReactNode
  /**
   * From module 0.33.0's feedback: while what's done with it waits on a move on its way, one
   * spinner right of its label, and its group busy, in place of a spinner on each of its buttons.
   */
  busy?: boolean
  children: ReactNode
}>) {
  const labelId = useId()
  if (action) {
    // The label, the fact, then what's done with it, at the card's left, wrapping to a second line
    // only where the card is too narrow (the owner's words, item 89): the spinner by the label.
    return (
      <div
        className={clsx(
          'flex min-w-0 flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-3',
          className,
        )}
      >
        <dt
          id={labelId}
          className='flex min-w-0 items-center gap-1.5 text-xs font-semibold tracking-wider text-text-secondary uppercase'
        >
          <span className='min-w-0 truncate'>{label}</span>
          {busy && (
            <LoaderCircle
              aria-hidden
              className='size-3.5 shrink-0 motion-safe:animate-spin'
            />
          )}
        </dt>
        <dd className='min-w-0'>{children}</dd>
        <dd className='pt-1'>
          <div
            role='group'
            aria-labelledby={labelId}
            aria-busy={busy || undefined}
            className='flex flex-wrap items-center gap-1.5'
          >
            {action}
          </div>
        </dd>
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
