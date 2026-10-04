'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * A modal dialog on the browser's own <dialog>, which keeps focus inside it, closes on Escape and
 * makes the page behind it inert. Its content is only rendered while open, so it starts afresh
 * each time it opens.
 */
export function Modal({ open, onClose, title, children }: Readonly<Props>) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape closes the dialog itself; this keeps the owner's state in step.
      onClose={onClose}
      // A click on the dialog element, rather than its content, is a click on the backdrop.
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
      className='m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-border bg-card p-0 text-text-primary shadow-xl backdrop:bg-black/50'
    >
      {open && (
        <>
          <header className='flex items-center justify-between gap-4 border-b border-border px-5 py-4'>
            <h2 id={titleId} className='text-lg font-semibold'>
              {title}
            </h2>
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
        </>
      )}
    </dialog>
  )
}
