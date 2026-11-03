'use client'

import { NoteTime } from '../note-time/note-time'
import type { NoteChapterView } from '@/types/notes'

/**
 * Who added a chapter, or renamed it last, and when, here or in Foundry: a chapter made here is
 * changed only by a rename, and is as it was made while it was last changed when made.
 */
export function ChapterLine({
  chapter,
}: Readonly<{ chapter: NoteChapterView }>) {
  const { modifiedIn, modifiedAt, createdAt, modifiedBy } = chapter
  let what = 'Renamed by'
  if (modifiedIn === 'foundry') what = 'Changed in Foundry by'
  else if (modifiedAt === createdAt) what = 'Added by'
  return (
    <>
      {what} {modifiedBy}, <NoteTime value={modifiedAt} />
    </>
  )
}
