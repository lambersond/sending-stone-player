import { readDescription } from '@/components/description/read-description'
import { matchesSearch } from '@/utils/search'
import type {
  JournalGroup,
  NoteDraft,
  NotePick,
  Ordering,
} from '@/features/notes/types'
import type { NoteEntryView } from '@/types/notes'

/**
 * What the reader shows (round 0.35.0 §8.7): the note or group picked; for a note picked that has
 * left the view, the next in reading order as it was, else the one before, else its group's page;
 * with nothing picked, the draft's note where the draft is a change to one, else the most recently
 * changed note, else the last group listed. `keep` where that's to be kept as the pick.
 */
export function showing({
  pick,
  groups,
  order,
  before,
  draft,
}: {
  pick?: NotePick
  groups: JournalGroup[]
  order: NoteEntryView[]
  before: NoteEntryView[]
  draft?: NoteDraft
}):
  | {
      pick: NotePick
      note?: NoteEntryView
      group?: JournalGroup
      keep: boolean
    }
  | undefined {
  const at = (next: NotePick, keep: boolean) => {
    if ('note' in next) {
      const note = order.find(({ id }) => id === next.note)
      return note && { pick: next, note, keep }
    }
    const group = groups.find(({ chapterId }) => chapterId === next.group)
    return group && { pick: next, group, keep }
  }
  if (pick) {
    const picked = at(pick, false)
    if (picked) return picked
    // A note picked that has left the view gives way to what was near it.
    if ('note' in pick) {
      const instead = near(pick.note, order, before, groups)
      if (instead) return at(instead, true)
      // Never drawn, as a note saved here whose read hasn't come: it's shown once it comes.
      const first = fallback(groups, order, draft)
      return first && at(first, false)
    }
  }
  const first = fallback(groups, order, draft)
  return first && at(first, true)
}

/** With nothing picked: the draft's note, the most recently changed note, or the last group. */
function fallback(
  groups: JournalGroup[],
  order: NoteEntryView[],
  draft?: NoteDraft,
): NotePick | undefined {
  if (draft?.role === 'entry' && order.some(({ id }) => id === draft.key)) {
    return { note: draft.key }
  }
  let latest: NoteEntryView | undefined
  for (const entry of order) {
    if (
      !latest ||
      Date.parse(entry.modifiedAt) > Date.parse(latest.modifiedAt)
    ) {
      latest = entry
    }
  }
  if (latest) return { note: latest.id }
  const listed = groups.filter(
    ({ chapterId, entries }) => chapterId !== null || entries.length > 0,
  )
  const last = listed.at(-1)
  return last && { group: last.chapterId }
}

/** What follows a note gone from the view: the next as it was, the one before, or its group. */
function near(
  id: string,
  order: NoteEntryView[],
  before: NoteEntryView[],
  groups: JournalGroup[],
): NotePick | undefined {
  const at = before.findIndex(entry => entry.id === id)
  if (at === -1) return
  const here = new Set(order.map(entry => entry.id))
  const next = before.slice(at + 1).find(entry => here.has(entry.id))
  if (next) return { note: next.id }
  const previous = before.slice(0, at).findLast(entry => here.has(entry.id))
  if (previous) return { note: previous.id }
  const { chapterId } = before[at]
  return {
    group: groups.some(group => group.chapterId === chapterId)
      ? chapterId
      : null,
  }
}

/** The group a note is in. */
export function groupOfNote(
  groups: JournalGroup[] | undefined,
  entry: NoteEntryView,
): JournalGroup | undefined {
  return groups?.find(({ entries }) => entries.includes(entry))
}

/** Is the draft held now the one on its way, just as it was sent? */
export function isSent(held: NoteDraft | undefined, made: NoteDraft): boolean {
  return (
    held?.saving === true &&
    held.key === made.key &&
    held.title === made.title &&
    held.body === made.body &&
    held.chapterId === made.chapterId
  )
}

/** Is the draft a note or chapter not yet made? */
export function isNew(made: NoteDraft): boolean {
  return made.key === 'new' || made.key === 'new-chapter'
}

/** A note's text as it's searched: its Markdown where the seat has it, else what it draws. */
export function searchText(entry: NoteEntryView): string {
  if (entry.body !== undefined) return entry.body
  return readDescription(entry.html)?.textContent ?? ''
}

/** The notes a search finds, by id, by title and text; none while nothing is searched. */
export function hitsOf(
  order: NoteEntryView[],
  texts: ReadonlyMap<string, string>,
  query: string,
): Set<string> | undefined {
  const searching = query.trim() !== ''
  return searching
    ? new Set(
        order
          .filter(entry =>
            matchesSearch([entry.title, texts.get(entry.id) ?? ''], query),
          )
          .map(({ id }) => id),
      )
    : undefined
}

/** After a delete, the next note in reading order, else the one before, else its group's page. */
export function afterDelete(
  order: NoteEntryView[],
  groups: JournalGroup[] | undefined,
  entry: NoteEntryView,
): NotePick {
  const at = order.findIndex(({ id }) => id === entry.id)
  const near = order[at + 1] ?? order[at - 1]
  if (near && near.id !== entry.id) return { note: near.id }
  return { group: groupOfNote(groups, entry)?.chapterId ?? null }
}

/** What locks the journal's contents: a draft open, else a Reorder open, else nothing. */
export function lockedBy(
  draft: NoteDraft | undefined,
  ordering: Ordering | undefined,
): 'editing' | 'ordering' | undefined {
  let locked: 'editing' | 'ordering' | undefined
  if (draft) locked = 'editing'
  else if (ordering) locked = 'ordering'
  return locked
}

/** The note a draft changes, which the contents mark; none for a new note or a chapter. */
export function draftNoteOf(draft: NoteDraft | undefined): string | undefined {
  return draft?.role === 'entry' && !isNew(draft) ? draft.key : undefined
}

/** A group's notes as a search shows them: those it found, or all while nothing is searched. */
export function hitEntries(
  group: JournalGroup,
  hits: ReadonlySet<string> | undefined,
): NoteEntryView[] {
  return hits ? group.entries.filter(({ id }) => hits.has(id)) : group.entries
}
