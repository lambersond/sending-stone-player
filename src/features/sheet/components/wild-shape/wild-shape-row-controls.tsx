'use client'

import { use } from 'react'
import clsx from 'clsx'
import { LoaderCircle, Undo2, PawPrint } from 'lucide-react'
import { WildShapeContext } from './use-wild-shape-row'
import { canReturn, isIncapacitated } from '@/utils/wild-shape'
import { ROW_WORDS } from '@/utils/wild-shape-words'
import type { WildShapeValue } from './use-wild-shape'

/** A Wild Shape button: solid, or a ghost; a finger's height on a phone, a chip's from `sm`. */
const BUTTON =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60 sm:min-h-9'

export const SOLID = clsx(BUTTON, 'bg-wild text-on-wild hover:bg-wild/90')

const GHOST = clsx(
  BUTTON,
  'border border-wild/50 text-wild hover:bg-wild/10 aria-disabled:hover:bg-transparent',
)

export const PLAIN = clsx(
  BUTTON,
  'border border-border text-text-primary hover:bg-primary/5',
)

/** A spinner, beside a control's words while what it pressed is on its way. */
export function Spinner() {
  return (
    <LoaderCircle
      aria-hidden
      className='size-4 shrink-0 motion-safe:animate-spin'
    />
  )
}

/**
 * Return, on the ribbon or the row: opens its confirm; "Returning…" while it's on its way. While a
 * change or a Beast learned is on its way, it's not offered either, as the game would refuse it.
 */
export function ReturnButton({ label }: Readonly<{ label: string }>) {
  const ws = use(WildShapeContext)
  const returning = ws.waiting === 'revert'
  return (
    <button
      type='button'
      aria-haspopup='dialog'
      aria-disabled={ws.waiting ? true : undefined}
      onClick={event => {
        if (ws.waiting) return
        ws.openReturn(event.currentTarget)
      }}
      className={GHOST}
    >
      {returning ? <Spinner /> : <Undo2 aria-hidden className='size-4' />}
      {returning ? 'Returning…' : label}
    </button>
  )
}

/** What the Wild Shape row says and offers, by the state it's in (round 0.40.0 §5.7). */
export function rowOf(
  ws: WildShapeValue,
): { line: string; change?: 'on' | 'off'; back: boolean } | undefined {
  const { block, form, sheet, name } = ws
  if (!block || !sheet) return undefined
  if (form && !canReturn(sheet)) {
    return { line: ROW_WORDS.other(name, form.name), back: false }
  }
  const lines: string[] = []
  if (form) lines.push(ROW_WORDS.shaped(name, form.name))
  const left = block.uses.value > 0
  let change: 'on' | 'off' | undefined
  if (isIncapacitated(sheet)) {
    lines.push(ROW_WORDS.incapacitated(name))
    change = 'off'
  } else if (left) {
    if (!form) lines.push(ROW_WORDS.ready(block.hours))
    change = 'on'
  } else {
    lines.push(ROW_WORDS.spent(block.resurgence))
    change = 'off'
  }
  return { line: lines.join(' '), change, back: !!form }
}

/** Whether a row, by its id, is the character's Wild Shape row, while it may be used from here. */
export function isRow(ws: WildShapeValue, id: string): boolean {
  return ws.on && ws.pane && ws.block?.item === id
}

/**
 * Wild Shape's controls at the end of its row, wherever it's drawn (round 0.40.0 §5.7), beside its
 * chips, never on what opens the row: Change, Return, and on Features, Known forms…. None on any
 * other row, nor where its player can't use it from here.
 */
export function WildShapeRowControls({
  id,
  knownForms = false,
}: Readonly<{ id: string; knownForms?: boolean }>) {
  const ws = use(WildShapeContext)
  const row = isRow(ws, id) ? rowOf(ws) : undefined
  if (!row) return
  const blocked = row.change === 'off'
  return (
    <>
      {row.back && <ReturnButton label='Return' />}
      {row.change && (
        <button
          type='button'
          aria-haspopup='dialog'
          aria-disabled={blocked || undefined}
          onClick={event => {
            if (blocked) return
            ws.openPicker(event.currentTarget)
          }}
          className={SOLID}
        >
          <PawPrint aria-hidden className='size-4' />
          Change
        </button>
      )}
      {knownForms && (
        <button
          type='button'
          aria-haspopup='dialog'
          onClick={event => ws.openKnown(event.currentTarget)}
          className={PLAIN}
        >
          Known forms…
        </button>
      )}
    </>
  )
}
