'use client'

import { Actions } from './use-enchanting'
import type { EnchantActions } from './types'
import type { ReactNode } from 'react'

/** Has enchantments ended, and enchant activities followed, wherever the sheet lists them. */
export function Enchanting({
  actions,
  children,
}: Readonly<{ actions: EnchantActions; children: ReactNode }>) {
  return <Actions value={actions}>{children}</Actions>
}
