'use client'

import { useId, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  ChevronDown,
  FlaskConical,
  Shield,
  Sparkles,
  Sword,
  Wand,
  type LucideIcon,
} from 'lucide-react'
import { FavoriteStar, useFavorite } from './favorite-mark'
import { UsesLeft } from './features-tab'
import { RollButton } from './roll-button'
import { RollMenu, type MenuPoint } from './roll-menu'
import { EntryIcon, joinParts } from './sheet-entry'
import { SheetText } from './sheet-text'
import {
  outOfSlots,
  poolName,
  slotPools,
  type SlotPool,
} from '@/utils/action-groups'
import { formatModifier } from '@/utils/format-modifier'
import { parseExtraTerms } from '@/utils/roll-modifiers'
import type { RollActions } from './d20-rolls'
import type { SheetDamageRoll } from '@/hooks/use-sheet-roller'
import type { RollSource } from '@/types/roll'
import type { SheetAction, SheetSpellSection } from '@/types/sending-stone'

/*
 * An action as the Actions tab shows it, and the favorites too: its name, opening to the rest,
 * and beside it what it rolls, each a button of its own.
 */

/** An action's damage or healing, ready to roll, with its formula as dnd5e shows it. */
export type DamageTarget = SheetDamageRoll & { formula: string }

export type DamageActions = {
  onRoll: (target: DamageTarget) => void
  onMenu: (anchor: HTMLElement, target: DamageTarget, point?: MenuPoint) => void
}

/** What every action's row needs: the character, its spellbook, and what rolling does. */
export type ActionRows = {
  characterId: string
  spellbook: SheetSpellSection[]
  d20: RollActions
  damage: DamageActions
}

/** Icons for actions without one of their own, by the item's type. */
export const FALLBACKS: Record<string, LucideIcon> = {
  weapon: Sword,
  spell: Wand,
  consumable: FlaskConical,
  equipment: Shield,
}

/** What an item is, for a type other than a spell. */
const KINDS: Record<string, string> = {
  weapon: 'Weapon',
  equipment: 'Equipment',
  consumable: 'Consumable',
  feat: 'Feature',
  tool: 'Tool',
  loot: 'Loot',
}

/**
 * Rolling an action's damage or healing from the sheet. A tap rolls it; a right-click or
 * long-press on damage offers to roll it as a critical hit's. The menu is in `dialogs`, to be put
 * on the page.
 */
export function useDamageRolls(onRollDamage: (roll: SheetDamageRoll) => void): {
  actions: DamageActions
  dialogs: ReactNode
} {
  const [menu, setMenu] = useState<{
    anchor: HTMLElement
    target: DamageTarget
    point?: MenuPoint
  }>()
  const roll = (target: DamageTarget, critical = false) =>
    onRollDamage({
      label: target.label,
      parts: target.parts,
      healing: target.healing,
      critical,
      ...(target.source && { source: target.source }),
    })
  const dialogs = menu && (
    <RollMenu
      anchor={menu.anchor}
      point={menu.point}
      title={`${menu.target.label} ${menu.target.formula}`}
      choices={['critical']}
      onChoose={() => {
        setMenu(undefined)
        roll(menu.target, true)
      }}
      onClose={() => setMenu(undefined)}
    />
  )
  return {
    actions: {
      onRoll: target => roll(target),
      onMenu: (anchor, target, point) => setMenu({ anchor, target, point }),
    },
    dialogs,
  }
}

/**
 * An action as it's shown, worked out once for a row: its damage or healing and their kinds, and
 * for a spell cast with slots, which it can be cast with and whether any are left.
 */
export function viewOf(action: SheetAction, spellbook: SheetSpellSection[]) {
  const healing =
    action.damage.length > 0 && action.damage.every(part => part.healing)
  const pools = slotPools(action, spellbook)
  return {
    healing,
    formula: action.damage.map(part => part.formula).join(' + '),
    target: damageTarget(action, healing),
    types: [
      ...new Set(action.damage.flatMap(part => (part.type ? [part.type] : []))),
    ],
    pools,
    spent: outOfSlots(action, pools),
  }
}

/**
 * An action in a list: its name, how it's activated and its reach, opening to the rest; and
 * beside it what it rolls, each a button of its own. A note, such as the item an activity is one
 * of, comes first.
 */
