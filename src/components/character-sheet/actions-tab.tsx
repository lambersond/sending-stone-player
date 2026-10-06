'use client'

import { useId, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  ChevronDown,
  Columns2,
  FlaskConical,
  Rows3,
  Shield,
  Sparkles,
  Sword,
  Table2,
  Wand,
  type LucideIcon,
} from 'lucide-react'
import { useD20Rolls, type RollActions } from './d20-rolls'
import { UsesLeft } from './features-tab'
import { RollButton } from './roll-button'
import { RollMenu, type MenuPoint } from './roll-menu'
import { EntryIcon, joinParts } from './sheet-entry'
import { SheetHeading } from './sheet-heading'
import { SheetText } from './sheet-text'
import { SpellSlots } from './spell-slots'
import { useStoredChoice, useStoredSet } from '@/hooks/use-stored'
import { useWidth } from '@/hooks/use-width'
import {
  groupActions,
  outOfSlots,
  poolName,
  slotPools,
  type ActionGroup,
  type SlotPool,
} from '@/utils/action-groups'
import { formatModifier } from '@/utils/format-modifier'
import { parseExtraTerms } from '@/utils/roll-modifiers'
import type { SheetDamageRoll, SheetRoll } from '@/hooks/use-sheet-roller'
import type {
  SheetAction,
  SheetActionSection,
  SheetSpellSection,
} from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

type Props = {
  characterId: string
  sheet: TableSheet
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
}

/** An action's damage or healing, ready to roll, with its formula as dnd5e shows it. */
type DamageTarget = SheetDamageRoll & { formula: string }

type DamageActions = {
  onRoll: (target: DamageTarget) => void
  onMenu: (anchor: HTMLElement, target: DamageTarget, point?: MenuPoint) => void
}

/** What every row needs: the character, its spellbook, and what rolling does. */
type Rows = {
  characterId: string
  spellbook: SheetSpellSection[]
  d20: RollActions
  damage: DamageActions
}

/** A section, with its heading's id and its actions in their groups. */
type GroupedSection = SheetActionSection & {
  headingId: string
  groups: ActionGroup[]
}

/** How the tab lays out its actions: in a list, in columns side by side, or in a table. */
type Layout = 'list' | 'columns' | 'table'

/**
 * The layouts, and the width of the sheet, in pixels, each needs: a table from about a small
 * tablet's, and columns from where two fit side by side, each as wide as a phone's list.
 */
const LAYOUTS: { id: Layout; label: string; icon: LucideIcon; from: number }[] =
  [
    { id: 'list', label: 'List', icon: Rows3, from: 0 },
    { id: 'columns', label: 'Columns', icon: Columns2, from: 720 },
    { id: 'table', label: 'Table', icon: Table2, from: 576 },
  ]
const LAYOUT_IDS = LAYOUTS.map(({ id }) => id)

/** Where this browser keeps the layout chosen. */
const LAYOUT_KEY = 'sending-stone:actions-layout'

/** Where this browser keeps the groups closed, after which the character's id. */
const CLOSED_KEY = 'sending-stone:actions-closed'

