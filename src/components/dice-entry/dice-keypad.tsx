'use client'

import clsx from 'clsx'
import { Delete } from 'lucide-react'
import type { MouseEvent, PointerEvent, ReactNode } from 'react'

/** A key of the dice keypad: a digit, a percentile die's 00, Delete or Next die. */
export type DiceKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '00'
  | 'delete'
  | 'next'

// Three columns as a phone's own number pad has them, Next die across the foot; or, on a short
// screen, five, so the keypad takes three rows and fits beside the dice.
const KEYS: DiceKey[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'delete',
  '0',
  '00',
  'next',
]
const COMPACT_KEYS: DiceKey[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
  '00',
  'delete',
  'next',
]

// A tap or a click on a key leaves focus in the box typed into, so the phone's keyboard never
// opens and the box stays the one typed into. Both, as not every browser takes the pointer's alone
// for a mouse's or a finger's.
const keepFocus = (event: MouseEvent | PointerEvent) => event.preventDefault()

/**
 * The dice entry dialog's own number keys, for typing in what a die shows without the phone's
 * keyboard: the digits, 00 for a percentile die, Delete and Next die.
 */
export function DiceKeypad({
  onKey,
  d100,
  compact = false,
}: Readonly<{
  onKey: (key: DiceKey) => void
  /** Whether the box being typed in is a d100's, which takes 00. */
  d100: boolean
  /** Five columns, for a short screen. */
  compact?: boolean
}>): ReactNode {
  return (
    <div
      role='group'
      aria-label='Keypad'
      className={clsx('grid gap-1.5', compact ? 'grid-cols-5' : 'grid-cols-3')}
    >
      {(compact ? COMPACT_KEYS : KEYS).map(key => {
        const off = key === '00' && !d100
        return (
          <button
            key={key}
            type='button'
            aria-label={key === 'delete' ? 'Delete' : undefined}
            aria-disabled={off || undefined}
            onMouseDown={keepFocus}
            onPointerDown={keepFocus}
            onClick={() => {
              if (!off) onKey(key)
            }}
            className={clsx(
              'flex touch-manipulation items-center justify-center rounded-xl border border-border bg-page font-semibold tabular-nums transition-colors select-none hover:border-primary/50 hover:bg-primary/5 active:bg-primary/10 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-border aria-disabled:hover:bg-page',
              compact ? 'h-9' : 'h-11 [@media(max-height:40rem)]:h-10',
              key === 'next' ? 'col-span-3 text-sm' : 'text-lg',
            )}
          >
            {key === 'delete' && <Delete aria-hidden className='size-5' />}
            {key === 'next' && 'Next die'}
            {key !== 'delete' && key !== 'next' && key}
          </button>
        )
      })}
    </div>
  )
}
