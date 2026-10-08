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
import { useD20Rolls, type RollActions } from './d20-rolls'
import { FavoriteStar, useFavorite } from './favorite-mark'
import { RollButton } from './roll-button'
import { RollMenu, type MenuPoint } from './roll-menu'
import { EntryIcon, joinParts } from './sheet-entry'
import { SheetText } from './sheet-text'
import { UsesLeft } from './uses-left'
import {
  outOfSlots,
  poolName,
  slotPools,
  type SlotPool,
} from '@/utils/action-groups'
import { formatModifier } from '@/utils/format-modifier'
import { parseExtraTerms } from '@/utils/roll-modifiers'
import type { SheetDamageRoll, SheetRoll } from '@/hooks/use-sheet-roller'
import type { RollSource } from '@/types/roll'
import type { SheetAction, SheetSpellSection } from '@/types/sending-stone'

/*
 * An action as the Actions tab shows it, and the favorites too, and the spells, features and
 * inventory items that roll: its name, opening to the rest, and beside it what it rolls, each a
 * button of its own.
 */

/** An action's damage or healing, ready to roll, with its formula as dnd5e shows it. */
export type DamageTarget = SheetDamageRoll & { formula: string }

export type DamageActions = {
  onRoll: (target: DamageTarget) => void
  onMenu: (anchor: HTMLElement, target: DamageTarget, point?: MenuPoint) => void
}

/** Using a spell or feature in the Gamemaster's game, rather than rolling it here. */
export type UseActions = {
  onUse: (action: SheetAction) => void
}

/**
 * What every action's row needs: the character, its spellbook, and what rolling does; and using
 * spells and features, while the Gamemaster's game takes them.
 */
export type ActionRows = {
  characterId: string
  spellbook: SheetSpellSection[]
  d20: RollActions
  damage: DamageActions
  use?: UseActions
}

/**
 * How a tab shows something it lists as an action, where it's shown otherwise than on the Actions
 * tab: such as a spell on the Spells tab, with its school and components, or an item in the
 * inventory, with its weight and price.
 */
export type EntryLook = {
  /** Under its name, in place of how it's used; empty for nothing. */
  detail?: string
  /** Beside what it rolls, such as a spell's marks or how many there are of an item. */
  marks?: ReactNode
  /** Over its facts once it's open, in place of what kind of action it is. */
  meta?: string
  /** Its own facts, after how and at whom it's used, such as a spell's duration. */
  facts?: { label: string; value: string }[]
  /** Faded, such as a spell not prepared. */
  muted?: boolean
}

/**
 * What every action's row needs, on a tab or among the favorites, with the menus and dialogs its
 * rolls open in `dialogs`, to be put on the page.
 */
