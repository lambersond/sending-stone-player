'use client'

import { useMemo, useState } from 'react'
import { hasProblem } from './utils'
import { drawDescription } from '@/components/description/draw-description'
import { readDescription } from '@/components/description/read-description'
import {
  noteReasonWords,
  noteStateWords,
} from '@/features/notes/utils/note-words'
import { seatWords } from '@/utils/seat-words'
import type { Mine, NoteProblemProps } from './types'

/**
 * What became of a change the game didn't take, or of a delete waiting for it, and the choices
 * left (§9.7): Foundry's version stays, and the seat's own is kept beside it to choose. The
 * Gamemaster sees another seat's, named, and chooses for it.
 */
export function NoteProblem({
  state,
  reason,
  modifiedBy,
  mine,
  role,
  tooLarge,
  onEdit,
  editFor,
  onResolve,
  busy = false,
}: Readonly<NoteProblemProps>) {
  const [showing, setShowing] = useState(false)
  const label = noteStateWords(state)
  if (!hasProblem(state) || !label) return
  const theirs = mine?.by !== undefined
  const whose = theirs ? `${mine.by}’s` : 'your'
  const yours = theirs ? 'theirs' : 'yours'
  const { game } = seatWords(role)
  let text: string
  // Whose change it was, where nothing else in the panel names them.
  let lead: string | undefined
  const buttons: { label: string; onClick: () => void; edit?: true }[] = []
  const pick = (choice: 'mine' | 'theirs', words: string) =>
    buttons.push({ label: words, onClick: () => onResolve(choice) })
  // A delete that met a change made in Foundry is kept, with choices of its own.
  const kind = state === 'conflict' && mine?.deleting ? 'kept' : state
  switch (kind) {
    case 'kept': {
      text = `Changed in Foundry by ${modifiedBy}, so it wasn’t deleted.`
      pick('mine', 'Delete anyway')
      pick('theirs', 'Keep it')
      break
    }
    case 'conflict': {
      text = tooLarge
        ? `Changed in Foundry while ${whose} edit waited. This journal is too large to show Foundry’s version here: open it in Foundry.`
        : `Changed in Foundry by ${modifiedBy} while ${whose} edit waited. Foundry’s version is shown.`
      pick('mine', `Use ${yours}`)
      pick('theirs', 'Keep Foundry’s')
      break
    }
    case 'gone': {
      text = `Deleted in Foundry while ${whose} edit waited.`
      pick('mine', 'Add it again')
      pick('theirs', `Discard ${yours}`)
      break
    }
    case 'failed': {
      text = `Not saved to ${game}: ${noteReasonWords(reason ?? 'error', role)}.`
      if (theirs) lead = `${mine.by}’s change`
      pick('mine', 'Try again')
      if (onEdit) buttons.push({ label: 'Edit', onClick: onEdit, edit: true })
      pick('theirs', `Discard ${yours}`)
      break
    }
    default: {
      text = `It’s deleted from Foundry when ${game} is next open.`
      pick('theirs', 'Keep it')
    }
  }
  const shows = state === 'conflict' && !mine?.deleting && mine !== undefined
  return (
    <div
      role='group'
      aria-label={label}
      className='flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5'
    >
      {lead && <p className='text-xs font-semibold'>{lead}</p>}
      <p className='text-sm'>{text}</p>
      <div className='flex flex-wrap gap-2'>
        {shows && (
          <button
            type='button'
            aria-expanded={showing}
            onClick={() => setShowing(shown => !shown)}
            className={BUTTON}
          >
            Show {yours}
          </button>
        )}
        {buttons.map(button => (
          <button
            key={button.label}
            type='button'
            disabled={busy}
            onClick={button.onClick}
            className={BUTTON}
            {...(button.edit && {
              'data-note-opener': 'problem-edit',
              ...(editFor.note && { 'data-note': editFor.note }),
              ...(editFor.chapter && { 'data-chapter': editFor.chapter }),
            })}
          >
            {button.label}
          </button>
        ))}
      </div>
      {shows && showing && <Waiting mine={mine} />}
    </div>
  )
}

const BUTTON =
  'min-h-11 rounded-xl border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60'

/** The waiting version, drawn as a note is. */
function Waiting({ mine }: Readonly<{ mine: Mine }>) {
  const body = useMemo(
    () => (mine.html ? readDescription(mine.html) : undefined),
    [mine.html],
  )
  return (
    <div className='flex flex-col gap-1 rounded-xl border border-border bg-card px-3 py-2'>
      <p className='font-medium break-words'>{mine.title}</p>
      {body && (
        <div className='overflow-x-auto'>
          <div className='sheet-text note-text'>{drawDescription(body)}</div>
        </div>
      )}
    </div>
  )
}
