'use client'

import { useState, type FormEvent } from 'react'
import clsx from 'clsx'
import { Minus, Plus } from 'lucide-react'
import { DIE_SIZES } from '@/constants/dice'
import { criticalHint, formulaOf } from '@/features/rolling/utils/damage-words'
import { useTableRole } from '@/hooks/use-table-api'
import {
  criticalParts,
  EVERY_DIE_TWICE,
  firstDie,
  mostExtra,
  takesAway,
  withModifiers,
} from '@/utils/damage-modifiers'
import { seatWords } from '@/utils/seat-words'
import type { DamageSubject, DamageChoice } from '@/features/rolling/types'
import type { DamageModifiers, DieSize } from '@/types/roll'

/*
 * The ways to roll damage or healing, from a right-click or long-press on it: as a critical hit's,
 * at its highest, or with its dice changed first, as dnd5e's damage dialog lets a player change
 * them: more of its first die, as a spell cast higher throws, or that die another size, as a
 * versatile weapon in two hands, or Toll the Dead at a creature that's hurt.
 */

/**
 * Changing damage or healing before it's rolled: more of its first die, that die another size,
 * every die at its highest, where that's offered, as it isn't for damage that takes a die away,
 * and, for damage rolled here, a critical hit's, each die twice, or as the world's rules make one,
 * for a description's damage the game rolls too, with what a critical hit adds to a description's.
 * What it will throw is shown as it's changed; and which die changes, never one it takes away.
 */
export function ModifyDamage({
  subject,
  onRoll,
  onCancel,
}: Readonly<{
  subject: DamageSubject
  onRoll: (choice: DamageChoice) => void
  onCancel: () => void
}>) {
  const { game } = seatWords(useTableRole())
  const die = firstDie(subject.parts)
  const perDie = subject.perDie ?? 1
  const rule = subject.criticalRule
  const adds = subject.criticalAdds
  const [extra, setExtra] = useState(0)
  const [faces, setFaces] = useState<number | undefined>(die?.sides)
  const [maximize, setMaximize] = useState(false)
  const [critical, setCritical] = useState(false)
  const offersCritical = subject.choices.includes('critical')
  const offersMaximum = subject.choices.includes('maximize')
  // A critical hit throws its dice as many times over as the world's rules make it, or twice where
  // it's rolled here, with the extra dice it adds, and as many more of each die added: they must
  // all still fit.
  const mostWith = (crit: boolean) => {
    if (!crit) return mostExtra(subject.parts, perDie)
    const made = rule ?? EVERY_DIE_TWICE
    return mostExtra(criticalParts(subject.parts, made, adds), made.perDie)
  }
  const most = mostWith(critical)
  const modifiers: DamageModifiers = {
    ...(extra > 0 && { extra }),
    ...(die &&
      faces !== undefined &&
      faces !== die.sides && { faces: faces as DieSize }),
    ...(maximize && { maximize }),
  }
  const changed = withModifiers(subject.parts, modifiers, perDie)
  const thrown = critical
    ? formulaOf(criticalParts(changed, rule ?? EVERY_DIE_TWICE, adds))
    : formulaOf(changed)
  const sizes = die
    ? [...new Set<number>([...DIE_SIZES, die.sides])].toSorted((a, b) => a - b)
    : []
  const kind = subject.healing ? 'healing' : 'damage'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onRoll({ ...(critical && { critical }), modifiers })
  }

  return (
    <form onSubmit={submit} noValidate className='grid gap-5'>
      <p className='text-sm text-text-secondary'>
        <span className='font-semibold text-text-primary'>{subject.label}</span>
        {': '}
        <output
          aria-live='polite'
          className='font-mono font-semibold text-text-primary'
        >
          {thrown}
        </output>
        {maximize && ', every die at its highest'}
        {critical && rule?.altered && `, as ${game} rolls it`}
      </p>

      {die && (
        <>
          <fieldset className='grid gap-2'>
            <legend className='mb-2 text-sm font-medium'>More dice</legend>
            <div className='flex items-center gap-3'>
              <button
                type='button'
                aria-label='One die fewer'
                disabled={extra === 0}
                onClick={() => setExtra(extra - 1)}
                className={STEP}
              >
                <Minus aria-hidden className='size-4' />
              </button>
              <span className='min-w-14 text-center font-mono font-semibold tabular-nums'>
                +{extra}d{faces ?? die.sides}
              </span>
              <button
                type='button'
                aria-label='One die more'
                disabled={extra >= most}
                onClick={() => setExtra(extra + 1)}
                className={STEP}
              >
                <Plus aria-hidden className='size-4' />
              </button>
            </div>
            <p className='text-xs text-text-secondary'>
              Such as for a spell cast at a higher level.
            </p>
          </fieldset>

          <fieldset className='grid gap-2'>
            <legend className='mb-2 text-sm font-medium'>Die</legend>
            <div
              className='grid gap-1 rounded-xl border border-border bg-page p-1'
              style={{
                gridTemplateColumns: `repeat(${sizes.length}, minmax(0, 1fr))`,
              }}
            >
              {sizes.map(size => (
                <label
                  key={size}
                  className={clsx(
                    'cursor-pointer rounded-lg px-1 py-2 text-center text-sm font-semibold transition-colors has-focus-visible:ring-2 has-focus-visible:ring-primary',
                    faces === size
                      ? 'bg-primary text-on-primary'
                      : 'text-text-secondary hover:text-text-primary',
                  )}
                >
                  <input
                    type='radio'
                    name='damage-die'
                    className='sr-only'
                    checked={faces === size}
                    onChange={() => setFaces(size)}
                  />
                  d{size}
                </label>
              ))}
            </div>
            <p className='text-xs text-text-secondary'>
              {takesAway(subject.parts)
                ? 'The first die it adds, never one it takes away, such as'
                : 'Its first die, such as'}{' '}
              a versatile weapon&apos;s in two hands, or Toll the Dead&apos;s at
              a creature that&apos;s hurt.
            </p>
          </fieldset>
        </>
      )}

      <div className='grid gap-3'>
        {offersMaximum && (
          <Toggle
            checked={maximize}
            onChange={setMaximize}
            label={`Maximum ${kind}`}
            hint='Every die at its highest.'
          />
        )}
        {offersCritical && (
          <Toggle
            checked={critical}
            onChange={next => {
              setCritical(next)
              // As many of each die added as a critical hit's take still fit.
              setExtra(Math.min(extra, mostWith(next)))
            }}
            label='Critical hit'
            hint={criticalHint(game, rule)}
          />
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
          {subject.verb ?? 'Roll'}
        </button>
      </div>
    </form>
  )
}

const STEP =
  'flex size-10 items-center justify-center rounded-xl border border-border transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-transparent'

/** A switch, with what it does under its label. */
function Toggle({
  checked,
  onChange,
  label,
  hint,
}: Readonly<{
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint: string
}>) {
  return (
    <label className='flex cursor-pointer items-start gap-3'>
      <input
        type='checkbox'
        role='switch'
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className='peer sr-only'
      />
      <span
        aria-hidden
        className={clsx(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary',
          checked ? 'bg-primary' : 'bg-border',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 size-4 rounded-full bg-card shadow-sm transition-[left]',
            checked ? 'left-4.5' : 'left-0.5',
          )}
        />
      </span>
      <span className='grid'>
        <span className='text-sm font-medium'>{label}</span>
        <span className='text-xs text-text-secondary'>{hint}</span>
      </span>
    </label>
  )
}
