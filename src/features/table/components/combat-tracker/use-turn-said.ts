import { useEffect, useState } from 'react'

/** How long whose turn it is stays in the live region once said, in milliseconds. */
const SAID_FOR = 6000

/**
 * Whose turn it is, for the tracker's live region: the turn's words as they change, the first turn
 * too as the encounter comes under way, then cleared a while after, so that a screen reader reading
 * through the pane hears the turn once, from the turn panel's heading. Opening Combat on a turn
 * says nothing: its heading is there to read. Nor does a switch to another encounter's tab (item
 * 36): the tab's name, read as focus lands on it, says the encounter and its round.
 * @param words - Whose turn it is, as the panel's heading says it; nothing with no encounter under
 *   way.
 * @param scope - The encounter the words are of, by id: where it changes from one to another, the
 *   new words are taken without being said.
 * @returns What the region says now.
 */
export function useTurnSaid(words: string, scope?: string): string {
  const [last, setLast] = useState({ words, scope, said: '' })
  if (last.words !== words || last.scope !== scope) {
    const switched = last.scope !== undefined && last.scope !== scope
    setLast({ words, scope, said: switched ? '' : words })
  }
  useEffect(() => {
    if (!last.said) return
    const timer = setTimeout(
      () => setLast(held => ({ ...held, said: '' })),
      SAID_FOR,
    )
    return () => clearTimeout(timer)
  }, [last.said])
  return last.said
}
