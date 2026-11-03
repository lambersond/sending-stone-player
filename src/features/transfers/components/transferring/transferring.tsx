'use client'

import { type ReactNode } from 'react'
import { Controls } from '@/features/transfers/hooks/use-transferring'
import type { TransferControls } from '@/features/transfers/types'

/*
 * Where a sheet moves items and coins, from module 0.31.0: the controls a character's sheet gives
 * its inventory, such as Give, and a party's sheet its stash, such as Take. Each sheet provides its
 * own, and resets any it's placed in, so that a party's sheet over a character's never shows the
 * character's Give.
 */

/** A move's button on a Currency row, or beside an item, as End is beside a concentration. */
export const ROW_BUTTON =
  'shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold transition-colors hover:bg-primary/5 disabled:opacity-60'
/** A move's pill in an opened item, on a line of its own, apart from the row's own buttons. */
export const ITEM_BUTTON =
  'self-start rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-primary/5 disabled:opacity-60'

/** Gives the sheet's items and coins within it these controls, in place of any around it. */
export function Transferring({
  controls,
  children,
}: Readonly<{ controls: TransferControls; children: ReactNode }>): ReactNode {
  return <Controls value={controls}>{children}</Controls>
}
