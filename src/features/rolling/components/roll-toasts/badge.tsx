'use client'

import clsx from 'clsx'
import { BADGE_ICONS, BADGES } from '../roll-tray/constants'
import type { RollBrief } from '../../types'

/**
 * A roll's total, coloured as the tray's; or a use's or an ask's icon, and for one of the
 * Gamemaster's as the character (#156), the hidden mark or dice where it has no total.
 */
export function Badge({ brief }: Readonly<{ brief: RollBrief }>) {
  const Icon = BADGE_ICONS[brief.badge]
  const shown = Icon ? <Icon aria-hidden className='size-6' /> : brief.total
  return (
    <span
      className={clsx(
        'flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tabular-nums',
        BADGES[brief.badge],
      )}
    >
      {shown}
    </span>
  )
}
