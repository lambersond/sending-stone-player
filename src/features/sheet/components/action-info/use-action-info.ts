import { createElement, useState, type ReactNode } from 'react'
import { useDescriptionActions } from '../description-actions/use-description-actions'
import { ActionInfo } from './action-info'
import { spellOf } from './utils'
import type { ActivityInfo } from './types'
import type { SheetSpellSection } from '@/types/sending-stone'

/**
 * What there is to read of one of an item's activities folded beneath it, in a dialog, with no
 * roll buttons of its own, which stay on its row: its spell's, where it casts one the Spells tab
 * lists under the item, or else what its row has. Its description's links act as they do on the
 * sheet, and once one throws dice, or asks the table, the dialog closes, for the dice and the tray
 * behind it to be seen. `show` opens it; the dialog is in `dialog`, to be put on the page.
 */
export function useActionInfo(
  characterId: string,
  spellbook: SheetSpellSection[],
): { show: (info: ActivityInfo) => void; dialog: ReactNode } {
  const [info, setInfo] = useState<ActivityInfo>()
  const actions = useDescriptionActions()
  const spell = info && spellOf(info, spellbook)
  const close = () => setInfo(undefined)
  return {
    show: setInfo,
    dialog: createElement(ActionInfo, {
      info,
      spell,
      characterId,
      actions,
      onClose: close,
    }),
  }
}
