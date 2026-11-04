import { useMemo } from 'react'
import { useGiveControls } from '@/features/transfers/hooks/use-give-controls'
import { useRemoveControls } from '@/features/transfers/hooks/use-remove-controls'
import type { PaneTable } from './types'
import type { TableMoves } from '@/types/party'
import type { LocalMove, LocalUse } from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { TableSheet } from '@/types/table'

/**
 * Give and Remove…, on the Inventory tab: Send to…, from module 0.31.0, its dialog held here, so
 * that it outlives the row it was opened from, and the controls going, as when the game stops
 * taking moves; and Remove…, from module 0.33.0, beside it, with moves off too. Neither while the
 * character is transformed (`shaped`), whose gear isn't on.
 */
export function useGiveRemove({
  moves,
  removes,
  shaped,
  sheet,
  table,
  role,
  name,
  actorId,
  logMove,
  setActed,
}: Readonly<{
  moves?: TableMoves
  removes?: boolean
  shaped: boolean
  sheet: TableSheet
  table: PaneTable
  role: SeatRole
  name: string
  actorId?: string
  logMove: (move: LocalMove) => LocalUse
  setActed: (acted: boolean) => void
}>) {
  const giving = useGiveControls({
    moves: shaped ? undefined : moves,
    table,
    role,
    name,
    actorId,
    logMove,
    setActed,
  })
  const removing = useRemoveControls({
    removes: removes === true && !shaped,
    inventory: sheet.inventory,
    table,
    role,
    name,
    logMove,
    setActed,
  })
  const transfers = useMemo(
    () =>
      removing.remove
        ? { ...giving.controls, remove: removing.remove }
        : giving.controls,
    [giving.controls, removing.remove],
  )
  return { giving, removing, transfers }
}
