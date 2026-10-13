'use client'

import { useCallback, useEffect, useState } from 'react'
import { useStoredChoice } from './use-stored'
import {
  dropToast,
  dueToasts,
  NO_TOASTS,
  popToasts,
  TOAST_CHOICES,
  TOAST_FADE,
  TOASTS_KEY,
  type RollToast,
} from '@/utils/roll-toasts'
import type { LocalRoll } from './use-sheet-roller'
import type { TableRollState } from './use-table-rolls'

/**
 * Whether the player's rolls pop up as toasts on this device, for every character: on until they
 * turn it off, in the sheet's settings.
 */
export function useToastSetting(): [boolean, (on: boolean) => void] {
  const [choice, choose] = useStoredChoice(TOASTS_KEY, TOAST_CHOICES, 'on')
  const turn = useCallback((on: boolean) => choose(on ? 'on' : 'off'), [choose])
  return [choice === 'on', turn]
}

/**
 * The player's rolls as toasts: each pops up as it's met, and again as its way to the game ends,
 * for `TOAST_FOR` milliseconds, fading for its last `TOAST_FADE` (`leaving`); or until the player
 * taps it away (`dismiss`). None while toasts are off, nor for the rolls made meanwhile.
 * @param rolls - Newest first, as the page keeps them.
 * @param states - Each roll's way to the game, by its id.
 * @param on - Whether the player has toasts on.
 */
export function useRollToasts(
  rolls: readonly LocalRoll[],
  states: ReadonlyMap<string, TableRollState>,
  on: boolean,
): {
  shown: (RollToast & { leaving: boolean })[]
  dismiss: (id: string) => void
} {
  const [book, setBook] = useState(NO_TOASTS)
  // When the toasts were last looked at, for which are fading: never later than now.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setBook(held => popToasts(held, rolls, states, Date.now(), on))
  }, [rolls, states, on])
  // One timer, for the next toast to start fading or to go.
  const next = Math.min(
    ...book.shown
      .flatMap(({ until }) => [until - TOAST_FADE, until])
      .filter(at => at > now),
  )
  useEffect(() => {
    if (!Number.isFinite(next)) return
    const timer = setTimeout(() => {
      const at = Date.now()
      setNow(at)
      setBook(held => dueToasts(held, at))
    }, next - Date.now())
    return () => clearTimeout(timer)
    // Again as `now` moves, should a timer have fired a moment early.
  }, [next, now])
  const dismiss = useCallback(
    (id: string) => setBook(held => dropToast(held, id)),
    [],
  )
  return {
    shown: book.shown.map(toast => ({
      ...toast,
      leaving: toast.until - TOAST_FADE <= now,
    })),
    dismiss,
  }
}
