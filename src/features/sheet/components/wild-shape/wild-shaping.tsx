'use client'

import { type ReactNode } from 'react'
import { WildShapeContext } from './context'
import { ReturnPopover } from './return-popover'
import { WildShapeDialog } from './wild-shape-dialog'
import type { WildShapeValue } from './types'

/**
 * What the rows, tabs and ribbon inside know of the character's Wild Shape; and the pane's one
 * Wild Shape dialog and Return's confirm, drawn here once, never inside a row, so that a row drawn
 * afresh as a new sheet arrives never closes either.
 */
export function WildShaping({
  value,
  children,
}: Readonly<{ value: WildShapeValue; children: ReactNode }>) {
  return (
    <WildShapeContext value={value}>
      {children}
      {value.block && <WildShapeDialog body={value.body} />}
      {value.returnAnchor && value.form && (
        <ReturnPopover anchor={value.returnAnchor} />
      )}
    </WildShapeContext>
  )
}
