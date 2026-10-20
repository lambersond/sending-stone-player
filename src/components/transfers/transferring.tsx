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
}

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
