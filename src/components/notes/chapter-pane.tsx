'use client'

import { useId, type ReactNode } from 'react'
import { ArrowDownUp, FileText, NotebookPen, Pencil, Plus } from 'lucide-react'
import { LOOSE_TITLE, type JournalGroup } from './contents'
import { NoteCard } from './note-card'
import { ChapterLine, mayMove, mayRename, NoteText } from './note-lines'
import { hasProblem, NoteChip, NoteProblem } from './note-problem'
import { OrderChip, OrderProblem } from './order-state'
import { Pane } from './pane'
import type { NotePick } from '@/hooks/use-notes'
import type { NoteChapterView, NoteEntryView } from '@/types/notes'
import type { SeatRole } from '@/utils/seat-words'

const ICON_BUTTON =
  'flex size-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'
const OUTLINE =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
const DASHED =
  'flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 text-sm font-medium text-text-secondary transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-text-primary'

type Props = {
  group: JournalGroup
  /** What's searched, if anything: its notes shown are then only the hits. */
  query: string
  /** Its notes the search finds, in its order; all of them while nothing is searched. */
  shown: NoteEntryView[]
  /** The book's chapters, oldest first. */
  chapters: NoteChapterView[]
  role: SeatRole
  /** The book takes changes: else nothing here offers one. */
  canAdd: boolean
  /** The seat may put the notes of a group in order. */
  canReorder: boolean
  /** Something is being written in the book, which is saved or cancelled first. */
  drafting: boolean
  /** Foundry holds the journal back as too large. */
  tooLarge: boolean
  /** The reader's Contents button, below 640 px of the modal. */
  contents: ReactNode
  onPick: (pick: NotePick) => void
  onRename: (opener: 'rename' | 'problem-edit') => void
  onNewIn: () => void
  onReorder: () => void
  /** The chapter's own choice, where the game didn't take its rename. */
  onResolve: (choice: 'mine' | 'theirs') => void
  onResolveOrder: (choice: 'mine' | 'theirs') => void
  onMove: (entry: NoteEntryView, chapterId: string | null) => void
  /** The note whose move is on its way. */
  moving?: string
  /** A choice for the chapter is on its way. */
  busy: boolean
  /** A choice for its order is on its way. */
  orderBusy: boolean
}

/**
 * A group's page (round 0.35.0 §8.9): a chapter's, or the notes' in no chapter. In its bar,
 * Reorder and Rename where the seat may; then which chapter it is, who added or renamed it, how
 * many notes it holds, where it and its order stand, what Foundry has written under it, and its
 * notes as cards, formatted, in its order; and New note in it.
 */
export function ChapterPane({
  group,
  query,
  shown,
  chapters,
  role,
  canAdd,
  canReorder,
  drafting,
  tooLarge,
  contents,
  onPick,
  onRename,
  onNewIn,
  onReorder,
  onResolve,
  onResolveOrder,
  onMove,
  moving,
  busy,
  orderBusy,
}: Readonly<Props>) {
  const titleId = useId()
  const { chapter, entries, order } = group
  const searching = query.trim() !== ''
  const reorders = canReorder && !drafting && !searching && entries.length > 1
  const renames = chapter !== undefined && mayRename(chapter, canAdd)
  // Only the notes in no chapter offer Move on their cards: a chapter's are moved from their own.
  const movable = (entry: NoteEntryView) =>
    chapter === undefined && mayMove(entry, canAdd, chapters)
  const count = entries.length

  const bar = (
    <>
      {contents}
      <span className='flex-1' />
      {reorders && (
        <button
          type='button'
          data-reorder
          onClick={onReorder}
          className={OUTLINE}
        >
          <ArrowDownUp aria-hidden className='size-4' />
          Reorder
        </button>
      )}
      {renames && (
        <button
          type='button'
          aria-label={`Rename ${chapter.title}`}
          title='Rename'
          data-note-opener='rename'
          data-chapter={chapter.id}
          onClick={() => onRename('rename')}
          className={ICON_BUTTON}
        >
          <Pencil aria-hidden className='size-5' />
        </button>
      )}
    </>
  )

  let empty: string | undefined
  if (count === 0) empty = 'No notes in this chapter yet.'
  else if (shown.length === 0) empty = `No notes match “${query.trim()}”.`

  return (
    <Pane bar={bar}>
      <article
        aria-labelledby={titleId}
        className='mx-auto flex w-full max-w-[44rem] flex-col gap-4 px-4 py-5 @min-[640px]:px-8 @min-[640px]:py-7'
      >
        <p className='text-xs font-semibold tracking-wider text-text-secondary uppercase'>
          {chapter ? `Chapter ${group.n} of ${chapters.length}` : 'Notes'}
        </p>
        <h3
          id={titleId}
          tabIndex={-1}
          data-reader-heading
          className='-mt-2 text-2xl leading-tight font-semibold text-balance break-words outline-none'
        >
          {chapter ? chapter.title : LOOSE_TITLE}
        </h3>
        <p className='-mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary'>
          {chapter && (
            <span className='inline-flex min-w-0 items-center gap-1'>
              <NotebookPen aria-hidden className='size-3.5 shrink-0' />
              <span>
                <ChapterLine chapter={chapter} />
              </span>
            </span>
          )}
          <span className='inline-flex items-center gap-1'>
            <FileText aria-hidden className='size-3.5 shrink-0' />
            {count} {count === 1 ? 'note' : 'notes'}
          </span>
        </p>
        {chapter && chapter.state !== 'synced' && (
          <NoteChip state={chapter.state} />
        )}
        {chapter && hasProblem(chapter.state) && (
          <NoteProblem
            state={chapter.state}
            reason={chapter.reason}
            modifiedBy={chapter.modifiedBy}
            mine={chapter.mine}
            role={role}
            tooLarge={tooLarge}
            onEdit={renames ? () => onRename('problem-edit') : undefined}
            editFor={{ chapter: chapter.id }}
            onResolve={onResolve}
            busy={busy}
          />
        )}
        <OrderChip state={order.state} />
        <OrderProblem
          group={order}
          entries={entries}
          role={role}
          busy={orderBusy}
          onResolve={onResolveOrder}
        />
        {chapter?.html && (
          <div className='flex flex-col gap-1 rounded-xl bg-page px-4 py-3'>
            <p className='text-xs font-semibold text-text-secondary'>
              Written in Foundry, under the chapter
            </p>
            <NoteText html={chapter.html} lifted />
          </div>
        )}
        {shown.some(entry => movable(entry)) && (
          <p className='text-sm text-text-secondary'>
            These notes aren’t in any chapter yet. Use Move to chapter to file
            one.
          </p>
        )}
        {shown.length > 0 && (
          <ul className='flex flex-col gap-3'>
            {shown.map(entry => (
              <li key={entry.id}>
                <NoteCard
                  entry={entry}
                  move={
                    movable(entry)
                      ? {
                          chapters,
                          busy: moving === entry.id,
                          onMove: chapterId => onMove(entry, chapterId),
                        }
                      : undefined
                  }
                  onOpen={() => onPick({ note: entry.id })}
                />
              </li>
            ))}
          </ul>
        )}
        {empty && <p className='text-sm text-text-secondary'>{empty}</p>}
        {canAdd && (
          <button
            type='button'
            data-note-opener='new-in'
            data-chapter={group.chapterId ?? ''}
            onClick={onNewIn}
            className={DASHED}
          >
            <Plus aria-hidden className='size-4' />
            {chapter ? `New note in ${chapter.title}` : 'New note'}
          </button>
        )}
      </article>
    </Pane>
  )
}
