'use client'

import { useId } from 'react'
import clsx from 'clsx'
import { Minus, Plus } from 'lucide-react'

/*
 * How many of a stack to move (module 0.31.0): typed, as a stack may be far more than a stepper
 * reaches, or stepped by one, or all of it at a tap. Only plain digits count, so that "1,000" or
 * "+3" is never read as some other number than the one meant.
 */

/** A count as typed: digits, and nothing else. */
const DIGITS = /^[0-9]+$/

/** As UsesMenu's steppers. */
const STEP =
  'flex size-10 shrink-0 items-center justify-center rounded-xl border border-border transition-colors hover:border-primary/50 hover:bg-primary/5 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-border aria-disabled:hover:bg-transparent'

/** The number typed, if it's one, of digits alone; whatever its size. */
export function typedCount(text: string): number | undefined {
  return DIGITS.test(text) ? Number(text) : undefined
}

/** How many are to move, as typed, if it's a whole number from 1 to as many as there are. */
export function amountOf(text: string, max: number): number | undefined {
  const count = typedCount(text)
  return count !== undefined && count >= 1 && count <= max ? count : undefined
}

/**
 * How many of a stack to move: one fewer, the number, of how many, one more, and all of them.
 * What's typed outside 1 and as many as there are is said to be, under it.
 * @param max - As many as may be moved.
 * @param value - What's typed.
 */
export function AmountField({
  max,
  value,
  onChange,
}: Readonly<{
  max: number
  value: string
  onChange: (value: string) => void
}>) {
  const ids = useId()
  const typed = typedCount(value)
  const valid = amountOf(value, max) !== undefined
  const fewest = typed !== undefined && typed <= 1
  const most = typed !== undefined && typed >= max
  // From what's typed, kept within 1 and as many as there are; from nothing typed, or no number,
  // from 1. The buttons stay where they can't go further, so that focus isn't lost from one.
  const step = (by: number) => {
    if ((by < 0 && fewest) || (by > 0 && most)) return
    const next = Math.min(max, Math.max(1, (typed ?? 0) + by))
    onChange(String(next))
  }
  return (
    <fieldset className='grid gap-2'>
      <legend className='mb-1.5 text-sm font-medium'>How many</legend>
      <div className='flex flex-wrap items-center gap-2'>
        <button
          type='button'
          aria-label='One fewer'
          aria-disabled={fewest}
          onClick={() => step(-1)}
          className={STEP}
        >
          <Minus aria-hidden className='size-4' />
        </button>
        <input
          type='text'
          inputMode='numeric'
          pattern='[0-9]*'
          aria-label='How many'
          value={value}
          onChange={event => onChange(event.target.value)}
          autoComplete='off'
          aria-invalid={valid ? undefined : true}
          aria-describedby={valid ? undefined : `${ids}-error`}
          className={clsx(
            // 16px text, as iOS zooms into a smaller one it focuses.
            'h-10 w-24 rounded-xl border bg-page px-3 text-center text-base tabular-nums outline-none focus:ring-2',
            valid
              ? 'border-border focus:ring-primary/40'
              : 'border-danger focus:ring-danger/40',
          )}
        />
        <span className='text-sm text-text-secondary'>
          of {max.toLocaleString('en')}
        </span>
        <button
          type='button'
          aria-label='One more'
          aria-disabled={most}
          onClick={() => step(1)}
          className={STEP}
        >
          <Plus aria-hidden className='size-4' />
        </button>
        <button
          type='button'
          aria-label={`All ${max}`}
          onClick={() => onChange(String(max))}
          className='h-10 rounded-xl border border-border px-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
        >
          All
        </button>
      </div>
      {!valid && (
        <p id={`${ids}-error`} role='alert' className='text-sm text-danger'>
          Enter a whole number from 1 to {max.toLocaleString('en')}.
        </p>
      )}
    </fieldset>
  )
}
