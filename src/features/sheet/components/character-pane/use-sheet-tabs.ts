import { useRef, useState } from 'react'
import { visibleTabs } from './utils'
import { hasDraft, journalOpen } from '@/features/notes/hooks/use-notes'
import type { SheetTab } from './types'
import type { NotesPlace } from '@/features/notes/types'
import type { CreatureFacts, TableSheet } from '@/types/table'

/**
 * The sheet's tabs, and the one shown (`tab`). It opens on the character; on Biography where a
 * note is being written there, or the journal is open, as when either was under why there was no
 * sheet, before this one arrived. A tab the sheet no longer has, such as Spells for a character
 * who lost theirs, shows the character. Showing one scrolls the tab back to its top (`scroller`).
 */
export function useSheetTabs({
  sheet,
  creature,
  notes,
}: Readonly<{
  sheet: TableSheet
  creature?: CreatureFacts
  notes?: NotesPlace
}>) {
  const [chosen, setTab] = useState<SheetTab>(() =>
    notes && (hasDraft(notes.api) || journalOpen(notes.api))
      ? 'biography'
      : 'character',
  )
  const scroller = useRef<HTMLDivElement>(null)
  const show = (next: SheetTab) => {
    setTab(next)
    scroller.current?.scrollTo?.({ top: 0 })
  }
  const tabs = visibleTabs(sheet, creature)
  const tab = tabs.some(({ id }) => id === chosen) ? chosen : 'character'
  return { tab, tabs, show, scroller }
}
