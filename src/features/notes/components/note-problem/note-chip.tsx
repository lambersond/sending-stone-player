'use client'

import clsx from 'clsx'
import { Clock, LoaderCircle, TriangleAlert } from 'lucide-react'
import { noteStateWords } from '@/features/notes/utils/note-words'
import type { NoteState } from '@/types/notes'

/** The states a change didn't reach Foundry in, which the chip warns of. */
const WARNS = new Set<NoteState>(['conflict', 'gone', 'failed'])

/** Where a note stands, as a chip of an icon and its words, never colour alone (§9.7). */
export function NoteChip({ state }: Readonly<{ state: NoteState }>) {
  const words = noteStateWords(state)
  if (!words) return
  const warns = WARNS.has(state)
  let icon = <Clock aria-hidden className='size-3.5 shrink-0' />
  if (state === 'saving') {
    icon = (
      <LoaderCircle
        aria-hidden
        className='size-3.5 shrink-0 motion-safe:animate-spin'
      />
    )
  } else if (warns) {
    icon = <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
  }
  return (
    <span
      className={clsx(
        'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        warns
          ? 'border-warning/40 bg-warning/10 text-warning'
          : 'border-border text-text-secondary',
      )}
    >
      {icon}
      {words}
    </span>
  )
}
