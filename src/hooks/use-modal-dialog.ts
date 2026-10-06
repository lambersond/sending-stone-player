'use client'

import { useEffect, useRef } from 'react'

/**
 * Shows a <dialog> as a modal while `open`, and closes it when not. The browser's own modal dialog
 * keeps focus inside it, closes on Escape, makes the page behind it inert, and gives focus back to
 * what had it when it closes.
 */
export function useModalDialog(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return ref
}
