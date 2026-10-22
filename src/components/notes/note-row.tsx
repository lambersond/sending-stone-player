'use client'

import { useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { hasProblem, NoteChip, NoteProblem } from './note-problem'
import { NoteTime } from './note-time'
import {
  drawDescription,
  readDescription,
} from '@/components/character-sheet/description-html'
import type { NoteEntryView } from '@/types/notes'
import type { SeatRole } from '@/utils/seat-words'

/** Why a note is changed only in Foundry, said where its Edit would be (§9.5). */
const FOUNDRY_ONLY: Record<
  NonNullable<NoteEntryView['foundryOnly']>,
  string
> = {
  html: 'Written in Foundry’s own editor: change it there.',
  long: 'Too long to change here: change it in Foundry.',
  secret: 'It holds a Gamemaster’s secret: change it in Foundry.',
}

type Props = {
  entry: NoteEntryView
  role: SeatRole
  /** The book takes changes: else nothing in it offers one (§9.4). */
  writable: boolean
  /** Foundry holds the journal back as too large. */
  tooLarge: boolean
  open: boolean
  onToggle: (open: boolean) => void
  onEdit: (opener: 'edit' | 'problem-edit') => void
  onDelete: () => void
  onResolve: (choice: 'mine' | 'theirs') => void
  /** A choice for it is on its way. */
  busy?: boolean
}

/**
 * A note in its book's list: its title, an h4, so a screen reader's list of headings names every
 * note; who changed it last and when; and where it stands. Opened, its text as the book draws it,
 * what became of a change the game didn't take, and Edit and Delete where the seat may.
 */
export function NoteRow({
  entry,
  role,
  writable,
  tooLarge,
  open,
  onToggle,
  onEdit,
  onDelete,
  onResolve,
  busy,
}: Readonly<Props>) {
  const body = useMemo(
    () => (entry.html ? readDescription(entry.html) : undefined),
    [entry.html],
  )
  // Changed or deleted in Foundry while a change waited, it's settled first, by the problem
  // panel's choices: the server refuses any other change or delete till then.
  const settling = entry.state === 'conflict' || entry.state === 'gone'
  const edits = writable && entry.canEdit && !entry.foundryOnly && !settling
  const deletes =
    writable && entry.canDelete && entry.state !== 'deleting' && !settling
  return (
    <details
      open={open}
      onToggle={event => onToggle(event.currentTarget.open)}
      className='group rounded-2xl border border-border bg-card'
    >
      <summary
        data-note-summary={entry.id}
        className='grid min-h-11 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 rounded-2xl px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&::-webkit-details-marker]:hidden'
      >
        <h4 className='font-medium break-words'>{entry.title}</h4>
        <ChevronDown
          aria-hidden
          className='row-span-3 mt-1 size-4 text-text-secondary transition-transform group-open:rotate-180 motion-reduce:transition-none'
        />
        <span className='block text-xs text-text-secondary'>
          <NoteMeta entry={entry} />
        </span>
        {entry.state !== 'synced' && <NoteChip state={entry.state} />}
      </summary>
      <div className='flex flex-col gap-3 border-t border-border px-4 py-3'>
        {body && (
          <div className='overflow-x-auto'>
            <div className='sheet-text note-text'>{drawDescription(body)}</div>
          </div>
        )}
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
        {(entry.foundryOnly || edits || deletes) && (
          <div className='flex flex-wrap items-center gap-2'>
            {entry.foundryOnly ? (
              <p className='text-sm text-text-secondary'>
                {FOUNDRY_ONLY[entry.foundryOnly]}
              </p>
            ) : (
              edits && (
                <button
                  type='button'
                  data-note-opener='edit'
                  data-note={entry.id}
                  onClick={() => onEdit('edit')}
                  className='min-h-11 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
                >
                  Edit
                </button>
              )
            )}
            {deletes && (
              <button
                type='button'
                onClick={onDelete}
                className='min-h-11 rounded-xl border border-border px-4 text-sm font-medium text-danger transition-colors hover:border-danger/50 hover:bg-danger/5'
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </details>
  )
}

/**
 * Who changed a note last and when, in the app or in Foundry, and who wrote it where that's
 * someone else: "Changed by Gamemaster, just now · written by Vex".
 */
export function NoteMeta({ entry }: Readonly<{ entry: NoteEntryView }>) {
  const { author, modifiedBy, modifiedIn, modifiedAt } = entry
  let written = ''
  if (!author) written = ' · written in Foundry'
  else if (author.name !== modifiedBy) written = ` · written by ${author.name}`
  return (
    <>
      {modifiedIn === 'foundry' ? 'Changed in Foundry by' : 'Changed by'}{' '}
      {modifiedBy}, <NoteTime value={modifiedAt} />
      {written}
    </>
  )
}
