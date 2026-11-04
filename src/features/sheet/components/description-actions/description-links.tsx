'use client'

import { Actions } from './use-description-actions'
import type { DescriptionActions } from './types'
import type { ReactNode } from 'react'

/**
 * Has the links in the descriptions inside do what `actions` says. Outside, they do nothing: each
 * is only its text.
 */
export function DescriptionLinks({
  actions,
  children,
}: Readonly<{ actions?: DescriptionActions; children: ReactNode }>) {
  return <Actions value={actions}>{children}</Actions>
}
