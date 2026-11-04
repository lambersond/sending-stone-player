'use client'

import { Actions } from './use-concentrating'
import type { ConcentrationActions } from './types'
import type { ReactNode } from 'react'

/** Has concentrations ended wherever the sheet shows them. */
export function Concentrating({
  actions,
  children,
}: Readonly<{ actions: ConcentrationActions; children: ReactNode }>) {
  return <Actions value={actions}>{children}</Actions>
}
