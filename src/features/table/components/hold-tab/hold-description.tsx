'use client'

import type { TabHold } from '@/features/table/types'

/** What a tab held to end the turn is described as while a turn may be ended. */
export function HoldDescription({ hold }: Readonly<{ hold?: TabHold }>) {
  if (!hold?.offer) return
  return (
    <span id={hold.offer.id} hidden>
      {hold.offer.description}
    </span>
  )
}
