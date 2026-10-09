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
import { useDamageMenu, type DamageChoice } from './damage-menu'
import { FavoriteStar, useFavorite } from './favorite-mark'
import { RollButton } from './roll-button'
import { EntryIcon, joinParts } from './sheet-entry'
import { SheetText } from './sheet-text'
import { UsesLeft } from './uses-left'
import { damageRollOf, type DueDamage } from '@/hooks/use-table-rolls'
import {
  outOfSlots,
  poolName,
  slotPools,
  type SlotPool,
} from '@/utils/action-groups'
import {
  changes,
  firstDie,
  type DamageModifiers,
} from '@/utils/damage-modifiers'
import { formatModifier } from '@/utils/format-modifier'
import { parseExtraTerms } from '@/utils/roll-modifiers'
import { activityAction } from '@/utils/sheet-actions'
import type { MenuPoint, RollChoice } from './roll-menu'
import type { SheetDamageRoll, SheetRoll } from '@/hooks/use-sheet-roller'
import type { RollSource } from '@/types/roll'
import type {
  SheetAction,
  SheetActivity,
  SheetSpellSection,
} from '@/types/sending-stone'

/*
 * An action as the Actions tab shows it, and the favorites too, and the spells, features and
 * inventory items that roll: its name, opening to the rest, and beside it what it rolls, each a
 * button of its own.
 */

/** An action's damage or healing, ready to roll, with its formula as dnd5e shows it. */
export type DamageTarget = SheetDamageRoll & { formula: string }

export type DamageActions = {
  onRoll: (target: DamageTarget) => void
  /**
   * Offers other ways to roll it; or, for the damage of a spell or feature used in the game, to
   * use it with its damage changed.
   */
  onMenu: (
    anchor: HTMLElement,
    target: DamageTarget,
    point?: MenuPoint,
    use?: DamageUse,
  ) => void
}

/** A spell or feature used in the game, its damage to follow, as its damage chip's menu uses it. */
export type DamageUse = {
  /** Such as "Cast". */
  verb: string
  onUse: (modifiers?: DamageModifiers) => void
}

/** Using a spell or feature in the Gamemaster's game, rather than rolling it here. */
export type UseActions = {
  /** Uses it, its damage changed as the player chose, if they did. */
  onUse: (action: SheetAction, modifiers?: DamageModifiers) => void
}

