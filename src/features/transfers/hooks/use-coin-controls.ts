import { createElement, useMemo, useState, type ReactNode } from 'react'
import { CoinDialogs } from '../components/coin-controls/coin-dialogs'
import { GiveButton } from '../components/give-controls/give-button'
import { ROW_BUTTON } from '../constants'
import { onItsWay } from '@/utils/lifecycle'
import type { CoinChanging } from '../types'
import type { useTableRolls } from '@/features/rolling/hooks/use-table-rolls'
import type { LocalMove, LocalUse } from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { SheetCurrency } from '@/types/sending-stone'
import type { TableView } from '@/types/table'

/*
 * A character's Currency row's own button (module 0.49.0), before its Give: Add or remove, while
 * the campaign lets its coins be changed from here. For its player and the Gamemaster at its page.
 * It opens its dialog, and what's sent is followed in the tray and the toasts, as a give. A row of
 * both buttons says what's on its way once, by its label, as a party's does (module 0.33.0's
 * feedback): each of them waits with no spinner of its own.
 */

/**
 * The Currency row's Add or remove and the dialog it opens, which is held here, so that it stays
 * open however its row changes, or should its button go, as when the game stops changing coins:
 * what's sent then says why it wasn't made.
 * @param coins - Whether the seat may add and remove the character's coins now, and whether the
 *   game pays with other coins where it's short of one.
 * @param name - The character's name, which the Gamemaster's words call the one whose they are.
 * @param setActed - Shows the tray, as changing coins rolls nothing.
 */
export function useCoinControls({
  coins,
  table,
  role,
  name,
  logMove,
  setActed,
}: Readonly<{
  coins?: TableView['coins']
  table: Pick<ReturnType<typeof useTableRolls>, 'states' | 'sendCoins'>
  role: SeatRole
  name: string
  logMove: (move: LocalMove) => LocalUse
  setActed: (acted: boolean) => void
}>): {
  /** Add or remove, for the row's coins; unset where they can't be changed from here. */
  change?: (currency: SheetCurrency[]) => ReactNode
  /** Whether a change to its coins, or a move of them, is on its way: the row's label says so. */
  waiting: boolean
  dialog: ReactNode
} {
  // What it was last opened with, kept once it closes: the dialog is closed rather than removed,
  // as only the browser's own close gives focus back to the button that opened it, which waits for
  // its move without losing focus (GiveButton).
  const [changing, setChanging] = useState<CoinChanging>()
  const [open, setOpen] = useState(false)
  // Whether a change to its coins, or a move of them, is on its way from this page: the app
  // refuses another until it's made.
  const busy = useMemo(
    () =>
      [...table.states.values()].some(
        ({ move, status }) => !!move && !move.item && onItsWay({ status }),
      ),
    [table.states],
  )
  const change = useMemo(() => {
    if (!coins) return
    return (currency: SheetCurrency[]) =>
      createElement(
        GiveButton,
        {
          className: ROW_BUTTON,
          busy,
          quiet: true,
          onGive: () => {
            setChanging({ currency, change: coins.change })
            setOpen(true)
          },
        },
        'Add or remove',
      )
  }, [coins, busy])

  const dialog =
    changing &&
    createElement(CoinDialogs, {
      changing,
      open,
      setOpen,
      role,
      name,
      table,
      logMove,
      setActed,
    })
  return { change, waiting: busy, dialog }
}
