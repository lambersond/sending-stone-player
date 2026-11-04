import { seenQuery } from '@/utils/seen-query'
import type { Card } from '@/features/cookbook/types'
import type { CookbookView } from '@/types/cookbook'

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
export const cards = new Map<string, Card>()

const listeners = new Map<string, Set<() => void>>()

export function subscribe(
  characterId: string,
  listener: () => void,
): () => void {
  const held = listeners.get(characterId) ?? new Set()
  held.add(listener)
  listeners.set(characterId, held)
  return () => {
    held.delete(listener)
    if (held.size === 0) listeners.delete(characterId)
  }
}

/** Keeps what a page holds of a card, or forgets it, and tells each card showing it. */
export function put(characterId: string, card: Card): void {
  if (card.view === undefined && card.fresh === undefined) {
    cards.delete(characterId)
  } else {
    cards.set(characterId, card)
  }
  for (const listener of listeners.get(characterId) ?? []) listener()
}

/** What a server render holds of a card: nothing, ever. */
export function onServer(): Card | undefined {
  return
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
export async function readCard(
  characterId: string,
  signal?: AbortSignal,
): Promise<boolean> {
  begun += 1
  const read = begun
  const version = cards.get(characterId)?.view?.version
  const query = version ? `?${seenQuery({ version })}` : ''
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

/** Keeps the link code just made for a character's card, or forgets it. */
export function putFresh(characterId: string, code: string | undefined): void {
  const held = cards.get(characterId)
  if (held?.fresh === code) return
  // Its card reads at once for the link the code was made with: the next read begun.
  put(characterId, {
    ...held,
    fresh: code,
    checkAfter: code === undefined ? undefined : begun + 1,
  })
}
