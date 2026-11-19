import { createElement, Fragment, useMemo } from 'react'
import { PENDING_COINS } from '@/features/transfers/constants'
import { useCoinControls } from '@/features/transfers/hooks/use-coin-controls'
import { useGiveControls } from '@/features/transfers/hooks/use-give-controls'
import { useRemoveControls } from '@/features/transfers/hooks/use-remove-controls'
import type { PaneTable } from './types'
import type { TransferControls } from '@/features/transfers/types'
import type { TableMoves } from '@/types/party'
import type { LocalMove, LocalUse } from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { TableSheet, TableView } from '@/types/table'

/** What a Currency row of several buttons waits on: its coins alone, never an item's row. */
const COINS_WAITING: ReadonlySet<string> = new Set([PENDING_COINS])

/**
 * Give and Remove…, on the Inventory tab: Send to…, from module 0.31.0, its dialog held here, so
 * that it outlives the row it was opened from, and the controls going, as when the game stops
 * taking moves; and Remove…, from module 0.33.0, beside it, with moves off too. From module
 * 0.49.0, the Currency row's Add or remove, before its Give, with moves off too; and where the row
 * has both, what's on its way is said once, by its label, as on a party's sheet. None while the
 * character is transformed (`shaped`), whose gear isn't on.
 */
export function useGiveRemove({
  moves,
  removes,
  coins,
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
  coins?: TableView['coins']
  shaped: boolean
  sheet: TableSheet
  table: PaneTable
  role: SeatRole
  name: string
  actorId?: string
  logMove: (move: LocalMove) => LocalUse
  setActed: (acted: boolean) => void
}>) {
  const coinage = useCoinControls({
    coins: shaped ? undefined : coins,
    table,
    role,
    name,
    logMove,
    setActed,
  })
  const { change, waiting } = coinage
  const giving = useGiveControls({
    moves: shaped ? undefined : moves,
    table,
    role,
    name,
    actorId,
    // Give alone, with coins off or an older module, keeps its own spinner, as Send to did.
    labelWaits: !!change,
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
  const transfers = useMemo<TransferControls>(() => {
    const send = giving.controls.coins
    return {
      ...giving.controls,
      // The Currency row's buttons, in the order they read: Add or remove, then Give.
      ...(change && {
        coins: currency => {
          const buttons = [change(currency), send?.(currency)]
          // Nothing at all, rather than an empty group, where none is shown.
          if (!buttons.some(Boolean)) return
          return createElement(Fragment, undefined, ...buttons)
        },
        ...(waiting && { waiting: COINS_WAITING }),
      }),
      ...(removing.remove && { remove: removing.remove }),
    }
  }, [giving.controls, removing.remove, change, waiting])
  return { giving, removing, coinage, transfers }
}
