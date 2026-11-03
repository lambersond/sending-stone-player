'use client'

import { createContext, use, type ReactNode } from 'react'
import type {
  SheetContainer,
  SheetCurrency,
  SheetItem,
} from '@/types/sending-stone'

/*
 * Where a sheet moves items and coins, from module 0.31.0: the controls a character's sheet gives
 * its inventory, such as Give, and a party's sheet its stash, such as Take. Each sheet provides its
 * own, and resets any it's placed in, so that a party's sheet over a character's never shows the
 * character's Give.
 */

/** What a sheet shows to move its items and coins, by where it shows it. */
export type TransferControls = {
  /** For an item row: beside its quantity (`aside`), and once opened (`body`). */
  item?: (
    item: SheetItem | SheetContainer,
  ) => { aside?: ReactNode; body?: ReactNode } | undefined
  /** Beside the Currency fact's coins. */
  coins?: (currency: SheetCurrency[]) => ReactNode
  /**
   * From module 0.32.0's feedback: what "Send to…" in an item's own menu opens for it, on a
   * right-click or long-press of its row. Unset where it can't be sent from here.
   */
  send?: (item: SheetItem | SheetContainer) => (() => void) | undefined
  /**
   * From module 0.33.0: "Remove…" in an item's own menu, on a character's sheet: what opens its
   * confirmation, and whether it waits, as while a move or a removal of it is on its way. Unset
   * where nothing is removed from here, as on a party's sheet.
   */
  remove?: (
    item: SheetItem | SheetContainer,
  ) => { open: () => void; waiting: boolean } | undefined
  /**
   * From module 0.33.0's feedback, on a party's sheet: what's on its way, by item id and `coins`,
   * said by one spinner beside the Currency label or the item's name, its buttons disabled with
   * none of their own. Unset on a character's sheet, whose buttons say it themselves.
   */
  waiting?: ReadonlySet<string>
}

/** A move's button on a Currency row, or beside an item, as End is beside a concentration. */
export const ROW_BUTTON =
  'shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold transition-colors hover:bg-primary/5 disabled:opacity-60'
/** A move's pill in an opened item, on a line of its own, apart from the row's own buttons. */
export const ITEM_BUTTON =
  'self-start rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-primary/5 disabled:opacity-60'

/** Nothing to move with, as where the game takes no moves, or a sheet resets them. */
export const NO_TRANSFERS: TransferControls = {}

const Controls = createContext<TransferControls>(NO_TRANSFERS)

/** Gives the sheet's items and coins within it these controls, in place of any around it. */
export function Transferring({
  controls,
  children,
}: Readonly<{ controls: TransferControls; children: ReactNode }>): ReactNode {
  return <Controls value={controls}>{children}</Controls>
}

/** The controls the sheet's items and coins are given, as it's given them. */
export function useTransferring(): TransferControls {
  return use(Controls)
}
