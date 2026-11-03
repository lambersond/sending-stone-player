'use client'

import { NoteTime } from '../note-time/note-time'
import type { NoteEntryView } from '@/types/notes'

/*
 * What the journal says of a note or chapter in a line (round 0.35.0 §8.8-§8.9): who wrote it and
 * who changed it last, where it stands as a mark, and its text as the book draws it.
 */

/** Who wrote a note and when, or that it was written in Foundry: said whoever changed it last. */
export function Written({ entry }: Readonly<{ entry: NoteEntryView }>) {
  const { author, createdAt } = entry
  return (
    <>
      {author ? `Written by ${author.name}` : 'Written in Foundry'},{' '}
      <NoteTime value={createdAt} />
    </>
  )
}
