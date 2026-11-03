'use client'

import { Info } from 'lucide-react'
import { actionTitle, usedFromApp } from './utils'
import type { ActionRows } from './types'
import type { SheetAction, SheetActivity } from '@/types/sending-stone'

/**
 * A button beside the name of one of an item's activities folded beneath it, such as a staff's
 * Starry Wisp, that opens what there is to read of it, as its row has no description of its own.
 * None for a spell's, such as Spirit Guardians' save each turn, as the spell opens to its own; but
 * one of a spell an item casts, beneath the item, opens to the spell, as the Spells tab lists it.
 */
export function ActivityInfoButton({
  activity,
  action,
  parent,
  rows,
  spellId,
}: Readonly<{
  activity: SheetActivity
  /** The activity as an action of its own. */
  action: SheetAction
  parent: SheetAction
  rows: ActionRows
  /** For one of a spell an item casts, the copy of the spell the Spells tab lists. */
  spellId?: string
}>) {
  if (parent.type === 'spell') return
  const label = `About ${actionTitle(action)}`
  return (
    // Outside its name, so that a long one is cut short before it, and as tall as the name's line.
    <button
      type='button'
      aria-haspopup='dialog'
      aria-label={label}
      title={label}
      onClick={() =>
        rows.about({
          activity: spellId ? { ...activity, spellId } : activity,
          action,
          item: parent,
          foundry: !usedFromApp(activity),
        })
      }
      className='-my-1 shrink-0 rounded-full p-1.5 text-text-secondary transition-colors hover:bg-primary/10 hover:text-primary'
    >
      <Info aria-hidden className='size-4' />
    </button>
  )
}
