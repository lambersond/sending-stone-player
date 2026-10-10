'use client'

import { useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { InPortalRoot, useDialogRoot } from '@/components/modal/portal-root'
import { useModalDialog } from '@/hooks/use-modal-dialog'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  /** Under the title, such as where its content comes from. */
  subtitle?: string
  children: ReactNode
}

/**
 * An aside that slides in from the right, over the page, for something to read beside it, such
 * as the rules of every condition: as wide as a phone, the height of the screen, its content
 * scrolling under its title. It is a modal dialog on the browser's own <dialog>, like Modal: focus
 * stays in it, Escape or a click beside it closes it, and its content is only rendered while open.
 * Menus and tooltips opened from its content open inside it.
 */
export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
}: Readonly<Props>) {
  const ref = useModalDialog(open)
  const { root, attach } = useDialogRoot(ref)
  const titleId = useId()

  return (
    <dialog
      ref={attach}
      aria-labelledby={titleId}
      onClose={onClose}
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
            <div className='min-h-0 flex-1 overflow-y-auto px-5 py-4'>
              {children}
            </div>
          </div>
        </InPortalRoot>
      )}
    </dialog>
  )
}
