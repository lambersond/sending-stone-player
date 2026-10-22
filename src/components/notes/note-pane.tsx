'use client'

import { useId, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Pencil,
  PenLine,
  Trash2,
  User,
} from 'lucide-react'
import { LOOSE_TITLE, type JournalGroup } from './contents'
import { MoveMenu } from './move-menu'
import {
  FOUNDRY_ONLY,
  LastChanged,
  mayDelete,
  mayEdit,
  mayMove,
  NoteText,
  Written,
} from './note-lines'
import { hasProblem, NoteChip, NoteProblem } from './note-problem'
import { Pane } from './pane'
import type { NotePick } from '@/hooks/use-notes'
import type { NoteChapterView, NoteEntryView } from '@/types/notes'
import type { SeatRole } from '@/utils/seat-words'

const ICON_BUTTON =
  'flex size-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary disabled:pointer-events-none disabled:opacity-40'
const NAV_CARD =
  'flex min-w-0 flex-col gap-0.5 rounded-xl border border-border px-3 py-2 transition-colors hover:border-primary/50 hover:bg-primary/5'

type Props = {
  entry: NoteEntryView
  /** The group it's in. */
  group: JournalGroup
  /** Every note of the book in reading order, whatever is searched. */
  order: NoteEntryView[]
  /** The book's chapters, oldest first, to move it to one. */
  chapters: NoteChapterView[]
  role: SeatRole
  /** The book takes changes: else nothing here offers one. */
  canAdd: boolean
  /** Foundry holds the journal back as too large. */
  tooLarge: boolean
  /** The reader's Contents button, below 640 px of the modal. */
  contents: ReactNode
  /** Shows another note or its group; from an arrow, focus stays on that arrow. */
  onPick: (pick: NotePick, from?: 'previous' | 'next') => void
  onEdit: (opener: 'edit' | 'problem-edit') => void
  onDelete: () => void
  onMove: (chapterId: string | null) => void
  onResolve: (choice: 'mine' | 'theirs') => void
  /** Its move is on its way. */
  moving: boolean
  /** A choice for it is on its way. */
  busy: boolean
}

/**
 * One note, read (round 0.35.0 §8.8): its chapter's number and its tools in the bar, Move, Edit
 * and Delete where the seat may, then where it is among the book's notes and the arrows to the
 * one before and after; its chapter's title over its own, who wrote it and who changed it last,
 * where it stands, and its text, at the reader's size; and Previous and Next, pinned below.
 */
