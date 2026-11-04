'use client'

import clsx from 'clsx'
import { UsesButton } from '../uses-button/uses-button'
import { recoveryOf } from './utils'
import { poolName } from '@/utils/action-groups'
import { formatModifier } from '@/utils/format-modifier'
import type { UsesSpending } from './types'
import type { SheetAction, SheetUses, SlotPool } from '@/types/sending-stone'
import type { ReactNode } from 'react'

/**
 * All there is to know of how an action is used, each with its label, and for a spell cast with
 * slots, the slots it can be cast with. More of its own, such as a spell's duration, follow whom
 * it's used at. Where its row folds its count away, its uses are spent from here in a narrow list,
 * as they are from the count wherever that's shown.
 */
export function Facts({
  action,
  uses = action.uses,
  pools,
  more = [],
  casting = false,
  spending,
}: Readonly<{
  action: SheetAction
  /** Its uses, where others are shown in place of its own, as `EntryLook`'s. */
  uses?: SheetUses | null
  /** For a spell cast with slots, the slots it can be cast with. */
  pools?: SlotPool[] | null
  more?: { label: string; value: string }[]
  /** Whether it's a spell cast from an item, how it's activated being its casting time. */
  casting?: boolean
  /** Where its row folds its count away in a narrow list, how its uses are spent from here. */
  spending?: UsesSpending
}>) {
  const { save } = action
  const healing =
    action.damage.length > 0 && action.damage.every(part => part.healing)
  const recovery = uses && recoveryOf(uses)
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
      uses && (
        <>
          {`${uses.value} of ${uses.max} left${recovery ? `, ${recovery}` : ''}`}
          {/* Only where the row's count is folded away, which is shown beside it otherwise. */}
          {spending && (
            <UsesButton
              uses={uses}
              name={spending.name}
              spends={spending.spends}
              bare
              className='ml-2 align-middle @md:hidden'
            />
          )}
        </>
      ),
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
