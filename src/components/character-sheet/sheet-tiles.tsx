'use client'

import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { CircleAlert, Dices, Footprints, Zap } from 'lucide-react'
import { ConcentrationChip } from './concentration'
import { conditionDetail } from './effects-tab'
import { RollButton } from './roll-button'
import { afterWords } from '@/utils/creature-words'
import { formatModifier } from '@/utils/format-modifier'
import { isDying } from '@/utils/roll-requests'
import type { RollActions } from './d20-rolls'
import type { TableSheet } from '@/types/table'

/*
 * The tiles and chips at the top of a sheet, a character's and, from module 0.36.0, a creature's:
 * its portrait, its conditions, and its vital numbers, each in a tile.
 */

/**
 * The tile of a character's or a creature's initiative. While its combatant waits to roll, a
 * button that rolls it for the combat, with the Roll badge; else one that rolls it as a check. A
 * companion that acts right after its character, while that one's in the combat (module 0.36.0),
 * rolls none: the tile says so, with the "After Thorin" badge, as a group named for it.
 * @param combatId - The combat its combatant waits to roll initiative in.
 * @param follows - The character it acts right after.
 */
export function InitiativeStat({
  modifier,
  combatId,
  follows,
  actions,
}: Readonly<{
  modifier: number
  combatId?: string
  follows?: string
  actions: RollActions
}>) {
  const shown = formatModifier(modifier)
  if (follows) {
    return (
      <Stat
        label='Initiative'
        short='Init'
        group={`Initiative, ${shown}, acts right after ${follows}`}
      >
        <Zap aria-hidden className='size-4 text-text-secondary' />
        {shown}
        <span className='truncate rounded bg-primary/10 px-1 text-[10px] font-bold tracking-wide text-primary-text uppercase'>
          {afterWords(follows)}
        </span>
      </Stat>
    )
  }
  return (
    <Stat label='Initiative' short='Init'>
      <RollButton
        target={{
          label: 'Initiative',
          modifier,
          mode: 0,
          source: combatId ? { kind: 'initiative', combatId } : undefined,
        }}
        {...actions}
        label={`Initiative, ${shown}${combatId ? ', to roll for the combat' : ''}`}
        // Its Roll badge goes under the number in a tile too narrow for both, rather than
        // under the tile beside it.
        className='-mx-1 inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 rounded-lg px-1 transition-colors hover:bg-primary/10 focus-visible:bg-primary/10'
      >
        <Zap
          aria-hidden
          className={clsx(
            'size-4',
            combatId ? 'text-primary' : 'text-text-secondary',
          )}
        />
        {shown}
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
  )
}

/** The walking speed, as the Speed tile shows it: its value and its units. */
export function WalkingSpeed({
  speed,
}: Readonly<{ speed: NonNullable<TableSheet['speed']> }>) {
  return (
    <span className='inline-flex items-center gap-1'>
      <Footprints aria-hidden className='size-4 text-text-secondary' />
      {speed.value}
      {speed.units && (
        <span className='text-sm font-normal text-text-secondary'>
          {speed.units}
        </span>
      )}
    </span>
  )
}

/**
 * Whether the sheet shows its death saving throws: dnd5e's sheet shows them while the character is
 * down, as do we; and while any are marked.
 */
export function isShowingDeathSaves(sheet: TableSheet): boolean {
  const { deathSaves } = sheet
  return (
    deathSaves !== null &&
    (sheet.hp?.value === 0 || deathSaves.success > 0 || deathSaves.failure > 0)
  )
}

/**
 * The death saving throws made, on a row of their own, while the sheet shows them, with a button
 * that rolls the next while the character is dying.
 */
export function DeathSavesStat({
  sheet,
  actions,
}: Readonly<{ sheet: TableSheet; actions: RollActions }>) {
  const { deathSaves } = sheet
  if (!deathSaves || !isShowingDeathSaves(sheet)) return
  return (
    <Stat label='Death saves' wide='row'>
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
  )
}

