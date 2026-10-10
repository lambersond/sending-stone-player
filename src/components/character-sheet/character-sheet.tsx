'use client'

import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  CircleAlert,
  Dices,
  Footprints,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react'
import { useD20Rolls, type RollActions } from './d20-rolls'
import { conditionDetail } from './effects-tab'
import { useFavorite } from './favorite-mark'
import { HitDiceList, hitDieSpending, type HitDieSpending } from './hit-dice'
import { RollButton } from './roll-button'
import { SheetHeading } from './sheet-heading'
import { formatModifier } from '@/utils/format-modifier'
import { hitDicePools } from '@/utils/formulas'
import { isDying } from '@/utils/roll-requests'
import type { SheetFormulaRoll, SheetRoll } from '@/hooks/use-sheet-roller'
import type { RollMode, SheetAbility, SheetSkill } from '@/types/sending-stone'
import type { TableCombat, TableSheet } from '@/types/table'

type Props = {
  name: string
  sheet: TableSheet
  /** The encounter under way, in which the character may be waiting to roll initiative. */
  combat?: TableCombat
  onRoll: (roll: SheetRoll) => void
  /** Spends a hit die, rolling it. */
  onRollFormula?: (roll: SheetFormulaRoll) => void
  /** Whether the Gamemaster's game spends a hit die rolled too, as it does while it takes them. */
  spendsAtTable?: boolean
  /** Shows the character's conditions in full, with their rules. */
  onShowConditions?: () => void
}

/**
 * A player's character sheet: who they are, their vital numbers, and their abilities and skills.
 * Each rolls when tapped, and a right-click or long-press offers advantage, disadvantage, or a
 * roll with extra dice or modifiers. Laid out after Tidy 5e's character sheet.
 */
