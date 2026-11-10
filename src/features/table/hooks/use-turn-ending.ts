import { useEffect, useRef, useState } from 'react'
import { useEndTurn } from './use-end-turn'
import { useHold } from './use-hold'
import { useTurnUndo } from './use-turn-undo'
import {
  END_TURN_QUIET_CLICKS,
  holdDescription,
  newlyNotMade,
  refusalKey,
  turnKey,
} from '@/features/table/utils/end-turn'
import type { EndTurnState, TabHold } from '@/features/table/types'
import type { RollKind } from '@/types/roll'
import type { EndableTurn, TableView } from '@/types/table'

/** No rolls the game takes from here, the same each time. */
const NO_KINDS: readonly RollKind[] = []

/**
 * Why the last End Turn wasn't made, which the turn panel says while it shows that turn: by the
 * turn and its way's reason, as a refusal by this app's own server has no id. A change of tab keeps
 * it, in either layout: it goes as the turn moves on, or as End Turn is pressed again (v0.44).
 */
function useRefusal(ending: EndTurnState) {
  const [refused, setRefused] = useState<{ turn: EndableTurn; key: string }>()
  const lastSent = useRef(ending.sent)
  useEffect(() => {
    const was = lastSent.current
    lastSent.current = ending.sent
    if (newlyNotMade(was, ending.sent)) {
      setRefused({ turn: ending.sent.turn, key: refusalKey(ending.sent.way) })
    }
  }, [ending.sent])
  const turnShown = ending.turn && turnKey(ending.turn)
  if (refused && turnShown !== turnKey(refused.turn)) setRefused(undefined)
  return [refused, setRefused] as const
}

/**
 * The Combat tab held to end the turn: whether a hold is past half a second, which its toast says;
 * and once a hold has ended the turn, the page's tabs ignore clicks for a moment, so that the click
 * that ends the press, wherever it lands, opens nothing.
 * @param onEnd - Ends the turn the hold was made on.
 */
function useTurnHold(ending: EndTurnState, onEnd: (turn: EndableTurn) => void) {
  const [held, setHeld] = useState(false)
  const quietUntil = useRef(0)
  const quiet = () => performance.now() < quietUntil.current
  const hold = useHold({
    key: ending.offered && ending.turn ? turnKey(ending.turn) : undefined,
    onToast: () => setHeld(true),
    onEnd: () => {
      quietUntil.current = performance.now() + END_TURN_QUIET_CLICKS
      setHeld(false)
      if (ending.turn) onEnd(ending.turn)
    },
    onCancel: () => setHeld(false),
  })
  return { held, quiet, hold }
}

/**
 * End Turn at the table (module 0.36.0): the seat's turn, its character's or a companion's, ended
 * from the turn panel's button or the Combat tab held, with Undo in the toast that follows;
 * wherever the game takes it from here. A character no longer in its campaign's game ends no turn.
 * It composes `useEndTurn`, `useTurnUndo` and `useHold`, each as it is.
 * @param api - The seat's API base, which its rolls go through.
 * @param gm - Whether the seat is the Gamemaster's.
 * @param sideBySide - Whether the sheet and the combat or chat column sit side by side.
 * @param combatShown - Whether the combat pane is shown.
 * @returns End Turn and Undo; how the last End Turn was sent, and why it wasn't made; `endTurn`;
 *   whether a hold is past half a second, and whether the tabs ignore clicks now; the Combat tab of
 *   each layout, and where focus on the turn goes; and `holdOf`, the hold as a Combat tab takes it.
 */
export function useTurnEnding({
  api,
  gm,
  view,
  sideBySide,
  combatShown,
}: {
  api: string
  gm: boolean
  view: TableView
  sideBySide: boolean
  combatShown: boolean
}) {
  const kinds = (view.connected && view.rollsToTable) || NO_KINDS
  const ending = useEndTurn({ api, gm, combat: view.combat, kinds })
  const undoing = useTurnUndo({
    api,
    gm,
    combat: view.combat,
    kinds,
    sent: ending.sent,
  })
  // How the last End Turn was sent, by the button or by a hold.
  const [via, setVia] = useState<'button' | 'hold'>()
  const [refused, setRefused] = useRefusal(ending)
  const endTurn = (turn: EndableTurn, how: 'button' | 'hold') => {
    setVia(how)
    setRefused(undefined)
    ending.end(turn)
  }
  const { held, quiet, hold } = useTurnHold(ending, turn =>
    endTurn(turn, 'hold'),
  )
  // The Combat tab of each layout: the bottom bar's or rail's, and the column's.
  const barCombat = useRef<HTMLButtonElement>(null)
  const columnCombat = useRef<HTMLButtonElement>(null)
  // Focus, where the control under it goes, as Undo does: to the turn panel's heading where the
  // combat pane is shown, else to the Combat tab of the layout shown, never the page's body.
  const focusTurn = () => {
    const heading = document.querySelector<HTMLElement>('#turn-heading')
    if (combatShown && heading) {
      heading.focus({ preventScroll: true })
      return
    }
    const combatTab = sideBySide ? columnCombat : barCombat
    combatTab.current?.focus()
  }
  // The Combat tab held to end the turn, on the layout shown: its handlers on it always, which do
  // nothing with no turn to end; while one may be ended, its fill and what it's described as.
  const offeredTurn = ending.offered ? ending.turn : undefined
  const holdOf = (id: string, shown: boolean): TabHold => ({
    handlers: hold.handlers,
    holding: shown && hold.holding,
    touch: shown && (offeredTurn !== undefined || hold.pressed),
    offer:
      shown && offeredTurn
        ? { fill: hold.fill, id, description: holdDescription(offeredTurn) }
        : undefined,
  })
  return {
    ending,
    undoing,
    via,
    refused,
    endTurn,
    held,
    quiet,
    barCombat,
    columnCombat,
    focusTurn,
    holdOf,
  }
}
