'use client'

import { PanelLeft } from 'lucide-react'

/**
 * The reader's Contents button, below 640 px of the modal, first in the bar of a note's, a group's
 * and the loading page: it opens the contents' drawer. Below 560 px, only its icon shows: its word
 * comes once a note's bar has room for it beside its chapter's number, its tools, its place among
 * the notes and the arrows.
 */
export function ContentsButton({
  controls,
  open,
  onOpen,
}: Readonly<{ controls: string; open: boolean; onOpen: () => void }>) {
  return (
    <button
      type='button'
      aria-expanded={open}
      aria-controls={controls}
      data-contents-button
      onClick={onOpen}
      className='inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-2.5 text-sm font-medium transition-colors hover:bg-primary/5 @min-[640px]:hidden'
    >
      <PanelLeft aria-hidden className='size-5' />
      <span className='@max-[560px]:sr-only'>Contents</span>
    </button>
  )
}
