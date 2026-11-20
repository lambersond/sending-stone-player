import { useCallback, useState } from 'react'

/**
 * Which of the favorites are open to their descriptions, by key, kept above their lists, so that a
 * row drawn anew, as in the other of two lists, opens again there (ROADMAP item 74), and so after
 * Reorder or Favorites hidden and shown again.
 * @returns `openAt`, whether a row is open, and `setOpenAt`, to open or close it.
 */
export function useOpenRows() {
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set())
  const openAt = useCallback((key: string) => opened.has(key), [opened])
  const setOpenAt = useCallback((key: string, open: boolean) => {
    setOpened(held => {
      if (held.has(key) === open) return held
      const next = new Set(held)
      if (open) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])
  return { openAt, setOpenAt }
}
