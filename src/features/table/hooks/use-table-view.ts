import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  POLL_INTERVAL,
  POLL_MOST_DELAY,
  READ_AGAIN_AFTER,
} from '@/constants/polling'
import { seenOf, tableQuery } from '@/features/table/utils/table-query'
import { retryDelay } from '@/utils/polling'
import type { TableView, Connection } from '@/types/table'

/**
 * Keep a character's view of its campaign current by polling for changes, including the
 * Gamemaster's game going offline or coming back. Polling pauses while the
 * page is in the background and catches up as soon as it is back. As a roll the game answered
 * ends (ROADMAP item 39), `readAgain` reads it at once, or as soon as a read on its way has come,
 * and once more a moment later, for the sheet the game sends a moment after the roll's answer.
 * @param api - The seat's API base: the character's, such as `/api/characters/<id>`, or the
 *   Gamemaster's at its sheet (#156).
 * @param initial - The view the page was rendered with.
 */
export function useTableView(api: string, initial: TableView) {
  const router = useRouter()
  const [view, setView] = useState(initial)
  const [connection, setConnection] = useState<Connection>('live')
  const seen = useRef(seenOf(initial))
  // As the poll running has it; nothing before it starts, nor once it's stopped.
  const again = useRef(() => {})

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let stopped = false
    // Whether the next read waits only a moment, as a roll the game answered has ended.
    let soon = false

    const poll = async () => {
      try {
        const query = tableQuery(seen.current)
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
      const wait = soon
        ? READ_AGAIN_AFTER
        : retryDelay(POLL_INTERVAL, failures, POLL_MOST_DELAY)
      soon = false
      timer = setTimeout(tick, wait)
    }

    again.current = () => {
      if (stopped || controller.signal.aborted) return
      soon = true
      // Read at once, unless a read is on its way: the next comes a moment after it either way.
      if (timer) {
        clearTimeout(timer)
        void tick()
      }
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

  const readAgain = useCallback(() => again.current(), [])
  return { view, connection, readAgain }
}
