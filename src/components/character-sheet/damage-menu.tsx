'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { Minus, Plus } from 'lucide-react'
import { RollMenu, type MenuPoint, type RollChoice } from './roll-menu'
import { Modal } from '@/components/modal'
import {
  DIE_SIZES,
  firstDie,
  mostExtra,
  withModifiers,
  type DamageModifiers,
  type DieSize,
} from '@/utils/damage-modifiers'
import type { SheetDamageRoll } from '@/hooks/use-sheet-roller'

/*
 * The ways to roll damage or healing, from a right-click or long-press on it: as a critical hit's,
 * at its highest, or with its dice changed first, as dnd5e's damage dialog lets a player change
 * them: more of its first die, as a spell cast higher throws, or that die another size, as a
 * versatile weapon in two hands, or Toll the Dead at a creature that's hurt.
 */

/** How damage or healing is to be rolled, as chosen from its menu. */
export type DamageChoice = { critical?: boolean; modifiers?: DamageModifiers }

/** What a damage menu opens for: damage or healing, and the ways it may be rolled. */
export type DamageSubject = {
  /** Such as "Warhammer damage". */
  label: string
  /** As the sheet or the game puts it, such as "1d8 + 4". */
  formula: string
  /** Its parts, as they'd be thrown unchanged: a critical hit's dice as the game doubled them. */
  parts: SheetDamageRoll['parts']
  healing: boolean
  /** The ways offered: a critical hit's, at its highest, or changed first. */
  choices: RollChoice[]
  /** How many dice are thrown for each die added, as a critical hit's doubled dice take two. */
  perDie?: number
  /** For a spell or feature used with it, what using it is called, such as "Cast". */
  verb?: string
  onChoose: (choice: DamageChoice) => void
}

/**
 * The menu of ways to roll damage or healing, and the dialog that changes its dice first, which
 * are in `dialogs`, to be put on the page.
 */
export function useDamageMenu(): {
  open: (anchor: HTMLElement, subject: DamageSubject, point?: MenuPoint) => void
  dialogs: ReactNode
} {
  const [menu, setMenu] = useState<{
    anchor: HTMLElement
    subject: DamageSubject
    point?: MenuPoint
  }>()
  const [modifying, setModifying] = useState<DamageSubject>()
  const choose = (subject: DamageSubject, choice: RollChoice) => {
    setMenu(undefined)
    switch (choice) {
      case 'critical': {
        subject.onChoose({ critical: true })
        break
      }
      case 'maximize': {
        subject.onChoose({ modifiers: { maximize: true } })

        break
      }
      case 'modify-damage': {
        setModifying(subject)
        // No default
        break
      }
    }
  }
  const dialogs = (
    <>
      {menu && (
        <RollMenu
          anchor={menu.anchor}
          point={menu.point}
          title={`${menu.subject.label} ${menu.subject.formula}`}
          choices={menu.subject.choices}
          labels={labelsFor(menu.subject)}
          onChoose={choice => choose(menu.subject, choice)}
          onClose={() => setMenu(undefined)}
        />
      )}
      <Modal
        open={modifying !== undefined}
        onClose={() => setModifying(undefined)}
        title={modifying?.healing ? 'Modify healing' : 'Modify damage'}
      >
        {modifying && (
          <ModifyDamage
            subject={modifying}
            onRoll={choice => {
              setModifying(undefined)
              modifying.onChoose(choice)
            }}
            onCancel={() => setModifying(undefined)}
          />
        )}
      </Modal>
    </>
  )
  return {
    open: (anchor, subject, point) => setMenu({ anchor, subject, point }),
    dialogs,
  }
}

/** What the menu calls each way, for damage or healing, rolled or used with a spell or feature. */
function labelsFor({
  healing,
  verb,
}: DamageSubject): Partial<Record<RollChoice, string>> {
  const kind = healing ? 'healing' : 'damage'
  return verb
    ? {
        maximize: `${verb} with maximum ${kind}`,
        'modify-damage': `${verb} with ${kind} modified…`,
      }
    : { maximize: `Roll maximum ${kind}`, 'modify-damage': `Modify ${kind}…` }
}

/**
 * Changing damage or healing before it's rolled: more of its first die, that die another size,
 * every die at its highest, and, for damage rolled here, a critical hit's, each die twice. What it
 * will throw is shown as it's changed.
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
  const die = firstDie(subject.parts)
  const perDie = subject.perDie ?? 1
  const [extra, setExtra] = useState(0)
  const [faces, setFaces] = useState<number | undefined>(die?.sides)
  const [maximize, setMaximize] = useState(false)
  const [critical, setCritical] = useState(false)
  const offersCritical = subject.choices.includes('critical')
  // A critical hit rolled here throws two of each die added.
  const most = mostExtra(subject.parts, critical ? 2 : perDie)
  const modifiers: DamageModifiers = {
    ...(extra > 0 && { extra }),
    ...(die &&
      faces !== undefined &&
      faces !== die.sides && { faces: faces as DieSize }),
    ...(maximize && { maximize }),
  }
  const thrown = formulaOf(withModifiers(subject.parts, modifiers, perDie), {
    doubled: critical,
  })
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
              Its first die, such as a versatile weapon&apos;s in two hands, or
              Toll the Dead&apos;s at a creature that&apos;s hurt.
            </p>
          </fieldset>
        </>
      )}

      <div className='grid gap-3'>
        <Toggle
          checked={maximize}
          onChange={setMaximize}
          label={`Maximum ${kind}`}
          hint='Every die at its highest.'
        />
        {offersCritical && (
          <Toggle
            checked={critical}
            onChange={next => {
              setCritical(next)
              // Two of each die added still fit.
              setExtra(Math.min(extra, mostExtra(subject.parts, next ? 2 : 1)))
            }}
            label='Critical hit'
            hint='Every die twice.'
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

/** Damage's parts as a formula, as thrown: such as "2d12 + 4 Necrotic + 1d6 Fire". */
export function formulaOf(
  parts: SheetDamageRoll['parts'],
  { doubled = false }: { doubled?: boolean } = {},
): string {
  return parts
    .map(({ terms, type }) => {
      const text = terms
        .map((term, index) => {
          const value =
            'sides' in term
              ? `${doubled ? term.count * 2 : term.count}d${term.sides}`
              : String(term.flat)
          if (index === 0) return term.sign < 0 ? `−${value}` : value
          return `${term.sign < 0 ? '−' : '+'} ${value}`
        })
        .join(' ')
      return type ? `${text} ${type}`.trim() : text
    })
    .filter(Boolean)
    .join(' + ')
}
