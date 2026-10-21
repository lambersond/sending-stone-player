'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { RemoveDialog } from './remove-dialog'
import { MOST_MOVED } from '@/constants/sending-stone'
import { relatedItems } from '@/utils/removals'
import type { TransferControls } from './transferring'
import type { LocalMove, LocalUse } from '@/hooks/use-sheet-roller'
import type { useTableRolls } from '@/hooks/use-table-rolls'
import type {
  SheetContainer,
  SheetInventory,
  SheetItem,
} from '@/types/sending-stone'
import type { SeatRole } from '@/utils/seat-words'

/*
 * Remove… (module 0.33.0): what a character's sheet gives its items' own menus to remove them,
 * apart from its moves, as the game removes items with no switch of its own.
 */

/**
 * Remove…, on a character's Inventory tab (module 0.33.0), for its player and the Gamemaster at its
 * page, whether or not the game takes moves: the confirmation it opens, held here so that it stays
 * open however its row changes, and what's removed followed in the tray and the toasts, as a give.
 * @param removes - Whether the game removes the character's items now.
 * @param name - The character's name, which the Gamemaster's words call the one who removed it.
 * @param setActed - Shows the tray, as removing rolls nothing.
 */
export function useRemoveControls({
  removes,
  inventory,
  table,
  role,
  name,
  logMove,
  setActed,
}: Readonly<{
  removes: boolean
  /** The character's inventory as the page has it, for what waits with an item. */
  inventory: SheetInventory
  table: Pick<ReturnType<typeof useTableRolls>, 'states' | 'sendRemove'>
  role: SeatRole
  name: string
  logMove: (move: LocalMove) => LocalUse
  setActed: (acted: boolean) => void
}>): { remove?: TransferControls['remove']; dialog: ReactNode } {
  // What it was last opened for, as it was then, kept once it closes: the dialog is closed rather
  // than removed, as only the browser's own close gives focus back to the row it was opened from.
  const [removing, setRemoving] = useState<SheetItem | SheetContainer>()
  const [open, setOpen] = useState(false)
  // The items this page has a move or a removal of on its way, by id.
  const pending = useMemo(() => {
    const held = new Set<string>()
    for (const { move, status } of table.states.values()) {
      if (move?.item && (status === 'sending' || status === 'rolling')) {
        held.add(move.item)
      }
    }
    return held
  }, [table.states])
  const remove = useMemo<TransferControls['remove']>(() => {
    if (!removes) return
    return item => {
      // How many there are must be one the game can be told it holds.
      if (item.quantity > MOST_MOVED) return
      // It waits while it, anything in it, or a container it's in is on its way from here, as the
      // app refuses it then.
      const related = relatedItems({ inventory }, item.id)
      return {
        open: () => {
          setRemoving(item)
          setOpen(true)
        },
        waiting: [...related].some(id => pending.has(id)),
      }
    }
  }, [removes, inventory, pending])

  const dialog = removing && (
    <RemoveDialog
      open={open}
      onClose={() => setOpen(false)}
      mover={role === 'gm' ? name : 'You'}
      item={removing}
      character={name}
      onRemove={({ item, quantity, held, words }) => {
        setActed(true)
        table.sendRemove(logMove(words), { item, quantity, held })
      }}
    />
  )
  return { remove, dialog }
}
