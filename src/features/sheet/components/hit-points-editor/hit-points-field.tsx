'use client'

import { useId, type KeyboardEvent, type Ref } from 'react'
import { Minus, Plus } from 'lucide-react'
import { STEP_BUTTON } from '@/constants/buttons'

/**
 * One of the hit points editor's two numbers (module 0.44.0): its label over a row of one fewer,
 * the number typed in, and one more; where it has a maximum, "of 30" beside the label, which the
 * field is described by. The field takes digits alone, selects them as it's focused, steps by one
 * with Arrow Up and Arrow Down, and shows what's typed as the number it comes to on leaving it or
 * on Enter. One fewer can't go below 0, nor one more past its most, which a visible hint then
 * says, the button described by it.
 * @param unit - What one step is, as its buttons are named: "hit point".
 * @param of - Its maximum in words, "of 30", where it has one.
 * @param atMost - Why one more isn't offered at its most: "30 is the maximum".
 */
export function HitPointsField({
  label,
  unit,
  text,
  number,
  most,
  of,
  atMost,
  minusRef,
  onStep,
  onType,
  onSettle,
}: Readonly<{
  label: string
  unit: string
  text: string
  number: number
  most: number
  of?: string
  atMost: string
  minusRef?: Ref<HTMLButtonElement>
  onStep: (by: number) => void
  onType: (text: string) => void
  onSettle: () => void
}>) {
  const id = useId()
  const ofId = `${id}-of`
  const hintId = `${id}-most`
  const full = number >= most
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      onStep(event.key === 'ArrowUp' ? 1 : -1)
    } else if (event.key === 'Enter') {
      onSettle()
    }
  }
  return (
    <div className='flex flex-col gap-1'>
      <div className='flex items-baseline justify-between gap-2'>
        <label htmlFor={id} className='text-sm font-semibold'>
          {label}
        </label>
        {of && (
          <span id={ofId} className='text-sm text-text-secondary'>
            {of}
          </span>
        )}
      </div>
      <div className='flex items-center gap-2'>
        <button
          ref={minusRef}
          type='button'
          aria-label={`One ${unit} fewer`}
          aria-disabled={number <= 0}
          onClick={() => onStep(-1)}
          className={STEP_BUTTON}
        >
          <Minus aria-hidden className='size-4' />
        </button>
        <input
          id={id}
          type='text'
          inputMode='numeric'
          autoComplete='off'
          value={text}
          aria-describedby={of ? ofId : undefined}
          onChange={event => onType(event.target.value)}
          onFocus={event => event.target.select()}
          onBlur={onSettle}
          onKeyDown={keyDown}
          className='h-11 min-w-0 flex-1 rounded-xl border border-border bg-page px-2 text-center text-lg font-bold tabular-nums focus-visible:border-primary focus-visible:outline-none'
        />
        <button
          type='button'
          aria-label={`One ${unit} more`}
          aria-disabled={full}
          aria-describedby={full ? hintId : undefined}
          onClick={() => onStep(1)}
          className={STEP_BUTTON}
        >
          <Plus aria-hidden className='size-4' />
        </button>
      </div>
      {full && (
        <p id={hintId} className='text-xs text-text-secondary'>
          {atMost}
        </p>
      )}
    </div>
  )
}
