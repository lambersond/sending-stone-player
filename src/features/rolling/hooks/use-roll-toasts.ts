'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  dropToast,
  dueToasts,
  NO_TOASTS,
  popToasts,
  TOAST_FADE,
} from '@/features/rolling/utils/roll-toasts'
import type { RollToast } from '@/features/rolling/types'
import type { LocalRoll, TableRollState } from '@/types/roll'

/**
 * The player's rolls as toasts: each pops up as it's met, and again as its way to the game ends,
 * for `TOAST_FOR` milliseconds, fading for its last `TOAST_FADE` (`leaving`); or until the player
 * taps it away, or closes it (`dismiss`). One whose roll waits for the player stays until it no
 * longer does. None while toasts are off, nor for the rolls made meanwhile.
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
    // Looked at again as the rolls change, so that a toast set to go at once, as its damage is
    // rolled, starts to fade then, not a timer later, and fades for all its time; any whose time
    // has passed goes with it.
    const at = Date.now()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the clock after commit
    setNow(at)
    setBook(held => dueToasts(popToasts(held, rolls, states, at, on), at))
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
