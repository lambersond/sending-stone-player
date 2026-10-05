import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TableView } from '@/types/table'

export type Connection = 'live' | 'reconnecting'

/** How often to ask for news, in milliseconds. */
export const POLL_INTERVAL = 3000

/** The longest wait between attempts while the server cannot be reached. */
const MAX_DELAY = 30_000

/**
 * Keep a character's view of its campaign current by polling for changes, including the
 * Gamemaster's game going offline or coming back. Polling pauses while the
 * page is in the background and catches up as soon as it is back.
 * @param characterId - The character being viewed.
 * @param initial - The view the page was rendered with.
 */
export function useTableView(characterId: string, initial: TableView) {
  const router = useRouter()
  const [view, setView] = useState(initial)
  const [connection, setConnection] = useState<Connection>('live')
  const seen = useRef({
    version: initial.version,
    live: initial.live,
    sheetVersion: initial.sheetVersion,
  })

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let stopped = false

    const poll = async () => {
      try {
        const { version, live, sheetVersion } = seen.current
        const query = new URLSearchParams({
          version: String(version),
          live: live ? '1' : '0',
          ...(sheetVersion && { sheet: sheetVersion }),
        })
        const response = await fetch(
          `/api/characters/${characterId}/table?${query}`,
          { cache: 'no-store', signal: controller.signal },
        )
        if (response.status === 401 || response.status === 404) {
          // Signed out, or the character was removed: let the page show why.
          stopped = true
          router.refresh()
          return
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        if (response.status === 200) {
          const next = (await response.json()) as TableView
          seen.current = {
            version: next.version,
            live: next.live,
            sheetVersion: next.sheetVersion,
          }
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
  }, [characterId, router])

  return { view, connection }
}
