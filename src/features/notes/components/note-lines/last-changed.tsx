'use client'

import { NoteTime } from '../note-time/note-time'
import type { NoteEntryView } from '@/types/notes'

/** Who changed a note last and when, here or in Foundry: "Last changed by Vex in Foundry, …". */
export function LastChanged({ entry }: Readonly<{ entry: NoteEntryView }>) {
  const { modifiedBy, modifiedIn, modifiedAt } = entry
  return (
    <>
      Last changed by {modifiedBy}
      {modifiedIn === 'foundry' && ' in Foundry'},{' '}
      <NoteTime value={modifiedAt} />
    </>
  )
}
