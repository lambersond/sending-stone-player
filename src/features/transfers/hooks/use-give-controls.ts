import { createElement, useState, useMemo, type ReactNode } from 'react'
import { GiveButton } from '../components/give-controls/give-button'
import { GiveDialogs } from '../components/give-controls/give-dialogs'
import {
  NO_TRANSFERS,
  ITEM_BUTTON,
  ROW_BUTTON,
  PENDING_COINS,
} from '../constants'
import { anyCoins } from '@/features/transfers/utils'
import { onItsWay } from '@/utils/lifecycle'
import type { TransferControls, Giving } from '../types'
import type { useTableRolls } from '@/features/rolling/hooks/use-table-rolls'
import type { TableMoves } from '@/types/party'
import type { LocalMove, LocalUse } from '@/types/roll'
import type { SeatRole } from '@/types/seats'

/*
 * Give, on a character's Inventory tab (module 0.31.0): in each item once it's opened, and on its
 * Currency row, while the game takes moves, to a party its player owns in Foundry or another of
 * the campaign's characters; for the Gamemaster, to any of the campaign's parties or characters.
 * From module 0.32.0's feedback, the Currency row's reads "Send to", and "Send to…" in an item's
 * own menu gives it too. Each opens the move's dialog, and what's given is followed in the tray
 * and the toasts, as a use is.
 */

/**
 * The controls a character's sheet gives its inventory to give its items and coins, and the
 * dialog they open, which is held here, so that it stays open however its row changes, or should
 * its Give go, as when the game stops taking moves: what's sent then says why it wasn't given.
 * @param moves - Where the seat may give to, while the game takes moves.
 * @param name - The character's name, which the Gamemaster's words call the one who gave it.
 * @param actorId - The character's Foundry actor, which it's given from.
 * @param setActed - Shows the tray, as giving rolls nothing.
 */
export function useGiveControls({
  moves,
  table,
  role,
  name,
  actorId,
  logMove,
  setActed,
}: Readonly<{
  moves?: TableMoves
  table: Pick<ReturnType<typeof useTableRolls>, 'states' | 'sendTransfer'>
  role: SeatRole
  name: string
  actorId?: string
  logMove: (move: LocalMove) => LocalUse
  setActed: (acted: boolean) => void
}>): { controls: TransferControls; dialog: ReactNode } {
  // What it was last opened for, kept once it closes: the dialog is closed rather than removed,
  // as only the browser's own close gives focus back to the Give that opened it.
  const [giving, setGiving] = useState<Giving>()
  const [open, setOpen] = useState(false)
  // What's on its way: the items, by id, and coins.
  const pending = useMemo(() => {
    const held = new Set<string>()
    for (const { move, status } of table.states.values()) {
      if (move && onItsWay({ status })) {
        held.add(move.item ?? PENDING_COINS)
      }
    }
    return held
  }, [table.states])
  const controls = useMemo<TransferControls>(() => {
    if (!actorId || !moves) return NO_TRANSFERS
    const { parties, characters } = moves
    if (parties.length === 0 && characters.length === 0) return NO_TRANSFERS
    const give = (what: Giving['what']) => {
      setGiving({ what, from: actorId, recipients: { parties, characters } })
      setOpen(true)
    }
    return {
      // In the item once opened: a row that rolls is full on a phone.
      item: item => ({
        body: createElement(
          GiveButton,
          {
            label: `Give ${item.name}`,
            className: ITEM_BUTTON,
            busy: pending.has(item.id),
            onGive: () => give({ item }),
          },
          'Give…',
        ),
      }),
      // On the Currency row, its words are its name, in the group the row's label names.
      coins: currency =>
        anyCoins(currency) &&
        createElement(
          GiveButton,
          {
            className: ROW_BUTTON,
            busy: pending.has(PENDING_COINS),
            onGive: () => give({ coins: currency }),
          },
          'Send to',
        ),
      // What "Send to…" in an item's own menu opens: the dialog its Give… opens.
      send: item => (item.quantity >= 1 ? () => give({ item }) : undefined),
    }
  }, [actorId, moves, pending])

  const dialog =
    giving &&
    createElement(GiveDialogs, {
      giving,
      open,
      setOpen,
      role,
      name,
      table,
      logMove,
      setActed,
    })
  return { controls, dialog }
}
