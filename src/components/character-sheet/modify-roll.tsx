'use client'

import { useId, useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { formatModifier } from '@/utils/format-modifier'
import { toAdvantage } from '@/utils/roll-mode'
import { parseExtraTerms } from '@/utils/roll-modifiers'
import type { RollTarget } from './roll-button'
import type { SheetRoll } from '@/hooks/use-sheet-roller'
import type { RollMode } from '@/types/sending-stone'

const MODES: { mode: RollMode; label: string }[] = [
  { mode: -1, label: 'Disadvantage' },
  { mode: 0, label: 'Normal' },
  { mode: 1, label: 'Advantage' },
]

type Props = {
  target: RollTarget
  /** The mode a tap would roll with, which the player starts from. */
  mode: RollMode
  onRoll: (roll: SheetRoll) => void
  onCancel: () => void
}

/**
 * Choosing how to roll a check or save: with advantage, disadvantage or neither, whatever the
 * character's conditions say, and with extra dice or modifiers such as +1d4 for Bless.
 */
export function ModifyRoll({
  target,
  mode: initial,
  onRoll,
  onCancel,
}: Readonly<Props>) {
  const [mode, setMode] = useState<RollMode>(initial)
  const [extras, setExtras] = useState('')
  const [error, setError] = useState<string>()
  const ids = useId()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = parseExtraTerms(extras)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    onRoll({
      label: target.label,
      modifier: target.modifier,
      advantage: toAdvantage(mode),
      extras: parsed.terms,
      source: target.source,
      explicit: true,
    })
  }

  return (
    <form onSubmit={submit} noValidate className='grid gap-5'>
      <p className='text-sm text-text-secondary'>
        <span className='font-semibold text-text-primary'>{target.label}</span>,
        d20 {formatModifier(target.modifier)}
        {target.mode !== 0 &&
          `. ${target.mode > 0 ? 'Advantage' : 'Disadvantage'} from the character's conditions or features.`}
      </p>

      <fieldset className='grid gap-2'>
        <legend className='mb-2 text-sm font-medium'>Roll with</legend>
        <div className='grid grid-cols-3 gap-1 rounded-xl border border-border bg-page p-1'>
          {MODES.map(option => (
            <label
              key={option.mode}
              className={clsx(
                'cursor-pointer rounded-lg px-2 py-2 text-center text-sm font-semibold transition-colors has-focus-visible:ring-2 has-focus-visible:ring-primary',
                mode === option.mode &&
                  option.mode < 0 &&
                  'bg-ruby text-on-ruby',
                mode === option.mode &&
                  option.mode === 0 &&
                  'bg-card shadow-sm',
                mode === option.mode &&
                  option.mode > 0 &&
                  'bg-primary text-on-primary',
                mode !== option.mode &&
                  'text-text-secondary hover:text-text-primary',
              )}
            >
              <input
                type='radio'
                name='roll-mode'
                className='sr-only'
                checked={mode === option.mode}
                onChange={() => setMode(option.mode)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className='grid gap-1.5'>
        <label htmlFor={`${ids}-extras`} className='text-sm font-medium'>
          Extra dice or modifiers
        </label>
        <input
          id={`${ids}-extras`}
          value={extras}
          onChange={event => {
            setExtras(event.target.value)
            setError(undefined)
          }}
          placeholder='1d4, -1d6, +5'
          autoComplete='off'
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${ids}-${error ? 'error' : 'hint'}`}
          className={clsx(
            'h-11 rounded-xl border bg-page px-3 font-mono text-sm outline-none focus:ring-2',
            error
              ? 'border-danger focus:ring-danger/40'
              : 'border-border focus:ring-primary/40',
          )}
        />
        {error ? (
          <p id={`${ids}-error`} className='text-sm text-danger'>
            {error}
          </p>
        ) : (
          <p id={`${ids}-hint`} className='text-xs text-text-secondary'>
            Such as 1d4 for Bless, -1d6, +5 or 2d6. Separate them with a comma
            or a sign.
          </p>
        )}
      </div>

      <div className='flex flex-wrap justify-end gap-2'>
        <button
          type='button'
          onClick={onCancel}
          className='h-10 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
        >
          Cancel
        </button>
        <button
          type='submit'
          className='h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover'
        >
          Roll
        </button>
      </div>
    </form>
  )
}
