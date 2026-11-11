'use client'

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { InPortalRoot } from '@/components/modal/in-portal-root'
import { useDialogRoot } from '@/components/modal/use-dialog-root'
import { HEADER_ICON_BUTTON } from '@/constants/buttons'
import { useModalDialog } from '@/hooks/use-modal-dialog'
import type { SidePanelProps } from './types'

/**
 * An aside that slides in from the right, over the page, for something to read beside it, such
 * as the rules of every condition: as wide as a phone, the height of the screen, its content
 * scrolling under its title. It is a modal dialog on the browser's own <dialog>, like Modal: focus
 * stays in it, Escape or a click beside it closes it, and its content is only rendered while open.
 * Menus and tooltips opened from its content open inside it. With `focusTitle`, opening it focuses
 * its title, so that reading starts at the top, as Help's does.
 */
export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  actions,
  focusTitle = false,
  children,
}: Readonly<SidePanelProps>) {
  const ref = useModalDialog(open)
  const { root, attach } = useDialogRoot(ref)
  const titleId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  // After the dialog is shown, which focuses its first control: the title takes it from there.
  useEffect(() => {
    if (open && focusTitle) heading.current?.focus()
  }, [open, focusTitle])

  return (
    <dialog
      ref={attach}
      aria-labelledby={titleId}
      // Escape closes the panel itself; this keeps the owner's state in step. Only its own close,
      // as Modal's: React hands it the close of a dialog opened inside it too, such as a Take's.
      onClose={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      className='m-0 ml-auto h-dvh max-h-none w-full max-w-md overflow-visible border-0 border-l border-border bg-card p-0 text-text-primary shadow-xl transition-transform duration-200 ease-out backdrop:bg-black/50 starting:open:translate-x-full motion-reduce:transition-none'
    >
      {open && (
        <InPortalRoot root={root}>
          <div className='flex h-full flex-col'>
            <header className='flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4'>
              <div className='min-w-0'>
                <h2
                  ref={heading}
                  id={titleId}
                  tabIndex={focusTitle ? -1 : undefined}
                  className='text-lg font-semibold outline-none'
                >
                  {title}
                </h2>
                {subtitle && (
                  <p className='text-xs text-text-secondary'>{subtitle}</p>
                )}
              </div>
              {actions && (
                <div className='ml-auto flex shrink-0 items-center gap-1'>
                  {actions}
                </div>
              )}
              <button
                type='button'
                onClick={onClose}
                aria-label='Close'
                className={`-mr-1.5 sm:-mr-3 ${HEADER_ICON_BUTTON}`}
              >
                <X aria-hidden className='size-5' />
              </button>
            </header>
            <div className='min-h-0 flex-1 overflow-y-auto px-5 py-4'>
              {children}
            </div>
          </div>
        </InPortalRoot>
      )}
    </dialog>
  )
}