export function NotePane({
  entry,
  group,
  order,
  chapters,
  role,
  canAdd,
  tooLarge,
  contents,
  onPick,
  onEdit,
  onDelete,
  onMove,
  onResolve,
  moving,
  busy,
}: Readonly<Props>) {
  const titleId = useId()
  const at = order.findIndex(({ id }) => id === entry.id)
  const previous = at > 0 ? order[at - 1] : undefined
  const next = at >= 0 ? order[at + 1] : undefined
  const moves = mayMove(entry, canAdd, chapters)
  const edits = mayEdit(entry, canAdd)
  const deletes = mayDelete(entry, canAdd)
  const { n } = group

  const bar = (
    <>
      {contents}
      {/* The rest of the bar goes by the room left for it, not by the modal's width: beside the
          contents from 640 px, or after the Contents button below, it has less than the modal,
          and all of it but the chapter's number keeps its width. Its number shortens below 360 px
          of room, and its place among the notes shows from 420, so Next is never cut off; past
          that, the number gives way first. */}
      <div className='flex min-w-0 flex-1 items-center gap-1 @container/bar'>
        {n !== undefined && (
          <p className='min-w-0 truncate px-1 text-xs font-semibold tracking-wider whitespace-nowrap text-text-secondary uppercase @min-[360px]/bar:px-2'>
            <span className='@max-[360px]/bar:hidden'>Chapter {n}</span>
            <span aria-hidden className='@min-[360px]/bar:hidden'>
              Ch. {n}
            </span>
            <span className='sr-only @min-[360px]/bar:hidden'>Chapter {n}</span>
          </p>
        )}
        <span className='flex-1' />
        {moves && (
          <MoveMenu
            entry={entry}
            chapters={chapters}
            busy={moving}
            onMove={onMove}
          />
        )}
        {edits && (
          <button
            type='button'
            aria-label={`Edit ${entry.title}`}
            title='Edit'
            data-note-opener='edit'
            data-note={entry.id}
            onClick={() => onEdit('edit')}
            className={ICON_BUTTON}
          >
            <Pencil aria-hidden className='size-5' />
          </button>
        )}
        {deletes && (
          <button
            type='button'
            aria-label={`Delete ${entry.title}`}
            title='Delete'
            onClick={onDelete}
            className={clsx(ICON_BUTTON, 'hover:text-danger')}
          >
            <Trash2 aria-hidden className='size-5' />
          </button>
        )}
        {(moves || edits || deletes) && (
          <span
            aria-hidden
            className='mx-1 h-6 w-px shrink-0 bg-border @max-[360px]/bar:hidden'
          />
        )}
        <span className='hidden shrink-0 px-1 text-xs whitespace-nowrap text-text-secondary tabular-nums @min-[420px]/bar:inline'>
          {at + 1} of {order.length}
        </span>
        <button
          type='button'
          aria-label='Previous note'
          title={previous && `Previous: ${previous.title}`}
          disabled={!previous}
          onClick={() => previous && onPick({ note: previous.id }, 'previous')}
          className={ICON_BUTTON}
        >
          <ChevronLeft aria-hidden className='size-5' />
        </button>
        <button
          type='button'
          aria-label='Next note'
          title={next && `Next: ${next.title}`}
          disabled={!next}
          onClick={() => next && onPick({ note: next.id }, 'next')}
          className={ICON_BUTTON}
        >
          <ChevronRight aria-hidden className='size-5' />
        </button>
      </div>
    </>
  )

  const footer = (previous || next) && (
    <nav aria-label='Other notes' className='grid grid-cols-2 gap-2'>
      {previous ? (
        <button
          type='button'
          onClick={() => onPick({ note: previous.id })}
          className={clsx(NAV_CARD, 'items-start text-left')}
        >
          <span className='inline-flex items-center gap-1 text-xs text-text-secondary'>
            <ChevronLeft aria-hidden className='size-3.5' />
            Previous
          </span>
          <span className='w-full truncate text-sm font-medium'>
            {previous.title}
          </span>
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button
          type='button'
          onClick={() => onPick({ note: next.id })}
          className={clsx(NAV_CARD, 'items-end text-right')}
        >
          <span className='inline-flex items-center gap-1 text-xs text-text-secondary'>
            Next
            <ChevronRight aria-hidden className='size-3.5' />
          </span>
          <span className='w-full truncate text-sm font-medium'>
            {next.title}
          </span>
        </button>
      ) : (
        <span />
      )}
    </nav>
  )

  return (
    <Pane bar={bar} footer={footer || undefined}>
      <article
        aria-labelledby={titleId}
        className='mx-auto flex w-full max-w-[44rem] flex-col gap-4 px-4 py-5 @min-[640px]:px-8 @min-[640px]:py-8'
      >
        {/* 44 px to tap, in the article's top padding and the gap under it, its words where
            they'd be at their own height; over the title's first line, whose glyphs reach a
            pixel above its box. */}
        <button
          type='button'
          onClick={() => onPick({ group: group.chapterId })}
          className='relative -mt-5 -mb-2 min-h-11 w-fit min-w-11 rounded-md pt-5 pb-2 text-left text-xs font-semibold tracking-wider text-text-secondary uppercase transition-colors hover:text-primary-text'
        >
          {group.chapter ? group.title : LOOSE_TITLE}
        </button>
        <h3
          id={titleId}
          tabIndex={-1}
          data-reader-heading
          className='-mt-2 text-2xl leading-tight font-semibold text-balance break-words outline-none'
        >
          {entry.title}
        </h3>
        <p className='-mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary'>
          <span className='inline-flex min-w-0 items-center gap-1'>
            <User aria-hidden className='size-3.5 shrink-0' />
            <span>
              <Written entry={entry} />
            </span>
          </span>
          <span className='inline-flex min-w-0 items-center gap-1'>
            <PenLine aria-hidden className='size-3.5 shrink-0' />
            <span>
              <LastChanged entry={entry} />
            </span>
          </span>
        </p>
        {entry.state !== 'synced' && <NoteChip state={entry.state} />}
        {hasProblem(entry.state) && (
          <NoteProblem
            state={entry.state}
            reason={entry.reason}
            modifiedBy={entry.modifiedBy}
            mine={entry.mine}
            role={role}
            tooLarge={tooLarge}
            onEdit={edits ? () => onEdit('problem-edit') : undefined}
            editFor={{ note: entry.id }}
            onResolve={onResolve}
            busy={busy}
          />
        )}
        <NoteText html={entry.html} lifted />
        {entry.foundryOnly && (
          <p className='inline-flex items-start gap-1.5 text-sm text-text-secondary'>
            <Lock aria-hidden className='mt-0.5 size-3.5 shrink-0' />
            {FOUNDRY_ONLY[entry.foundryOnly]}
          </p>
        )}
      </article>
    </Pane>
  )
}
