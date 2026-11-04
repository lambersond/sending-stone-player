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

/** Gives the sheet's items and coins within it these controls, in place of any around it. */
export function Transferring({
  controls,
  children,
}: Readonly<{ controls: TransferControls; children: ReactNode }>): ReactNode {
  return <Controls value={controls}>{children}</Controls>
}
