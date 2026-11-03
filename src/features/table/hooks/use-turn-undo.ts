'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NO_DICE } from '@/constants/roll-kinds'
import { useSendChoice } from '@/features/rolling/hooks/use-send-choice'
import { nextFollowed } from '@/features/table/utils/end-turn'
import { useFollow } from '@/hooks/use-follow'
import type { Followed, UndoState } from '@/features/table/types'
import type { RollKind, RollRequestInput, TableRollState } from '@/types/roll'
import type { EndableTurn, TableCombat, TurnUndo } from '@/types/table'

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
}): UndoState {
  // As every hook on the page reads it, so that turning it off stops Undo too.
  const [choice] = useSendChoice(gm)

  // The End Turn the game said it made, by its id: only that may be taken back.
  const done = sent?.way.status === 'done' ? sent.way.requestId : undefined
  const [followed, setFollowed] = useState<Followed>({ over: false })
  const now = nextFollowed(followed, sent, done, combat)
  if (now !== followed) setFollowed(now)

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
  const follow = useFollow()

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
    const update = (state: TableRollState) => {
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
      ...NO_DICE,
    }
    update({ status: 'sending' })
    follow(api, input, update)
  }, [follow])

  return { offer, way, undo }
}
