'use client'

import { useId, useMemo, type ReactNode } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { hasProblem, NoteChip, NoteProblem } from './note-problem'
import { NoteRow } from './note-row'
import { NoteTime } from './note-time'
import {
  drawDescription,
  readDescription,
} from '@/components/character-sheet/description-html'
import type { NoteChapterView, NoteEntryView, NoteResolve } from '@/types/notes'
import type { SeatRole } from '@/utils/seat-words'

type Props = {
  /** The chapters shown, oldest first. */
  chapters: NoteChapterView[]
  /** The entries shown, oldest first. */
  entries: NoteEntryView[]
  /** The book has chapters, shown or not: its loose entries are then headed as such. */
  chaptered: boolean
  role: SeatRole
  /** The book takes changes: else nothing in it offers one (§9.4). */
  writable: boolean
  /** Foundry holds the journal back as too large. */
  tooLarge: boolean
  /** Whether a note's row is open. */
  isOpen: (entry: NoteEntryView) => boolean
  onToggle: (id: string, open: boolean) => void
  onNewIn: (chapter: NoteChapterView) => void
  onRename: (
    chapter: NoteChapterView,
    opener: 'rename' | 'problem-edit',
  ) => void
  onEdit: (entry: NoteEntryView, opener: 'edit' | 'problem-edit') => void
  onDelete: (entry: NoteEntryView) => void
  onResolve: (
    note: { id: string; stamp: string },
    choice: NoteResolve['resolve'],
  ) => void
  /** The note a choice is on its way for. */
  busy?: string
}

/**
 * A book's notes as its list shows them (round 0.34.0 §9.5): first the entries in no chapter, then
 * each chapter, oldest first, with its entries oldest first, as the user asked. Chapters are
 * added and renamed here, never deleted.
 */
export function NoteList({
  chapters,
  entries,
  chaptered,
  role,
  writable,
  tooLarge,
  isOpen,
  onToggle,
  onNewIn,
  onRename,
  onEdit,
  onDelete,
  onResolve,
  busy,
}: Readonly<Props>) {
  const ids = useId()
  // Oldest first, as the view sends them: sorted again here, so they're never shown otherwise.
  const chaptersShown = useMemo(() => chapters.toSorted(byCreated), [chapters])
  const entriesShown = useMemo(() => entries.toSorted(byCreated), [entries])
  const loose = entriesShown.filter(({ chapterId }) => chapterId === null)
  const rows = (shown: NoteEntryView[]) => (
    <ul className='flex flex-col gap-2'>
      {shown.map(entry => (
        <li key={entry.id}>
          <NoteRow
            entry={entry}
            role={role}
            writable={writable}
            tooLarge={tooLarge}
            open={isOpen(entry)}
            onToggle={open => onToggle(entry.id, open)}
            onEdit={opener => onEdit(entry, opener)}
            onDelete={() => onDelete(entry)}
            onResolve={choice => onResolve(entry, choice)}
            busy={busy === entry.id}
          />
        </li>
      ))}
    </ul>
  )
  return (
    <div className='flex flex-col gap-5'>
      {loose.length > 0 && (
        <div className='flex flex-col gap-2'>
          {/* So heading navigation reaches them, as it reaches each chapter's. */}
          {chaptered && <h3 className='sr-only'>Not in a chapter</h3>}
          {rows(loose)}
        </div>
      )}
      {chaptersShown.map(chapter => (
        <Chapter
          key={chapter.id}
          id={`${ids}-${chapter.id}`}
          chapter={chapter}
          role={role}
          writable={writable}
          tooLarge={tooLarge}
          count={
            entriesShown.filter(({ chapterId }) => chapterId === chapter.id)
              .length
          }
          onNewIn={() => onNewIn(chapter)}
          onRename={opener => onRename(chapter, opener)}
          onResolve={choice => onResolve(chapter, choice)}
          busy={busy === chapter.id}
        >
          {rows(
            entriesShown.filter(({ chapterId }) => chapterId === chapter.id),
          )}
        </Chapter>
      ))}
    </div>
  )
}

