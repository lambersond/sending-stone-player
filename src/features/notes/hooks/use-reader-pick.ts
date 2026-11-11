import { useEffect, useRef } from 'react'
import { showing } from '@/features/notes/utils/reader'
import type { JournalGroup, NoteDraft, NotePick } from '@/features/notes/types'
import type { NoteEntryView, NoteTidyView } from '@/types/notes'

/**
 * What the journal's reader shows (`showing`), from what's picked; and what it settled on, kept as
 * the pick, so a card mounted again shows the same.
 */
export function useReaderPick({
  pick,
  groups,
  order,
  tidy,
  draft,
  setPick,
}: {
  pick?: NotePick
  groups?: JournalGroup[]
  order: NoteEntryView[]
  /** The character's Tidy 5e Sheets entries, in Tidy's order (module 0.44.0). */
  tidy: NoteTidyView[]
  draft?: NoteDraft
  setPick: (pick: NotePick) => void
}) {
  // The reading order as last drawn, to find what follows a note, or a Tidy entry, that has left
  // the view.
  const drawn = useRef<Parameters<typeof showing>[0]['before']>({
    order: [],
    tidy: [],
  })
  // eslint-disable-next-line react-hooks/refs -- the order as the last commit drew it, by design
  const before = drawn.current
  const shownNow = groups
    ? showing({ pick, groups, order, before, draft, tidy })
    : undefined
  const note = shownNow?.note
  const group = shownNow?.group
  useEffect(() => {
    if (groups) drawn.current = { order, tidy }
  })
  // What the reader settled on is kept, so a card mounted again shows the same: the most
  // recently changed note it opened on, or what follows a note gone since.
  const keep = shownNow?.keep ? shownNow.pick : undefined
  useEffect(() => {
    if (keep) setPick(keep)
  }, [keep, setPick])

  return { shownNow, note, group }
}
