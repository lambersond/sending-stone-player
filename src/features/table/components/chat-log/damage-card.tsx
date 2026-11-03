import { Fragment, useState } from 'react'
import clsx from 'clsx'
import { ActionChip } from './action-chip'
import { Badge } from './badge'
import { ACTIONS, CAPTION } from './constants'
import { DiceList } from './dice-list'
import { Targets } from './targets'
import { bubble } from './utils'
import { Chevron } from '@/components/chevron/chevron'
import type {
  DamagePool,
  TableDamage,
  TableDamageKind,
  TableTarget,
} from '@/types/table'

/** What a creature that saves takes, as dnd5e's damage card says beneath its total. */
const ON_SAVE: Record<NonNullable<TableDamage['onSave']>, string> = {
  half: 'Half damage on a save',
  none: 'No damage on a save',
  full: 'Full damage on a save',
}

/** A chip of a kind of healing: each of its pools is the accent's. */
const HEALS = {
  chip: 'border-transparent bg-primary/10',
  word: 'text-primary-text',
}

/**
 * How each kind of damage's chip is coloured: its tint and edge, and its word's colour. Each has an
 * edge, if only a clear one, so that every chip is as tall as damage's.
 */
const KIND_TONES: Record<DamagePool, { chip: string; word: string }> = {
  harm: { chip: 'border-damage/30 bg-damage/10', word: 'text-damage-text' },
  healing: HEALS,
  temphp: HEALS,
  maximum: HEALS,
  none: {
    chip: 'border-transparent bg-text-secondary/10',
    word: 'text-text-secondary',
  },
}

/**
 * A message's damage rolls in one card, as dnd5e's damage card adds them up: its formula, a chip
 * for each kind of damage with what it came to, and their total where they fill one pool. Its
 * rolls' dice open beneath it, or show inline where it has only the one roll.
 */
export function DamageCard({
  damage,
  label,
  targets,
  summary,
  whisper,
  mine,
}: Readonly<{
  damage: TableDamage
  label?: string
  targets: TableTarget[]
  summary?: string
  whisper: boolean
  mine: boolean
}>) {
  const [open, setOpen] = useState(false)
  const { action, critical, rolls } = damage
  const formula = damage.formula && (
    <span className='font-mono text-xs break-words text-text-secondary'>
      {damage.formula}
    </span>
  )
  return (
    <div
      className={clsx(
        bubble(whisper, mine, critical),
        'flex w-full max-w-sm flex-col gap-2 p-3',
        'border-l-4',
        ACTIONS[action].accent,
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <span className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
          <ActionChip action={action} />
          {damage.section === 'other' && (
            <span className={CAPTION}>Other damage</span>
          )}
          {label && <span className='text-sm font-semibold'>{label}</span>}
        </span>
        {critical && (
          <div className='flex shrink-0 flex-wrap justify-end gap-1'>
            <Badge className='bg-gold text-on-gold'>Critical</Badge>
          </div>
        )}
      </div>
      <Targets targets={targets} summary={summary} />
      {rolls.length > 1 ? (
        <details onToggle={event => setOpen(event.currentTarget.open)}>
          {/* A hover rings it rather than tinting it: a tint under its chips and total would take
              them below WCAG AA on the player's own bubble, in the light theme. */}
          <summary className='-mx-1 flex min-h-11 cursor-pointer list-none items-end gap-2 rounded-lg px-1 hover:ring-1 hover:ring-primary/30 [&::-webkit-details-marker]:hidden'>
            <span className='flex min-w-0 flex-1 flex-col gap-1.5'>
              {formula}
              {/* So its name reads "1d4 + 4 + 2d6, 5 Piercing + 7 Poison = 12". */}
              {formula && <span className='sr-only'>, </span>}
              <KindChips kinds={damage.kinds} />
            </span>
            <DamageTotal damage={damage} />
            <span className='mb-1 flex shrink-0'>
              <Chevron open={open} />
            </span>
          </summary>
          {open && (
            <ul
              aria-label='Rolls'
              className='mt-2 flex flex-col gap-1.5 border-t border-border pt-2'
            >
              {rolls.map((roll, index) => (
                <li
                  key={index}
                  className='flex items-end justify-between gap-3'
                >
                  <span className='flex min-w-0 flex-wrap items-center gap-1'>
                    {roll.tag && (
                      <>
                        <span className='text-[11px] font-semibold text-text-secondary'>
                          {roll.tag}
                        </span>{' '}
                      </>
                    )}
                    <span className='pr-1 font-mono text-xs break-words text-text-secondary'>
                      {roll.formula}
                    </span>{' '}
                    <DiceList dice={roll.dice} />
                  </span>
                  <span className='shrink-0 text-sm'>
                    <span className='font-semibold tabular-nums'>
                      {roll.total ?? '–'}
                    </span>
                    {roll.label && (
                      <>
                        {' '}
                        <span className='text-text-secondary'>
                          {roll.label}
                        </span>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>
      ) : (
        <div className='flex items-end gap-2'>
          <span className='flex min-w-0 flex-1 flex-col gap-1.5'>
            {formula}
            <DiceList dice={rolls[0]?.dice ?? []} />
            <KindChips kinds={damage.kinds} />
          </span>
          <DamageTotal damage={damage} />
        </div>
      )}
      {damage.onSave && (
        <p className='text-xs text-text-secondary'>{ON_SAVE[damage.onSave]}</p>
      )}
    </div>
  )
}

/** A chip for each kind of damage, "5 Piercing", read as "5 Piercing + 7 Poison". */
function KindChips({ kinds }: Readonly<{ kinds: TableDamageKind[] }>) {
  return (
    <span className='flex flex-wrap gap-1'>
      {kinds.map((kind, index) => (
        <Fragment key={index}>
          {index > 0 && <span className='sr-only'> + </span>}
          <span
            className={clsx(
              'inline-flex items-baseline gap-1 rounded-full border px-2 py-0.5 text-xs',
              KIND_TONES[kind.pool].chip,
            )}
          >
            {/* Midi-QOL's damage of none is said in words, as it isn't counted. */}
            {kind.pool !== 'none' && (
              <span className='font-bold text-text-primary tabular-nums'>
                {kind.total ?? '–'}
              </span>
            )}
            {/* A space of its own, as the chip's gap isn't one to a screen reader. */}
            {kind.pool !== 'none' && kind.label && ' '}
            {kind.label && (
              <span className={KIND_TONES[kind.pool].word}>{kind.label}</span>
            )}
          </span>
        </Fragment>
      ))}
    </span>
  )
}

/** A damage card's total, where it has one: "–" while any of it is unknown. */
function DamageTotal({ damage }: Readonly<{ damage: TableDamage }>) {
  if (damage.total === undefined) return
  return (
    <span
      className={clsx(
        'text-3xl leading-none font-semibold tabular-nums',
        damage.critical && 'text-gold-text',
      )}
    >
      <span className='sr-only'>{' = '}</span>
      {damage.total ?? '–'}
    </span>
  )
}
