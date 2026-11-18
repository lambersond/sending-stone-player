import { createElement, useMemo, useState, type ReactNode } from 'react'
import { CoinDialogs } from '../components/coin-controls/coin-dialogs'
import { GiveButton } from '../components/give-controls/give-button'
import { ROW_BUTTON } from '../constants'
import { anyCoins } from '@/features/transfers/utils'
import { onItsWay } from '@/utils/lifecycle'
import type { CoinChanging } from '../types'
import type { useTableRolls } from '@/features/rolling/hooks/use-table-rolls'
import type { TableMoves } from '@/types/party'
import type { LocalMove, LocalUse } from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { SheetCurrency } from '@/types/sending-stone'
import type { TableView } from '@/types/table'

/*
 * A character's Currency row's own buttons (module 0.49.0), either side of its Send to: Add or
 * take away, while the campaign lets its coins be changed from here; and Hand out, while the game
 * takes moves and its module hands coins out, to any of the campaign's other characters. For its
 * player and the Gamemaster at its page. Each opens its dialog, and what's sent is followed in the
 * tray and the toasts, as a give. A row of several buttons says what's on its way once, by its
 * label, as a party's does (module 0.33.0's feedback): each of these waits with no spinner of its
 * own.
 */

/**
 * The Currency row's own buttons and the dialog they open, which is held here, so that it stays
 * open however its row changes, or should its button go, as when the game stops changing coins:
 * what's sent then says why it wasn't made.
 * @param coins - Whether the seat may add and take away the character's coins now, and whether
 *   the game pays with other coins where it's short of one.
 * @param moves - Where the seat may move to, while the game takes moves: its `handOut` says
 *   whether the character's coins may be handed out to its `characters`.
 * @param name - The character's name, which the Gamemaster's words call the one whose they are.
 * @param actorId - The character's Foundry actor, whose coins are handed out.
 * @param setActed - Shows the tray, as changing coins rolls nothing.
 */
export function useCoinControls({
  coins,
  moves,
  table,
  role,
  name,
  actorId,
  logMove,
  setActed,
}: Readonly<{
  coins?: TableView['coins']
  moves?: TableMoves
  table: Pick<
    ReturnType<typeof useTableRolls>,
    'states' | 'sendCoins' | 'sendTransfer'
  >
  role: SeatRole
  name: string
  actorId?: string
  logMove: (move: LocalMove) => LocalUse
  setActed: (acted: boolean) => void
}>): {
  /** Add or take away, for the row's coins; unset where they can't be changed from here. */
  change?: (currency: SheetCurrency[]) => ReactNode
  /** Hand out, where there's a whole coin and someone to hand it to; unset where it can't be. */
  handOut?: (currency: SheetCurrency[]) => ReactNode
  /** Whether a change to its coins, or a move of them, is on its way: the row's label says so. */
  waiting: boolean
  dialog: ReactNode
} {
  // What it was last opened with, kept once it closes: the dialog is closed rather than removed,
  // as only the browser's own close gives focus back to the button that opened it.
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
            setChanging({ mode: 'change', currency, change: coins.change })
            setOpen(true)
          },
        },
        'Add or take away',
      )
  }, [coins, busy])
  const handOut = useMemo(() => {
    const paying = moves?.handOut
    const characters = moves?.characters ?? []
    if (!actorId || !paying || characters.length === 0) return
    return (currency: SheetCurrency[]) =>
      anyCoins(currency) &&
      createElement(
        GiveButton,
        {
          className: ROW_BUTTON,
          busy,
          quiet: true,
          onGive: () => {
            setChanging({
              mode: 'handOut',
              currency,
              change: paying.change,
              from: actorId,
              characters,
            })
            setOpen(true)
          },
        },
        'Hand out',
      )
  }, [actorId, moves, busy])

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
  return { change, handOut, waiting: busy, dialog }
}
