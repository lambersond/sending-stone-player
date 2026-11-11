'use client'

import { useEffect, useId, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  ChevronDown,
  NotebookPen,
  PenLine,
  Plus,
  TriangleAlert,
  X,
} from 'lucide-react'
import { SearchField } from '@/components/search-field/search-field'
import { StateMark } from '@/features/notes/components/note-lines/state-mark'
import { OrderMark } from '@/features/notes/components/order-state/order-mark'
import { TidyContents } from '@/features/notes/components/tidy-contents/tidy-contents'
import { JOURNAL_ICON_BUTTON } from '@/features/notes/constants'
import { groupNeedsChoice, keyOf } from '@/features/notes/utils/groups'
import type { ContentsProps } from './types'
import type { NoteEntryView } from '@/types/notes'

const PRIMARY =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover'
const OUTLINE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'

/**
 * The journal's contents (round 0.35.0 §8.6): a search, then the notes in no chapter and every
 * chapter, each shut or open, with its notes; from module 0.44.0 the character's Tidy 5e Sheets
 * entries last, read only; and New note and New chapter. From 640 px of the
 * modal they're a pane at its left; below, a drawer, opened by the reader's Contents button, which
 * is inert while it's closed, so Tab never reaches it. While the editor or a Reorder fills the
 * reader, they're inert and say why.
 */
