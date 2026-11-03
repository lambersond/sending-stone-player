'use client'

import { Actions, type EnchantActions } from './use-enchanting'
import type { ReactNode } from 'react'

/** Has enchantments ended, and enchant activities followed, wherever the sheet lists them. */
export function Enchanting({
  actions,
  children,
}: Readonly<{ actions: EnchantActions; children: ReactNode }>) {
  return <Actions value={actions}>{children}</Actions>
}
