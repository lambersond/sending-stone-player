'use client'

import { useId } from 'react'
import { ChevronLeft, ChevronRight, EyeOff, Lock } from 'lucide-react'
import { NoteText } from '../note-lines/note-text'
import { Pane } from '../pane/pane'
import { TidyChip } from '../tidy-chip/tidy-chip'
import { TidyDates } from '../tidy-lines/tidy-dates'
import { TidyNotice } from '../tidy-lines/tidy-notice'
import { JOURNAL_ICON_BUTTON, TIDY_TITLE } from '@/features/notes/constants'
import {
  tidyClassicGoneWords,
  tidySecretWords,
  tidyWhereWords,
} from '@/features/notes/utils/note-words'
import type { TidyPaneProps } from './types'
import type { ReadingStep } from '@/features/notes/types'

const ICON_BUTTON = `${JOURNAL_ICON_BUTTON} disabled:pointer-events-none disabled:opacity-40`
const LINE = 'inline-flex items-start gap-1.5 text-sm text-text-secondary'

/**
 * One of a character's Tidy 5e Sheets entries, read (module 0.44.0): where it is among them and the
 * arrows to the one before and after in the bar, before the first, the book's last note; their
 * page's title over its own, its chip, where it comes from and when the app first saw it and last
 * saw it change, why it can't be changed now or where it can, and its text. Read only: no Edit,
 * Delete or Move, as it's changed in Foundry.
 */
export function TidyPane({
  entry,
  tidy,
  name,
  form,
  before,
  contents,
  onPick,
}: Readonly<TidyPaneProps>) {
  const titleId = useId()
  const { entries } = tidy
  const at = entries.findIndex(({ key }) => key === entry.key)
  const previousEntry = at > 0 ? entries[at - 1] : undefined
  const previous: ReadingStep | undefined = previousEntry
    ? { pick: { tidy: previousEntry.key }, title: previousEntry.title }
    : before
  const next = at >= 0 ? entries[at + 1] : undefined
  const where = tidyWhereWords(tidy, entry, name)
  const gone = entry.from === 'classic' && tidy.classicGone

  const bar = (
    <>
      {contents}
      <span className='flex-1' />
      <span className='shrink-0 px-1 text-xs whitespace-nowrap text-text-secondary tabular-nums'>
        {at + 1} of {entries.length}
      </span>
      <button
        type='button'
        aria-label='Previous note'
        title={previous && `Previous: ${previous.title}`}
        disabled={!previous}
        onClick={() => previous && onPick(previous.pick, 'previous')}
        className={ICON_BUTTON}
      >
        <ChevronLeft aria-hidden className='size-5' />
      </button>
      <button
        type='button'
        aria-label='Next note'
        title={next && `Next: ${next.title}`}
        disabled={!next}
        onClick={() => next && onPick({ tidy: next.key }, 'next')}
        className={ICON_BUTTON}
      >
        <ChevronRight aria-hidden className='size-5' />
      </button>
    </>
  )

  return (
    <Pane bar={bar}>
      <article
        aria-labelledby={titleId}
        className='mx-auto flex w-full max-w-[44rem] flex-col gap-4 px-4 py-5 @min-[640px]:px-8 @min-[640px]:py-8'
      >
        <button
          type='button'
          onClick={() => onPick({ tidy: null })}
          className='relative -mt-5 -mb-2 min-h-11 w-fit min-w-11 rounded-md pt-5 pb-2 text-left text-xs font-semibold tracking-wider text-text-secondary uppercase transition-colors hover:text-primary-text'
        >
          {TIDY_TITLE}
        </button>
        <h3
          id={titleId}
          tabIndex={-1}
          data-reader-heading
          className='-mt-2 text-2xl leading-tight font-semibold text-balance break-words outline-none'
        >
          {entry.title}
        </h3>
        <div className='-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary'>
          <TidyChip from={entry.from} />
          <span>From Tidy 5e Sheets in Foundry</span>
          <TidyDates entry={entry} />
        </div>
        <TidyNotice tidy={tidy} name={name} form={form} />
        {gone && <p className={LINE}>{tidyClassicGoneWords(name)}</p>}
        {entry.secret && (
          <p className={LINE}>
            <EyeOff aria-hidden className='mt-0.5 size-3.5 shrink-0' />
            {tidySecretWords(name)}
          </p>
        )}
        <NoteText html={entry.html} lifted />
        {where && (
          <p className={LINE}>
            <Lock aria-hidden className='mt-0.5 size-3.5 shrink-0' />
            {where}
          </p>
        )}
      </article>
    </Pane>
  )
}