/**
 * The conditions on a character or creature, each a chip that opens its rules, or, for
 * Concentrating, ends what's concentrated on. Nothing where it has none.
 */
export function Conditions({
  conditions,
  onShowConditions,
}: Readonly<{
  conditions: TableSheet['conditions']
  onShowConditions?: (id: string) => void
}>) {
  if (conditions.length === 0) return
  return (
    <ul aria-label='Conditions' className='flex flex-wrap gap-1.5'>
      {conditions.map(condition => {
        const chip = (
          <>
            <StatusIcon src={condition.img} />
            {condition.name}
            {conditionDetail(condition) && (
              <span className='font-normal text-text-secondary'>
                {conditionDetail(condition)}
              </span>
            )}
          </>
        )
        const opener = (
          <button
            type='button'
            onClick={() => onShowConditions?.(condition.id)}
            className={CHIP}
          >
            {chip}
          </button>
        )
        return (
          <li key={condition.id}>
            {/* Concentrating has no rules here to open: it ends what's concentrated on. */}
            {condition.id === CONCENTRATING ? (
              <ConcentrationChip className={CHIP} fallback={opener}>
                {chip}
              </ConcentrationChip>
            ) : (
              opener
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** The look of a condition's chip in the header. */
const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-border bg-page py-1 pr-2.5 pl-1 text-xs font-semibold transition-colors hover:border-primary hover:bg-primary/5'

/** dnd5e's status of a character concentrating, as the sheet's conditions name it. */
const CONCENTRATING = 'concentrating'

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

/** A character's or creature's portrait, or its initials where it has none or it won't load. */
export function Portrait({
  name,
  src,
}: Readonly<{ name: string; src?: string }>) {
  const [failed, setFailed] = useState(false)
  const box =
    'size-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-primary/10'
  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={clsx(
          box,
          'flex items-center justify-center text-lg font-bold text-primary-text',
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
 * Armor class, needs 114 pixels. What it shows fills the box's height, which a taller box beside
 * it on its row may stretch, for the hit points' bar to sit at its foot.
 * @param wide - For one of a pair, such as the hit points beside the hit dice, a column on a
 * phone, where there are two, and two where there are more; two columns however many there are,
 * as the hit points with no hit dice beside them; or a row of its own, up to four columns.
 * @param group - What it says, as a group of its own named so, where its value is more than a
 * number, as a companion's initiative right after its character (module 0.36.0).
 */
export function Stat({
  label,
  short,
  wide,
  group,
  children,
}: Readonly<{
  label: string
  short?: string
  wide?: 'pair' | 'double' | 'row'
  group?: string
  children: ReactNode
}>) {
  return (
    <div
      className={clsx(
        '@container flex min-w-0 flex-col gap-0.5 rounded-xl bg-page py-2',
        wide === 'pair' && '@lg:col-span-2',
        wide === 'double' && 'col-span-2',
        wide === 'row' && 'col-span-2 @lg:col-span-4',
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
      <dd className='flex-1 px-3 text-lg font-bold tabular-nums'>
        {group ? (
          // On a span in the value, as a list's own div may have no role.
          <span
            role='group'
            aria-label={group}
            className='inline-flex flex-wrap items-center gap-x-1 gap-y-0.5'
          >
            {children}
          </span>
        ) : (
          children
        )}
      </dd>
    </div>
  )
}

/**
 * The character's hit points, of how many, and any temporary ones, over a bar of how many are left;
 * the bar at the foot of the tile, should the hit dice beside it make it taller.
 */
export function HitPoints({
  hp,
}: Readonly<{ hp: NonNullable<TableSheet['hp']> }>) {
  const ratio = hp.max ? Math.max(0, Math.min(1, hp.value / hp.max)) : 1
  let bar = 'bg-primary'
  if (ratio <= 0.25) bar = 'bg-danger'
  else if (ratio <= 0.5) bar = 'bg-warning'
  return (
    <span className='flex h-full flex-col justify-between gap-1'>
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('')
}
