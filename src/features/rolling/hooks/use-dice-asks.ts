'use client'

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  answeredRoll,
  answerOf,
  askEntry,
} from '@/features/rolling/utils/dice-ask-entry'
import { answers } from '@/features/rolling/utils/roll-states'
import { typingInText } from '@/features/rolling/utils/text-focus'
import type { EnterDice } from '@/types/dice-entry'
import type { DiceAnswerTerm, LocalFormula, TableRollState } from '@/types/roll'
import type { TableDiceAsk } from '@/types/table'

/** No asks, the same each render, so that a view without any changes nothing. */
const NONE: readonly TableDiceAsk[] = []

/**
 * The dice the game asks the player for, for later rolls in their typed rolls' runs, from module
 * 0.44.0. On the device that sent the roll an ask is for, the dice dialog opens by itself, unless
 * they're typing in a text field there, such as the chat's, or this device doesn't send their
 * rolls; on their other devices, or then, its banner offers it (`offered`): Type in, which opens
 * it, or Let the game roll. Done sends what they typed, a die skipped left to the game; Let the
 * game roll, in the dialog or the banner, leaves the game every die; and a dialog that closes by
 * itself, its time out or the ask closed elsewhere, sends nothing, as the game rolls it anyway.
 * Whether an ask is for this device's roll is known once the app has told it the roll's id, a
 * moment after it was sent, which a view may list it before: until then it's on the banner, and
 * its dialog opens as the id comes. Each ask is taken once on a page, and its dialog closes once
 * it's no longer asked; one a view lists again after, as one that lost it for a moment, is asked
 * again. Each answer is kept in the tray, as a formula rolled; one that never reaches the game,
 * refused or lost on its way, leaves its ask on the banner again, never opened by itself.
 * @param asks - What the pane's view lists, oldest first.
 * @param states - The pane's rolls' ways to the game, by which the device that sent one is known.
 * @param sending - Whether this device sends the player's rolls to the game.
 */
export function useDiceAsks({
  asks = NONE,
  states,
  sending,
  enter,
  logAnswer,
  sendAnswer,
}: Readonly<{
  asks?: readonly TableDiceAsk[]
  states: ReadonlyMap<string, TableRollState>
  sending: boolean
  enter: EnterDice
  logAnswer: (
    answered: Omit<LocalFormula, 'kind' | 'id' | 'at'>,
  ) => LocalFormula
  sendAnswer: (
    answered: LocalFormula,
    diceAsk: string,
    answer: DiceAnswerTerm[],
  ) => void
}>) {
  // The asks this page has taken, by their ids: asked in its dialog, or answered.
  const [taken, setTaken] = useState<ReadonlySet<string>>(() => new Set())
  const takenNow = useRef(new Set<string>())
  // Each dialog open, to close as its ask closes, or the pane goes.
  const open = useRef(new Map<string, AbortController>())
  // The asks this page has known to be for its own rolls: each opened at once, or left on the
  // banner where the player was typing or this device doesn't send their rolls, never opened by
  // itself after.
  const known = useRef(new Set<string>())
  // The answers this page sent, by their asks' ids: the tray's roll each is kept as, whose way to
  // the game says whether it got there.
  const sentAnswers = useRef(new Map<string, string>())

  const take = useCallback((id: string): boolean => {
    if (takenNow.current.has(id)) return false
    takenNow.current.add(id)
    setTaken(held => new Set(held).add(id))
    return true
  }, [])

  // An ask this page took, on the banner again.
  const untake = useCallback((id: string) => {
    takenNow.current.delete(id)
    setTaken(held => {
      const kept = new Set(held)
      kept.delete(id)
      return kept
    })
  }, [])

  // An ask whose dialog closed as a view stopped listing it, as one again to this page.
  const release = useCallback(
    (id: string) => {
      untake(id)
      known.current.delete(id)
    },
    [untake],
  )

  const answer = useCallback(
    (ask: TableDiceAsk, values?: number[][]) => {
      const kept = logAnswer(answeredRoll(ask, values))
      sentAnswers.current.set(ask.id, kept.id)
      sendAnswer(kept, ask.id, answerOf(ask, values))
    },
    [logAnswer, sendAnswer],
  )

  const typeIn = useCallback(
    async (ask: TableDiceAsk) => {
      if (!take(ask.id)) return
      const controller = new AbortController()
      open.current.set(ask.id, controller)
      const values = await enter(askEntry(ask, controller.signal))
      if (open.current.get(ask.id) === controller) open.current.delete(ask.id)
      if (values) {
        answer(ask, values)
        return
      }
      // Closed by itself, its time out or its ask closed elsewhere, or with the pane: the game
      // rolls it anyway. Else the player let the game roll it.
      const out = Date.now() >= Date.parse(ask.expiresAt)
      if (!controller.signal.aborted && !out) answer(ask)
    },
    [answer, enter, take],
  )

  const leave = useCallback(
    (ask: TableDiceAsk) => {
      if (take(ask.id)) answer(ask)
    },
    [answer, take],
  )

  // As the view's asks or this page's rolls change: the asks whose answers never reached the game
  // on the banner again; the dialogs of asks no longer listed closed, each such ask forgotten, so
  // that one listed again is asked again; and those newly known to be for this device's rolls, as
  // the latest render has them, opened at once.
  const arrive = useEffectEvent((listed: readonly TableDiceAsk[]) => {
    for (const [id, local] of sentAnswers.current) {
      const way = states.get(local)
      if (!way || answers(way)) continue
      sentAnswers.current.delete(id)
      known.current.add(id)
      untake(id)
    }
    const ids = new Set(listed.map(({ id }) => id))
    for (const [id, controller] of open.current) {
      if (ids.has(id)) continue
      open.current.delete(id)
      controller.abort()
      release(id)
    }
    for (const id of known.current) {
      if (!ids.has(id)) known.current.delete(id)
    }
    const sent = new Set([...states.values()].map(({ requestId }) => requestId))
    const ours = listed.filter(
      ({ id, command }) => !known.current.has(id) && sent.has(command),
    )
    for (const { id } of ours) known.current.add(id)
    if (!sending || typingInText(document.activeElement)) return
    // One this page took already, `typeIn` leaves alone.
    for (const ask of ours) void typeIn(ask)
  })
  useEffect(() => arrive(asks), [asks, states])

  // The pane going closes its dialogs first, so that none is taken as the player letting the game
  // roll it.
  useEffect(() => {
    const dialogs = open.current
    return () => {
      for (const controller of dialogs.values()) controller.abort()
    }
  }, [])

  return {
    /** The asks the banner offers: those this page hasn't taken. */
    offered: asks.filter(({ id }) => !taken.has(id)),
    typeIn: (ask: TableDiceAsk) => void typeIn(ask),
    leave,
  }
}
