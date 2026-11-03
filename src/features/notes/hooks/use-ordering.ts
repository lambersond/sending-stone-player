import { useEffect, useState } from 'react'
import type { JournalGroup, Ordering } from '@/features/notes/types'

/** A Reorder open in the journal, and its group: gone with the group, as a chapter deleted. */
export function useOrdering(groups: JournalGroup[] | undefined) {
  const [ordering, setOrdering] = useState<Ordering>()
  const ordered =
    ordering &&
    groups?.find(({ chapterId }) => chapterId === ordering.chapterId)
  // A group gone meanwhile, as a chapter deleted in Foundry, takes its Reorder with it.
  useEffect(() => {
    if (ordering && groups && !ordered) setOrdering(undefined)
  }, [ordering, groups, ordered])

  return { ordering, setOrdering, ordered }
}