export function ActionEntry({
  action,
  rows,
  note,
}: Readonly<{ action: SheetAction; rows: ActionRows; note?: string }>) {
  const [open, setOpen] = useState(false)
  const body = useId()
  const favorite = useFavorite(`item:${action.id}`)
  const view = viewOf(action, rows.spellbook)
  const { name, toHit, save, uses } = action
  const detail = joinParts(
    note,
    action.activation,
    action.range,
    view.types.join(', '),
    view.spent && 'No slots left',
  )

  return (
    <li>
      <div className='flex items-center gap-2 rounded-xl py-1.5 pr-1.5 pl-1'>
        <button
          type='button'
          aria-expanded={open}
          aria-controls={open ? body : undefined}
          onClick={() => setOpen(!open)}
          className={clsx(
            'flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-0.5 text-left transition-colors hover:bg-primary/5',
            view.spent && 'opacity-60',
          )}
        >
          <EntryIcon
            src={action.img}
            fallback={FALLBACKS[action.type] ?? Sparkles}
          />
          <span className='min-w-0 flex-1'>
            {/* The mark sits by the name, where it lines up from row to row whatever each
                rolls. */}
            <span className='flex items-center gap-1'>
              <span className='truncate font-medium'>{name}</span>
              {favorite && <FavoriteStar />}
              <Chevron open={open} />
            </span>
            {detail && (
              <span className='block truncate text-xs text-text-secondary'>
                {detail}
              </span>
            )}
          </span>
        </button>
        {uses && (
          // Beside what the action rolls, in a narrow list, its uses would leave its name too
          // little room; they're listed when it opens.
          <span
            className={clsx(
              'shrink-0',
              (toHit !== null || save || view.formula) && 'hidden @md:inline',
            )}
          >
            <UsesLeft uses={uses} />
          </span>
        )}
        {toHit !== null && (
          <AttackChip
            name={name}
            toHit={toHit}
            d20={rows.d20}
            source={attackSource(action)}
          />
        )}
        {save && <SaveChip save={save} />}
        {view.formula && (
          <DamageChip
            name={name}
            formula={view.formula}
            healing={view.healing}
            target={view.target}
            damage={rows.damage}
          />
        )}
      </div>
      {open && (
        <div
          id={body}
          className='flex flex-col gap-2 px-2.5 pt-1 pb-3 pl-[3.25rem]'
        >
          <ActionDetails
            action={action}
            pools={view.pools}
            characterId={rows.characterId}
          />
        </div>
      )}
    </li>
  )
}

/** The mark that an action opens, turned while it's open. */
export function Chevron({ open }: Readonly<{ open: boolean }>) {
  return (
    <ChevronDown
      aria-hidden
      className={clsx(
        'size-3.5 shrink-0 text-text-secondary transition-transform',
        open && 'rotate-180',
      )}
    />
  )
}

/**
 * What an action's attack is, for the Gamemaster's game to make it: its item and attack activity.
 * None for an action whose attack the module didn't name, as before module 0.11.0.
 */
export function attackSource(action: SheetAction): RollSource | undefined {
  return action.attackId
    ? { kind: 'attack', item: action.id, activity: action.attackId }
    : undefined
}

/** An attack's bonus, as a button that rolls it, or offers advantage and the like. */
export function AttackChip({
  name,
  toHit,
  d20,
  source,
}: Readonly<{
  name: string
  toHit: number
  d20: RollActions
  source?: RollSource
}>) {
  return (
    <RollButton
      target={{ label: `${name} attack`, modifier: toHit, mode: 0, source }}
      {...d20}
      label={`${name} attack, ${formatModifier(toHit)}`}
      className='shrink-0 rounded-lg bg-attack/15 px-2 py-1 text-sm font-bold text-attack tabular-nums transition-colors hover:bg-attack/25'
    >
      {formatModifier(toHit)}
    </RollButton>
  )
}

/** The saving throw an action calls for, such as DEX 14. */
export function SaveChip({
  save,
}: Readonly<{ save: NonNullable<SheetAction['save']> }>) {
  return (
    <span
      className='shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold whitespace-nowrap tabular-nums'
      title={`${save.ability.toUpperCase()} saving throw`}
    >
      <span className='text-text-secondary uppercase'>{save.ability}</span>
      {save.dc !== null && ` ${save.dc}`}
    </span>
  )
}

/**
 * The damage or healing an action rolls, as a button that rolls it: damage, which a right-click
 * or long-press can roll as a critical hit's, or healing. A formula the app can't read is shown,
 * but not rolled.
 */
