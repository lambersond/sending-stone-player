'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { Clock, LoaderCircle, TriangleAlert } from 'lucide-react'
import { noteReasonWords } from '@/utils/note-words'
import { orderStateWords } from '@/utils/order-words'
import { seatWords, type SeatRole } from '@/utils/seat-words'
import type {
  NoteEntryView,
  NoteGroupView,
  NoteOrderState,
} from '@/types/notes'

/** The states an order didn't reach Foundry in, which its chip warns of. */
const WARNS = new Set<NoteOrderState>(['conflict', 'failed'])

/** The icon of an order's state, beside its words: a spinner while it's on its way. */
function OrderIcon({ state }: Readonly<{ state: NoteOrderState }>) {
  if (state === 'saving') {
    return (
      <LoaderCircle
        aria-hidden
        className='size-3.5 shrink-0 motion-safe:animate-spin'
      />
    )
  }
  if (WARNS.has(state)) {
    return <TriangleAlert aria-hidden className='size-3.5 shrink-0' />
  }
  return <Clock aria-hidden className='size-3.5 shrink-0' />
}

/**
 * Where a group's order stands, as a chip of an icon and its words, never colour alone (round
 * 0.35.0 §9.5), as a note's `NoteChip` says a note's. Nothing where it's the same in Foundry.
 */
export function OrderChip({ state }: Readonly<{ state: NoteOrderState }>) {
  const words = orderStateWords(state)
  if (!words) return
  return (
    <span
      className={clsx(
        'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        WARNS.has(state)
          ? 'border-warning/40 bg-warning/10 text-warning'
          : 'border-border text-text-secondary',
      )}
    >
      <OrderIcon state={state} />
      {words}
    </span>
  )
}

/**
 * An order on its way, as the contents' mark beside its group: the chip's icon alone, its words
 * as its title and for a screen reader. Nothing otherwise: a refused order shows as the group's
 * warning, which the contents draw themselves.
 */
export function OrderMark({ state }: Readonly<{ state: NoteOrderState }>) {
  if (state !== 'waiting' && state !== 'saving') return
  const words = orderStateWords(state)
  return (
    <span title={words} className='inline-flex text-text-secondary'>
      <OrderIcon state={state} />
      <span className='sr-only'>{words}</span>
    </span>
  )
}

type Props = {
  group: NoteGroupView
  /** The group's notes as the seat sees them, to name an order's notes by their titles. */
  entries: NoteEntryView[]
  role: SeatRole
  /** A choice is on its way. */
  busy: boolean
  onResolve: (choice: 'mine' | 'theirs') => void
}

/**
 * What became of an order the game didn't take, and the choices left (round 0.35.0 §9.5): Foundry's
 * order stays shown, and the seat's own is kept to send again or drop. The server shows it only to
 * the seat that made the order, and to the Gamemaster, who sees another seat's, named, and chooses
 * for it, as a note's problem panel does.
 */
export function OrderProblem({
  group,
  entries,
  role,
  busy,
  onResolve,
}: Readonly<Props>) {
  const [showing, setShowing] = useState(false)
  const { state, mine } = group
  const label = orderStateWords(state)
  if (!label || !WARNS.has(state)) return
  const theirs = mine?.by !== undefined
  const yours = theirs ? 'theirs' : 'yours'
  const buttons: { label: string; choice: 'mine' | 'theirs' }[] = []
  let text: string
  if (state === 'conflict') {
    const whose = theirs ? `${mine.by}’s` : 'your'
    text = `Reordered in Foundry while ${whose} order waited. Foundry’s order is shown.`
    buttons.push(
      { label: `Use ${yours}`, choice: 'mine' },
      { label: 'Keep Foundry’s', choice: 'theirs' },
    )
  } else {
    const { game } = seatWords(role)
    text = `Not saved to ${game}: ${noteReasonWords(group.reason ?? 'error', role)}.`
    buttons.push(
      { label: 'Try again', choice: 'mine' },
      { label: `Discard ${yours}`, choice: 'theirs' },
    )
  }
  const shows = state === 'conflict' && mine !== undefined
  return (
    <div
      role='group'
      aria-label={label}
      className='flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5'
    >
      <p className='text-sm'>{text}</p>
      <div className='flex flex-wrap gap-2'>
        {shows && (
          <button
            type='button'
            aria-expanded={showing}
            disabled={busy}
            onClick={() => setShowing(shown => !shown)}
            className={BUTTON}
          >
            {showing ? 'Hide' : 'Show'} {yours}
          </button>
        )}
        {buttons.map(button => (
          <button
            key={button.label}
            type='button'
            disabled={busy}
            onClick={() => onResolve(button.choice)}
            className={BUTTON}
          >
            {button.label}
          </button>
        ))}
      </div>
      {shows && showing && <Waiting ids={mine.ids} entries={entries} />}
    </div>
  )
}

const BUTTON =
  'min-h-11 rounded-xl border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60'

/**
 * The waiting order, by its notes' titles, in its order: a note the seat doesn't see now, as one
 * deleted or hidden since, is left out, its title never shown.
 */
function Waiting({
  ids,
  entries,
}: Readonly<{ ids: string[]; entries: NoteEntryView[] }>) {
  const titles = new Map(entries.map(entry => [entry.id, entry.title]))
  const seen = ids.filter(id => titles.has(id))
  return (
    <ol className='flex list-decimal flex-col gap-1 rounded-xl border border-border bg-card py-2 pr-3 pl-8 text-sm'>
      {seen.map(id => (
        <li key={id} className='break-words'>
          {titles.get(id)}
        </li>
      ))}
    </ol>
  )
}
