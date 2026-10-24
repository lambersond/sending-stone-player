'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStoredChoice } from '@/hooks/use-stored'
import {
  follow,
  GM_SEND_KEY,
  SEND_CHOICES,
  SEND_KEY,
  type TableRollState,
} from '@/hooks/use-table-rolls'
import type { EndedTurn, RollKind, RollRequestInput } from '@/types/roll'
import type { EndableTurn, TableCombat, TurnUndo } from '@/types/table'

/**
 * The End Turn this hook follows, by its id, as the page has shown its combat since the game said
 * it was made: the turn it left the combat on, once the page has shown one; and whether it can no
 * longer be taken back from here, as once the page has shown another turn since, or none, or an
 * Undo was sent for it.
 */
type Followed = {
  id?: string
  left?: TurnUndo['left']
  over: boolean
}

/**
 * The turn the page shows: its combat's, while that's started and someone it shows is acting, with
 * who that is. None before the start, or while a combatant hidden from players acts.
 */
function shownTurn(
  combat: TableCombat | undefined,
): TurnUndo['left'] | undefined {
  if (!combat?.started || combat.currentId === undefined) return undefined
  const current = combat.combatants.find(({ id }) => id === combat.currentId)
  if (!current) return undefined
  return {
    combatId: combat.id,
    round: combat.round,
    combatantId: current.id,
    name: current.name,
    mine: current.side === 'me',
  }
}

/** Whether two turns are the same: the same combat, round and current combatant. */
function sameTurn(one: EndedTurn, other: EndedTurn): boolean {
  return (
    one.combatId === other.combatId &&
    one.round === other.round &&
    one.combatantId === other.combatantId
  )
}

/**
 * Undo, for a character's page (module 0.36.0): the End Turn this page sent last, once the game
 * says it ended the turn, offered to take back while the page shows the turn it left the combat
 * on; the way of the Undo sent, followed to its end whichever turn is shown, with the End Turn
 * it's for; and `undo`, which sends it. The turn it left is the one the page shows when the
 * game's answer comes, where it has moved on already, as the game moves the turn before it
 * answers; else the first other turn it shows after. It's offered while the game takes it and Send
 * to the table is on, on this device, and goes for good once the page shows any other turn, or
 * none, as when the one acting next is hidden from players, or once it's sent. Another End Turn
 * starts afresh. It reads no turn index: the turn left is named by its combat, round and current
 * combatant.
 * @param api - The seat's API base, which its rolls go through.
 * @param gm - Whether the seat is the Gamemaster's, whose Send to the table is a switch of its own.
 * @param combat - The combat as the page's view shows it.
 * @param kinds - The rolls the game takes from this page now: none while the character isn't in its
 *   campaign's game.
 * @param sent - The last End Turn this page sent, with its way, as `useEndTurn` follows it.
 */
export function useTurnUndo({
  api,
  gm,
  combat,
  kinds,
  sent,
}: {
  api: string
  gm: boolean
  combat?: TableCombat
  kinds: readonly RollKind[]
  sent?: { turn: EndableTurn; way: TableRollState }
}): {
  offer?: TurnUndo
  way?: TableRollState & { for: string }
  undo: () => void
} {
  // As every hook on the page reads it, so that turning it off stops Undo too.
  const [choice] = useStoredChoice(
    gm ? GM_SEND_KEY : SEND_KEY,
    SEND_CHOICES,
    'on',
  )

  // The End Turn the game said it made, by its id: only that may be taken back.
  const done = sent?.way.status === 'done' ? sent.way.requestId : undefined
  const [followed, setFollowed] = useState<Followed>({ over: false })
  let now = followed
  if (sent && done !== undefined) {
    if (now.id !== done) now = { id: done, over: false }
    if (!now.over) {
      const shown = shownTurn(combat)
      if (now.left === undefined) {
        // Still on the turn it ended, as in a view from before the game moved it: the next turn
        // shown is the one it left. Another combat, or none, and there's nothing to take back to.
        if (!shown || shown.combatId !== sent.turn.combatId) {
          now = { ...now, over: true }
        } else if (!sameTurn(shown, sent.turn)) {
          now = { ...now, left: shown }
        }
      } else if (!shown || !sameTurn(shown, now.left)) {
        // The combat has moved on from where it left it, or back: it's gone for good.
        now = { ...now, over: true }
      }
    }
    if (now !== followed) setFollowed(now)
  }

  const taking = kinds.includes('undoEndTurn') && choice === 'on'
  const left = now.id === done && !now.over ? now.left : undefined
  const turn = sent?.turn
  const offer = useMemo<TurnUndo | undefined>(
    () =>
      taking && done !== undefined && turn && left
        ? { requestId: done, turn, left }
        : undefined,
    [taking, done, turn, left],
  )

  // As the latest render has it, so that `undo` sends only what's offered now, whenever it's
  // called.
  const latest = useRef({ api, offer })
  useEffect(() => {
    latest.current = { api, offer }
  })
  // The End Turns an Undo was sent for, so that two calls at once send one.
  const undone = useRef(new Set<string>())
  const running = useRef(new Set<AbortController>())
  useEffect(() => {
    const controllers = running.current
    return () => {
      for (const controller of controllers) controller.abort()
    }
  }, [])

  // The last Undo sent and its way, and how many have been, so that only the last is told.
  const [way, setWay] = useState<TableRollState & { for: string }>()
  const sends = useRef(0)

  const undo = useCallback(() => {
    const { api, offer } = latest.current
    if (!offer || undone.current.has(offer.requestId)) return
    const of = offer.requestId
    undone.current.add(of)
    // Sent once: it's offered no more.
    setFollowed(held => (held.id === of ? { ...held, over: true } : held))
    const which = (sends.current += 1)
    const controller = new AbortController()
    running.current.add(controller)
    const update = (state: TableRollState) => {
      if (controller.signal.aborted) return
      if (sends.current === which) setWay({ ...state, for: of })
    }
    // Its words are the page's: only which End Turn, and the turn it left, by its combat, round
    // and current combatant.
    const input: RollRequestInput = {
      kind: 'undoEndTurn',
      undo: of,
      turn: {
        combatId: offer.left.combatId,
        round: offer.left.round,
        combatantId: offer.left.combatantId,
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

  return { offer, way, undo }
}
