'use client'

import { useId, useState } from 'react'
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
import { UsesLeft } from './features-tab'
import { RollButton } from './roll-button'
import { RollMenu, type MenuPoint } from './roll-menu'
import { EntryIcon, joinParts } from './sheet-entry'
import { SheetHeading } from './sheet-heading'
import { SheetText } from './sheet-text'
import { formatModifier } from '@/utils/format-modifier'
import { parseExtraTerms } from '@/utils/roll-modifiers'
import type { SheetDamageRoll, SheetRoll } from '@/hooks/use-sheet-roller'
import type { SheetAction } from '@/types/sending-stone'
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
 * The bonus rolls the attack and the damage its damage, as the Character tab rolls checks; a
 * right-click or long-press offers advantage and the like, or a critical hit's damage. Each action
 * opens to its description.
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
  const roll = (target: DamageTarget, critical = false) =>
    onRollDamage({
      label: target.label,
      parts: target.parts,
      healing: target.healing,
      critical,
    })
  const damage: DamageActions = {
    onRoll: target => roll(target),
    onMenu: (anchor, target, point) => setMenu({ anchor, target, point }),
  }

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:px-8 md:py-6'>
      {sheet.actions.map((section, index) => (
        <section
          key={section.id}
          // A section the player named in Tidy 5e may have any name, so it isn't the id.
          aria-labelledby={`actions-${index}`}
          className='flex flex-col gap-2'
        >
          <SheetHeading id={`actions-${index}`}>{section.label}</SheetHeading>
          <ul className='rounded-2xl border border-border bg-card p-1.5'>
            {section.actions.map(action => (
              <ActionEntry
                key={action.id}
                characterId={characterId}
                action={action}
                d20={d20}
                damage={damage}
              />
            ))}
          </ul>
        </section>
      ))}

      {sheet.actions.length === 0 && (
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

/**
 * An action: its name, how it's activated and its reach, opening to the rest; and beside it what
 * it rolls, each a button of its own.
 */
function ActionEntry({
  characterId,
  action,
  d20,
  damage,
}: Readonly<{
  characterId: string
  action: SheetAction
  d20: RollActions
  damage: DamageActions
}>) {
  const [open, setOpen] = useState(false)
  const body = useId()
  const { name, toHit, save, uses } = action
  const healing =
    action.damage.length > 0 && action.damage.every(part => part.healing)
  const formula = action.damage.map(part => part.formula).join(' + ')
  const target = damageTarget(action, healing)
  const types = [
    ...new Set(action.damage.flatMap(part => (part.type ? [part.type] : []))),
  ]
  const detail = joinParts(action.activation, action.range, types.join(', '))
  const meta = joinParts(kindOf(action), !action.identified && 'Not identified')

  return (
    <li>
      <div className='flex items-center gap-2 rounded-xl py-1.5 pr-1.5 pl-1'>
        <button
          type='button'
          aria-expanded={open}
          aria-controls={open ? body : undefined}
          onClick={() => setOpen(!open)}
          className='flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-0.5 text-left transition-colors hover:bg-primary/5'
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
              <ChevronDown
                aria-hidden
                className={clsx(
                  'size-3.5 shrink-0 text-text-secondary transition-transform',
                  open && 'rotate-180',
                )}
              />
            </span>
            {detail && (
              <span className='block truncate text-xs text-text-secondary'>
                {detail}
              </span>
            )}
          </span>
        </button>
        {uses && (
          // On a phone, beside what the action rolls, its uses would leave its name too little
          // room; they're listed when it opens.
          <span
            className={clsx(
              'shrink-0',
              (toHit !== null || save || formula) && 'hidden @md:inline',
            )}
          >
            <UsesLeft uses={uses} />
          </span>
        )}
        {toHit !== null && (
          <RollButton
            target={{ label: `${name} attack`, modifier: toHit, mode: 0 }}
            {...d20}
            label={`${name} attack, ${formatModifier(toHit)}`}
            className='shrink-0 rounded-lg bg-attack/15 px-2 py-1 text-sm font-bold text-attack tabular-nums transition-colors hover:bg-attack/25'
          >
            {formatModifier(toHit)}
          </RollButton>
        )}
        {save && (
          <span
            className='shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold tabular-nums'
            title={`${save.ability.toUpperCase()} saving throw`}
          >
            <span className='text-text-secondary uppercase'>
              {save.ability}
            </span>
            {save.dc !== null && ` ${save.dc}`}
          </span>
        )}
        {formula && (
          <DamageChip
            name={name}
            formula={formula}
            healing={healing}
            target={target}
            damage={damage}
          />
        )}
      </div>
      {open && (
        <div
          id={body}
          className='flex flex-col gap-2 px-2.5 pt-1 pb-3 pl-[3.25rem]'
        >
          {meta && <p className='text-xs text-text-secondary'>{meta}</p>}
          <Facts action={action} />
          {action.text && (
            <SheetText characterId={characterId} hash={action.text} />
          )}
        </div>
      )}
    </li>
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

/** All there is to know of how an action is used, each with its label. */
function Facts({ action }: Readonly<{ action: SheetAction }>) {
  const { save, uses } = action
  const healing =
    action.damage.length > 0 && action.damage.every(part => part.healing)
  const facts: [string, string | null | undefined][] = [
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
  ]
  const shown = facts.filter((fact): fact is [string, string] =>
    Boolean(fact[1]),
  )
  if (shown.length === 0) return
  return (
    <dl className='grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs'>
      {shown.map(([label, value]) => (
        <div key={label} className='contents'>
          <dt className='font-semibold text-text-secondary'>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
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
