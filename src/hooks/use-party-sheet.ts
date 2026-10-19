import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { POLL_INTERVAL, type Connection } from '@/hooks/use-table-view'
import type { PartyView } from '@/types/party'

/** The longest wait between attempts while the server cannot be reached. */
const MAX_DELAY = 30_000

/**
 * Where a party sheet stands: being fetched for the first time, shown, or no longer the seat's to
 * see, as when its access is taken away in Foundry, or its group leaves the campaign.
 */
export type PartyState = 'loading' | 'ready' | 'gone'

/** What the viewer has of a party sheet, which the server compares to say nothing is new. */
function queryOf(view: PartyView | undefined): string {
  if (!view) return ''
  const query = new URLSearchParams({
    version: String(view.version),
    live: view.live ? '1' : '0',
    ...(view.sheetVersion && { sheet: view.sheetVersion }),
  })
  return `?${query}`
}

/**
 * Keep a party sheet current by polling for changes, as a character's view is kept (module
 * 0.30.0): from the view its page was rendered with, or fetched at once, as for its side panel.
 * Polling pauses while the page is in the background, catches up as soon as it is back, and stops
 * once the sheet is no longer the seat's to see, or once the viewer is signed out, when the page
 * is rendered again to send them to sign in.
 * @param api - The party sheet's API, such as `/api/characters/<id>/party/<group>`.
 * @param initial - The view its page was rendered with, if any.
 */
export function usePartySheet(
  api: string,
  initial?: PartyView,
): { view?: PartyView; state: PartyState; connection: Connection } {
  const [view, setView] = useState(initial)
  const [gone, setGone] = useState(false)
  const [connection, setConnection] = useState<Connection>('live')
  const seen = useRef(initial)
  const router = useRouter()

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let stopped = false

    const poll = async () => {
      try {
        const response = await fetch(`${api}${queryOf(seen.current)}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (response.status === 401) {
          // Signed out, as in another tab, or once the session lapsed: nothing was taken away in
          // Foundry, so the page is rendered again, which sends them to sign in and back.
          stopped = true
          router.refresh()
          return
        }
        if (response.status === 404) {
          // The sheet is no longer the seat's to see: say so, and stop.
          stopped = true
          setGone(true)
          setConnection('live')
          return
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        if (response.status === 200) {
          const next = (await response.json()) as PartyView
          const held = seen.current
          // A sheet left out is the one this page already has.
          const merged =
            next.sheet === undefined &&
            next.sheetVersion !== undefined &&
            next.sheetVersion === held?.sheetVersion
              ? { ...next, sheet: held.sheet }
              : next
          seen.current = merged
          setView(merged)
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

    // Without a view to show, it's fetched at once; with one, it's asked after in a while.
    timer = setTimeout(tick, seen.current ? POLL_INTERVAL : 0)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [api, router])

  let state: PartyState = view ? 'ready' : 'loading'
  if (gone) state = 'gone'
  return { view, state, connection }
}