/** Icons for actions without one of their own, by the item's type. */
const FALLBACKS: Record<string, LucideIcon> = {
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
 * What the character can do in a fight, as Tidy 5e's Actions tab lists it: by how each is
 * activated, with its bonus to hit, the saving throw it calls for, and its damage or healing.
 * Within each section, actions are grouped as Tidy 5e groups a sheet by where things come from:
 * what the character carries, by kind, such as weapons and consumables; spells as the spellbook
 * groups them, such as by level, with their slots; spells cast from an item, under its name; and
 * features. Each group closes, and stays closed for the character. The bonus rolls the attack
 * and the damage its damage, as the Character tab rolls checks; a right-click or long-press offers
 * advantage and the like, or a critical hit's damage. Each action opens to its description, and a
 * spell to the slots it can be cast with.
 *
 * On a phone the actions are listed. On a tablet or wider, the player may lay them out in a table,
 * or in columns, with Actions beside the rest, where the sheet is wide enough for each, and this
 * browser remembers which. Where the layout chosen doesn't fit, they're listed.
 */
export function ActionsTab({
  characterId,
  sheet,
  onRoll,
  onRollDamage,
}: Readonly<Props>) {
  const { actions: d20, dialogs } = useD20Rolls(onRoll)
  const [menu, setMenu] = useState<{
    anchor: HTMLElement
    target: DamageTarget
    point?: MenuPoint
  }>()
  const root = useRef<HTMLDivElement>(null)
  const width = useWidth(root)
  const offered = LAYOUTS.filter(({ from }) => width >= from)
  const [chosen, choose] = useStoredChoice(LAYOUT_KEY, LAYOUT_IDS, 'list')
  const layout = offered.some(({ id }) => id === chosen) ? chosen : 'list'
  // The groups the player closed, for this character.
  const [closed, toggleGroup] = useStoredSet(`${CLOSED_KEY}:${characterId}`)
  const roll = (target: DamageTarget, critical = false) =>
    onRollDamage({
      label: target.label,
      parts: target.parts,
      healing: target.healing,
      critical,
    })
  const rows: Rows = {
    characterId,
    spellbook: sheet.spells,
    d20,
    damage: {
      onRoll: target => roll(target),
      onMenu: (anchor, target, point) => setMenu({ anchor, target, point }),
    },
  }
  const sections = sheet.actions.map((section, index): GroupedSection => ({
    ...section,
    // A section the player named in Tidy 5e may have any name, so it isn't the id.
    headingId: `actions-${index}`,
    groups: groupActions(section.actions, sheet.spells),
  }))
  const shown = sections.map(section => (
    <ActionSection
      key={section.id}
      section={section}
      layout={layout}
      rows={rows}
      closed={closed}
      onToggle={toggleGroup}
    />
  ))

  return (
    <div
      ref={root}
      className={clsx(
        'mx-auto flex w-full flex-col gap-6 p-4 md:px-8 md:py-6',
        layout === 'columns' ? 'max-w-7xl' : 'max-w-5xl',
      )}
    >
      {offered.length > 1 && sections.length > 0 && (
        <LayoutPicker layouts={offered} layout={layout} onChange={choose} />
      )}
      {layout === 'columns' ? <Columns sections={shown} /> : shown}

      {sections.length === 0 && (
        <p className='text-sm text-text-secondary'>No actions to show yet.</p>
      )}

      {dialogs}
      {menu && (
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
      )}
    </div>
  )
}

/** The layouts to choose from, each a button pressed while it's the one chosen. */
function LayoutPicker({
  layouts,
  layout,
  onChange,
}: Readonly<{
  layouts: typeof LAYOUTS
  layout: Layout
  onChange: (layout: Layout) => void
}>) {
  return (
    <div
      role='group'
      aria-label='Layout'
      className='flex self-end rounded-lg border border-border bg-card p-0.5'
    >
      {layouts.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type='button'
          aria-pressed={layout === id}
          onClick={() => onChange(id)}
          className={clsx(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
            layout === id
              ? 'bg-primary/10 text-primary'
              : 'text-text-secondary hover:bg-primary/5 hover:text-text-primary',
          )}
        >
          <Icon aria-hidden className='size-4' />
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * Sections side by side: the first, usually Actions, in a column of its own and the rest beside
 * it, or on a wide screen, the second, usually Bonus Actions, in a third column of its own too.
 * Each section stays in its column as its actions open and close.
 */
function Columns({ sections }: Readonly<{ sections: ReactNode[] }>) {
  const [first, second, ...rest] = sections
  return (
    <div className='grid grid-cols-2 items-start gap-6 @6xl:grid-cols-3'>
      <div className='flex min-w-0 flex-col gap-6'>{first}</div>
      {second && (
        <div className='flex min-w-0 flex-col gap-6 @6xl:contents'>
          {second}
          {rest.length > 0 && (
            <div className='flex min-w-0 flex-col gap-6'>{rest}</div>
          )}
        </div>
      )}
    </div>
  )
}

/** Whether each group is open, and what opens or closes it. */
type Groups = {
  isOpen: (group: ActionGroup) => boolean
  toggle: (group: ActionGroup) => void
}

/** A section of actions, such as Bonus Actions, in a list or a table. */
function ActionSection({
  section,
  layout,
  rows,
  closed,
  onToggle,
}: Readonly<{
  section: GroupedSection
  layout: Layout
  rows: Rows
  closed: ReadonlySet<string>
  onToggle: (name: string) => void
}>) {
  const name = (group: ActionGroup) => `${section.id}/${group.id}`
  const groups: Groups = {
    isOpen: group => !closed.has(name(group)),
    toggle: group => onToggle(name(group)),
  }
  return (
    <section
      aria-labelledby={section.headingId}
      className='flex flex-col gap-2'
    >
      <SheetHeading id={section.headingId}>{section.label}</SheetHeading>
      {layout === 'table' ? (
        <ActionTable
          groups={section.groups}
          labelledBy={section.headingId}
          rows={rows}
          state={groups}
        />
      ) : (
        <ActionList groups={section.groups} rows={rows} state={groups} />
      )}
    </section>
  )
}

/**
 * A section's actions listed in their groups, each under its name, which closes the group or
 * opens it again.
 */
function ActionList({
  groups,
  rows,
  state,
}: Readonly<{ groups: ActionGroup[]; rows: Rows; state: Groups }>) {
  const prefix = useId()
  return (
    // A container, so that each row fits the column it's in.
    <div className='@container rounded-2xl border border-border bg-card p-1.5'>
      {groups.map((group, index) => {
        const open = state.isOpen(group)
        return (
          <div
            key={group.id}
            role='group'
            aria-labelledby={`${prefix}-${group.id}`}
            className={clsx(index > 0 && 'mt-1 border-t border-border pt-1')}
          >
            <h3>
              <GroupToggle
                group={group}
                open={open}
                labelId={`${prefix}-${group.id}`}
                controls={`${prefix}-${group.id}-actions`}
                onToggle={() => state.toggle(group)}
              />
            </h3>
            {/* Closed, its actions are hidden but kept, each as open as it was. */}
            <ul id={`${prefix}-${group.id}-actions`} hidden={!open}>
              {group.actions.map(action => (
                <ActionEntry key={action.id} action={action} rows={rows} />
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/**
 * A group's name, with how many actions are in it and the spell slots they're cast with, if they
 * use any, as a button that closes the group or opens it again.
 */
function GroupToggle({
  group,
  open,
  labelId,
  controls,
  onToggle,
}: Readonly<{
  group: ActionGroup
  open: boolean
  labelId: string
  controls: string
  onToggle: () => void
}>) {
  const count = group.actions.length
  return (
    <button
      type='button'
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className='flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-primary/5'
    >
      <ChevronDown
        aria-hidden
        className={clsx(
          'size-3.5 shrink-0 text-text-secondary transition-transform',
          !open && '-rotate-90',
        )}
      />
      <span
        id={labelId}
        className='min-w-0 truncate text-xs font-semibold text-text-secondary'
      >
        {group.label}
      </span>
      <span className='shrink-0 text-xs text-text-secondary tabular-nums opacity-70'>
        <span aria-hidden>{count}</span>
        <span className='sr-only'>
          , {count === 1 ? '1 action' : `${count} actions`}
        </span>
      </span>
      {group.slots && (
        <span className='ml-auto pl-2'>
          <SpellSlots value={group.slots.value} max={group.slots.max} />
        </span>
      )}
    </button>
  )
}

/**
 * A section's actions in a table, in their groups, with what each rolls lined up in columns: its
 * range, its bonus to hit or saving throw, its damage or healing, and its uses.
 */
function ActionTable({
  groups,
  labelledBy,
  rows,
  state,
}: Readonly<{
  groups: ActionGroup[]
  labelledBy: string
  rows: Rows
  state: Groups
}>) {
  const prefix = useId()
  const head = 'px-2 py-2 text-left font-semibold whitespace-nowrap'
  return (
    <div className='overflow-x-auto rounded-2xl border border-border bg-card'>
      <table aria-labelledby={labelledBy} className='w-full text-sm'>
        <thead className='text-[11px] tracking-wider text-text-secondary uppercase'>
          <tr>
            <th scope='col' className={clsx(head, 'pl-4')}>
              Name
            </th>
            <th scope='col' className={head}>
              Range
            </th>
            <th scope='col' className={head}>
              Hit / DC
            </th>
            <th scope='col' className={head}>
              Damage
            </th>
            <th scope='col' className={clsx(head, 'pr-4 text-right')}>
              Uses
            </th>
          </tr>
        </thead>
        {groups.map(group => {
          const open = state.isOpen(group)
          return (
            <tbody
              key={group.id}
              id={`${prefix}-${group.id}`}
              className='border-t border-border'
            >
              <tr>
                <th
                  scope='rowgroup'
                  colSpan={5}
                  className='px-2.5 pt-1.5 pb-0.5 text-left font-normal'
                >
                  <GroupToggle
                    group={group}
                    open={open}
                    labelId={`${prefix}-${group.id}-name`}
                    controls={`${prefix}-${group.id}`}
                    onToggle={() => state.toggle(group)}
                  />
                </th>
              </tr>
              {group.actions.map(action => (
                <ActionTableRow
                  key={action.id}
                  action={action}
                  rows={rows}
                  hidden={!open}
                />
              ))}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

/**
 * An action as it's shown, worked out once for a row: its damage or healing and their kinds, and
 * for a spell cast with slots, which it can be cast with and whether any are left.
 */
function viewOf(action: SheetAction, spellbook: SheetSpellSection[]) {
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
 * beside it what it rolls, each a button of its own.
 */
function ActionEntry({
  action,
  rows,
}: Readonly<{ action: SheetAction; rows: Rows }>) {
  const [open, setOpen] = useState(false)
  const body = useId()
  const view = viewOf(action, rows.spellbook)
  const { name, toHit, save, uses } = action
  const detail = joinParts(
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
          <AttackChip name={name} toHit={toHit} d20={rows.d20} />
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

/**
 * An action in a table: its name, opening to the rest in a row of its own below, and its range,
 * what it rolls and its uses, each in its column.
 */
function ActionTableRow({
  action,
  rows,
  hidden,
}: Readonly<{ action: SheetAction; rows: Rows; hidden: boolean }>) {
  const [open, setOpen] = useState(false)
  const body = useId()
  const view = viewOf(action, rows.spellbook)
  const { name, toHit, save, uses } = action

  return (
    <>
      {/* In a closed group, it's hidden but kept, as open as it was. */}
      <tr hidden={hidden}>
        {/* As wide as the table leaves it, and no wider, so that a long name is cut short. */}
        <td className='w-full max-w-0 py-0.5 pr-2 pl-1.5'>
          <button
            type='button'
            aria-expanded={open}
            aria-controls={open ? body : undefined}
            onClick={() => setOpen(!open)}
            className={clsx(
              'flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-primary/5',
              view.spent && 'opacity-60',
            )}
          >
            <EntryIcon
              src={action.img}
              fallback={FALLBACKS[action.type] ?? Sparkles}
            />
            <span className='min-w-0 flex-1'>
              <span className='flex items-center gap-1'>
                <span className='truncate font-medium'>{name}</span>
                <Chevron open={open} />
              </span>
              {view.spent && (
                <span className='block truncate text-xs text-text-secondary'>
                  No slots left
                </span>
              )}
            </span>
          </button>
        </td>
        <td className='px-2 text-xs whitespace-nowrap text-text-secondary'>
          {action.range && (
            <span className='block max-w-32 truncate' title={action.range}>
              {action.range}
            </span>
          )}
        </td>
        <td className='px-2'>
          <span className='flex gap-1'>
            {toHit !== null && (
              <AttackChip name={name} toHit={toHit} d20={rows.d20} />
            )}
            {save && <SaveChip save={save} />}
          </span>
        </td>
        {/* In a cell of its own, each chip is laid out as it is in a list's row, not as a
            line of text that may wrap. */}
        <td className='px-2'>
          {view.formula && (
            <span className='flex'>
              <DamageChip
                name={name}
                formula={view.formula}
                healing={view.healing}
                target={view.target}
                damage={rows.damage}
              />
            </span>
          )}
        </td>
        <td className='py-0.5 pr-4 pl-2'>
          {uses && (
            <span className='flex justify-end'>
              <UsesLeft uses={uses} />
            </span>
          )}
        </td>
      </tr>
      {open && (
        <tr id={body} hidden={hidden}>
          <td colSpan={5} className='px-4 pt-1 pb-3 pl-[3.375rem]'>
            <div className='flex flex-col gap-2'>
              <ActionDetails
                action={action}
                pools={view.pools}
                characterId={rows.characterId}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/** The mark that an action opens, turned while it's open. */
function Chevron({ open }: Readonly<{ open: boolean }>) {
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

/** An attack's bonus, as a button that rolls it, or offers advantage and the like. */
function AttackChip({
  name,
  toHit,
  d20,
}: Readonly<{ name: string; toHit: number; d20: RollActions }>) {
  return (
    <RollButton
      target={{ label: `${name} attack`, modifier: toHit, mode: 0 }}
      {...d20}
      label={`${name} attack, ${formatModifier(toHit)}`}
      className='shrink-0 rounded-lg bg-attack/15 px-2 py-1 text-sm font-bold text-attack tabular-nums transition-colors hover:bg-attack/25'
    >
      {formatModifier(toHit)}
    </RollButton>
  )
}

/** The saving throw an action calls for, such as DEX 14. */
function SaveChip({
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
function DamageChip({
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
function ActionDetails({
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
  }
}