export function useActionRows({
  characterId,
  spellbook,
  onRoll,
  onRollDamage,
  onUse,
}: Readonly<{
  characterId: string
  spellbook: SheetSpellSection[]
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Uses a spell or feature in the Gamemaster's game, while it takes them. */
  onUse?: (action: SheetAction) => void
}>): { rows: ActionRows; dialogs: ReactNode } {
  const { actions: d20, dialogs } = useD20Rolls(onRoll)
  const { actions: damage, dialogs: damageMenu } = useDamageRolls(onRollDamage)
  return {
    rows: {
      characterId,
      spellbook,
      d20,
      damage,
      ...(onUse && { use: { onUse } }),
    },
    dialogs: (
      <>
        {dialogs}
        {damageMenu}
      </>
    ),
  }
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
 * An action as it's shown, worked out once for a row: its damage or healing and their kinds, for a
 * spell cast with slots, which it can be cast with and whether any are left; and, while the
 * Gamemaster's game takes spells and features, which of its chips use it there: its saving throw's
 * and damage's, for an activity that calls for one or deals it, or else one of its own.
 */
export function viewOf(
  action: SheetAction,
  spellbook: SheetSpellSection[],
  using?: UseActions,
) {
  const healing =
    action.damage.length > 0 && action.damage.every(part => part.healing)
  const pools = slotPools(action, spellbook)
  const formula = action.damage.map(part => part.formula).join(' + ')
  const use =
    using && action.activity && action.identified ? action.activity : undefined
  const save = !!use && use.type === 'save' && !!action.save
  const damage =
    !!use && use.type !== 'utility' && !!formula && !action.attackId
  const onUse = using && (() => using.onUse(action))
  return {
    healing,
    formula,
    target: damageTarget(action, healing),
    types: [
      ...new Set(action.damage.flatMap(part => (part.type ? [part.type] : []))),
    ],
    pools,
    spent: outOfSlots(action, pools),
    /** What the chips do in the game, if anything. */
    uses: {
      save: save ? onUse : undefined,
      damage: damage ? onUse : undefined,
      chip: use && !save && !damage ? onUse : undefined,
    },
  }
}

/**
 * An action in a list: its name, how it's activated and its reach, opening to the rest; and
 * beside it what it rolls, each a button of its own. A note, such as the item an activity is one
 * of, comes first. A tab that lists it otherwise shows it as it shows the rest it lists.
 */
export function ActionEntry({
  action,
  rows,
  note,
  look = {},
}: Readonly<{
  action: SheetAction
  rows: ActionRows
  note?: string
  look?: EntryLook
}>) {
  const [open, setOpen] = useState(false)
  const body = useId()
  const favorite = useFavorite(`item:${action.id}`)
  const view = viewOf(action, rows.spellbook, rows.use)
  const { name, toHit, save, uses } = action
  const detail =
    look.detail ??
    joinParts(
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
            (view.spent || look.muted) && 'opacity-60',
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
        {look.marks}
        {uses && (
          // Beside what the action rolls, in a narrow list, its uses would leave its name too
          // little room; they're listed when it opens.
          <span
            className={clsx(
              'shrink-0',
              (toHit !== null || save || view.formula || view.uses.chip) &&
                'hidden @md:inline',
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
        {save && <SaveChip name={name} save={save} onUse={view.uses.save} />}
        {view.formula && (
          <DamageChip
            name={name}
            formula={view.formula}
            healing={view.healing}
            target={view.target}
            damage={rows.damage}
            onUse={view.uses.damage}
          />
        )}
        {view.uses.chip && <UseChip action={action} onUse={view.uses.chip} />}
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
            look={look}
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

/**
 * The saving throw an action calls for, such as DEX 14: while the Gamemaster's game takes spells
 * and features, a button that uses it there, calling for it.
 */
export function SaveChip({
  name,
  save,
  onUse,
}: Readonly<{
  name: string
  save: NonNullable<SheetAction['save']>
  onUse?: () => void
}>) {
  const chip =
    'shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold whitespace-nowrap tabular-nums'
  const title = `${save.ability.toUpperCase()} saving throw`
  const content = (
    <>
      <span className='text-text-secondary uppercase'>{save.ability}</span>
      {save.dc !== null && ` ${save.dc}`}
    </>
  )
  if (onUse) {
    return (
      <button
        type='button'
        aria-label={`${name}, ${title}${save.dc === null ? '' : ` DC ${save.dc}`}`}
        title={title}
        onClick={onUse}
        className={clsx(chip, 'transition-colors hover:bg-primary/5')}
      >
        {content}
      </button>
    )
  }
  return (
    <span className={chip} title={title}>
      {content}
    </span>
  )
}

/**
 * A spell or feature that rolls nothing of its own, such as Bless, Shield or Action Surge, as a
 * button that casts or uses it in the Gamemaster's game.
 */
export function UseChip({
  action,
  onUse,
}: Readonly<{ action: SheetAction; onUse: () => void }>) {
  const verb = action.type === 'spell' ? 'Cast' : 'Use'
  return (
    <button
      type='button'
      aria-label={`${verb} ${action.name}`}
      onClick={onUse}
      className='shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary/20'
    >
      {verb}
    </button>
  )
}

/**
 * The damage or healing an action rolls, as a button that rolls it: damage, which a right-click
 * or long-press can roll as a critical hit's, or healing. A formula the app can't read is shown,
 * but not rolled. While the Gamemaster's game takes the spell or feature it's of, it uses it
 * there, and its damage or healing follows.
 */
export function DamageChip({
  name,
  formula,
  healing,
  target,
  damage,
  onUse,
}: Readonly<{
  name: string
  formula: string
  healing: boolean
  target: DamageTarget | undefined
  damage: DamageActions
  onUse?: () => void
}>) {
  const chip = clsx(
    'max-w-36 shrink-0 truncate rounded-lg px-2 py-1 text-sm font-semibold tabular-nums',
    healing ? 'bg-primary/10 text-primary' : 'bg-damage/15 text-damage',
  )
  const label = `${name} ${healing ? 'healing' : 'damage'}, ${formula}`
  if (onUse) {
    return (
      <button
        type='button'
        aria-label={label}
        title={formula}
        onClick={onUse}
        className={clsx(
          chip,
          'transition-colors',
          healing ? 'hover:bg-primary/20' : 'hover:bg-damage/25',
        )}
      >
        {formula}
      </button>
    )
  }
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
  look = {},
}: Readonly<{
  action: SheetAction
  pools: SlotPool[] | null
  characterId: string
  look?: EntryLook
}>) {
  const meta =
    look.meta ??
    joinParts(kindOf(action), !action.identified && 'Not identified')
  return (
    <>
      {meta && <p className='text-xs text-text-secondary'>{meta}</p>}
      <Facts action={action} pools={pools} more={look.facts} />
      {action.text && (
        <SheetText characterId={characterId} hash={action.text} />
      )}
    </>
  )
}

/**
 * All there is to know of how an action is used, each with its label, and for a spell cast with
 * slots, the slots it can be cast with. More of its own, such as a spell's duration, follow whom
 * it's used at.
 */
function Facts({
  action,
  pools,
  more = [],
}: Readonly<{
  action: SheetAction
  pools: SlotPool[] | null
  more?: { label: string; value: string }[]
}>) {
  const { save, uses } = action
  const healing =
    action.damage.length > 0 && action.damage.every(part => part.healing)
  const facts: [string, ReactNode][] = [
    [
      action.type === 'spell' ? 'Casting time' : 'Activation',
      action.activation,
    ],
    ['Range', action.range],
    ['Target', action.target],
    ...more.map(({ label, value }): [string, ReactNode] => [label, value]),
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
