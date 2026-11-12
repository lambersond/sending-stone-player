'use client'

import { useEffect, useRef, useState } from 'react'
import { POLL_INTERVAL, POLL_MOST_DELAY } from '@/constants/polling'
import { useReadAgain } from '@/hooks/use-read-again'
import { retryDelay } from '@/utils/polling'
import { rollsKey } from '@/utils/requests/availability'
import { seenQuery } from '@/utils/seen-query'
import type { CompanionView, Connection } from '@/types/table'

/** What a pane has of a companion's view, which the server compares to say nothing is new. */
function queryOf(view: CompanionView | undefined): URLSearchParams {
  if (!view) return new URLSearchParams()
  return seenQuery({
    version: view.version,
    live: view.live,
    rolls: rollsKey(view.rollsToTable, view.rollFeatures),
    // For the Gamemaster's seat: where their rolls go.
    gm: view.gm?.rolls,
    // For the player's: where the Gamemaster's rolls as it stand.
    gmrolls: view.gmRollsKey,
    // Whether the player types in their own dice, which another of their devices may change.
    typed: view.manualDice?.on,
    // From module 0.44.0: whether the player may set its hit points.
    hitpoints: view.hitPoints,
    sheet: view.sheetVersion,
  })
}

/**
 * Keep a companion's view current for its pane (module 0.36.0), as a character's table view is
 * kept: asked for once as the pane mounts, at once whenever the pane is shown again, then every few
 * seconds while it's shown, and never while it's hidden, nor while the page is in the background.
 * While the server can't be reached it says it's reconnecting, and backs off as the table's poll
 * does. A sheet left out is the one the pane has already. Once its API answers 404, the companion
 * is no longer the seat's character's, or the seat's own: it's gone, and asked for no more, its
 * last view kept with nothing to roll and not connected. A 404 or a 401 is the server's answer, so
 * neither leaves it reconnecting. While it's shown, as a roll the game answered ends (ROADMAP item
 * 39), `readAgain` reads it at once, or as soon as a read on its way has come, and once more a
 * moment later, as the character's table is read.
 * @param api - The companion's API base: the seat's own API and `/companions/<key>`.
 * @param active - Whether its pane is the one shown.
 */
export function useCompanionView(
  api: string,
  { active }: { active: boolean },
): {
  view?: CompanionView
  gone: boolean
  connection: Connection
  readAgain: () => void
} {
  const [view, setView] = useState<CompanionView>()
  const [gone, setGone] = useState(false)
  const [connection, setConnection] = useState<Connection>('live')
  // As the latest answer has them, for what's asked next.
  const held = useRef<CompanionView | undefined>(undefined)
  const stopped = useRef(false)
  // Whether the server has answered yet: asked as it mounts, shown or not, until it has.
  const answered = useRef(false)
  const { readAgain, pace } = useReadAgain()

  useEffect(() => {
    // After the first answer, asked only while shown.
    if (stopped.current || (!active && answered.current)) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0

    const poll = async () => {
      try {
        const query = queryOf(held.current).toString()
        const response = await fetch(
          query ? `${api}/table?${query}` : `${api}/table`,
          { cache: 'no-store', signal: controller.signal },
        )
        answered.current = true
        if (response.status === 404) {
          stopped.current = true
          setConnection('live')
          setGone(true)
          setView(
            last =>
              last && { ...last, rollsToTable: undefined, connected: false },
          )
          return
        }
        // Signed out: the character's own page says why.
        if (response.status === 401) {
          stopped.current = true
          setConnection('live')
          return
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        if (response.status === 200) {
          const next = (await response.json()) as CompanionView
          const kept =
            next.sheet === undefined && next.sheetVersion !== undefined
              ? { ...next, sheet: held.current?.sheet }
              : next
          held.current = kept
          setView(kept)
        }
        failures = 0
        setConnection('live')
      } catch {
        // The pane went; or unreachable for now: asked again, later each time.
        if (controller.signal.aborted) return
        failures += 1
        setConnection('reconnecting')
      }
    }

    const tick = async () => {
      timer = undefined
      if (document.visibilityState !== 'hidden') await poll()
      if (!active || stopped.current || controller.signal.aborted) return
      const wait = paced(retryDelay(POLL_INTERVAL, failures, POLL_MOST_DELAY))
      timer = setTimeout(tick, wait)
    }

    // Read at once, unless a read is on its way.
    const readNow = () => {
      if (timer) {
        clearTimeout(timer)
        void tick()
      }
    }
    const paced = pace(controller.signal, readNow)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') readNow()
    }

    void tick()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [api, active, pace])

  return { view, gone, connection, readAgain }
}
