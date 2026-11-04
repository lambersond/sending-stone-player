'use client'

import { Actions } from '@/features/sheet/components/charging/use-charging'
import type { ChargeActions } from '@/features/sheet/components/charging/types'
import type { ReactNode } from 'react'

/** Has counters spent, and Heroic Inspiration changed, wherever the sheet shows them. */
export function Charging({
  actions,
  children,
}: Readonly<{ actions: ChargeActions; children: ReactNode }>) {
  return <Actions value={actions}>{children}</Actions>
}
