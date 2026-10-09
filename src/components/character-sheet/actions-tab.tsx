'use client'

import { useId, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  ChevronDown,
  Columns2,
  Rows3,
  Sparkles,
  Table2,
  type LucideIcon,
} from 'lucide-react'
import {
  ActionDetails,
  ActionEntry,
  actionTitle,
  activityDetail,
  AttackChip,
  attackSource,
  castNote,
  Chevron,
  DamageChip,
  FormulaChip,
  dimmed,
  FALLBACKS,
  firstInFoundry,
  moreNote,
  otherActivities,
  ownUses,
  SaveChip,
  useActionRows,
  UseChip,
  verbOf,
  viewOf,
  type ActionRows,
  type TableDamage,
} from './action-entry'
import { FavoriteStar, useFavorite } from './favorite-mark'
import { EntryIcon, joinParts } from './sheet-entry'
import { SheetHeading } from './sheet-heading'
import { SpellSlots } from './spell-slots'
import { UsesLeft } from './uses-left'
import { useStoredChoice, useStoredSet } from '@/hooks/use-stored'
import { useWidth } from '@/hooks/use-width'
import { groupActions, type ActionGroup } from '@/utils/action-groups'
import type {
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from '@/hooks/use-sheet-roller'
import type {
  SheetAction,
  SheetActionSection,
  SheetActivity,
} from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'
import type { DamageModifiers } from '@/utils/damage-modifiers'

type Props = {
  characterId: string
  sheet: TableSheet
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Rolls an activity's own formula, such as a light's radius. */
  onRollFormula?: (roll: SheetFormulaRoll) => void
  /** Uses a spell or feature in the Gamemaster's game, while it takes them. */
  onUse?: (action: SheetAction, modifiers?: DamageModifiers) => void
  /** What the game does with damage, while it takes it. */
  tableDamage?: TableDamage
  /** Shown first, such as the character's favorites. */
  favorites?: ReactNode
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
  onRollFormula,
  onUse,
  tableDamage,
  favorites,
}: Readonly<Props>) {
  const { rows, dialogs } = useActionRows({
    characterId,
    spellbook: sheet.spells,
    onRoll,
    onRollDamage,
    onRollFormula,
    onUse,
    tableDamage,
  })
  const root = useRef<HTMLDivElement>(null)
  const width = useWidth(root)
  const offered = LAYOUTS.filter(({ from }) => width >= from)
  const [chosen, choose] = useStoredChoice(LAYOUT_KEY, LAYOUT_IDS, 'list')
  const layout = offered.some(({ id }) => id === chosen) ? chosen : 'list'
  // The groups the player closed, for this character.
  const [closed, toggleGroup] = useStoredSet(`${CLOSED_KEY}:${characterId}`)
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
      {favorites}
      {offered.length > 1 && sections.length > 0 && (
        <LayoutPicker layouts={offered} layout={layout} onChange={choose} />
      )}
      {layout === 'columns' ? <Columns sections={shown} /> : shown}

      {sections.length === 0 && (
        <p className='text-sm text-text-secondary'>No actions to show yet.</p>
      )}

      {dialogs}
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
  rows: ActionRows
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
          section={section.id}
        />
      ) : (
        <ActionList
          groups={section.groups}
          rows={rows}
          state={groups}
          section={section.id}
        />
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
  section,
}: Readonly<{
  groups: ActionGroup[]
  rows: ActionRows
  state: Groups
  /** The section's id: the kind of action its actions take, which goes without saying. */
  section: string
}>) {
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
                <ActionEntry
                  key={action.id}
                  action={action}
                  rows={rows}
                  section={section}
                />
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
  section,
}: Readonly<{
  groups: ActionGroup[]
  labelledBy: string
  rows: ActionRows
  state: Groups
  section: string
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
                  section={section}
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
 * An action in a table: its name, opening to the rest below, and its range, what it rolls and its
 * uses, each in its column; once it's open, each of its other activities, in a row of its own, and
 * all there is to know of it.
 */
function ActionTableRow({
  action,
  rows,
  hidden,
  section,
}: Readonly<{
  action: SheetAction
  rows: ActionRows
  hidden: boolean
  section: string
}>) {
  const [open, setOpen] = useState(false)
  const body = useId()
  const favorite = useFavorite(`item:${action.id}`)
  const view = viewOf(action, rows.spellbook, rows.use)
  const { toHit, save, uses } = action
  const others = otherActivities(action)
  // Its range has a column of its own.
  const detail = joinParts(
    action.activityName,
    castNote(action.cast),
    view.spent && 'No slots left',
    firstInFoundry(action) && 'Used in Foundry',
    !open && moreNote(others.length),
  )
  const name = actionTitle(action)

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
              (view.spent || action.cast?.short) && 'opacity-60',
            )}
          >
            <EntryIcon
              src={action.img}
              fallback={FALLBACKS[action.type] ?? Sparkles}
            />
            <span className='min-w-0 flex-1'>
              <span className='flex items-center gap-1'>
                <span className='truncate font-medium'>{action.name}</span>
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
              <AttackChip
                name={name}
                toHit={toHit}
                d20={rows.d20}
                source={attackSource(action)}
              />
            )}
            {save && (
              <SaveChip name={name} save={save} onUse={view.uses.save} />
            )}
            {action.rollFormula && (
              <FormulaChip action={action} onRoll={rows.formula} />
            )}
            {view.uses.chip && (
              <UseChip action={action} onUse={view.uses.chip} />
            )}
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
                onUse={view.uses.damage}
                verb={verbOf(action)}
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
      {/* Its other activities, folded away with the rest until it's opened. */}
      {open &&
        others.map(other => (
          <ActivityTableRow
            key={other.activity.id}
            activity={other.activity}
            action={other.action}
            parent={action}
            rows={rows}
            hidden={hidden}
            section={section}
          />
        ))}
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

