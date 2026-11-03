'use client'

import clsx from 'clsx'
import { joinParts } from '../../utils/join-parts'
import { ActionChips } from '../action-chips/action-chips'
import { UsesChips } from '../action-chips/uses-chips'
import { usePressMenu } from '../press-menu/press-menu'
import { ActivityInfoButton } from './activity-info-button'
import { useActivityMenu } from './use-activity-menu'
import {
  activityDetail,
  dimmed,
  foldsUses,
  ownUses,
  usesName,
  viewOf,
} from './utils'
import { castOf } from '@/utils/casts'
import type { ActionRows, OtherActivity } from './types'
import type { SheetAction } from '@/types/sending-stone'

/**
 * One of an action's other activities, beneath it, such as Hex's Bonus Hex Damage: its name, how
 * it differs from the action in how it's used and how far it reaches, and what it rolls beside it,
 * as an action's row has them. One the app can't use, such as a summoning, says so. One of an
 * item's opens to what there is to read of it from beside its name. From module 0.37.0, its name
 * opens a menu of its own, adding the activity itself to the favorites or removing it, where the
 * pane offers them, and is a tab stop then, for the keyboard to open it.
 */
export function ActivityEntry({
  other,
  parent,
  rows,
  muted,
  section,
}: Readonly<{
  other: OtherActivity
  parent: SheetAction
  rows: ActionRows
  muted?: boolean
  section?: string
}>) {
  const { activity, action } = other
  const view = viewOf(action, rows.spellbook, rows.use)
  const cast = castOf(action, rows.casts)
  const uses = ownUses(activity, parent)
  const detail = joinParts(
    ...activityDetail(activity, parent, view.spent, { section, cast }),
  )
  const { onMenu, menu } = useActivityMenu(other)
  const press = usePressMenu(onMenu)
  return (
    // Its chips wrap under its name where both don't fit, as an action's row's do.
    <li className='flex flex-wrap items-center gap-x-2 gap-y-0 py-0.5 pr-1.5'>
      <span
        tabIndex={onMenu ? 0 : undefined}
        {...press.props}
        className={clsx(
          'min-w-[8.5rem] flex-1 py-0.5',
          (view.spent || muted || dimmed(activity, cast)) && 'opacity-60',
          onMenu &&
            'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary',
          press.className,
        )}
      >
        <span className='flex items-center gap-1'>
          <span className='truncate text-sm'>{other.name}</span>
          <ActivityInfoButton
            activity={activity}
            action={action}
            parent={parent}
            rows={rows}
            spellId={other.spellId}
          />
        </span>
        {detail && (
          <span className='block truncate text-xs text-text-secondary'>
            {detail}
          </span>
        )}
      </span>
      <span className='ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1'>
        {uses && (
          <UsesChips
            name={usesName(action, uses)}
            uses={uses}
            rows={rows}
            spends={action.activity?.spends}
            fold={foldsUses(action, view)}
          />
        )}
        <ActionChips action={action} view={view} rows={rows} uses={uses} />
      </span>
      {menu}
    </li>
  )
}
