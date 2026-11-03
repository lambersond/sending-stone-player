'use client'

import { type ReactNode } from 'react'
import { SheetIdPrefix } from '@/features/sheet/hooks/use-sheet-ids'
import { CreatureContext } from '@/hooks/use-creature'
import { RollsLocked } from '@/hooks/use-rolls-locked'
import type { CreatureFacts } from '@/types/table'

/**
 * What every part of a pane inside knows of whose it is (module 0.36.0): at a companion's, the
 * creature and its character, for the words it says; whether its rolls are locked, as a gone
 * companion's are; and what its ids begin with. Its toasts, portalled, know it too.
 */
export function PaneContext({
  creature,
  locked,
  idPrefix,
  children,
}: Readonly<{
  creature?: CreatureFacts
  locked: boolean
  idPrefix: string
  children: ReactNode
}>) {
  return (
    <CreatureContext
      value={creature && { ...creature, character: creature.relation.of }}
    >
      <RollsLocked value={locked}>
        <SheetIdPrefix value={idPrefix}>{children}</SheetIdPrefix>
      </RollsLocked>
    </CreatureContext>
  )
}
