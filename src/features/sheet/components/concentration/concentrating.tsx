'use client'

import { Actions, type ConcentrationActions } from './use-concentrating'
import type { ReactNode } from 'react'

/** Has concentrations ended wherever the sheet shows them. */
export function Concentrating({
  actions,
  children,
}: Readonly<{ actions: ConcentrationActions; children: ReactNode }>) {
  return <Actions value={actions}>{children}</Actions>
}
