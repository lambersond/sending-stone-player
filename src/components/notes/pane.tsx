import clsx from 'clsx'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * One of the journal's reader panes (round 0.35.0 §8.7): its bar at the top, its content scrolling
 * between, and its footer pinned to the modal's bottom, whatever the content's length.
 */
export function Pane({
  as = 'div',
  bar,
  footer,
  children,
  className,
  ...rest
}: Readonly<
  {
    /** A plain box, or the editor's form. */
    as?: 'div' | 'form'
    bar: ReactNode
    footer?: ReactNode
    children: ReactNode
  } & Omit<ComponentPropsWithoutRef<'form'>, 'children'>
>): ReactNode {
  const classes = clsx('flex min-h-0 min-w-0 flex-1 flex-col', className)
  const inside = (
    <>
      <div className='flex h-14 shrink-0 items-center gap-1 border-b border-border px-2 @min-[640px]:px-3'>
        {bar}
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
        {children}
      </div>
      {footer && (
        // Full screen, below `sm`, clear of a phone's home indicator.
        <div className='shrink-0 border-t border-border bg-card px-3 py-2.5 @min-[640px]:px-4 max-sm:pb-[max(0.625rem,env(safe-area-inset-bottom))]'>
          {footer}
        </div>
      )}
    </>
  )
  if (as === 'form') {
    return (
      <form {...rest} className={classes}>
        {inside}
      </form>
    )
  }
  return (
    <div {...(rest as ComponentPropsWithoutRef<'div'>)} className={classes}>
      {inside}
    </div>
  )
}
