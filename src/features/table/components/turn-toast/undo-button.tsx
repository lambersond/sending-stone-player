'use client'

import { useLayoutEffect, useRef } from 'react'

/**
 * The toast's Undo: it takes the turn back. As it goes, taken or withdrawn, focus on it is handed
 * on, never left to the page's body.
 */
export function UndoButton({
  onUndo,
  onGone,
}: Readonly<{ onUndo: () => void; onGone: () => void }>) {
  const button = useRef<HTMLButtonElement>(null)
  const gone = useRef(onGone)
  useLayoutEffect(() => {
    gone.current = onGone
  })
  useLayoutEffect(() => {
    const own = button.current
    return () => {
      if (own && document.activeElement === own) gone.current()
    }
  }, [])
  return (
    <button
      ref={button}
      type='button'
      onClick={onUndo}
      className='min-h-11 min-w-11 rounded-[10px] border border-border bg-transparent px-3 font-semibold'
    >
      Undo
    </button>
  )
}