export function DamageChip({
  name,
  formula,
  healing,
  target,
  damage,
}: Readonly<{
  name: string
  formula: string
  healing: boolean
  target: DamageTarget | undefined
  damage: DamageActions
}>) {
  const chip = clsx(
    'max-w-36 shrink-0 truncate rounded-lg px-2 py-1 text-sm font-semibold tabular-nums',
    healing ? 'bg-primary/10 text-primary' : 'bg-damage/15 text-damage',
  )
  const label = `${name} ${healing ? 'healing' : 'damage'}, ${formula}`
  if (!target) {
    return (
      <span className={chip} title={formula}>
        {formula}
      </span>
    )
  }
  if (healing) {
    return (
      <button
        type='button'
        aria-label={label}
        title={formula}
        onClick={() => damage.onRoll(target)}
        className={clsx(chip, 'transition-colors hover:bg-primary/20')}
      >
        {formula}
      </button>
    )
  }
  return (
    <RollButton
      target={target}
      {...damage}
      label={label}
      className={clsx(chip, 'transition-colors hover:bg-damage/25')}
    >
      {formula}
    </RollButton>
  )
}

/** All there is to know of an action once it's open: what it is, its facts, its description. */
export function ActionDetails({
  action,
  pools,
  characterId,
}: Readonly<{
  action: SheetAction
  pools: SlotPool[] | null
  characterId: string
}>) {
  const meta = joinParts(kindOf(action), !action.identified && 'Not identified')
  return (
    <>
      {meta && <p className='text-xs text-text-secondary'>{meta}</p>}
      <Facts action={action} pools={pools} />
      {action.text && (
        <SheetText characterId={characterId} hash={action.text} />
      )}
    </>
  )
}

/**
 * All there is to know of how an action is used, each with its label, and for a spell cast with
 * slots, the slots it can be cast with.
 */
function Facts({
  action,
  pools,
}: Readonly<{ action: SheetAction; pools: SlotPool[] | null }>) {
  const { save, uses } = action
  const healing =
    action.damage.length > 0 && action.damage.every(part => part.healing)
  const facts: [string, ReactNode][] = [
    ['Activation', action.activation],
    ['Range', action.range],
    ['Target', action.target],
    [
      'To hit',
      action.toHit === null ? undefined : formatModifier(action.toHit),
    ],
    [
      'Saving throw',
      save &&
        `${save.dc === null ? '' : `DC ${save.dc} `}${save.ability.toUpperCase()}`,
    ],
    [
      healing ? 'Healing' : 'Damage',
      action.damage
        .map(part =>
          part.type && !part.healing
            ? `${part.formula} ${part.type}`
            : part.formula,
        )
        .join(' + '),
    ],
    [
      'Uses',
      uses &&
        `${uses.value} of ${uses.max} left${uses.recovery ? `, ${uses.recovery}` : ''}`,
    ],
    ['Cast at', pools && pools.length > 0 && <CastAt pools={pools} />],
  ]
  const shown = facts.filter(([, value]) => Boolean(value))
  if (shown.length === 0) return
  return (
    <dl className='grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-0.5 text-xs'>
      {shown.map(([label, value]) => (
        <div key={label} className='contents'>
          <dt className='font-semibold text-text-secondary'>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The slots a spell can be cast with, each with how many are left, such as "3rd 1/2". */
function CastAt({ pools }: Readonly<{ pools: SlotPool[] }>) {
  return (
    <ul className='flex flex-wrap gap-1'>
      {pools.map(pool => (
        <li
          key={pool.id}
          className={clsx(
            'rounded-md border px-1.5 font-semibold tabular-nums',
            pool.value === 0 ? 'border-ruby/40 text-ruby' : 'border-border',
          )}
        >
          <span aria-hidden>
            {poolName(pool)}{' '}
            <span className='font-normal text-text-secondary'>
              {pool.value}/{pool.max}
            </span>
          </span>
          <span className='sr-only'>
            {pool.label}, {pool.value} of {pool.max} slots left
          </span>
        </li>
      ))}
    </ul>
  )
}

/** What an action is: a spell's level, or else the item's type. */
function kindOf(action: SheetAction): string | undefined {
  if (action.type === 'spell') {
    return joinParts(
      action.level === 0 ? 'Cantrip' : `Level ${action.level ?? '?'} spell`,
      action.concentration && 'Concentration',
    )
  }
  return joinParts(KINDS[action.type], action.concentration && 'Concentration')
}

/**
 * An action's damage or healing, read for rolling: each part's formula as dice and numbers. Unset
 * when there's none, or a formula is beyond reading, such as one with a function in it.
 */
function damageTarget(
  action: SheetAction,
  healing: boolean,
): DamageTarget | undefined {
  if (action.damage.length === 0) return undefined
  const parts: DamageTarget['parts'] = []
  for (const part of action.damage) {
    const read = parseExtraTerms(part.formula)
    if (!read.ok) return undefined
    parts.push({ terms: read.terms, type: part.type })
  }
  return {
    label: `${action.name} ${healing ? 'healing' : 'damage'}`,
    parts,
    healing,
    formula: action.damage.map(part => part.formula).join(' + '),
    ...(action.attackId && {
      source: { item: action.id, activity: action.attackId },
    }),
  }
}
