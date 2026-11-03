import { useEffect, useState } from 'react'
import type { Said } from '@/features/notes/types'

/** How long the header says what was done, in milliseconds, before it clears itself. */
const SAID_FOR = 6000

/**
 * What the journal's header says last, cleared a while after: `say` for what was done, `refuse`
 * for why a change wasn't made, said as a warning.
 */
export function useSaid() {
  const [said, setSaid] = useState<Said>()
  // What the header says clears itself a while after.
  useEffect(() => {
    if (!said) return
    const timer = setTimeout(() => setSaid(undefined), SAID_FOR)
    return () => clearTimeout(timer)
  }, [said])

  const say = (words: string, refused = false) =>
    setSaid(held => ({ words, refused, n: (held?.n ?? 0) + 1 }))
  // Why a change wasn't made: said as a warning.
  const refuse = (words: string) => say(words, true)

  return { said, say, refuse }
}
