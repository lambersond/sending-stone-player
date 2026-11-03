import { useCallback, useRef, useState } from 'react'
import type { Beasts } from './types'
import type { WildShapeForms } from '@/features/rolling/types'

/**
 * The Beasts to learn, as the game lists them (`beasts`), while it does, or why it didn't; read
 * afresh each time `loadBeasts` asks, the latest ask's answer alone kept.
 * @param read - Asks the game for the Beasts to learn, logging nothing.
 */
export function useBeasts(read: () => Promise<WildShapeForms>) {
  const [beasts, setBeasts] = useState<Beasts>()
  const asking = useRef(0)
  const loadBeasts = useCallback(() => {
    const token = ++asking.current
    setBeasts({ status: 'loading' })
    void read().then(result => {
      if (token !== asking.current) return
      setBeasts(
        'reason' in result
          ? { status: 'failed', reason: result.reason }
          : { status: 'done', forms: result.forms, more: result.more },
      )
    })
  }, [read])
  return { beasts, loadBeasts }
}
