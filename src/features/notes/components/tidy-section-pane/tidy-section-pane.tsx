'use client'

import { useId } from 'react'
import { NotebookTabs } from 'lucide-react'
import { Pane } from '../pane/pane'
import { TidyCard } from '../tidy-card/tidy-card'
import { TidyNotice } from '../tidy-lines/tidy-notice'
import { TIDY_TITLE } from '@/features/notes/constants'
import { tidySectionWords } from '@/features/notes/utils/note-words'
import type { TidySectionPaneProps } from './types'

/**
 * A character's Tidy 5e Sheets entries' own page (module 0.45.0), last in the journal: where they
 * come from and that they're changed in Foundry, why they can't be now where Tidy is off, and each
 * as a card, in Tidy's order; searching, those the search finds.
 */
export function TidySectionPane({
  tidy,
  texts,
  hits,
  name,
  form,
  contents,
  onPick,
}: Readonly<TidySectionPaneProps>) {
  const titleId = useId()
  const entries = hits
    ? tidy.entries.filter(({ key }) => hits.has(key))
    : tidy.entries
  return (
    <Pane bar={contents}>
      <section
        aria-labelledby={titleId}
        className='mx-auto flex w-full max-w-[44rem] flex-col gap-4 px-4 py-5 @min-[640px]:px-8 @min-[640px]:py-8'
      >
        <h3
          id={titleId}
          tabIndex={-1}
          data-reader-heading
          className='inline-flex items-center gap-2 text-2xl leading-tight font-semibold outline-none'
        >
          <NotebookTabs
            aria-hidden
            className='size-6 shrink-0 text-primary-text'
          />
          {TIDY_TITLE}
        </h3>
        <p className='-mt-2 text-sm text-text-secondary'>
          {tidySectionWords(tidy.entries.length, name)}
        </p>
        <TidyNotice tidy={tidy} name={name} form={form} />
        <ul className='flex flex-col gap-3'>
          {entries.map(entry => (
            <li key={entry.key}>
              <TidyCard
                entry={entry}
                text={texts.get(entry.key) ?? ''}
                onOpen={() => onPick({ tidy: entry.key })}
              />
            </li>
          ))}
        </ul>
      </section>
    </Pane>
  )
}
