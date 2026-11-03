'use client'

import { Opener } from './use-show-conditions'
import type { ShowConditions } from './types'
import type { ReactNode } from 'react'

/**
 * Has every part of the sheet inside open the sheet's conditions panel with `show`; none, given
 * none, as inside a party's sheet, which has no conditions panel.
 */
export function ConditionsOpener({
  show,
  children,
}: Readonly<{ show: ShowConditions | undefined; children: ReactNode }>) {
  return <Opener value={show}>{children}</Opener>
}
