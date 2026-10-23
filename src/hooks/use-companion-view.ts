'use client'

import { useEffect, useRef, useState } from 'react'
import { POLL_INTERVAL } from '@/hooks/use-table-view'
import { rollsKey } from '@/utils/roll-requests'
import type { CompanionView } from '@/types/table'

/** What a pane has of a companion's view, which the server compares to say nothing is new. */
function queryOf(view: CompanionView | undefined): URLSearchParams {
  if (!view) return new URLSearchParams()
  const rolls = rollsKey(view.rollsToTable, view.rollFeatures)
  return new URLSearchParams({
    version: String(view.version),
    live: view.live ? '1' : '0',
    ...(rolls && { rolls }),
    // For the Gamemaster's seat: where their rolls go.
    ...(view.gm && { gm: view.gm.rolls }),
    // For the player's: where the Gamemaster's rolls as it stand.
    ...(view.gmRollsKey && { gmrolls: view.gmRollsKey }),
    // Whether the player types in their own dice, which another of their devices may change.
    ...(view.manualDice?.on && { typed: '1' }),
    ...(view.sheetVersion && { sheet: view.sheetVersion }),
  })
}

/**
 * Keep a companion's view current for its pane (module 0.36.0), as a character's table view is
 * kept: asked for once as the pane mounts, at once whenever the pane is shown again, then every few
 * seconds while it's shown, and never while it's hidden, nor while the page is in the background.
 * A sheet left out is the one the pane has already. Once its API answers 404, the companion is no
 * longer the seat's character's, or the seat's own: it's gone, and asked for no more, its last view
 * kept with nothing to roll and not connected.
 * @param api - The companion's API base: the seat's own API and `/companions/<key>`.
 * @param active - Whether its pane is the one shown.
 */
export function useCompanionView(
  api: string,
  { active }: { active: boolean },
): { view?: CompanionView; gone: boolean } {
  const [view, setView] = useState<CompanionView>()
  const [gone, setGone] = useState(false)
  // As the latest answer has them, for what's asked next.
  const held = useRef<CompanionView | undefined>(undefined)
  const stopped = useRef(false)
  // Whether the server has answered yet: asked as it mounts, shown or not, until it has.
  const answered = useRef(false)

  useEffect(() => {
    // After the first answer, asked only while shown.
    if (stopped.current || (!active && answered.current)) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined

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
          return
        }
        if (response.status !== 200) return
        const next = (await response.json()) as CompanionView
        const kept =
          next.sheet === undefined && next.sheetVersion !== undefined
            ? { ...next, sheet: held.current?.sheet }
            : next
        held.current = kept
        setView(kept)
      } catch {
        // Unreachable for now, or the pane went: asked again next time.
      }
    }

    const tick = async () => {
      timer = undefined
      if (document.visibilityState !== 'hidden') await poll()
      if (!active || stopped.current || controller.signal.aborted) return
      timer = setTimeout(tick, POLL_INTERVAL)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && timer) {
        clearTimeout(timer)
        void tick()
      }
    }

    void tick()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [api, active])

  return { view, gone }
}
