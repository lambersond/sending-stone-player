'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { MoveMenu } from './move-menu'
import { LastChanged, NoteText, StateMark, Written } from './note-lines'
import type { NoteChapterView, NoteEntryView } from '@/types/notes'

/** How far past the clip a note's text must reach to be cut short, rather than a rounding pixel. */
const SLACK = 4

/**
 * A note as a group's page lists it (round 0.35.0 §8.9): its title, a button over the whole card
 * that opens it; where it stands; for a note in no chapter the seat may move, Move to chapter,
 * above the card's hit area; who wrote and last changed it; and its text, formatted, cut short
 * with a fade where it's long. No Edit, Delete or choices: those are in the note's own view.
 */
export function NoteCard({
  entry,
  move,
  onOpen,
}: Readonly<{
  entry: NoteEntryView
  /** Where it may be moved from no chapter: the book's chapters, and the move's state. */
  move?: {
    chapters: NoteChapterView[]
    busy: boolean
    onMove: (chapterId: string | null) => void
  }
  onOpen: () => void
}>) {
  const box = useRef<HTMLDivElement>(null)
  const [long, setLong] = useState(false)
  // Measured once drawn, and again as its text changes or changes size: an image in it that loads
  // after it's drawn makes it longer, and the card drawn narrower or wider, as a phone turns,
  // makes it longer or shorter.
  useLayoutEffect(() => {
    const clipped = box.current
    if (!clipped) {
      setLong(false)
      return
    }
    const measure = () =>
      setLong(clipped.scrollHeight > clipped.clientHeight + SLACK)
    measure()
    const text = clipped.firstElementChild
    if (!text) return
    const observer = new ResizeObserver(measure)
    observer.observe(text)
    return () => observer.disconnect()
  }, [entry.html])

  return (
    <article className='relative flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/50'>
      <div className='flex items-start gap-2'>
        <h4 className='min-w-0 flex-1 pt-0.5 font-semibold break-words'>
          <button
            type='button'
            onClick={onOpen}
            className='text-left after:absolute after:inset-0 after:rounded-2xl'
          >
            {entry.title}
          </button>
        </h4>
        {entry.state !== 'synced' && (
          <span className='pt-1'>
            <StateMark state={entry.state} />
          </span>
        )}
        {move && (
          <div className='relative z-10 -my-1'>
            <MoveMenu
              entry={entry}
              chapters={move.chapters}
              busy={move.busy}
              labelled
              onMove={move.onMove}
            />
          </div>
        )}
      </div>
      <p className='-mt-1 text-xs text-text-secondary'>
        <Written entry={entry} /> · <LastChanged entry={entry} />
      </p>
      {entry.html && (
        <div ref={box} className='relative max-h-52 overflow-hidden'>
          <NoteText html={entry.html} />
          {long && (
            <div
              aria-hidden
              className='pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-linear-to-t from-card to-transparent'
            />
          )}
        </div>
      )}
      {long && (
        <span aria-hidden className='text-sm font-medium text-primary-text'>
          Continue reading
        </span>
      )}
    </article>
  )
}
