'use client'

import { createPortal } from 'react-dom'
import { DiceEntryDialog } from './dice-entry-dialog'
import type { Asked } from './types'

/**
 * What `useDiceEntry` puts on the page: the dice entry dialog, asking for the roll first in turn,
 * if any, in the page's body.
 */
export function DiceEntryDialogs({ current }: Readonly<{ current?: Asked }>) {
  return createPortal(
    <DiceEntryDialog
      entry={current?.entry}
      onDone={values => current?.settle(values)}
      onCancel={() => current?.settle()}
    />,
    document.body,
  )
}
