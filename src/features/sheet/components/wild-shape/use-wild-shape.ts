import { useMemo, useRef, useState } from 'react'
import { LAST_FORM_KEY } from './constants'
import { useBeasts } from './use-beasts'
import { useReturnConfirm } from './use-return-confirm'
import { useWildShapeCommands } from './use-wild-shape-commands'
import { useWildShapeDialog } from './use-wild-shape-dialog'
import { useWildShapeFocus } from './use-wild-shape-focus'
import { useStoredText } from '@/hooks/use-stored'
import { usableForm, canReturn } from '@/utils/wild-shape'
import type { Focus, Refusal, WildShapeValue } from './types'
import type { WildShapeForms } from '@/features/rolling/types'
import type {
  TableRollState,
  WildShapeInput,
  WildShapeLogged,
} from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { TableSheet } from '@/types/table'

/**
 * What a pane offers of its character's Wild Shape, from module 0.40.0, and its one dialog's state,
 * held here so that it outlives the row it was opened from as a new sheet arrives.
 * @param on - Whether its player may use Wild Shape from here: the view offers it, at the
 *   character's own pane.
 * @param pane - Whether it's the character's own pane, which has the ribbon and notes, not a
 *   creature's.
 * @param send - Sends a change, a return or a Beast learned, logging it among the rolls: its local
 *   id.
 * @param read - Asks the game for the Beasts to learn, logging nothing.
 * @param panel - The shown tab's panel, which takes focus after a return.
 */
export function useWildShape({
  on,
  pane,
  role,
  name,
  sheet,
  characterId,
  effects,
  states,
  send,
  read,
  panel,
}: Readonly<{
  on: boolean
  pane: boolean
  role: SeatRole
  name: string
  sheet: TableSheet
  characterId: string
  effects: boolean
  states: ReadonlyMap<string, TableRollState>
  send: (
    input: Exclude<WildShapeInput, { op: 'forms' }>,
    logged: WildShapeLogged,
  ) => string
  read: () => Promise<WildShapeForms>
  panel: () => HTMLElement | null
}>): WildShapeValue {
  const block = sheet.wildShape
  const { form } = sheet
  const [refusal, setRefusal] = useState<Refusal>()
  const [focus, setFocus] = useState<Focus>()
  const [last, keepLast] = useStoredText(`${LAST_FORM_KEY}:${characterId}`)
  const heading = useRef<HTMLHeadingElement>(null)
  const body = useRef<HTMLDivElement>(null)
  // The Return pressed, for focus to go back to once the return is made.
  const pressed = useRef<HTMLElement>(undefined)
  const { beasts, loadBeasts } = useBeasts(read)
  const offered = useMemo(
    () =>
      (block?.known ?? []).filter(
        known => usableForm(known) && known.id !== form?.profile,
      ),
    [block, form],
  )
  const dialog = useWildShapeDialog({
    offered,
    last,
    refusal,
    setRefusal,
    setFocus,
    loadBeasts,
    keepLast,
    body,
    pressed,
  })
  const { waiting, change, revert, learn } = useWildShapeCommands({
    on,
    name,
    sheet,
    states,
    send,
    checked: dialog.checked,
    setRefusal,
    made: sent => dialog.made(sent, sheet),
  })
  useWildShapeFocus({ focus, setFocus, heading, body, panel })
  const { returnAnchor, openReturn, closeReturn } = useReturnConfirm({
    returnable: on && canReturn(sheet),
    form,
    setFocus,
    confirm: anchor => {
      pressed.current = anchor
      revert()
    },
  })

  return {
    on,
    pane,
    role,
    name,
    sheet,
    block,
    form,
    effects,
    offered,
    waiting,
    refusal,
    view: block ? dialog.view : undefined,
    fromPicker: dialog.fromPicker,
    checked: dialog.checked,
    pick: dialog.pick,
    change,
    beast: dialog.beast,
    pickBeast: dialog.pickBeast,
    learn,
    beasts,
    loadBeasts,
    openPicker: dialog.openPicker,
    openKnown: dialog.openKnown,
    showKnown: dialog.showKnown,
    showLearn: dialog.showLearn,
    back: dialog.back,
    close: dialog.close,
    returnAnchor,
    openReturn,
    closeReturn,
    heading,
    body,
    panel,
  }
}
