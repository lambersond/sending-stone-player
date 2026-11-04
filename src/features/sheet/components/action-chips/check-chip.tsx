'use client'

import clsx from 'clsx'
import { Hammer, Search } from 'lucide-react'
import { actionTitle } from '../action-entry/utils'
import { useDescriptionActions } from '../description-actions/use-description-actions'
import {
  checkMenuItems,
  checkOptionName,
  checkWayName,
  tableUseItems,
} from '../description-link/utils'
import { tableUseHint } from './utils'
import { useRollsLocked } from '@/hooks/use-rolls-locked'
import { checkTitle } from '@/utils/description-links'
import { REASONS } from '@/utils/roll-reasons'
import type { ActionRows } from '../action-entry/types'
import type { DamageModifiers } from '@/types/roll'
import type { SheetAction, SheetCheck } from '@/types/sending-stone'

/**
 * The check an activity asks for, such as Fast Hands' Sleight of Hand, a tool's, or Maze's
 * Investigation: its one way's name, or "Check" for several, and its DC, where it has one, cut
 * short where it's long, but never the DC. For one the character makes, its menu: to ask the
 * table for it, by using the activity in the game, which posts dnd5e's card with a button for each
 * way, saying what that spends, or why it can't be used now; or to roll the player's own, against
 * its DC, which spends nothing and uses nothing, as the card's buttons don't: for each way the
 * character can make it, and for one, with advantage, with disadvantage, or modified first. For one
 * another creature makes, such as a spell's, a tap uses it in the game, as a saving throw's chip
 * does; and while the game doesn't take spells and features, it's only shown.
 */
export function CheckChip({
  action,
  check,
  rows,
  onUse,
}: Readonly<{
  action: SheetAction
  check: SheetCheck
  rows: ActionRows
  /** Uses it in the game, while the game takes spells and features. */
  onUse?: (modifiers?: DamageModifiers) => void
}>) {
  const actions = useDescriptionActions()
  // A gone companion's pane rolls nothing, its own check among them (module 0.36.0).
  const locked = useRollsLocked()
  const name = actionTitle(action)
  const dc = check.dc ?? undefined
  const title = checkTitle(
    check.checks.map(option => checkOptionName(option, actions)),
    { dc },
  )
  const [first] = check.checks
  const label =
    check.checks.length === 1 && first ? checkWayName(first, actions) : 'Check'
  const Icon = check.checks.every(option => option.type === 'tool')
    ? Hammer
    : Search
  const chip =
    'inline-flex max-w-36 shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold whitespace-nowrap tabular-nums'
  const content = (
    <>
      <Icon aria-hidden className='size-3.5 shrink-0' />
      <span className='min-w-0 truncate'>{label}</span>
      {dc !== undefined && <span className='shrink-0'>DC {dc}</span>}
    </>
  )
  const named = `${name}, ${title}`
  if (check.own) {
    const { activity } = action
    const open = (anchor: HTMLElement) =>
      rows.menus.open({
        anchor,
        ...checkMenuItems({
          checks: check.checks,
          dc,
          title,
          ask: {
            items: tableUseItems(
              tableUseHint(action, rows),
              onUse ? undefined : (actions?.useBlocked ?? REASONS.activity),
              actions,
            ),
            choose: id => {
              if (id === 'ask') onUse?.()
              else if (id === 'send') actions?.sendRolls?.()
            },
          },
          own: true,
          actions,
          menus: rows.menus,
          // For the game to make it against the activity, as its card's button does.
          ...(activity && { from: { item: action.id, activity: activity.id } }),
          hint: 'Spends nothing',
          nameOf: option => checkWayName(option, actions),
        }),
      })
    return (
      <button
        type='button'
        aria-haspopup='menu'
        aria-label={named}
        title={title}
        disabled={locked}
        onClick={event => open(event.currentTarget)}
        className={clsx(
          chip,
          'bg-primary/10 text-primary-text transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary/10',
        )}
      >
        {content}
      </button>
    )
  }
  if (onUse) {
    return (
      <button
        type='button'
        aria-label={named}
        title={title}
        onClick={() => onUse()}
        className={clsx(
          chip,
          'border border-border transition-colors hover:bg-primary/5',
        )}
      >
        {content}
      </button>
    )
  }
  return (
    <span className={clsx(chip, 'border border-border')} title={title}>
      {content}
    </span>
  )
}