/** What the Gamemaster's game does with damage rolled from the sheet, while it takes damage. */
export type TableDamage = {
  /** Whether it takes damage the player changed. */
  modifies: boolean
  /** An attack's or a use's damage due at the table, if it's waiting for it. */
  dueFor: (source: { item: string; activity: string }) => DueDamage | undefined
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
  tableDamage,
}: Readonly<{
  characterId: string
  spellbook: SheetSpellSection[]
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Uses a spell or feature in the Gamemaster's game, while it takes them. */
  onUse?: (action: SheetAction, modifiers?: DamageModifiers) => void
  /** What the game does with damage, while it takes it. */
  tableDamage?: TableDamage
}>): { rows: ActionRows; dialogs: ReactNode } {
  const { actions: d20, dialogs } = useD20Rolls(onRoll)
  const { actions: damage, dialogs: damageMenu } = useDamageRolls(
    onRollDamage,
    tableDamage,
  )
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
 * long-press offers other ways: as a critical hit's, for damage rolled here; at its highest; or
 * with its dice changed first, more of them or another size. For damage the Gamemaster's game is
 * waiting for, the game decides a critical hit, and the rest is offered where it takes them. A
 * spell or feature the game uses offers to use it so, its damage to follow. The menu and its
 * dialog are in `dialogs`, to be put on the page.
 */
export function useDamageRolls(
  onRollDamage: (roll: SheetDamageRoll) => void,
  table?: TableDamage,
): {
  actions: DamageActions
  dialogs: ReactNode
} {
  const { open, dialogs } = useDamageMenu()
  const roll = (
    target: DamageTarget,
    { critical = false, modifiers }: DamageChoice = {},
  ) =>
    onRollDamage({
      label: target.label,
      parts: target.parts,
      healing: target.healing,
      critical,
      ...(target.source && { source: target.source }),
      ...(modifiers && changes(modifiers) && { modifiers }),
    })
  const onMenu: DamageActions['onMenu'] = (anchor, target, point, use) => {
    const subject = {
      label: target.label,
      formula: target.formula,
      healing: target.healing === true,
    }
    const changed: RollChoice[] = firstDie(target.parts)
      ? ['maximize', 'modify-damage']
      : ['maximize']
    if (use) {
      if (!table?.modifies) return
      open(
        anchor,
        {
          ...subject,
          parts: target.parts,
          choices: changed,
          verb: use.verb,
          onChoose: ({ modifiers }) => use.onUse(modifiers),
        },
        point,
      )
      return
    }
    const due = target.source && table?.dueFor(target.source)
    if (due) {
      if (!table?.modifies) return
      // As the game will throw it: a critical hit's dice as it doubled them.
      const game = damageRollOf(target.label, due)
      open(
        anchor,
        {
          ...subject,
          parts: game.parts,
          perDie: game.perDie,
          choices: firstDie(game.parts)
            ? ['maximize', 'modify-damage']
            : ['maximize'],
          onChoose: choice => roll(target, choice),
        },
        point,
      )
      return
    }
    open(
      anchor,
      {
        ...subject,
        parts: target.parts,
        choices: target.healing ? changed : ['critical', ...changed],
        onChoose: choice => roll(target, choice),
      },
      point,
    )
  }
  return { actions: { onRoll: target => roll(target), onMenu }, dialogs }
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
  const onUse =
    using &&
    ((modifiers?: DamageModifiers) =>
      modifiers ? using.onUse(action, modifiers) : using.onUse(action))
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
  section,
}: Readonly<{
  action: SheetAction
  rows: ActionRows
  note?: string
  look?: EntryLook
  /** The section of the Actions tab it's listed in, whose kind of action goes without saying. */
  section?: string
}>) {
  const [open, setOpen] = useState(false)
  const body = useId()
  const favorite = useFavorite(`item:${action.id}`)
  const view = viewOf(action, rows.spellbook, rows.use)
  const others = otherActivities(action)
  const { name, uses } = action
  const detail =
    look.detail ??
    joinParts(
      note,
      action.activityName,
      activationIn(action, section),
      action.range,
      view.types.join(', '),
      castNote(action.cast),
      view.spent && 'No slots left',
      firstInFoundry(action) && 'Used in Foundry',
      !open && moreNote(others.length),
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
            (view.spent || look.muted || action.cast?.short) && 'opacity-60',
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
        {uses && <ChipUses uses={uses} view={view} action={action} />}
        <ActionChips action={action} view={view} rows={rows} />
      </div>
      {open && (
        <div id={body} className='flex flex-col gap-2 pb-3'>
          {/* Its other activities, folded away with the rest until it's opened. */}
          {others.length > 0 && (
            <ul
              aria-label={`${name}: its other activities`}
              className='ml-[1.625rem] border-l border-border pl-[1.5rem]'
            >
              {others.map(other => (
                <ActivityEntry
                  key={other.activity.id}
                  activity={other.activity}
                  action={other.action}
                  parent={action}
                  rows={rows}
                  muted={look.muted}
                  section={section}
                />
              ))}
            </ul>
          )}
          <div className='flex flex-col gap-2 px-2.5 pt-1 pl-[3.25rem]'>
            <ActionDetails
              action={action}
              pools={view.pools}
              characterId={rows.characterId}
              look={look}
            />
          </div>
        </div>
      )}
    </li>
  )
}

/**
 * One of an action's other activities, beneath it, such as Hex's Bonus Hex Damage: its name, how
 * it differs from the action in how it's used and how far it reaches, and what it rolls beside it,
 * as an action's row has them. One the app can't use, such as a summoning, says so.
 */
function ActivityEntry({
  activity,
  action,
  parent,
  rows,
  muted,
  section,
}: Readonly<{
  activity: SheetActivity
  /** The activity as an action of its own. */
  action: SheetAction
  parent: SheetAction
  rows: ActionRows
  muted?: boolean
  section?: string
}>) {
  const view = viewOf(action, rows.spellbook, rows.use)
  const uses = ownUses(activity, parent)
  const detail = joinParts(
    ...activityDetail(activity, parent, view.spent, { section }),
  )
  return (
    <li className='flex items-center gap-2 py-0.5 pr-1.5'>
      <span
        className={clsx(
          'min-w-0 flex-1 py-0.5',
          (view.spent || muted || dimmed(activity)) && 'opacity-60',
        )}
      >
        <span className='block truncate text-sm'>{activity.name}</span>
        {detail && (
          <span className='block truncate text-xs text-text-secondary'>
            {detail}
          </span>
        )}
      </span>
      {uses && <ChipUses uses={uses} view={view} action={action} />}
      <ActionChips action={action} view={view} rows={rows} />
    </li>
  )
}

