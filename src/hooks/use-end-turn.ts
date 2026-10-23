'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useStoredChoice } from '@/hooks/use-stored'
import {
  follow,
  GM_SEND_KEY,
  SEND_CHOICES,
  SEND_KEY,
  type TableRollState,
} from '@/hooks/use-table-rolls'
import { POLL_INTERVAL } from '@/hooks/use-table-view'
import {
  END_TURN_ARMS_AFTER,
  endableTurn,
  TURN_OVER,
  turnKey,
} from '@/utils/end-turn'
import type { RollKind, RollRequestInput } from '@/types/roll'
import type { EndableTurn, TableCombat } from '@/types/table'

/**
 * How long a turn whose End Turn says it's over is held back while the page still shows it in the
 * same view of the combat, in milliseconds: two of the table's polls, by which that view is the
 * latest, so the turn it shows is the turn now, as when the Gamemaster's Previous Turn came back
 * to it before the game's answer did.
 */
const OVER_FOR = 2 * POLL_INTERVAL

/**
 * The turn the page shows, as this hook has it: which, by its key; how many turns have been shown
 * before it, so that what's heard of an End Turn sent for one of those is never taken for it, even
 * where it's the same turn shown again; whether it has been shown long enough to be offered; and
 * the way of the End Turn sent for it, if one was.
 */
type Shown = {
  key?: string
  serial: number
  armed: boolean
  way?: TableRollState
  /**
   * Once that way says the turn is over, the view of the combat the page showed then. The game
   * moves the turn before it answers, so a newer view still showing the turn is the turn shown
   * again, as after the Gamemaster's Previous Turn, though the page never saw the turn between.
   */
  overIn?: TableCombat
}

/**
 * Whether an End Turn's way says its turn is over: the game ended it, or it was refused as a turn
 * that's over, or never the seat's.
 */
function isOver(way: TableRollState | undefined): boolean {
  if (!way) return false
  if (way.status === 'done') return true
  return (
    (way.status === 'failed' || way.status === 'refused') &&
    way.reason !== undefined &&
    TURN_OVER.has(way.reason)
  )
}

/**
 * Whether an End Turn's way keeps its turn from being offered again: it's on its way to the game,
 * or it says the turn is over. Any other end, such as too many rolls at once, or no answer, lets
 * it be sent again.
 */
function holds(way: TableRollState | undefined): boolean {
  return way?.status === 'sending' || way?.status === 'rolling' || isOver(way)
}

/**
 * End Turn, for a character's page (module 0.36.0): the turn it may end, the seat's character's or
 * one of its companions', while the game takes it and Send to the table is on, on this device;
 * whether it's offered now; the way of the one sent for it; the last one sent, with its way
 * followed to its end whichever turn is shown, for the toast to say how it went; and `end`, which
 * sends it. A turn is offered once it has been shown for a moment (`END_TURN_ARMS_AFTER`), and not
 * while one sent for it is on its way, nor once it's ended or refused as over. What's kept is kept
 * for the turn shown only: a turn ended once and shown again, as by the Gamemaster's Previous
 * Turn, is offered again, whether or not the page saw another turn between, and the game tells
 * whether it still may be ended.
 * @param api - The seat's API base, which its rolls go through.
 * @param gm - Whether the seat is the Gamemaster's, whose Send to the table is a switch of its own.
 * @param combat - The combat as the page's view shows it: a new object only with a newer view, as
 *   the table's poll gives it.
 * @param kinds - The rolls the game takes from this page now: none while the character isn't in its
 *   campaign's game.
 */
