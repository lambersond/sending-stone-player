'use client'

import { useEffect, useId, type ReactNode, type RefObject } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
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
  children,
}: Readonly<Props>) {
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
      // the close of that dialog too.
      onClose={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      // A click on the dialog element, rather than its content, is a click on the backdrop.
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      // Its content scrolls, not the dialog, so a menu opened inside it may reach past its edges.
      className={clsx(
        'm-auto w-[calc(100%-2rem)] max-w-lg overflow-visible rounded-2xl border border-border bg-card p-0 text-text-primary shadow-xl backdrop:bg-black/50',
        fullOnPhone &&
          'max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-x-0',
      )}
    >
      {open && (
        <InPortalRoot root={root}>
          <header
            className={clsx(
              'flex justify-between gap-4 border-b border-border px-5 py-4',
              subtitle ? 'items-start' : 'items-center',
            )}
          >
            <div className='min-w-0'>
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
              className='-mr-1.5 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'
            >
              <X aria-hidden className='size-5' />
            </button>
          </header>
          <div className='max-h-[calc(100dvh-9rem)] overflow-y-auto p-5'>
            {children}
          </div>
        </InPortalRoot>
      )}
    </dialog>
  )
}