/**
 * An action's other activities, after its first, which the action is, each with itself as an
 * action of its own, rolled and used as that activity alone.
 */
export function otherActivities(
  action: SheetAction,
): { activity: SheetActivity; action: SheetAction }[] {
  return (action.activities ?? []).slice(1).map(activity => ({
    activity,
    action: activityAction(action, activity),
  }))
}

/** The kinds of activity the app rolls or uses; others, such as a summoning, are Foundry's. */
const FROM_APP = new Set(['attack', 'save', 'damage', 'heal', 'utility'])

/**
 * Is this an activity the app rolls or uses: one of a kind it does, or one the module says it can
 * roll or use, such as a spell a staff casts?
 */
export function usedFromApp(activity: SheetActivity): boolean {
  return (
    FROM_APP.has(activity.type) || !!(activity.attackId || activity.activity)
  )
}

/** Is an activity shown faded: one used only in Foundry, or a spell cast from charges not left? */
export function dimmed(activity: SheetActivity): boolean {
  return !usedFromApp(activity) || activity.cast?.short === true
}

/**
 * An activity's uses, beside it: none for a spell cast from its item's charges, which are shown by
 * the item already.
 */
export function ownUses(
  activity: SheetActivity,
  parent: SheetAction,
): SheetAction['uses'] | undefined {
  const { uses } = activity
  const same =
    !!uses &&
    !!parent.uses &&
    uses.value === parent.uses.value &&
    uses.max === parent.uses.max
  return activity.cast && same ? undefined : uses
}

/**
 * What a spell cast from an item costs, such as "1 charge", or that the item hasn't that many
 * left.
 */
export function castNote(cast: SheetAction['cast']): string | undefined {
  if (!cast) return undefined
  if (cast.short) return 'No charges left'
  if (!cast.charges) return undefined
  return cast.charges === 1 ? '1 charge' : `${cast.charges} charges`
}

/** How many more activities an action has than it shows while it's closed, such as "3 more". */
export function moreNote(count: number): string | undefined {
  return count > 0 ? `${count} more` : undefined
}

/**
 * How an action is activated, but where its section of the Actions tab says it already, as one
 * action does under Actions, or a reaction under Reactions.
 */
export function activationIn(
  action: Pick<SheetAction, 'activation' | 'activationType'>,
  section?: string,
): string | null | undefined {
  return section && action.activationType === section
    ? undefined
    : action.activation
}

/**
 * An action's name for its rolls: an item's, and the activity it's listed for, where it isn't the
 * item's first, such as "Staff (Silvery Barbs)".
 */
export function actionTitle(
  action: Pick<SheetAction, 'name' | 'activityName'>,
): string {
  return action.activityName
    ? `${action.name} (${action.activityName})`
    : action.name
}

/**
 * Is an action with more than one activity first one the app can't use, such as Flaming Sphere's
 * summoning, with the rest beneath it?
 */
export function firstInFoundry(action: SheetAction): boolean {
  const [first] = action.activities ?? []
  return !!first && !usedFromApp(first)
}

/**
 * What to say of one of an action's activities beneath it: how it's used and how far it reaches,
 * where that differs from the action, its kinds of damage, and whether it's out of slots, or used
 * only in Foundry.
 */
export function activityDetail(
  activity: SheetActivity,
  parent: SheetAction,
  spent: boolean,
  {
    section,
    range = true,
  }: {
    /** The section of the Actions tab it's listed in. */
    section?: string
    /** Whether to say how far it reaches, which a table has a column for. */
    range?: boolean
  } = {},
): (string | false | null | undefined)[] {
  return [
    activity.activation !== parent.activation &&
      activationIn(activity, section),
    range && activity.range !== parent.range && activity.range,
    [
      ...new Set(
        activity.damage.flatMap(part => (part.type ? [part.type] : [])),
      ),
    ].join(', '),
    castNote(activity.cast),
    spent && 'No slots left',
    !usedFromApp(activity) && 'Used in Foundry',
  ]
}

/** An action's uses beside what it rolls, which in a narrow list are listed when it opens. */
function ChipUses({
  uses,
  view,
  action,
}: Readonly<{
  uses: NonNullable<SheetAction['uses']>
  view: ReturnType<typeof viewOf>
  action: SheetAction
}>) {
  const rolls =
    action.toHit !== null || !!action.save || !!view.formula || !!view.uses.chip
  return (
    // Beside what the action rolls, in a narrow list, its uses would leave its name too little
    // room; they're listed when it opens.
    <span className={clsx('shrink-0', rolls && 'hidden @md:inline')}>
      <UsesLeft uses={uses} />
    </span>
  )
}

