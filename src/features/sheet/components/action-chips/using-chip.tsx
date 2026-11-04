'use client'

import { enchantOf } from '../../utils/enchantments'
import { viewOf } from '../action-entry/utils'
import { CheckChip } from './check-chip'
import { EnchantChip } from './enchant-chip'
import { PlainUseChip } from './plain-use-chip'
import type { ActionRows } from '../action-entry/types'
import type { SheetAction, SheetUses } from '@/types/sending-stone'

/**
 * Using an action in the game, as a chip: its check's, for an activity that asks for one, such as
 * Fast Hands' Sleight of Hand; for one that enchants, as `EnchantChip` has it; or else, while the
 * game takes spells and features, one that uses it.
 */
export function UsingChip({
  action,
  view,
  rows,
  uses,
}: Readonly<{
  action: SheetAction
  view: ReturnType<typeof viewOf>
  rows: ActionRows
  /** The uses its row shows. */
  uses?: SheetUses | null
}>) {
  if (action.check) {
    return (
      <CheckChip
        action={action}
        check={action.check}
        rows={rows}
        onUse={view.uses.chip}
      />
    )
  }
  const enchant = enchantOf(action.activity)
  if (enchant && view.uses.chip) {
    return (
      <EnchantChip
        action={action}
        enchant={enchant}
        onUse={view.uses.chip}
        uses={uses}
      />
    )
  }
  return (
    view.uses.chip && (
      <PlainUseChip action={action} onUse={view.uses.chip} uses={uses} />
    )
  )
}
