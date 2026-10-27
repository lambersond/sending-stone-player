'use client'

import { useEffect, useId, type ReactNode, type RefObject } from 'react'
import clsx from 'clsx'
import { ArrowLeft, X } from 'lucide-react'
import { InPortalRoot, useDialogRoot } from './portal-root'
import { useModalDialog } from '@/hooks/use-modal-dialog'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  /** Under the title, such as where its content comes from. */
  subtitle?: string
  /** On a phone, as wide as the screen, as the side panel is: for content that needs the room. */
  fullOnPhone?: boolean
  /**
   * What takes focus as it opens, such as a confirm's Cancel (round 0.39.0): without it, the
   * browser gives focus to the first control in it, the header's Close.
   */
  initialFocus?: RefObject<HTMLElement | null>
  /**
   * Where it sits (round 0.40.0): centred, as ever; or as a sheet, which on a phone rises from the
   * bottom of the screen, as wide as it, its top corners rounded, at most 92% of its height, and
   * from `sm` up is a centred dialog up to 640 pixels wide.
   */
  placement?: 'center' | 'sheet'
  /**
   * What stays under its content, outside what scrolls, such as a picker's note and its button
   * (round 0.40.0); above the screen's own inset at the bottom, as a sheet.
   */
  footer?: ReactNode
  /** A way back, before its title, for a dialog with views one inside another (round 0.40.0). */
  back?: { label: string; onClick: () => void }
  children: ReactNode
}

/**
 * A modal dialog on the browser's own <dialog>, which keeps focus inside it, closes on Escape and
 * makes the page behind it inert. Its content is only rendered while open, so it starts afresh
 * each time it opens. Menus and tooltips opened from its content open inside it, over its edges.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  fullOnPhone = false,
  initialFocus,
  placement = 'center',
  footer,
  back,
  children,
}: Readonly<Props>) {
  const sheet = placement === 'sheet'
  const ref = useModalDialog(open)
  const { root, attach } = useDialogRoot(ref)
  const titleId = useId()
  // After the dialog's own effect has shown it, and the browser has focused its first control.
  useEffect(() => {
    if (open) initialFocus?.current?.focus()
  }, [open, initialFocus])

  return (
    <dialog
      ref={attach}
      aria-labelledby={titleId}
      // Escape closes the dialog itself; this keeps the owner's state in step. Only its own close:
      // React hands a dialog opened inside it, such as one modifying damage in an item's details,
      // the close of that dialog too. And only while its owner still has it open: a browser fires
      // close a moment after the dialog is closed in code, so the close of one its owner closed
      // itself would reach it again, after whatever it did next, such as focus given elsewhere.
      onClose={event => {
        if (open && event.target === event.currentTarget) onClose()
      }}
      // A click on the dialog element, rather than its content, is a click on the backdrop.
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      // Its content scrolls, not the dialog, so a menu opened inside it may reach past its edges.
      className={clsx(
        'overflow-visible border border-border bg-card p-0 text-text-primary shadow-xl backdrop:bg-black/50',
        sheet
          ? // Under sm a sheet at the bottom of the screen, from sm a dialog up to 640 pixels wide:
            // either way a column, its content scrolling between its header and its footer.
            'open:flex open:flex-col max-sm:mx-0 max-sm:mt-auto max-sm:mb-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-t-[20px] max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-160 sm:rounded-2xl'
          : 'm-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl',
        fullOnPhone &&
          !sheet &&
          'max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-x-0',
      )}
    >
      {open && (
        <InPortalRoot root={root}>
          <header
            className={clsx(
              'flex justify-between gap-4 border-b border-border px-5 py-4',
              subtitle ? 'items-start' : 'items-center',
              sheet && 'shrink-0',
            )}
          >
            {back && (
              <button
                type='button'
                onClick={back.onClick}
                aria-label={back.label}
                className='-ml-1.5 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary sm:min-h-9'
              >
                <ArrowLeft aria-hidden className='size-4' />
                Back
              </button>
            )}
            <div className={clsx('min-w-0', back && 'flex-1')}>
              <h2 id={titleId} className='text-lg font-semibold'>
                {title}
              </h2>
              {subtitle && (
                <p className='text-xs text-text-secondary'>{subtitle}</p>
              )}
            </div>
            <button
              type='button'
              onClick={onClose}
              aria-label='Close'
              className={clsx(
                '-mr-1.5 shrink-0 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary',
                // As tall as a finger on a phone, as every control in a sheet is.
                sheet &&
                  'flex min-h-11 min-w-11 items-center justify-center sm:min-h-9 sm:min-w-9',
              )}
            >
              <X aria-hidden className='size-5' />
            </button>
          </header>
          <div
            className={clsx(
              'overflow-y-auto p-5',
              // A sheet's content takes what its header and footer leave, and scrolls alone.
              sheet
                ? 'min-h-0 flex-1 overscroll-contain'
                : 'max-h-[calc(100dvh-9rem)]',
            )}
          >
            {children}
          </div>
          {footer && (
            <footer
              className={clsx(
                'flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-5 py-3',
                sheet &&
                  'max-sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
              )}
            >
              {footer}
            </footer>
          )}
        </InPortalRoot>
      )}
    </dialog>
  )
}