/**
 * One of an action's other activities in a table, beneath it, such as Hex's Bonus Hex Damage: its
 * name, and its range, what it rolls and its uses, each in its column.
 */
function ActivityTableRow({
  activity,
  action,
  parent,
  rows,
  hidden,
  section,
}: Readonly<{
  activity: SheetActivity
  /** The activity as an action of its own. */
  action: SheetAction
  parent: SheetAction
  rows: ActionRows
  hidden: boolean
  section: string
}>) {
  const view = viewOf(action, rows.spellbook, rows.use)
  const { name, toHit, save } = action
  const uses = ownUses(activity, parent)
  // Its range has a column of its own.
  const detail = joinParts(
    ...activityDetail(activity, parent, view.spent, { section, range: false }),
  )
  return (
    <tr hidden={hidden}>
      <td className='w-full max-w-0 py-0.5 pr-2 pl-[3.375rem]'>
        <span
          className={clsx(
            'block border-l border-border py-0.5 pl-2.5',
            (view.spent || dimmed(activity)) && 'opacity-60',
          )}
        >
          <span className='block truncate'>{activity.name}</span>
          {detail && (
            <span className='block truncate text-xs text-text-secondary'>
              {detail}
            </span>
          )}
        </span>
      </td>
      <td className='px-2 text-xs whitespace-nowrap text-text-secondary'>
        {action.range && action.range !== parent.range && (
          <span className='block max-w-32 truncate' title={action.range}>
            {action.range}
          </span>
        )}
      </td>
      <td className='px-2'>
        <span className='flex gap-1'>
          {toHit !== null && (
            <AttackChip
              name={name}
              toHit={toHit}
              d20={rows.d20}
              source={attackSource(action)}
            />
          )}
          {save && <SaveChip name={name} save={save} onUse={view.uses.save} />}
          {action.rollFormula && (
            <FormulaChip action={action} onRoll={rows.formula} />
          )}
          {view.uses.chip && <UseChip action={action} onUse={view.uses.chip} />}
        </span>
      </td>
      <td className='px-2'>
        {view.formula && (
          <span className='flex'>
            <DamageChip
              name={name}
              formula={view.formula}
              healing={view.healing}
              target={view.target}
              damage={rows.damage}
              onUse={view.uses.damage}
              verb={verbOf(action)}
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
  )
}