export function useEndTurn({
  api,
  gm,
  combat,
  kinds,
}: {
  api: string
  gm: boolean
  combat?: TableCombat
  kinds: readonly RollKind[]
}): {
  turn?: EndableTurn
  offered: boolean
  way?: TableRollState
  sent?: { turn: EndableTurn; way: TableRollState }
  end: (turn: EndableTurn) => void
} {
  // As every hook on the page reads it, so that turning it off stops End Turn too.
  const [choice] = useStoredChoice(
    gm ? GM_SEND_KEY : SEND_KEY,
    SEND_CHOICES,
    'on',
  )
  const turn = choice === 'on' ? endableTurn(combat, kinds) : undefined
  const key = turn ? turnKey(turn) : undefined

  const [shown, setShown] = useState<Shown>({ key, serial: 0, armed: false })
  // Another turn shown, or none; or a turn said to be over shown in a newer view of the combat:
  // what was kept of the last is forgotten, and this one waits a moment.
  let now = shown
  if (
    shown.key !== key ||
    (shown.overIn !== undefined && combat !== shown.overIn)
  ) {
    now = { key, serial: shown.serial + 1, armed: false }
    setShown(now)
  }
  const offered = turn !== undefined && now.armed && !holds(now.way)

  const { serial, armed } = now
  useEffect(() => {
    if (key === undefined || armed) return
    const timer = setTimeout(() => {
      setShown(held =>
        held.serial === serial ? { ...held, armed: true } : held,
      )
    }, END_TURN_ARMS_AFTER)
    return () => clearTimeout(timer)
  }, [key, serial, armed])

  // A turn said to be over, still shown two polls on with no newer view: so it's the turn now, as
  // when a view the page had before the game's answer already showed it back.
  const over = now.overIn !== undefined
  useEffect(() => {
    if (!over) return
    const timer = setTimeout(() => {
      setShown(held =>
        held.serial === serial
          ? { key: held.key, serial: serial + 1, armed: false }
          : held,
      )
    }, OVER_FOR)
    return () => clearTimeout(timer)
  }, [serial, over])

  // As the latest render has them, so that `end` sends only the turn shown now, whenever it's
  // called.
  const latest = useRef({ api, combat, shown: now, offered })
  useEffect(() => {
    latest.current = { api, combat, shown: now, offered }
  })
  // The turn shown an End Turn is on its way for, by its serial, so that two calls at once, as a
  // tap and a hold together, send one.
  const sending = useRef<number | undefined>(undefined)
  const running = useRef(new Set<AbortController>())
  useEffect(() => {
    const controllers = running.current
    return () => {
      for (const controller of controllers) controller.abort()
    }
  }, [])

  // The last End Turn sent and its way, and how many have been, so that only the last is told.
  const [sent, setSent] = useState<{ turn: EndableTurn; way: TableRollState }>()
  const sends = useRef(0)

  const end = useCallback((given: EndableTurn) => {
    const { api, shown, offered } = latest.current
    // Only the turn the tap or the hold was made on, while it's still the one shown.
    if (!offered || turnKey(given) !== shown.key) return
    const at = shown.serial
    if (sending.current === at) return
    sending.current = at
    const which = (sends.current += 1)
    const controller = new AbortController()
    running.current.add(controller)
    const update = (way: TableRollState) => {
      if (controller.signal.aborted) return
      if (!holds(way) && sending.current === at) sending.current = undefined
      // Its way is its turn's while that's the one shown; once it says the turn is over, with the
      // view the page showed then.
      const overIn = isOver(way) ? latest.current.combat : undefined
      setShown(held => (held.serial === at ? { ...held, way, overIn } : held))
      // And the toast's while it's the last sent, whichever turn is shown now.
      if (sends.current === which) setSent({ turn: given, way })
    }
    // Its words are the page's: only which turn is sent, by its combat, round and combatant.
    const input: RollRequestInput = {
      kind: 'endTurn',
      turn: {
        combatId: given.combatId,
        round: given.round,
        combatantId: given.combatantId,
      },
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    }
    update({ status: 'sending' })
    void follow(api, input, controller.signal, update, () => {}).finally(() =>
      running.current.delete(controller),
    )
  }, [])

  return { turn, offered, way: now.way, sent, end }
}
