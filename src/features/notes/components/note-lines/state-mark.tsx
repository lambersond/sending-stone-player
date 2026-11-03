'use client'

import clsx from 'clsx'
import { Clock, LoaderCircle, TriangleAlert } from 'lucide-react'
import { noteStateWords } from '@/features/notes/utils/note-words'
import type { NoteState } from '@/types/notes'

/** The states a note's mark warns of: its change didn't reach Foundry, and it waits on a choice. */
const WARNS = new Set<NoteState>(['conflict', 'gone', 'failed'])

/**
 * Where a note stands, as an icon alone, in the contents and on a card: its chip's words are its
 * title and what a screen reader says. A delete waiting is waiting, not a choice. Nothing for a
 * note the same here and in Foundry.
 */
export function StateMark({ state }: Readonly<{ state: NoteState }>) {
  const words = noteStateWords(state)
  if (!words) return
  const warns = WARNS.has(state)
  let icon = <Clock aria-hidden className='size-3.5' />
  if (state === 'saving') {
    icon = (
      <LoaderCircle aria-hidden className='size-3.5 motion-safe:animate-spin' />
    )
  } else if (warns) {
    icon = <TriangleAlert aria-hidden className='size-3.5' />
  }
  return (
    <span
      title={words}
      className={clsx(
        'inline-flex shrink-0',
        warns ? 'text-warning' : 'text-text-secondary',
      )}
    >
      {icon}
      <span className='sr-only'>{words}</span>
    </span>
  )
}
