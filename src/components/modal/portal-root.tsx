'use client'

import { useCallback, useState, type Ref } from 'react'

/**
 * A modal dialog's element, kept for menus and tooltips opened inside it to go in, with a ref to
 * give the element that also keeps it in `ref`.
 * @param ref - Where the dialog is kept for showing and closing it.
 */
export function useDialogRoot<T extends HTMLElement>(ref: {
  current: T | null
}): { root: T | null; attach: Ref<T> } {
  const [root, setRoot] = useState<T | null>(null)
  const attach = useCallback(
    (node: T | null) => {
      ref.current = node
      setRoot(node)
    },
    [ref],
  )
  return { root, attach }
}
