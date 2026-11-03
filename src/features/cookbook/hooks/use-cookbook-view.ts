import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { COOKBOOK_POLL_EVERY } from '@/constants/cookbook'
import type { CookbookView } from '@/types/cookbook'

/** The longest wait between reads while the server can't be reached. */
const MOST_DELAY = 120_000

/** What a page holds of one character's Magical Recipe Book card. */
type Card = {
  /** What it last read of the card. */
  view?: CookbookView
  /** The link code just made, shown until its player is done with it. */
  fresh?: string
  /**
   * The read the code just made is checked after: the next begun once it was made, its card's own
   * read for the link the make wrote, so the read that comes with showing the code never takes it
   * back.
   */
  checkAfter?: number
}

/** Reads begun on this page, numbered, so a code just made is checked only by those after it. */
let begun = 0

/*
 * The page's store of cards, by character, for as long as the page is loaded: in memory only,
 * never in the browser's storage, as a link code is shown once and never kept. The Biography tab
 * unmounts whenever another of the sheet's tabs is chosen, and the card with it: the store is what
 * keeps a code just made on screen until its player says they're done with it. A character is one
 * user's, as its route answers only them. It's written only on the client, in effects and event
 * handlers, so a server render, which shares the module with every request, never holds a card.
 */
const cards = new Map<string, Card>()
const listeners = new Map<string, Set<() => void>>()

function subscribe(characterId: string, listener: () => void): () => void {
  const held = listeners.get(characterId) ?? new Set()
  held.add(listener)
  listeners.set(characterId, held)
  return () => {
    held.delete(listener)
    if (held.size === 0) listeners.delete(characterId)
  }
}

/** Keeps what a page holds of a card, or forgets it, and tells each card showing it. */
function put(characterId: string, card: Card): void {
  if (card.view === undefined && card.fresh === undefined) {
    cards.delete(characterId)
  } else {
    cards.set(characterId, card)
  }
  for (const listener of listeners.get(characterId) ?? []) listener()
}

/** What a server render holds of a card: nothing, ever. */
function onServer(): Card | undefined {
  return
}

/** Forgets every card the page holds, as a reload does. */
export function forgetCookbook(): void {
  for (const characterId of cards.keys()) put(characterId, {})
}

/**
 * Forgets the code just made once a read begun after its card's own finds the character's link
 * gone, or made with another code: revoked by the Gamemaster, or replaced from the player's other
 * device. The card then offers a code again, rather than one that no longer works. A link's hint
 * is its code's last four characters.
 */
function forgetGoneCode(characterId: string, read: number): void {
  const held = cards.get(characterId)
  if (!held?.fresh || !held.view || read <= (held.checkAfter ?? 0)) return
  if (held.view.link?.hint === held.fresh.slice(-4)) return
  put(characterId, { ...held, fresh: undefined, checkAfter: undefined })
}

/**
 * Reads a character's card, from the version it holds for 204 while nothing has changed: whether
 * the read was answered. A failure keeps what's shown.
 */
async function readCard(
  characterId: string,
  signal?: AbortSignal,
): Promise<boolean> {
  begun += 1
  const read = begun
  const version = cards.get(characterId)?.view?.version
  const query = version ? `?${new URLSearchParams({ version })}` : ''
  try {
    const response = await fetch(
      `/api/characters/${encodeURIComponent(characterId)}/cookbook${query}`,
      { cache: 'no-store', signal },
    )
    if (response.status === 200) {
      const view = (await response.json()) as CookbookView
      if (signal?.aborted) return false
      put(characterId, { ...cards.get(characterId), view })
    } else if (response.status !== 204) {
      return false
    }
    if (!signal?.aborted) forgetGoneCode(characterId, read)
    return true
  } catch {
    return false
  }
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
      const delay = failures
        ? Math.min(COOKBOOK_POLL_EVERY * 2 ** failures, MOST_DELAY)
        : COOKBOOK_POLL_EVERY
      timer = setTimeout(tick, delay)
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
    (code: string | undefined) => {
      const held = cards.get(characterId)
      if (held?.fresh === code) return
      // Its card reads at once for the link the code was made with: the next read begun.
      put(characterId, {
        ...held,
        fresh: code,
        checkAfter: code === undefined ? undefined : begun + 1,
      })
    },
    [characterId],
  )

  return { view: card?.view, reload, fresh: card?.fresh, setFresh }
}