/** By when they were created, then by id, as the server orders them. */
function byCreated(
  a: { createdAt: string; id: string },
  b: { createdAt: string; id: string },
): number {
  const at = Date.parse(a.createdAt) - Date.parse(b.createdAt)
  if (at !== 0 && !Number.isNaN(at)) return at
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

const ICON_BUTTON =
  'flex size-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'

/** A chapter: its heading, a line saying who added or renamed it, and its entries. */
function Chapter({
  id,
  chapter,
  role,
  writable,
  tooLarge,
  count,
  onNewIn,
  onRename,
  onResolve,
  busy,
  children,
}: Readonly<{
  id: string
  chapter: NoteChapterView
  role: SeatRole
  writable: boolean
  tooLarge: boolean
  count: number
  onNewIn: () => void
  onRename: (opener: 'rename' | 'problem-edit') => void
  onResolve: (choice: NoteResolve['resolve']) => void
  busy: boolean
  children: ReactNode
}>) {
  const text = useMemo(
    () => (chapter.html ? readDescription(chapter.html) : undefined),
    [chapter.html],
  )
  const titleId = `${id}-title`
  // Renamed in Foundry, or deleted there, while a rename waited, it's settled first, by the problem
  // panel's choices: the server refuses another rename till then.
  const renames =
    writable &&
    chapter.canRename &&
    chapter.state !== 'conflict' &&
    chapter.state !== 'gone'
  return (
    // Named by its title alone, so it's found by it.
    <section aria-labelledby={titleId} className='flex flex-col gap-2'>
      <div className='flex items-start gap-1'>
        <h3
          tabIndex={-1}
          data-chapter-heading={chapter.id}
          className='min-w-0 flex-1 py-2.5 font-semibold break-words outline-none'
        >
          <span id={titleId}>{chapter.title}</span>
          <span className='font-normal text-text-secondary'>
            {' '}
            · {count}
            <span className='sr-only'> {count === 1 ? 'note' : 'notes'}</span>
          </span>
        </h3>
        {writable && (
          <button
            type='button'
            aria-label={`New note in ${chapter.title}`}
            title={`New note in ${chapter.title}`}
            data-note-opener='new-in'
            data-chapter={chapter.id}
            onClick={onNewIn}
            className={ICON_BUTTON}
          >
            <Plus aria-hidden className='size-5' />
          </button>
        )}
        {renames && (
          <button
            type='button'
            aria-label={`Rename ${chapter.title}`}
            title={`Rename ${chapter.title}`}
            data-note-opener='rename'
            data-chapter={chapter.id}
            onClick={() => onRename('rename')}
            className={ICON_BUTTON}
          >
            <Pencil aria-hidden className='size-4' />
          </button>
        )}
      </div>
      <p className='-mt-2 text-xs text-text-secondary'>
        <ChapterLine chapter={chapter} />
      </p>
      {chapter.state !== 'synced' && <NoteChip state={chapter.state} />}
      {hasProblem(chapter.state) && (
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
      {text && (
        <div className='overflow-x-auto'>
          <div className='sheet-text note-text'>{drawDescription(text)}</div>
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * Who added a chapter, or renamed it last, and when, here or in Foundry (§9.5): a chapter made
 * here is changed only by a rename, and is as it was made while it was last changed when made.
 */
export function ChapterLine({
  chapter,
}: Readonly<{ chapter: NoteChapterView }>) {
  const { modifiedIn, modifiedAt, createdAt, modifiedBy } = chapter
  let what = 'Renamed by'
  if (modifiedIn === 'foundry') what = 'Changed in Foundry by'
  else if (modifiedAt === createdAt) what = 'Added by'
  return (
    <>
      {what} {modifiedBy}, <NoteTime value={modifiedAt} />
    </>
  )
}
