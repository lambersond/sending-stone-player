'use client'

import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Footprints, Shield, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { formatModifier } from '@/utils/format-modifier'
import type { SheetRoll } from '@/hooks/use-sheet-roller'
import type { RollMode, SheetAbility, SheetSkill } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { Advantage } from '@lambersond/3d-dice-core'

type Props = {
  name: string
  sheet: TableSheet
  onRoll: (roll: SheetRoll) => void
}

/**
 * A player's character sheet: who they are, their vital numbers, and their abilities and skills,
 * each of which rolls when tapped. Laid out after Tidy 5e's character sheet.
 */
export function CharacterSheet({ name, sheet, onRoll }: Readonly<Props>) {
  // The player's choice for the next roll, which then goes back to normal. It combines with any
  // advantage or disadvantage the character's conditions and features give, as dnd5e does.
  const [next, setNext] = useState<RollMode>(0)
  const roll = (label: string, modifier: number, mode: RollMode) => {
    onRoll({ label, modifier, advantage: toAdvantage(next + mode) })
    setNext(0)
  }
  const abbreviation = (id: string) =>
    sheet.abilities.find(ability => ability.id === id)?.abbreviation ??
    id.toUpperCase()

  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      <SheetHeader name={name} sheet={sheet} />

      <section
        aria-labelledby='abilities-heading'
        className='flex flex-col gap-3'
      >
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <Heading id='abilities-heading'>Abilities</Heading>
          <NextRoll value={next} onChange={setNext} />
        </div>
        <ul className='grid grid-cols-3 gap-2 @xl:grid-cols-6'>
          {sheet.abilities.map(ability => (
            <AbilityTile
              key={ability.id}
              ability={ability}
              onCheck={() =>
                roll(`${ability.label} check`, ability.check, ability.checkMode)
              }
              onSave={() =>
                roll(
                  `${ability.label} saving throw`,
                  ability.save,
                  ability.saveMode,
                )
              }
            />
          ))}
        </ul>
      </section>

      {sheet.skills.length > 0 && (
        <section
          aria-labelledby='skills-heading'
          className='flex flex-col gap-2'
        >
          <div className='flex items-baseline justify-between gap-2 px-1'>
            <Heading id='skills-heading'>Skills</Heading>
            <span aria-hidden className='text-xs text-text-secondary'>
              Modifier · Passive
            </span>
          </div>
          <ul className='grid gap-x-4 rounded-2xl border border-border bg-card p-1.5 @2xl:grid-cols-2'>
            {sheet.skills.map(skill => (
              <SkillRow
                key={skill.id}
                skill={skill}
                ability={abbreviation(skill.ability)}
                onRoll={() =>
                  roll(`${skill.label} check`, skill.total, skill.mode)
                }
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/* -------------------------------------------- */

function SheetHeader({
  name,
  sheet,
}: Readonly<{ name: string; sheet: TableSheet }>) {
  const identity = [sheet.species, sheet.background].filter(Boolean)
  return (
    <header className='flex flex-col gap-4 rounded-2xl border border-border bg-card p-4'>
      <div className='flex items-center gap-4'>
        <Portrait name={name} src={sheet.portrait} />
        <div className='min-w-0'>
          <p className='font-semibold'>{classLine(sheet)}</p>
          {identity.length > 0 && (
            <p className='text-sm text-text-secondary'>
              {identity.join(' · ')}
            </p>
          )}
          {sheet.inspiration && (
            <p className='mt-1 inline-flex items-center gap-1 text-xs font-semibold text-gold-text'>
              <Sparkles aria-hidden className='size-3.5' />
              Inspired
            </p>
          )}
        </div>
      </div>
      <dl className='grid grid-cols-2 gap-2 @md:grid-cols-5'>
        {sheet.hp && (
          <Stat label='Hit points' wide>
            <HitPoints hp={sheet.hp} />
          </Stat>
        )}
        {sheet.ac !== null && (
          <Stat label='Armor class'>
            <span className='inline-flex items-center gap-1'>
              <Shield aria-hidden className='size-4 text-text-secondary' />
              {sheet.ac}
            </span>
          </Stat>
        )}
        {sheet.proficiency !== null && (
          <Stat label='Proficiency'>{formatModifier(sheet.proficiency)}</Stat>
        )}
        {sheet.initiative !== null && (
          <Stat label='Initiative'>
            <span className='inline-flex items-center gap-1'>
              <Zap aria-hidden className='size-4 text-text-secondary' />
              {formatModifier(sheet.initiative)}
            </span>
          </Stat>
        )}
        {sheet.speed && (
          <Stat label='Speed'>
            <span className='inline-flex items-center gap-1'>
              <Footprints aria-hidden className='size-4 text-text-secondary' />
              {sheet.speed.value}
              {sheet.speed.units && (
                <span className='text-sm font-normal text-text-secondary'>
                  {sheet.speed.units}
                </span>
              )}
            </span>
          </Stat>
        )}
      </dl>
    </header>
  )
}

function Portrait({ name, src }: Readonly<{ name: string; src?: string }>) {
  const [failed, setFailed] = useState(false)
  const box =
    'size-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-primary/10'
  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={clsx(
          box,
          'flex items-center justify-center text-lg font-bold text-primary',
        )}
      >
        {initials(name)}
      </span>
    )
  }
  return (
    // A portrait from the Gamemaster's game, which Next's image optimizer doesn't know.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=''
      className={clsx(box, 'object-cover object-top')}
      onError={() => setFailed(true)}
    />
  )
}

function Stat({
  label,
  wide = false,
  children,
}: Readonly<{ label: string; wide?: boolean; children: ReactNode }>) {
  return (
    <div
      className={clsx(
        'flex flex-col gap-0.5 rounded-xl bg-page px-3 py-2',
        wide && 'col-span-2 @md:col-span-1',
      )}
    >
      <dt className='text-[11px] font-semibold tracking-wider text-text-secondary uppercase'>
        {label}
      </dt>
      <dd className='text-lg font-bold tabular-nums'>{children}</dd>
    </div>
  )
}

function HitPoints({ hp }: Readonly<{ hp: NonNullable<TableSheet['hp']> }>) {
  const ratio = hp.max ? Math.max(0, Math.min(1, hp.value / hp.max)) : 1
  let bar = 'bg-primary'
  if (ratio <= 0.25) bar = 'bg-danger'
  else if (ratio <= 0.5) bar = 'bg-warning'
  return (
    <span className='flex flex-col gap-1'>
      <span>
        {hp.value}
        {hp.max !== null && (
          <span className='font-normal text-text-secondary'> / {hp.max}</span>
        )}
        {hp.temp > 0 && (
          <span className='text-sm text-party'> +{hp.temp} temp</span>
        )}
      </span>
      {hp.max !== null && (
        <span
          aria-hidden
          className='block h-1.5 w-full overflow-hidden rounded-full bg-border'
        >
          <span
            className={clsx('block h-full rounded-full', bar)}
            style={{ width: `${ratio * 100}%` }}
          />
        </span>
      )}
    </span>
  )
}

/* -------------------------------------------- */

function AbilityTile({
  ability,
  onCheck,
  onSave,
}: Readonly<{
  ability: SheetAbility
  onCheck: () => void
  onSave: () => void
}>) {
  const { label, abbreviation, score, check, save, saveProficient } = ability
  const SaveIcon = saveProficient ? ShieldCheck : Shield
  return (
    <li className='flex flex-col overflow-hidden rounded-2xl border border-border bg-card'>
      <button
        type='button'
        onClick={onCheck}
        aria-label={`${label} check, ${formatModifier(check)}${modeText(ability.checkMode)}`}
        className='flex flex-col items-center gap-1 px-2 pt-2.5 pb-2 transition-colors hover:bg-primary/5 focus-visible:bg-primary/5'
      >
        <span className='text-xs font-semibold tracking-wider text-text-secondary uppercase'>
          {abbreviation}
        </span>
        <span className='text-2xl leading-none font-bold tabular-nums'>
          {formatModifier(check)}
        </span>
        <span className='flex items-center gap-1'>
          {score !== null && (
            <span className='rounded-full border border-border px-2 text-xs tabular-nums'>
              {score}
            </span>
          )}
          <ModeChip mode={ability.checkMode} />
        </span>
      </button>
      <button
        type='button'
        onClick={onSave}
        aria-label={`${label} saving throw, ${formatModifier(save)}${saveProficient ? ', proficient' : ''}${modeText(ability.saveMode)}`}
        className='flex items-center justify-center gap-1 border-t border-border py-1.5 text-xs transition-colors hover:bg-primary/5 focus-visible:bg-primary/5'
      >
        <SaveIcon
          aria-hidden
          className={clsx(
            'size-3.5',
            saveProficient ? 'text-primary' : 'text-text-secondary',
          )}
        />
        <span className='text-text-secondary'>Save</span>
        <span className='font-semibold tabular-nums'>
          {formatModifier(save)}
        </span>
        <ModeChip mode={ability.saveMode} />
      </button>
    </li>
  )
}

const PROFICIENCY: Record<string, string> = {
  '0.5': 'half proficiency',
  '1': 'proficient',
  '2': 'expertise',
}

function SkillRow({
  skill,
  ability,
  onRoll,
}: Readonly<{ skill: SheetSkill; ability: string; onRoll: () => void }>) {
  const proficiency = PROFICIENCY[String(skill.proficiency)]
  const details = [
    proficiency,
    skill.passive === null ? undefined : `passive ${skill.passive}`,
  ].filter(Boolean)
  return (
    <li>
      <button
        type='button'
        onClick={onRoll}
        aria-label={`${skill.label} check, ${formatModifier(skill.total)}${details.length > 0 ? ` (${details.join(', ')})` : ''}${modeText(skill.mode)}`}
        className='flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-primary/5 focus-visible:bg-primary/5'
      >
        <ProficiencyMark value={skill.proficiency} />
        <span className='w-8 shrink-0 text-[11px] font-semibold tracking-wider text-text-secondary uppercase'>
          {ability}
        </span>
        <span className='min-w-0 flex-1 truncate font-medium'>
          {skill.label}
        </span>
        <ModeChip mode={skill.mode} />
        <span className='w-8 text-right font-semibold tabular-nums'>
          {formatModifier(skill.total)}
        </span>
        <span className='w-7 text-right text-xs text-text-secondary tabular-nums'>
          {skill.passive}
        </span>
      </button>
    </li>
  )
}

/** Proficiency as dnd5e's sheets mark it: none, half, proficient, or expertise. */
function ProficiencyMark({ value }: Readonly<{ value: number }>) {
  return (
    <span
      aria-hidden
      className={clsx(
        'size-3 shrink-0 rounded-full border-2',
        value === 0 && 'border-border',
        value === 0.5 &&
          'border-primary bg-[linear-gradient(90deg,var(--color-primary)_50%,transparent_50%)]',
        value === 1 && 'border-primary bg-primary',
        value >= 2 && 'border-primary bg-primary ring-2 ring-primary/30',
      )}
    />
  )
}

/** Advantage or disadvantage from the character's conditions and features. */
function ModeChip({ mode }: Readonly<{ mode: RollMode }>) {
  if (mode === 0) return
  return (
    <span
      aria-hidden
      className={clsx(
        'rounded px-1 text-[10px] font-bold tracking-wide uppercase',
        mode > 0 ? 'bg-primary/15 text-primary' : 'bg-ruby/15 text-ruby',
      )}
    >
      {mode > 0 ? 'Adv' : 'Dis'}
    </span>
  )
}

/* -------------------------------------------- */

const NEXT_ROLL: { mode: RollMode; label: string }[] = [
  { mode: -1, label: 'Disadvantage' },
  { mode: 0, label: 'Normal' },
  { mode: 1, label: 'Advantage' },
]

/** Whether the next roll has advantage or disadvantage, chosen by the player. */
function NextRoll({
  value,
  onChange,
}: Readonly<{ value: RollMode; onChange: (mode: RollMode) => void }>) {
  return (
    <fieldset className='flex items-center gap-2'>
      <legend className='sr-only'>Next roll</legend>
      <span aria-hidden className='text-xs text-text-secondary'>
        Next roll
      </span>
      <span className='flex rounded-lg border border-border bg-card p-0.5'>
        {NEXT_ROLL.map(({ mode, label }) => (
          <label
            key={mode}
            className={clsx(
              'cursor-pointer rounded-md px-2 py-1 text-xs font-semibold transition-colors has-focus-visible:ring-2 has-focus-visible:ring-primary',
              value === mode && mode < 0 && 'bg-ruby text-on-ruby',
              value === mode && mode === 0 && 'bg-page text-text-primary',
              value === mode && mode > 0 && 'bg-primary text-on-primary',
              value !== mode && 'text-text-secondary hover:text-text-primary',
            )}
          >
            <input
              type='radio'
              name='next-roll'
              className='sr-only'
              checked={value === mode}
              onChange={() => onChange(mode)}
            />
            {label}
          </label>
        ))}
      </span>
    </fieldset>
  )
}

function Heading({ id, children }: Readonly<{ id: string; children: string }>) {
  return (
    <h2
      id={id}
      className='text-xs font-semibold tracking-wider text-text-secondary uppercase'
    >
      {children}
    </h2>
  )
}

/* -------------------------------------------- */

/** Any advantage and any disadvantage cancel out. */
function toAdvantage(mode: number): Advantage | undefined {
  if (mode > 0) return 'adv'
  if (mode < 0) return 'dis'
  return undefined
}

function modeText(mode: RollMode): string {
  if (mode > 0) return ', with advantage'
  if (mode < 0) return ', with disadvantage'
  return ''
}

/** Such as "Fighter 4 / Rogue 1 · Champion", or the level alone. */
export function classLine(sheet: TableSheet): string {
  if (sheet.classes.length === 0) {
    return sheet.level === null ? 'Character' : `Level ${sheet.level}`
  }
  const classes = sheet.classes
    .map(({ name, levels }) => (levels === null ? name : `${name} ${levels}`))
    .join(' / ')
  const subclasses = sheet.classes.flatMap(({ subclass }) =>
    subclass ? [subclass] : [],
  )
  return subclasses.length > 0
    ? `${classes} · ${subclasses.join(' / ')}`
    : classes
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('')
}