export function Contents({
  id,
  groups,
  query,
  onQuery,
  hits,
  tidy,
  tidyHits,
  shown,
  draftNote,
  locked,
  canAdd,
  narrow,
  drawer,
  onCloseDrawer,
  onPick,
  onNewNote,
  onNewChapter,
}: Readonly<ContentsProps>) {
  const ids = useId()
  const close = useRef<HTMLButtonElement>(null)
  // Groups shut by hand, by their key; they stay shut while the modal is open.
  const [shut, setShut] = useState<Record<string, boolean>>({})
  // Opened, the drawer takes focus to its own Close.
  useEffect(() => {
    if (drawer) close.current?.focus()
  }, [drawer])

  const searching = hits !== undefined
  // The notes in no chapter only where it has some; every chapter, empty or not; searching, only
  // the groups with a hit.
  const listed = (groups ?? [])
    .map(group => ({
      group,
      notes: searching
        ? group.entries.filter(({ id: note }) => hits.has(note))
        : group.entries,
    }))
    .filter(({ group, notes }) =>
      searching
        ? notes.length > 0
        : group.chapterId !== null || notes.length > 0,
    )
  const onNote = shown && 'note' in shown ? shown.note : undefined
  const onGroup = shown && 'group' in shown ? keyOf(shown.group) : undefined
  // New note goes in the chapter open: the note's, the group's, none for the notes in no chapter;
  // with nothing open, the newest chapter.
  const newNote = () => {
    const open = (groups ?? []).find(
      ({ chapterId, entries }) =>
        keyOf(chapterId) === onGroup ||
        entries.some(({ id: note }) => note === onNote),
    )
    const newest = groups?.findLast(({ chapterId }) => chapterId !== null)
    onNewNote(open ? open.chapterId : (newest?.chapterId ?? null))
  }

  return (
    <>
      {drawer && (
        <div
          aria-hidden
          onClick={onCloseDrawer}
          className='absolute inset-0 z-20 bg-black/30 @min-[640px]:hidden'
        />
      )}
      <div
        id={id}
        inert={locked !== undefined || (narrow && !drawer)}
        className={clsx(
          'absolute inset-y-0 left-0 z-30 flex w-[min(20rem,86%)] flex-col border-r border-border bg-card shadow-xl transition-transform duration-200 motion-reduce:transition-none',
          drawer ? 'translate-x-0' : '-translate-x-full',
          '@min-[640px]:static @min-[640px]:z-auto @min-[640px]:w-64 @min-[640px]:translate-x-0 @min-[640px]:shadow-none @min-[800px]:w-72',
          locked && 'opacity-50',
        )}
      >
        <div className='flex items-center gap-1 p-3 pb-2'>
          <div className='min-w-0 flex-1'>
            <SearchField
              value={query}
              onChange={onQuery}
              label='Search notes'
              placeholder='Search notes'
            />
          </div>
          <button
            ref={close}
            type='button'
            aria-label='Close contents'
            onClick={onCloseDrawer}
            className={clsx(JOURNAL_ICON_BUTTON, '@min-[640px]:hidden')}
          >
            <X aria-hidden className='size-5' />
          </button>
        </div>
        {locked && (
          <p className='px-4 pb-2 text-xs text-text-secondary'>
            {locked === 'editing'
              ? 'Save or cancel to read another note.'
              : 'Save or cancel the new order first.'}
          </p>
        )}
        {groups ? (
          <nav
            aria-label='Contents'
            className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3'
          >
            {searching && listed.length === 0 && !tidyHits?.size && (
              <p className='px-3 py-2 text-sm text-text-secondary'>
                No notes match “{query.trim()}”.
              </p>
            )}
            {listed.map(({ group, notes }) => {
              const key = keyOf(group.chapterId)
              // Searching, every group with a hit is open.
              const isShut = !searching && shut[key] === true
              const groupId = `${ids}-group-${key}`
              const warns = groupNeedsChoice(group)
              return (
                <div key={key} className='py-0.5'>
                  <div className='flex items-center'>
                    <button
                      type='button'
                      aria-expanded={!isShut}
                      aria-label={`${isShut ? 'Show' : 'Hide'} the notes in ${group.title}`}
                      onClick={() =>
                        setShut(held => ({ ...held, [key]: !isShut }))
                      }
                      className={JOURNAL_ICON_BUTTON}
                    >
                      <ChevronDown
                        aria-hidden
                        className={clsx(
                          'size-4 transition-transform motion-reduce:transition-none',
                          isShut && '-rotate-90',
                        )}
                      />
                    </button>
                    {/* Named by its title alone, so it's found by it; its mark and count
                        describe it. */}
                    <button
                      type='button'
                      aria-label={group.title}
                      aria-describedby={groupId}
                      aria-current={onGroup === key ? 'true' : undefined}
                      onClick={() => onPick({ group: group.chapterId })}
                      className={clsx(
                        'flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl pr-3 pl-1 text-left text-sm font-semibold transition-colors',
                        onGroup === key
                          ? 'bg-primary/10 text-primary-text'
                          : 'hover:bg-primary/5',
                      )}
                    >
                      <span
                        title={group.title}
                        className='min-w-0 flex-1 truncate'
                      >
                        {group.title}
                      </span>
                      <span
                        id={groupId}
                        className='flex shrink-0 items-center gap-2'
                      >
                        {warns ? (
                          <span
                            title='Needs a choice'
                            className='inline-flex text-warning'
                          >
                            <TriangleAlert aria-hidden className='size-3.5' />
                            <span className='sr-only'>Needs a choice</span>
                          </span>
                        ) : (
                          <OrderMark state={group.order.state} />
                        )}
                        <span className='text-xs font-normal text-text-secondary tabular-nums'>
                          {notes.length}
                          <span className='sr-only'>
                            {notes.length === 1 ? ' note' : ' notes'}
                          </span>
                        </span>
                      </span>
                    </button>
                  </div>
                  {!isShut && notes.length > 0 && (
                    <ul className='flex flex-col'>
                      {notes.map(entry => (
                        <li key={entry.id}>
                          <NoteRow
                            id={`${ids}-note-${entry.id}`}
                            entry={entry}
                            current={onNote === entry.id}
                            drafted={draftNote === entry.id}
                            onPick={() => onPick({ note: entry.id })}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
            {tidy && (
              <TidyContents
                tidy={tidy}
                hits={tidyHits}
                shown={shown}
                onPick={onPick}
              />
            )}
          </nav>
        ) : (
          <div aria-hidden className='flex flex-col gap-5 p-4'>
            {['72%', '55%', '84%', '61%', '47%'].map(width => (
              <div
                key={width}
                style={{ width }}
                className='h-3 rounded-full bg-border motion-safe:animate-pulse'
              />
            ))}
          </div>
        )}
        {canAdd && groups && (
          <div className='flex shrink-0 gap-2 border-t border-border p-3'>
            <button
              type='button'
              data-note-opener='new'
              onClick={newNote}
              className={clsx(PRIMARY, 'flex-1')}
            >
              <Plus aria-hidden className='size-4' />
              New note
            </button>
            <button
              type='button'
              aria-label='New chapter'
              title='New chapter'
              data-note-opener='new-chapter'
              onClick={onNewChapter}
              className={clsx(OUTLINE, 'min-w-11')}
            >
              <NotebookPen aria-hidden className='size-4' />
            </button>
          </div>
        )}
      </div>
    </>
  )
}

/** A note in the contents: its title, named by it alone, and marks for its draft and its state. */
function NoteRow({
  id,
  entry,
  current,
  drafted,
  onPick,
}: Readonly<{
  id: string
  entry: NoteEntryView
  current: boolean
  drafted: boolean
  onPick: () => void
}>) {
  const marked = drafted || entry.state !== 'synced'
  return (
    <button
      type='button'
      aria-label={entry.title}
      aria-describedby={marked ? id : undefined}
      aria-current={current ? 'true' : undefined}
      onClick={onPick}
      className={clsx(
        'flex min-h-11 w-full items-center gap-2 rounded-xl py-2 pr-3 pl-11 text-left text-sm transition-colors',
        current
          ? 'bg-primary/10 font-medium text-primary-text'
          : 'hover:bg-primary/5',
      )}
    >
      <span title={entry.title} className='min-w-0 flex-1 truncate'>
        {entry.title}
      </span>
      {marked && (
        <span id={id} className='flex shrink-0 items-center gap-1'>
          {drafted && (
            <span
              title='Draft not saved yet'
              className='inline-flex text-primary-text'
            >
              <PenLine aria-hidden className='size-3.5' />
              <span className='sr-only'>Draft not saved yet</span>
            </span>
          )}
          <StateMark state={entry.state} />
        </span>
      )}
    </button>
  )
}
