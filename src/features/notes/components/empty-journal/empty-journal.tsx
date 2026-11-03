'use client'

import { NotebookPen, Plus } from 'lucide-react'

/**
 * A journal with nothing in it yet (round 0.35.0 §8.11), in place of the contents and the reader:
 * what it's for, and, where the seat may write in it, New note and New chapter.
 */
export function EmptyJournal({
  canAdd,
  onNewNote,
  onNewChapter,
}: Readonly<{
  canAdd: boolean
  onNewNote: () => void
  onNewChapter: () => void
}>) {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-10 text-center'>
      <span className='flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary-text'>
        <NotebookPen aria-hidden className='size-7' />
      </span>
      <div className='flex max-w-sm flex-col gap-1'>
        <p className='text-lg font-semibold'>No notes yet</p>
        <p className='text-sm text-text-secondary'>
          Write down what happened, what you found and who you met.
        </p>
      </div>
      {canAdd && (
        <div className='flex flex-wrap justify-center gap-2'>
          <button
            type='button'
            data-note-opener='new'
            onClick={onNewNote}
            className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover'
          >
            <Plus aria-hidden className='size-4' />
            New note
          </button>
          <button
            type='button'
            data-note-opener='new-chapter'
            onClick={onNewChapter}
            className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
          >
            <NotebookPen aria-hidden className='size-4' />
            New chapter
          </button>
        </div>
      )}
    </div>
  )
}
