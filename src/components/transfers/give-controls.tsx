'use client'

import { useMemo, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'
import { MoveDialog, type MoveEnd } from './move-dialog'
import {
  ITEM_BUTTON,
  NO_TRANSFERS,
  ROW_BUTTON,
  type TransferControls,
} from './transferring'
import type { LocalMove, LocalUse } from '@/hooks/use-sheet-roller'
import type { useTableRolls } from '@/hooks/use-table-rolls'
import type {
  SheetContainer,
  SheetCurrency,
  SheetItem,
} from '@/types/sending-stone'
import type { TableMoves } from '@/types/table'
import type { SeatRole } from '@/utils/seat-words'

/*
 * Give, on a character's Inventory tab (module 0.31.0): in each item once it's opened, and on its
 * Currency row, while the game takes moves, to a party its player owns in Foundry or another of
 * the campaign's characters; for the Gamemaster, to any of the campaign's parties or characters.
 * From module 0.32.0's feedback, the Currency row's reads "Send to", and "Send to…" in an item's
 * own menu gives it too. Each opens the move's dialog, and what's given is followed in the tray
 * and the toasts, as a use is.
 */

/** What's pending, for coins rather than an item. */
const COINS = 'coins'

/** What's being given, while its dialog is open, as it was when it opened. */
type Giving = {
  what: { item: SheetItem | SheetContainer } | { coins: SheetCurrency[] }
  /** The character it's given from. */
  from: string
  recipients: { parties: MoveEnd[]; characters: MoveEnd[] }
}

/** Any whole coin to give: dnd5e 6 may hold part of one, which can't be moved. */
function anyCoins(currency: SheetCurrency[]): boolean {
  return currency.some(coin => Math.floor(coin.value) >= 1)
}

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
      if (move && (status === 'sending' || status === 'rolling')) {
        held.add(move.item ?? COINS)
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
        body: (
          <GiveButton
            label={`Give ${item.name}`}
            className={ITEM_BUTTON}
            busy={pending.has(item.id)}
            onGive={() => give({ item })}
          >
            Give…
          </GiveButton>
        ),
      }),
      // On the Currency row, its words are its name, in the group the row's label names.
      coins: currency =>
        anyCoins(currency) && (
          <GiveButton
            className={ROW_BUTTON}
            busy={pending.has(COINS)}
            onGive={() => give({ coins: currency })}
          >
            Send to
          </GiveButton>
        ),
      // What "Send to…" in an item's own menu opens: the dialog its Give… opens.
      send: item => (item.quantity >= 1 ? () => give({ item }) : undefined),
    }
  }, [actorId, moves, pending])

  const dialog = giving && (
    <MoveDialog
      open={open}
      onClose={() => setOpen(false)}
      mode='give'
      mover={role === 'gm' ? name : 'You'}
      what={giving.what}
      recipients={giving.recipients}
      onMove={({ to, items, currency, words }) => {
        setActed(true)
        table.sendTransfer(logMove(words), {
          from: giving.from,
          to,
          ...(items && { items }),
          ...(currency && { currency }),
        })
      }}
    />
  )
  return { controls, dialog }
}

function GiveButton({
  label,
  className,
  busy,
  onGive,
  children,
}: Readonly<{
  /** Its name, where its words alone don't say what it gives. */
  label?: string
  className: string
  busy: boolean
  onGive: () => void
  children: ReactNode
}>) {
  return (
    <button
      type='button'
      aria-haspopup='dialog'
      aria-label={label}
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={onGive}
      className={clsx(className, busy && 'inline-flex items-center gap-1')}
    >
      {busy && (
        <LoaderCircle
          aria-hidden
          className='size-3.5 motion-safe:animate-spin'
        />
      )}
      {children}
    </button>
  )
}
