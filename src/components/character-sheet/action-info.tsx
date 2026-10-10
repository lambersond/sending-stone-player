'use client'

import { useId, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import {
  closingAfter,
  DescriptionLinks,
  spellOrigin,
  useDescriptionActions,
  type DescriptionOrigin,
} from './description-actions'
import { joinParts } from './sheet-entry'
import { SheetText } from './sheet-text'
import { Modal } from '@/components/modal'
import { ordinal, poolName, type SlotPool } from '@/utils/action-groups'
import { formatModifier } from '@/utils/format-modifier'
import { itemSpellOf } from '@/utils/sheet-actions'
import type {
  SheetAction,
  SheetActivity,
  SheetCast,
  SheetCastFrom,
  SheetSpell,
  SheetSpellSection,
} from '@/types/sending-stone'

/*
 * All there is to know of an action: its facts, as it shows them once it's open; and, for one of an
 * item's activities folded beneath it, such as a staff's Starry Wisp, a dialog to read them in,
 * with the spell's school, components and description where it casts one, as the Spells tab shows
 * the spell under the item.
 */

/** One of an item's activities folded beneath it, to be read about. */
export type ActivityInfo = {
  activity: SheetActivity
  /** The activity as an action of its own. */
  action: SheetAction
  /** The item it's one of, as an action. */
  item: SheetAction
  /** Whether it's used only in Foundry, as the app neither rolls nor uses it. */
  foundry: boolean
}

/**
 * What there is to read of one of an item's activities folded beneath it, in a dialog, with no
 * roll buttons of its own, which stay on its row: its spell's, where it casts one the Spells tab
 * lists under the item, or else what its row has. Its description's links act as they do on the
 * sheet, and once one throws dice, or asks the table, the dialog closes, for the dice and the tray
 * behind it to be seen. `show` opens it; the dialog is in `dialog`, to be put on the page.
 */
export function useActionInfo(
  characterId: string,
  spellbook: SheetSpellSection[],
): { show: (info: ActivityInfo) => void; dialog: ReactNode } {
  const [info, setInfo] = useState<ActivityInfo>()
  const actions = useDescriptionActions()
  const spell = info && spellOf(info, spellbook)
  const close = () => setInfo(undefined)
  return {
    show: setInfo,
    dialog: (
      <Modal
        open={!!info}
        onClose={close}
        title={spell?.name ?? info?.activity.name ?? ''}
        subtitle={
          info && joinParts(spell && spellKind(spell), `From ${info.item.name}`)
        }
      >
        {info && (
          <DescriptionLinks actions={actions && closingAfter(actions, close)}>
            <ActivityAbout
              characterId={characterId}
              info={info}
              spell={spell}
            />
          </DescriptionLinks>
        )}
      </Modal>
    ),
  }
}

/**
 * The spell an activity casts, as the Spells tab lists it under the activity's item: the copy the
 * module names, from 0.17.0; or else where it can be told which.
 */
function spellOf(
  { activity, item }: ActivityInfo,
  spellbook: SheetSpellSection[],
): SheetSpell | undefined {
  const named =
    typeof activity.spellId === 'string'
      ? spellbook
          .flatMap(section => section.spells)
          .find(spell => spell.id === activity.spellId)
      : undefined
  if (named) return named
  return itemSpellOf(spellbook, item.id, {
    name: activity.name,
    text: activity.cast?.text,
    casts: activity.type === 'cast',
    resolved: !!activity.cast,
  })
}

/**
 * All there is to read of one of an item's activities: its marks, such as for concentration or no
 * charges left; its facts, a spell's among them where it casts one, with what a reaction answers
 * and how long it lasts; and the spell's description, or its own, or else the item's, under the
 * item's name.
 */
function ActivityAbout({
  characterId,
  info,
  spell,
}: Readonly<{
  characterId: string
  info: ActivityInfo
  spell?: SheetSpell
}>) {
  const headingId = useId()
  const { activity, action, item, foundry } = info
  const { cast } = activity
  const unusable =
    spell?.castFrom?.usable === false ? spell.castFrom : undefined
  const marks = [
    // Its own, or its spell's, never the item's: that's its first activity's, as the module has
    // it, and only a spell takes concentration.
    (cast?.concentration ?? spell?.concentration) && 'Concentration',
    cast?.short && 'No charges left',
    unusable && whyNot(unusable),
    foundry && 'Used in Foundry',
  ].filter(mark => typeof mark === 'string')
  const facts = [...ownFacts(activity, spell), ...spellFacts(spell, cast)]
  const formula = action.rollFormula
  if (formula) {
    facts.push({
      label: 'Formula',
      value: formula.name
        ? `${formula.formula} (${formula.name})`
        : formula.formula,
    })
  }
  const text = spell?.text ?? cast?.text ?? textOf(activity)
  // A spell's description is the spell's, cast from the item; an activity's own is the item's.
  const origin: DescriptionOrigin =
    spell || cast?.text
      ? {
          name: spellOrigin({
            name: spell?.name ?? activity.name,
            castFrom: item,
          }),
          item: item.id,
        }
      : { name: action.name, item: item.id }
  return (
    <div className='flex flex-col gap-3'>
      {marks.length > 0 && (
        <ul className='flex flex-wrap gap-1'>
          {marks.map(mark => (
            <li
              key={mark}
              className='rounded border border-border px-1.5 text-xs leading-5 font-semibold text-text-secondary'
            >
              {mark}
            </li>
          ))}
        </ul>
      )}
      <Facts
        action={spell ? castAs(action, spell) : action}
        casting={!!spell || activity.type === 'cast'}
        more={facts}
      />
      {text && (
        <SheetText characterId={characterId} hash={text} origin={origin} />
      )}
      {/* An activity that casts no spell known has no description of its own: its item's is
          what there is to read of it. */}
      {!text && item.text && (
        <section aria-labelledby={headingId} className='flex flex-col gap-1'>
          <h3
            id={headingId}
            className='text-xs font-semibold tracking-wider text-text-secondary uppercase'
          >
            {item.name}
          </h3>
          <SheetText
            characterId={characterId}
            hash={item.text}
            origin={{ name: item.name, item: item.id }}
          />
        </section>
      )}
    </div>
  )
}

/**
 * An activity's own facts, from module 0.17.0: what a reaction is taken in answer to, and how long
 * what it does lasts, where its spell doesn't say.
 */
function ownFacts(
  activity: SheetActivity,
  spell: SheetSpell | undefined,
): { label: string; value: string }[] {
  const { trigger, duration } = activity
  return [
    ...(typeof trigger === 'string' && trigger
      ? [{ label: 'Trigger', value: trigger }]
      : []),
    ...(typeof duration === 'string' && duration && !spell?.duration
      ? [{ label: 'Duration', value: duration }]
      : []),
  ]
}

/** An activity's own description's hash, which dnd5e 6 gives it; none before. */
function textOf(activity: SheetActivity): string | undefined {
  return typeof activity.text === 'string' && activity.text
    ? activity.text
    : undefined
}

/**
 * All there is to know of how an action is used, each with its label, and for a spell cast with
 * slots, the slots it can be cast with. More of its own, such as a spell's duration, follow whom
 * it's used at.
 */
export function Facts({
  action,
  pools,
  more = [],
  casting = false,
}: Readonly<{
  action: SheetAction
  /** For a spell cast with slots, the slots it can be cast with. */
  pools?: SlotPool[] | null
  more?: { label: string; value: string }[]
  /** Whether it's a spell cast from an item, how it's activated being its casting time. */
  casting?: boolean
}>) {
  const { save, uses } = action
  const healing =
    action.damage.length > 0 && action.damage.every(part => part.healing)
  const facts: [string, ReactNode][] = [
    [
      casting || action.type === 'spell' ? 'Casting time' : 'Activation',
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

/**
 * The facts of a spell an item casts, after whom it's cast at, as the Spells tab has them: its
 * duration and components, the level it's cast at where that's above its own, and how many of the
 * item's charges it costs. Only the cost, where the spell isn't known.
 */
export function spellFacts(
  spell: SheetSpell | undefined,
  cast: SheetCast | null | undefined,
): { label: string; value: string }[] {
  const facts: [string, string | false | null | undefined][] = [
    ['Duration', spell?.duration],
    ['Components', spell && componentsOf(spell)],
    [
      'Cast at',
      spell &&
        cast &&
        cast.level > spell.level &&
        `${ordinal(cast.level)} level`,
    ],
    ['Cost', cast && castCost(cast)],
  ]
  return facts.flatMap(([label, value]) => (value ? [{ label, value }] : []))
}

/**
 * An action that casts a spell, how it's cast, its range and its target falling back to the
 * spell's own where it has none of its own.
 */
export function castAs(action: SheetAction, spell: SheetSpell): SheetAction {
  return {
    ...action,
    activation: action.activation ?? spell.activation,
    range: action.range ?? spell.range,
    target: action.target ?? spell.target,
  }
}

/** What a spell is: its level and its school, such as "Cantrip · Evocation". */
export function spellKind(
  spell: Pick<SheetSpell, 'level' | 'school'>,
): string | undefined {
  return joinParts(
    spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`,
    spell.school,
  )
}

/** A spell's components, with its materials, such as "V, S, M (a pinch of soot)". */
export function componentsOf(
  spell: Pick<SheetSpell, 'components' | 'materials'>,
): string {
  return [spell.components, spell.materials && `(${spell.materials})`]
    .filter(Boolean)
    .join(' ')
}

/** How many of an item's charges a spell cast from it costs, such as "1 charge"; none for none. */
export function castCost(cast: SheetCast): string | undefined {
  if (!cast.charges) return undefined
  return cast.charges === 1 ? '1 charge' : `${cast.charges} charges`
}

/** Why the item a spell is cast from can't cast it now: it needs attuning, or else it can't. */
export function whyNot(castFrom: SheetCastFrom): string {
  return castFrom.attune ? 'Needs attuning' : 'Can’t be cast now'
}
