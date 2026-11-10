import { useMemo } from 'react'
import { tidyHitsOf, tidyText } from '@/features/notes/utils/reader'
import type { NotesTidyView } from '@/types/notes'

/**
 * A character's Tidy 5e Sheets entries as the journal reads and searches them (module 0.45.0): in
 * Tidy's order, none where it holds none; each one's text, worked out once as they change; and
 * those the search finds.
 */
export function useTidySearch(tidy: NotesTidyView | undefined, query: string) {
  const entries = useMemo(() => tidy?.entries ?? [], [tidy])
  const texts = useMemo(
    () => new Map(entries.map(entry => [entry.key, tidyText(entry)])),
    [entries],
  )
  return { entries, texts, hits: tidyHitsOf(entries, texts, query) }
}
