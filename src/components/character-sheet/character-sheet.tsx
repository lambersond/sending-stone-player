'use client'

import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Footprints, Shield, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { ModifyRoll } from './modify-roll'
import { RollButton, type RollTarget } from './roll-button'
import { RollMenu, type RollChoice } from './roll-menu'
import { Modal } from '@/components/modal'
import { formatModifier } from '@/utils/format-modifier'
import { toAdvantage } from '@/utils/roll-mode'
import type { SheetRoll } from '@/hooks/use-sheet-roller'
import type { RollMode, SheetAbility, SheetSkill } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

type Props = {
  name: string
  sheet: TableSheet
  onRoll: (roll: SheetRoll) => void
}

/**
 * A player's character sheet: who they are, their vital numbers, and their abilities and skills.
 * Each rolls when tapped, and a right-click or long-press offers advantage, disadvantage, or a
 * roll with extra dice or modifiers. Laid out after Tidy 5e's character sheet.
 */
export function CharacterSheet({ name, sheet, onRoll }: Readonly<Props>) {
  const [menu, setMenu] = useState<{
    anchor: HTMLElement
    target: RollTarget
  }>()
  const [modifying, setModifying] = useState<RollTarget>()

  // A tap rolls with whatever advantage or disadvantage the character's conditions and features
  // give.
  const tap = (target: RollTarget) =>
    onRoll({
      label: target.label,
      modifier: target.modifier,
      advantage: toAdvantage(target.mode),
    })
  const openMenu = (anchor: HTMLElement, target: RollTarget) =>
    setMenu({ anchor, target })
  // A choice from the menu is the player's say on this roll, as in dnd5e's roll dialog.
  const choose = (target: RollTarget, choice: RollChoice) => {
    setMenu(undefined)
    if (choice === 'modify') setModifying(target)
    else
      onRoll({
        label: target.label,
        modifier: target.modifier,
        advantage: choice,
      })
  }
  const actions = { onRoll: tap, onMenu: openMenu }
  const abbreviation = (id: string) =>
    sheet.abilities.find(ability => ability.id === id)?.abbreviation ??
    id.toUpperCase()

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      <SheetHeader name={name} sheet={sheet} />

      <section
        aria-labelledby='abilities-heading'
        className='flex flex-col gap-3'
      >
        <Heading id='abilities-heading'>Abilities</Heading>
        <ul className='grid grid-cols-3 gap-2 @xl:grid-cols-6'>
          {sheet.abilities.map(ability => (
            <AbilityTile key={ability.id} ability={ability} {...actions} />
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
                {...actions}
              />
            ))}
          </ul>
        </section>
      )}

      {menu && (
        <RollMenu
          anchor={menu.anchor}
          title={`${menu.target.label} ${formatModifier(menu.target.modifier)}`}
          onChoose={choice => choose(menu.target, choice)}
          onClose={() => setMenu(undefined)}
        />
      )}
      <Modal
        open={modifying !== undefined}
        onClose={() => setModifying(undefined)}
        title='Modify roll'
      >
        {modifying && (
          <ModifyRoll
            target={modifying}
            mode={modifying.mode}
            onRoll={request => {
              setModifying(undefined)
              onRoll(request)
            }}
            onCancel={() => setModifying(undefined)}
          />
        )}
      </Modal>
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
      <dl className='grid grid-cols-2 gap-2 @lg:grid-cols-6'>
        {sheet.hp && (
          <Stat label='Hit points' wide>
            <HitPoints hp={sheet.hp} />
          </Stat>
        )}
        {sheet.ac !== null && (
          <Stat label='Armor class' short='AC'>
            <span className='inline-flex items-center gap-1'>
              <Shield aria-hidden className='size-4 text-text-secondary' />
              {sheet.ac}
            </span>
          </Stat>
        )}
        {sheet.proficiency !== null && (
          <Stat label='Proficiency' short='Prof'>
            {formatModifier(sheet.proficiency)}
          </Stat>
        )}
        {sheet.initiative !== null && (
          <Stat label='Initiative' short='Init'>
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

/**
 * One of the sheet's vital numbers. Each box is a container, so a label with a short form, such as
 * Prof for Proficiency, can use it when its box is too narrow for the whole word: the longest,
 * Armor class, needs 114 pixels.
 */
function Stat({
  label,
  short,
  wide = false,
  children,
}: Readonly<{
  label: string
  short?: string
  wide?: boolean
  children: ReactNode
}>) {
  return (
    <div
      className={clsx(
        '@container flex min-w-0 flex-col gap-0.5 rounded-xl bg-page py-2',
        wide && 'col-span-2',
      )}
    >
      <dt className='truncate px-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase'>
        {short ? (
          <>
            <span className='@max-[116px]:hidden'>{label}</span>
            <abbr
              title={label}
              className='hidden no-underline @max-[116px]:inline'
            >
              {short}
            </abbr>
          </>
        ) : (
          label
        )}
      </dt>
      <dd className='px-3 text-lg font-bold tabular-nums'>{children}</dd>
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
      <span className='flex flex-wrap items-baseline gap-x-1'>
        <span>{hp.value}</span>
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

type RollActions = {
  onRoll: (target: RollTarget) => void
  onMenu: (anchor: HTMLElement, target: RollTarget) => void
}

function AbilityTile({
  ability,
  onRoll,
  onMenu,
}: Readonly<{ ability: SheetAbility } & RollActions>) {
  const { label, abbreviation, score, check, save, saveProficient } = ability
  const SaveIcon = saveProficient ? ShieldCheck : Shield
  return (
    <li className='flex flex-col overflow-hidden rounded-2xl border border-border bg-card'>
      <RollButton
        target={{
          label: `${label} check`,
          modifier: check,
          mode: ability.checkMode,
        }}
        onRoll={onRoll}
        onMenu={onMenu}
        label={`${label} check, ${formatModifier(check)}${modeText(ability.checkMode)}`}
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
      </RollButton>
      <RollButton
        target={{
          label: `${label} saving throw`,
          modifier: save,
          mode: ability.saveMode,
        }}
        onRoll={onRoll}
        onMenu={onMenu}
        label={`${label} saving throw, ${formatModifier(save)}${saveProficient ? ', proficient' : ''}${modeText(ability.saveMode)}`}
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
      </RollButton>
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
  onMenu,
}: Readonly<{ skill: SheetSkill; ability: string } & RollActions>) {
  const proficiency = PROFICIENCY[String(skill.proficiency)]
  const details = [
    proficiency,
    skill.passive === null ? undefined : `passive ${skill.passive}`,
  ].filter(Boolean)
  return (
    <li>
      <RollButton
        target={{
          label: `${skill.label} check`,
          modifier: skill.total,
          mode: skill.mode,
        }}
        onRoll={onRoll}
        onMenu={onMenu}
        label={`${skill.label} check, ${formatModifier(skill.total)}${details.length > 0 ? ` (${details.join(', ')})` : ''}${modeText(skill.mode)}`}
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
      </RollButton>
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
