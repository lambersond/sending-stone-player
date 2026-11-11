'use client'

import { useId } from 'react'
import clsx from 'clsx'
import { NotebookTabs } from 'lucide-react'
import { TidyChip } from '../tidy-chip/tidy-chip'
import { TIDY_TITLE } from '@/features/notes/constants'
import type { NotePick } from '@/features/notes/types'
import type { NotesTidyView } from '@/types/notes'

/**
 * A character's Tidy 5e Sheets entries in the journal's contents (module 0.44.0), last, after every
 * chapter: their title, which opens their page, and each entry with its chip, in Tidy's order,
 * named by its title and described by its chip, as a note is by its marks; searching, only those
 * it finds. Read only: nothing here adds, moves or reorders them.
 */
export function TidyContents({
  tidy,
  hits,
  shown,
  onPick,
}: Readonly<{
  tidy: NotesTidyView
  /** The entries the search finds, by key; none while nothing is searched. */
  hits?: ReadonlySet<string>
  shown?: NotePick
  onPick: (pick: NotePick) => void
}>) {
  const countId = useId()
  const chipsId = useId()
  const entries = hits
    ? tidy.entries.filter(({ key }) => hits.has(key))
    : tidy.entries
  if (entries.length === 0) return
  const onTidy = shown && 'tidy' in shown ? shown.tidy : undefined
  return (
    <div className='mt-1 border-t border-border pt-1.5 pb-0.5'>
      <button
        type='button'
        aria-label={TIDY_TITLE}
        aria-describedby={countId}
        aria-current={onTidy === null ? 'true' : undefined}
        onClick={() => onPick({ tidy: null })}
        className={clsx(
          'flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl pr-3 pl-3.5 text-left text-sm font-semibold transition-colors',
          onTidy === null
            ? 'bg-primary/10 text-primary-text'
            : 'hover:bg-primary/5',
        )}
      >
        <NotebookTabs aria-hidden className='size-4 shrink-0' />
        <span className='min-w-0 flex-1 truncate'>{TIDY_TITLE}</span>
        <span
          id={countId}
          className='shrink-0 text-xs font-normal text-text-secondary tabular-nums'
        >
          {entries.length}
          <span className='sr-only'>
            {entries.length === 1 ? ' entry' : ' entries'}
          </span>
        </span>
      </button>
      <ul className='flex flex-col'>
        {entries.map((entry, at) => (
          <li key={entry.key}>
            <button
              type='button'
              aria-label={entry.title}
              aria-describedby={`${chipsId}-${at}`}
              aria-current={onTidy === entry.key ? 'true' : undefined}
              onClick={() => onPick({ tidy: entry.key })}
              className={clsx(
                'flex min-h-11 w-full items-center gap-2 rounded-xl py-2 pr-3 pl-11 text-left text-sm transition-colors',
                onTidy === entry.key
                  ? 'bg-primary/10 font-medium text-primary-text'
                  : 'hover:bg-primary/5',
              )}
            >
              <span title={entry.title} className='min-w-0 flex-1 truncate'>
                {entry.title}
              </span>
              <TidyChip from={entry.from} id={`${chipsId}-${at}`} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
