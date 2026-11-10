'use client'

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  answeredRoll,
  answerOf,
  askEntry,
} from '@/features/rolling/utils/dice-ask-entry'
import { typingInText } from '@/features/rolling/utils/text-focus'
import type { EnterDice } from '@/types/dice-entry'
import type { DiceAnswerTerm, LocalFormula, TableRollState } from '@/types/roll'
import type { TableDiceAsk } from '@/types/table'

/**
 * The dice the game asks the player for, for later rolls in their typed rolls' runs, from module
 * 0.45.0. On the device that sent the roll an ask is for, the dice dialog opens by itself, unless
 * they're typing in a text field there, such as the chat's, or this device doesn't send their
 * rolls; on their other devices, or then, its banner offers it (`offered`): Type in, which opens
 * it, or Let the game roll. Done sends what they typed, a die skipped left to the game; Let the
 * game roll, in the dialog or the banner, leaves the game every die; and a dialog that closes by
 * itself, its time out or the ask closed elsewhere, sends nothing, as the game rolls it anyway.
 * Each ask is taken once on a page, and its dialog closes once it's no longer asked. Each answer
 * is kept in the tray, as a formula rolled.
 * @param asks - What the pane's view lists, oldest first.
 * @param states - The pane's rolls' ways to the game, by which the device that sent one is known.
 * @param sending - Whether this device sends the player's rolls to the game.
 */
export function useDiceAsks({
  asks = [],
  states,
  sending,
  enter,
  logAnswer,
  sendAnswer,
}: Readonly<{
  asks?: TableDiceAsk[]
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

  const take = useCallback((id: string): boolean => {
    if (takenNow.current.has(id)) return false
    takenNow.current.add(id)
    setTaken(held => new Set(held).add(id))
    return true
  }, [])

  const answer = useCallback(
    (ask: TableDiceAsk, values?: number[][]) => {
      const kept = logAnswer(answeredRoll(ask, values))
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
      open.current.delete(ask.id)
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

  // Asks new to this page: opened at once on the device whose roll each is for, as the latest
  // render has it; and the dialogs of those no longer asked closed.
  const arrive = useEffectEvent((listed: TableDiceAsk[]) => {
    const ids = new Set(listed.map(({ id }) => id))
    for (const [id, controller] of open.current) {
      if (!ids.has(id)) controller.abort()
    }
    if (!sending || typingInText(document.activeElement)) return
    for (const ask of listed) {
      const ours = [...states.values()].some(
        ({ requestId }) => requestId === ask.command,
      )
      // One this page took already, `typeIn` leaves alone.
      if (ours) void typeIn(ask)
    }
  })
  useEffect(() => arrive(asks), [asks])

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
