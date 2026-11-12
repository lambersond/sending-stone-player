'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { BookOpen, PenLine, TriangleAlert } from 'lucide-react'
import { JournalModal } from '../journal-modal/journal-modal'
import { NoteTime } from '../note-time/note-time'
import { journalOpen, useNotes } from '@/features/notes/hooks/use-notes'
import { needsChoice } from '@/features/notes/utils/groups'
import {
  choicesWords,
  journalCounts,
  journalTitle,
  whoSeesNotes,
} from '@/features/notes/utils/note-words'
import type { JournalCardProps } from './types'

/**
 * Where a character's or a party's journal opens (round 0.35.0 §8.3): a card the same size
 * whatever the journal holds, so the tab it's on never grows with it, saying whose journal it is,
 * who sees it, how much it holds and its last change, what's not saved yet and what waits on a
 * choice; and the button that opens it. The journal's open state is the page's store's, so a card
 * mounted elsewhere, as the sheet arrives, shows it open still. It's polled while it's in view or
 * open.
 */
export function JournalCard({
  api,
  role,
  kind,
  name,
  active,
  look,
  form,
}: Readonly<JournalCardProps>) {
  const notes = useNotes(api, { active: active || journalOpen(api) })
  const { view, state, draft, open, setDraft, setOpen } = notes
  const headingId = useId()
  const button = useRef<HTMLButtonElement>(null)
  const isOpen = open !== undefined
  // Closed, focus goes back to Open: the browser gives it back where this button opened it, but
  // where the card was mounted again meanwhile, as when the sheet arrived, what it would give it
  // back to is gone.
  const was = useRef(isOpen)
  useEffect(() => {
    if (was.current && !isOpen) button.current?.focus()
    was.current = isOpen
  }, [isOpen])
  if (state === 'gone') return

  const title = journalTitle({ kind, role, name })
  let counts: ReactNode
  if (view) {
    counts = (
      <>
        {journalCounts(
          view.chapters.length,
          view.entries.length,
          view.tidy?.entries.length,
        )}
        {view.lastChange && (
          <>
            {' '}
            · Last changed by {view.lastChange.by},{' '}
            <NoteTime value={view.lastChange.at} />
          </>
        )}
      </>
    )
  } else {
    counts =
      state === 'failed'
        ? 'Notes couldn’t be loaded. Trying again…'
        : 'Loading notes…'
  }
  // What waits on a choice: a delete waiting is waiting, not a choice.
  const choices = view
    ? [...view.chapters, ...view.entries].filter(({ state: at }) =>
        needsChoice(at),
      ).length +
      view.groups.filter(
        ({ state: at }) => at === 'conflict' || at === 'failed',
      ).length
    : 0
  const unsaved =
    draft &&
    (draft.title.trim() ||
      (draft.role === 'chapter' ? 'new chapter' : 'new note'))
  const openJournal = () => {
    // A draft waiting comes back with focus in its title, unless it noted where it was.
    setDraft(held =>
      held && !held.focus ? { ...held, focus: { field: 'title' } } : held,
    )
    setOpen(true)
  }

  return (
    <section
      aria-labelledby={headingId}
      className='@container flex flex-col gap-2'
    >
      <h2
        id={headingId}
        className={
          look === 'sheet'
            ? 'text-xs font-semibold tracking-wider text-text-secondary uppercase'
            : 'text-sm font-semibold'
        }
      >
        Journal
      </h2>
      <div className='flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 @min-[640px]:flex-row @min-[640px]:items-center @min-[640px]:gap-5'>
        <div className='flex min-w-0 flex-1 items-start gap-3'>
          <span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-text'>
            <BookOpen aria-hidden className='size-5' />
          </span>
          <div className='flex min-w-0 flex-col gap-0.5'>
            <p className='font-semibold break-words'>{title}</p>
            <p className='text-sm text-text-secondary'>
              {whoSeesNotes({ kind, role, name, journal: view?.journal })}
            </p>
            <p className='text-xs text-text-secondary'>{counts}</p>
            {(unsaved || choices > 0) && (
              <div className='mt-1.5 flex flex-wrap gap-1.5'>
                {unsaved && (
                  <span className='inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary-text'>
                    <PenLine aria-hidden className='size-3.5 shrink-0' />
                    <span className='truncate'>Unsaved: {unsaved}</span>
                  </span>
                )}
                {choices > 0 && (
                  <span className='inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning'>
                    <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
                    {choicesWords(choices)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Beside the words, no wider than half the card, its label wrapping: as wide as a long
            name made it, it left them a letter's width. */}
        <button
          ref={button}
          type='button'
          onClick={openJournal}
          className='inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary wrap-anywhere transition-colors hover:bg-primary-hover @min-[640px]:w-auto @min-[640px]:max-w-1/2'
        >
          <BookOpen aria-hidden className='size-4 shrink-0' />
          Open {title}
        </button>
      </div>
      <JournalModal
        notes={notes}
        role={role}
        kind={kind}
        name={name}
        form={form}
        open={isOpen}
        onClose={() => setOpen(false)}
      />
    </section>
  )
}
