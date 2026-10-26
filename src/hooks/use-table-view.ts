import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { rollsKey } from '@/utils/roll-requests'
import type { TableView } from '@/types/table'

export type Connection = 'live' | 'reconnecting'

/** How often to ask for news, in milliseconds. */
export const POLL_INTERVAL = 3000

/** The longest wait between attempts while the server cannot be reached. */
const MAX_DELAY = 30_000

/** What the viewer has of a view, which the server compares to say nothing is new. */
function seenOf(view: TableView) {
  return {
    version: view.version,
    live: view.live,
    sheetVersion: view.sheetVersion,
    rolls: rollsKey(view.rollsToTable, view.rollFeatures),
    // For the Gamemaster's seat (#156): where their rolls go.
    gm: view.gm?.rolls,
    // For the player's: where the Gamemaster's rolls as their character stand.
    gmRolls: view.gmRollsKey,
    // From module 0.31.0: whether the seat may move its character's items and coins.
    moves: view.moves !== undefined,
    // From module 0.32.0: whether the player types in their own dice, which another of their
    // devices may change.
    typed: view.manualDice?.on === true,
    // From module 0.33.0: whether the seat may remove its character's items.
    removes: view.removes === true,
    // From module 0.37.0: whether the player may change its character's favorites.
    favorites: view.favorites === true,
    // From module 0.39.0: whether the player may change its character's own effects.
    effects: view.effects === true,
  }
}

/**
 * Keep a character's view of its campaign current by polling for changes, including the
 * Gamemaster's game going offline or coming back. Polling pauses while the
 * page is in the background and catches up as soon as it is back.
 * @param api - The seat's API base: the character's, such as `/api/characters/<id>`, or the
 *   Gamemaster's at its sheet (#156).
 * @param initial - The view the page was rendered with.
 */
export function useTableView(api: string, initial: TableView) {
  const router = useRouter()
  const [view, setView] = useState(initial)
  const [connection, setConnection] = useState<Connection>('live')
  const seen = useRef(seenOf(initial))

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let stopped = false

    const poll = async () => {
      try {
        const {
          version,
          live,
          sheetVersion,
          rolls,
          gm,
          gmRolls,
          moves,
          typed,
          removes,
          favorites,
          effects,
        } = seen.current
        const query = new URLSearchParams({
          version: String(version),
          live: live ? '1' : '0',
          ...(rolls && { rolls }),
          ...(gm && { gm }),
          ...(gmRolls && { gmrolls: gmRolls }),
          ...(moves && { moves: '1' }),
          ...(typed && { typed: '1' }),
          ...(removes && { removes: '1' }),
          ...(favorites && { favorites: '1' }),
          ...(effects && { effects: '1' }),
          ...(sheetVersion && { sheet: sheetVersion }),
        })
        const response = await fetch(`${api}/table?${query}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (response.status === 401 || response.status === 404) {
          // Signed out, the character was removed, or it left the Gamemaster's campaign: let the
          // page show why.
          stopped = true
          router.refresh()
          return
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        if (response.status === 200) {
          const next = (await response.json()) as TableView
          seen.current = seenOf(next)
          // A sheet left out is the one this page already has.
          setView(held =>
            next.sheet === undefined && next.sheetVersion !== undefined
              ? { ...next, sheet: held.sheet }
              : next,
          )
        }
        failures = 0
        setConnection('live')
      } catch {
        if (controller.signal.aborted) return
        failures += 1
        setConnection('reconnecting')
      }
    }

    const tick = async () => {
      timer = undefined
      if (document.visibilityState !== 'hidden') await poll()
      if (stopped || controller.signal.aborted) return
      const delay = failures
        ? Math.min(POLL_INTERVAL * 2 ** failures, MAX_DELAY)
        : POLL_INTERVAL
      timer = setTimeout(tick, delay)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && timer) {
        clearTimeout(timer)
        void tick()
      }
    }

    timer = setTimeout(tick, POLL_INTERVAL)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [api, router])

  return { view, connection }
}