export function CharacterSheet({
  name,
  sheet,
  combat,
  onRoll,
  onRollFormula,
  spendsAtTable,
  onShowConditions,
}: Readonly<Props>) {
  const { actions, dialogs } = useD20Rolls(onRoll)
  const abbreviation = (id: string) =>
    sheet.abilities.find(ability => ability.id === id)?.abbreviation ??
    id.toUpperCase()
  // The character's place in the encounter, while it has no initiative yet.
  const waiting = combat?.combatants.some(
    ({ side, initiative }) => side === 'me' && initiative === null,
  )

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      <SheetHeader
        name={name}
        sheet={sheet}
        actions={actions}
        combatId={waiting ? combat?.id : undefined}
        onShowConditions={onShowConditions}
        spending={hitDieSpending(sheet, onRollFormula, spendsAtTable)}
      />

      <section
        aria-labelledby='abilities-heading'
        className='flex flex-col gap-3'
      >
        <SheetHeading id='abilities-heading'>Abilities</SheetHeading>
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
            <SheetHeading id='skills-heading'>Skills</SheetHeading>
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

      {sheet.traits.length > 0 && (
        <section
          aria-labelledby='traits-heading'
          className='flex flex-col gap-2'
        >
          <SheetHeading id='traits-heading'>Traits</SheetHeading>
          <dl className='grid gap-x-4 rounded-2xl border border-border bg-card p-1.5 @2xl:grid-cols-2'>
            {sheet.traits.map(trait => (
              <div
                key={trait.id}
                className='flex flex-col gap-0.5 rounded-xl px-2.5 py-2'
              >
                <dt className='text-[11px] font-semibold tracking-wider text-text-secondary uppercase'>
                  {trait.label}
                </dt>
                <dd className='text-sm'>{trait.values.join(', ')}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {dialogs}
    </div>
  )
}

/* -------------------------------------------- */

function SheetHeader({
  name,
  sheet,
  actions,
  combatId,
  onShowConditions,
  spending,
}: Readonly<{
  name: string
  sheet: TableSheet
  actions: RollActions
  /** The combat the character waits to roll initiative in. */
  combatId?: string
  onShowConditions?: () => void
  /** How a hit die is spent; their counts alone without. */
  spending?: HitDieSpending
}>) {
  const identity = [sheet.species, sheet.background].filter(Boolean)
  const pools = hitDicePools(sheet.classes)
  const { deathSaves } = sheet
  // dnd5e's sheet shows them while the character is down, as do we; and while any are marked.
  const dying =
    deathSaves !== null &&
    (sheet.hp?.value === 0 || deathSaves.success > 0 || deathSaves.failure > 0)
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
      {sheet.conditions.length > 0 && (
        <ul aria-label='Conditions' className='flex flex-wrap gap-1.5'>
          {sheet.conditions.map(condition => (
            <li key={condition.id}>
              <button
                type='button'
                onClick={onShowConditions}
                className='inline-flex items-center gap-1.5 rounded-full border border-border bg-page py-1 pr-2.5 pl-1 text-xs font-semibold transition-colors hover:border-primary hover:bg-primary/5'
              >
                <StatusIcon src={condition.img} />
                {condition.name}
                {conditionDetail(condition) && (
                  <span className='font-normal text-text-secondary'>
                    {conditionDetail(condition)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* Where the sheet is wide enough, its hit dice go last, on a row of their own however wide
          it is, so the numbers beside the hit points stay on theirs, as tall as each other, and
          each size of die stays on one line with its button. */}
      <dl className='grid grid-cols-2 gap-2 @lg:grid-cols-6'>
        {sheet.hp && (
          <Stat label='Hit points' wide>
            <HitPoints hp={sheet.hp} />
          </Stat>
        )}
        {dying && (
          <Stat label='Death saves' wide>
            <span className='flex items-center justify-between gap-2'>
              <DeathSaves saves={deathSaves} />
              {isDying(sheet) && (
                <RollButton
                  target={{
                    label: 'Death saving throw',
                    modifier: 0,
                    mode: 0,
                    source: { kind: 'death' },
                  }}
                  {...actions}
                  label='Death saving throw'
                  className='inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/5 focus-visible:border-primary'
                >
                  <Dices aria-hidden className='size-4 text-primary' />
                  Roll
                </RollButton>
              )}
            </span>
          </Stat>
        )}
        {/* After the death saves, which stay under the hit points while the character is dying.
            Spent any time, each tap a die of that size, for the hit points it gives back. */}
        {pools.length > 0 && (
          <Stat label='Hit dice' wide className='@lg:order-last @lg:col-span-6'>
            <HitDiceList pools={pools} spending={spending} />
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
            <RollButton
              target={{
                label: 'Initiative',
                modifier: sheet.initiative,
                mode: 0,
                source: combatId ? { kind: 'initiative', combatId } : undefined,
              }}
              {...actions}
              label={`Initiative, ${formatModifier(sheet.initiative)}${combatId ? ', to roll for the combat' : ''}`}
              className='-mx-1 inline-flex items-center gap-1 rounded-lg px-1 transition-colors hover:bg-primary/10 focus-visible:bg-primary/10'
            >
              <Zap
                aria-hidden
                className={clsx(
                  'size-4',
                  combatId ? 'text-primary' : 'text-text-secondary',
                )}
              />
              {formatModifier(sheet.initiative)}
              {combatId && (
                <span
                  aria-hidden
                  className='rounded bg-primary px-1 text-[10px] font-bold tracking-wide text-on-primary uppercase'
                >
                  Roll
                </span>
              )}
            </RollButton>
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

/**
 * A condition's icon. The game's status icons are white, made for its dark token controls, so they
 * sit on a dark disc.
 */
function StatusIcon({ src }: Readonly<{ src: string | null }>) {
  const [failed, setFailed] = useState<string>()
  if (!src || failed === src) {
    return (
      <span
        aria-hidden
        className='flex size-5 items-center justify-center rounded-full bg-ruby/15 text-ruby'
      >
        <CircleAlert className='size-3.5' />
      </span>
    )
  }
  return (
    // An icon from the Gamemaster's game, which Next's image optimizer doesn't know.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=''
      className='size-5 rounded-full bg-[#23232f] p-0.5'
      onError={() => setFailed(src)}
    />
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
  className,
  children,
}: Readonly<{
  label: string
  short?: string
  wide?: boolean
  /** Where it goes in the grid, where that differs from its place among the others. */
  className?: string
  children: ReactNode
}>) {
  return (
    <div
      className={clsx(
        '@container flex min-w-0 flex-col gap-0.5 rounded-xl bg-page py-2',
        wide && 'col-span-2',
        className,
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

/** Death saving throws made: successes and failures, three of either ending them. */
function DeathSaves({
  saves,
}: Readonly<{ saves: { success: number; failure: number } }>) {
  return (
    <span className='flex flex-col gap-1 text-xs font-semibold'>
      <SaveMarks label='Successes' count={saves.success} mark='bg-primary' />
      <SaveMarks label='Failures' count={saves.failure} mark='bg-danger' />
    </span>
  )
}

function SaveMarks({
  label,
  count,
  mark,
}: Readonly<{ label: string; count: number; mark: string }>) {
  return (
    <span className='flex items-center gap-2'>
      <span className='w-16 text-text-secondary'>{label}</span>
      <span aria-hidden className='flex gap-1'>
        {[0, 1, 2].map(index => (
          <span
            key={index}
            className={clsx(
              'size-3 rounded-full border-2 border-border',
              index < count && clsx('border-transparent', mark),
            )}
          />
        ))}
      </span>
      <span className='sr-only'>{Math.min(count, 3)} of 3</span>
    </span>
  )
}

/* -------------------------------------------- */

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
          source: { kind: 'ability', key: ability.id },
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
          source: { kind: 'save', key: ability.id },
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

/** Proficiency, as a skill's multiplier says it. */
export const PROFICIENCY: Record<string, string> = {
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
  const favorite = useFavorite(`skill:${skill.id}`)
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
          source: { kind: 'skill', key: skill.id },
        }}
        onRoll={onRoll}
        onMenu={onMenu}
        label={`${skill.label} check, ${formatModifier(skill.total)}${details.length > 0 ? ` (${details.join(', ')})` : ''}${modeText(skill.mode)}${favorite ? ', favorite' : ''}`}
        className='flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-primary/5 focus-visible:bg-primary/5'
      >
        <ProficiencyMark value={skill.proficiency} />
        <span className='w-8 shrink-0 text-[11px] font-semibold tracking-wider text-text-secondary uppercase'>
          {ability}
        </span>
        <span className='flex min-w-0 flex-1 items-center gap-1'>
          <span className='truncate font-medium'>{skill.label}</span>
          {favorite && (
            <Star aria-hidden className='size-3 shrink-0 fill-gold text-gold' />
          )}
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
export function ModeChip({ mode }: Readonly<{ mode: RollMode }>) {
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

/** Advantage or disadvantage, as a roll's label says it. */
export function modeText(mode: RollMode): string {
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
