'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useStoredChoice } from './use-stored'
import {
  dropToast,
  dueToasts,
  NO_TOASTS,
  popToasts,
  TOAST_CHOICES,
  TOAST_FADE,
  toastTop,
  TOASTS_KEY,
  type RollToast,
} from '@/utils/roll-toasts'
import type { LocalRoll } from './use-sheet-roller'
import type { TableRollState } from './use-table-rolls'

/**
 * Whether the player's rolls pop up as toasts on this device, for every character, rather than
 * staying in a banner at the bottom of the sheet: toasts until they choose the banner, in the
 * sheet's settings. One or the other, never both.
 */
export function useToastSetting(): [boolean, (on: boolean) => void] {
  const [choice, choose] = useStoredChoice(TOASTS_KEY, TOAST_CHOICES, 'on')
  const turn = useCallback((on: boolean) => choose(on ? 'on' : 'off'), [choose])
  return [choice === 'on', turn]
}

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

/**
 * Where the toasts start, in pixels from the top of the screen (`toastTop`): below the game's
 * prompts beneath the sheet's row of tabs, while it asks any, else below the row, where it's shown,
 * else below the table's header; none where none is. It's measured before the browser first
 * paints, and again as the layout changes: as the window is resized or turned, the prompts come,
 * go or change, or the row, the pane it tops or the header change size, as the pane does when a
 * note above it, such as the Gamemaster's, comes or wraps, and the row when a phone shows another
 * pane. Not measured while toasts are off.
 * @param tabs - The sheet's row of tabs, with the rolls' button and the settings' cog.
 * @param header - The table's header.
 * @param prompts - The game's prompts beneath the row, while it asks any.
 */
export function useToastTop(
  on: boolean,
  tabs?: HTMLElement | null,
  header?: HTMLElement | null,
  prompts?: HTMLElement | null,
): number | undefined {
  const [top, setTop] = useState<number>()
  useLayoutEffect(() => {
    if (!on) return
    const measure = () => setTop(toastTop([prompts, tabs, header]))
    measure()
    const observer = new ResizeObserver(measure)
    for (const element of [prompts, tabs, tabs?.parentElement, header]) {
      if (element) observer.observe(element)
    }
    globalThis.addEventListener('resize', measure)
    globalThis.addEventListener('orientationchange', measure)
    return () => {
      observer.disconnect()
      globalThis.removeEventListener('resize', measure)
      globalThis.removeEventListener('orientationchange', measure)
    }
  }, [on, tabs, header, prompts])
  return top
}
