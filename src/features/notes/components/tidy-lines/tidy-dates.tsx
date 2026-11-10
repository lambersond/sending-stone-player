'use client'

import { NoteTime } from '../note-time/note-time'
import type { NoteTidyView } from '@/types/notes'

/**
 * When the app first saw a Tidy 5e Sheets entry and last saw it change (module 0.45.0), as Tidy
 * keeps no dates: "First seen 3 Nov · changed 5 Nov"; for one there before the app could see it,
 * `undated` in place of its first sight, or nothing.
 */
export function TidyDates({
  entry,
  undated,
}: Readonly<{ entry: NoteTidyView; undated?: string }>) {
  const { firstSeenAt, changedAt } = entry
  if (!firstSeenAt && !changedAt && !undated) return
  return (
    <span>
      {firstSeenAt ? (
        <>
          First seen <NoteTime value={firstSeenAt} />
        </>
      ) : (
        undated
      )}
      {changedAt && (
        <>
          {firstSeenAt || undated ? ' · changed ' : 'Changed '}
          <NoteTime value={changedAt} />
        </>
      )}
    </span>
  )
}