/**
 * What an action rolls, each a button of its own: its attack's bonus, its saving throw, its
 * damage or healing, or using it in the game.
 */
export function ActionChips({
  action,
  view,
  rows,
}: Readonly<{
  action: SheetAction
  view: ReturnType<typeof viewOf>
  rows: ActionRows
}>) {
  const { toHit, save } = action
  const name = actionTitle(action)
  return (
    <>
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
          verb={verbOf(action)}
        />
      )}
      {view.uses.chip && <UseChip action={action} onUse={view.uses.chip} />}
    </>
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
  onUse?: (modifiers?: DamageModifiers) => void
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
        onClick={() => onUse()}
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
}: Readonly<{
  action: SheetAction
  onUse: (modifiers?: DamageModifiers) => void
}>) {
  const verb = verbOf(action)
  return (
    <button
      type='button'
      aria-label={`${verb} ${actionTitle(action)}`}
      onClick={() => onUse()}
      className='shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-sm font-semibold text-primary transition-colors hover:bg-primary/20'
    >
      {verb}
    </button>
  )
}

/**
 * The damage or healing an action rolls, as a button that rolls it, which a right-click or
 * long-press offers other ways to roll: as a critical hit's, at its highest, or changed. A formula
 * the app can't read is shown, but not rolled. While the Gamemaster's game takes the spell or
 * feature it's of, it uses it there, and its damage or healing follows; its menu then uses it
 * with its damage changed.
 */
export function DamageChip({
  name,
  formula,
  healing,
  target,
  damage,
  onUse,
  verb = 'Use',
}: Readonly<{
  name: string
  formula: string
  healing: boolean
  target: DamageTarget | undefined
  damage: DamageActions
  onUse?: (modifiers?: DamageModifiers) => void
  /** What using it is called, such as "Cast" for a spell. */
  verb?: string
}>) {
  const chip = clsx(
    'max-w-36 shrink-0 truncate rounded-lg px-2 py-1 text-sm font-semibold tabular-nums',
    healing ? 'bg-primary/10 text-primary' : 'bg-damage/15 text-damage',
  )
  const label = `${name} ${healing ? 'healing' : 'damage'}, ${formula}`
  const hover = clsx(
    'transition-colors',
    healing ? 'hover:bg-primary/20' : 'hover:bg-damage/25',
  )
  if (onUse && target) {
    return (
      <RollButton
        target={target}
        onRoll={() => onUse()}
        onMenu={(anchor, at, point) =>
          damage.onMenu(anchor, at, point, { verb, onUse })
        }
        label={label}
        className={clsx(chip, hover)}
      >
        {formula}
      </RollButton>
    )
  }
  if (onUse) {
    return (
      <button
        type='button'
        aria-label={label}
        title={formula}
        onClick={() => onUse()}
        className={clsx(chip, hover)}
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
  return (
    <RollButton
      target={target}
      {...damage}
      label={label}
      className={clsx(chip, hover)}
    >
      {formula}
    </RollButton>
  )
}

/**
 * What using an action in the game is called: casting, for a spell, or one an item casts, but for
 * one of a spell's activities used after it's cast, without spending a slot, such as Spirit
 * Guardians' save each turn.
 */
export function verbOf(action: SheetAction): 'Cast' | 'Use' {
  return (action.type === 'spell' && action.consumesSlot !== false) ||
    !!action.cast
    ? 'Cast'
    : 'Use'
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
  // An item listed for a spell it casts opens to the spell.
  const { cast } = action
  const spell = cast?.text ? cast : undefined
  const meta =
    look.meta ??
    (spell
      ? joinParts(
          spell.level === 0 ? 'Cantrip' : `Level ${spell.level} spell`,
          spell.concentration && 'Concentration',
          `Cast from ${action.castFrom?.name ?? action.name}`,
        )
      : joinParts(kindOf(action), !action.identified && 'Not identified'))
  const text = spell?.text ?? action.text
  return (
    <>
      {meta && <p className='text-xs text-text-secondary'>{meta}</p>}
      <Facts action={action} pools={pools} more={look.facts} />
      {text && <SheetText characterId={characterId} hash={text} />}
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
    label: `${actionTitle(action)} ${healing ? 'healing' : 'damage'}`,
    parts,
    healing,
    formula: action.damage.map(part => part.formula).join(' + '),
    ...(action.attackId && {
      source: { item: action.id, activity: action.attackId },
    }),
  }
}
