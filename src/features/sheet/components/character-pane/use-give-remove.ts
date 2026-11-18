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
 * 0.48.0, the Currency row's Add or take away, before its Send to, with moves off too, and Hand
 * out, after it; and where the row has either, what's on its way is said once, by its label, as on
 * a party's sheet. None while the character is transformed (`shaped`), whose gear isn't on.
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
    moves: shaped ? undefined : moves,
    table,
    role,
    name,
    actorId,
    logMove,
    setActed,
  })
  const { change, handOut, waiting } = coinage
  const giving = useGiveControls({
    moves: shaped ? undefined : moves,
    table,
    role,
    name,
    actorId,
    labelWaits: !!(change || handOut),
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
      // The Currency row's buttons, in the order they read: Add or take away, Send to, Hand out.
      ...((change || handOut) && {
        coins: currency => {
          const buttons = [
            change?.(currency),
            send?.(currency),
            handOut?.(currency),
          ]
          // Nothing at all, rather than an empty group, where none is shown.
          if (!buttons.some(Boolean)) return
          return createElement(Fragment, undefined, ...buttons)
        },
        ...(waiting && { waiting: COINS_WAITING }),
      }),
      ...(removing.remove && { remove: removing.remove }),
    }
  }, [giving.controls, removing.remove, change, handOut, waiting])
  return { giving, removing, coinage, transfers }
}
