import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import {
  cards,
  onServer,
  put,
  putFresh,
  readCard,
  subscribe,
} from './cookbook-store'
import { COOKBOOK_POLL_EVERY } from '@/constants/cookbook'
import { retryDelay } from '@/utils/polling'
import type { CookbookView } from '@/types/cookbook'

/** The longest wait between reads while the server can't be reached. */
const MOST_DELAY = 120_000

/** Forgets every card the page holds, as a reload does. */
export function forgetCookbook(): void {
  for (const characterId of cards.keys()) put(characterId, {})
}

/**
 * A player's Magical Recipe Book card for their character, from module 0.38.0
 * (`GET /api/characters/[id]/cookbook`): read at once, then every COOKBOOK_POLL_EVERY while
 * active and the page is visible, with ?version= for 204 while nothing changed, so a Gamemaster
 * turning dishes on, or a dish's progress, shows within a poll. A failure doubles the wait, up to
 * two minutes; an answer resets it. `reload()` reads at once, as after the player makes or revokes
 * a code. What it last read, and the code just made, are kept in the page's store by character, so
 * a card mounted again, as when the Biography tab is chosen again, starts from them. The code is
 * forgotten once a read after the card's own for it finds the link gone or another code's.
 */
export function useCookbookView(
  characterId: string,
  { active }: { active: boolean },
): {
  view?: CookbookView
  reload(): Promise<void>
  /**
   * The link code just made, until its player is done with it, revokes it or makes another, or a
   * later read finds its link gone.
   */
  fresh?: string
  setFresh(code: string | undefined): void
} {
  const card = useSyncExternalStore(
    useCallback(listener => subscribe(characterId, listener), [characterId]),
    () => cards.get(characterId),
    onServer,
  )
  // Reads the card at once, while it's polled.
  const refresh = useRef<() => Promise<void>>(undefined)

  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let running: Promise<void> | undefined
    let again = false

    // One read at a time; one asked for meanwhile runs once it's done, as a code may have been
    // made or revoked after the read started.
    const read = async () => {
      if (running) {
        again = true
        return running
      }
      running = (async () => {
        do {
          again = false
          const answered = await readCard(characterId, controller.signal)
          if (controller.signal.aborted) return
          failures = answered ? 0 : failures + 1
        } while (again && !controller.signal.aborted)
      })()
      try {
        await running
      } finally {
        running = undefined
      }
    }

    const schedule = () => {
      clearTimeout(timer)
      if (controller.signal.aborted) return
      timer = setTimeout(
        tick,
        retryDelay(COOKBOOK_POLL_EVERY, failures, MOST_DELAY),
      )
    }

    const tick = async () => {
      timer = undefined
      if (document.visibilityState !== 'hidden') await read()
      schedule()
    }

    refresh.current = async () => {
      clearTimeout(timer)
      timer = undefined
      await read()
      schedule()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && timer) {
        clearTimeout(timer)
        void tick()
      }
    }

    timer = setTimeout(tick, 0)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      controller.abort()
      clearTimeout(timer)
      refresh.current = undefined
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [characterId, active])

  const reload = useCallback(async () => {
    // Out of view, it's read once, and polled again once in view.
    await (refresh.current ? refresh.current() : readCard(characterId))
  }, [characterId])

  const setFresh = useCallback(
    (code: string | undefined) => putFresh(characterId, code),
    [characterId],
  )

  return { view: card?.view, reload, fresh: card?.fresh, setFresh }
}
