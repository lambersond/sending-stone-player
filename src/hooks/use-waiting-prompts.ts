'use client'

import { useEffect, useState } from 'react'
import { waitingPrompts } from '@/utils/prompts'
import type { TablePrompt } from '@/types/table'

/**
 * The saving throws the game asks of the character that still wait for their player: each until
 * its time runs out, when it's dropped, though nothing new comes from the game.
 * @param prompts - As the table view last had them.
 */
export function useWaitingPrompts(
  prompts: readonly TablePrompt[] = [],
): TablePrompt[] {
  const [now, setNow] = useState(() => Date.now())
  const waiting = waitingPrompts(prompts, now)
  const next = Math.min(
    ...waiting.map(({ expiresAt }) => Date.parse(expiresAt)),
  )
  useEffect(() => {
    if (!Number.isFinite(next)) return
    const timer = setTimeout(() => setNow(Date.now()), next - Date.now() + 50)
    return () => clearTimeout(timer)
  }, [next])
  return waiting
}
