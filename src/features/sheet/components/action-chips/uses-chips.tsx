'use client'

import clsx from 'clsx'
import { UsesButton } from '../uses-button/uses-button'
import { RechargeChip } from './recharge-chip'
import { rechargeOf } from './utils'
import type { ActionRows } from '../action-entry/types'
import type { SheetSpend, SheetUses } from '@/types/sending-stone'

/**
 * A row's uses, with the Recharge chip on their left where they're spent and the game takes a
 * recharge rolled from here (module 0.36.0), first of its chips, beside its uses, which show with
 * it however narrow the list. In a list's row, beside what the action rolls, its uses would leave
 * its name too little room in a narrow list, so they `fold` away there, listed when it opens;
 * beside a Recharge chip they show however narrow. In a table's cell they're as they are. Where the
 * game takes charges spent from here, they're a button that spends them.
 * @param name - What the count is called, as the game's chat names it once it's spent.
 * @param fold - In a list's row, whether they fold away in a narrow list; unset in a table.
 */
export function UsesChips({
  name,
  uses,
  rows,
  spends,
  fold,
}: Readonly<{
  name: string
  uses: SheetUses
  rows: Pick<ActionRows, 'recharges' | 'formula'>
  spends?: SheetSpend[]
  fold?: boolean
}>) {
  const recharge = rechargeOf(rows, uses)
  const count = <UsesButton uses={uses} name={name} spends={spends} />
  return (
    <>
      {recharge && <RechargeChip name={name} uses={uses} onRoll={recharge} />}
      {fold === undefined ? (
        count
      ) : (
        // A count shown always cuts the name short instead.
        <span
          data-uses
          className={clsx('shrink-0', fold && !recharge && 'hidden @md:inline')}
        >
          {count}
        </span>
      )}
    </>
  )
}
