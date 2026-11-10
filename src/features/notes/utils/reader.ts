import { readDescription } from '@/components/description/read-description'
import { matchesSearch } from '@/utils/search'
import type {
  JournalGroup,
  NoteDraft,
  NotePick,
  Ordering,
  ReadingStep,
} from '@/features/notes/types'
import type { NoteEntryView, NotesTidyView, NoteTidyView } from '@/types/notes'

/** What the reader settles on, and whether that's to be kept as the pick. */
type Shown = {
  pick: NotePick
  note?: NoteEntryView
  group?: JournalGroup
  /** One of the character's Tidy 5e Sheets entries (module 0.45.0). */
  tidy?: NoteTidyView
  /** The Tidy entries' own page. */
  tidySection?: true
  keep: boolean
}

/**
 * What the reader shows (round 0.35.0 §8.7): the note or group picked; for a note picked that has
 * left the view, the next in reading order as it was, else the one before, else its group's page;
 * with nothing picked, the draft's note where the draft is a change to one, else the most recently
 * changed note, else the last group listed. `keep` where that's to be kept as the pick. From module
 * 0.45.0, likewise a Tidy 5e Sheets entry picked, or their page; one deleted in Foundry gives way
 * as a note does, to the next as they were, else the one before, else their page while any is
 * left; and with nothing else to show, the first of them.
 */
export function showing({
  pick,
  groups,
  order,
  before,
  draft,
  tidy = [],
}: {
  pick?: NotePick
  groups: JournalGroup[]
  order: NoteEntryView[]
  /** The reading order as last drawn: the notes, and the Tidy entries. */
  before: { order: NoteEntryView[]; tidy: NoteTidyView[] }
  draft?: NoteDraft
  /** The character's Tidy entries, in Tidy's order. */
  tidy?: NoteTidyView[]
}): Shown | undefined {
  const at = (next: NotePick, keep: boolean): Shown | undefined => {
    if ('tidy' in next) {
      if (next.tidy === null) {
        return tidy.length > 0
          ? { pick: next, tidySection: true, keep }
          : undefined
      }
      const entry = tidy.find(({ key }) => key === next.tidy)
      return entry && { pick: next, tidy: entry, keep }
    }
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
      const instead = near(pick.note, order, before.order, groups)
      if (instead) return at(instead, true)
      // Never drawn, as a note saved here whose read hasn't come: it's shown once it comes.
      const first = fallback(groups, order, tidy, draft)
      return first && at(first, false)
    }
    // A Tidy entry deleted in Foundry gives way to what was near it, while any is left.
    if ('tidy' in pick && tidy.length > 0) {
      return at(nearTidy(pick.tidy, tidy, before.tidy), true)
    }
  }
  const first = fallback(groups, order, tidy, draft)
  return first && at(first, true)
}

/**
 * With nothing picked: the draft's note, the most recently changed note, the last group, or the
 * first Tidy entry.
 */
function fallback(
  groups: JournalGroup[],
  order: NoteEntryView[],
  tidy: NoteTidyView[],
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
  if (last) return { group: last.chapterId }
  return tidy[0] && { tidy: tidy[0].key }
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

/** What follows a Tidy entry gone: the next as it was, the one before, or their page. */
function nearTidy(
  key: string | null,
  tidy: NoteTidyView[],
  before: NoteTidyView[],
): NotePick {
  const at = before.findIndex(entry => entry.key === key)
  if (at === -1) return { tidy: null }
  const here = new Set(tidy.map(entry => entry.key))
  const instead =
    before.slice(at + 1).find(entry => here.has(entry.key)) ??
    before.slice(0, at).findLast(entry => here.has(entry.key))
  return { tidy: instead?.key ?? null }
}

/**
 * Where the journal's reading order crosses from the book's notes to the character's Tidy 5e
 * Sheets entries (module 0.45.0): what follows its last note, the first entry; and what comes
 * before the first entry, its last note. Neither where either part is empty.
 */
export function tidyCrossing(
  order: NoteEntryView[],
  tidy: NoteTidyView[],
): { after?: ReadingStep; before?: ReadingStep } {
  const last = order.at(-1)
  const first = tidy[0]
  if (!last || !first) return {}
  return {
    after: { pick: { tidy: first.key }, title: first.title },
    before: { pick: { note: last.id }, title: last.title },
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

/** The character's Tidy entries, where the reader shows one of them or their page; else none. */
export function tidyShown(
  shown: Pick<Shown, 'tidy' | 'tidySection'> | undefined,
  tidy: NotesTidyView | undefined,
): NotesTidyView | undefined {
  return shown?.tidy !== undefined || shown?.tidySection === true
    ? tidy
    : undefined
}

/**
 * A Tidy entry's text as it's searched, and its card shows it: what it draws, as plain text, its
 * paragraphs and other blocks a space apart.
 */
export function tidyText(entry: NoteTidyView): string {
  const body = readDescription(entry.html)
  if (!body) return ''
  return [...body.childNodes]
    .map(node => node.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
}

/** The Tidy entries a search finds, by key, by title and text; none while nothing is searched. */
export function tidyHitsOf(
  tidy: NoteTidyView[],
  texts: ReadonlyMap<string, string>,
  query: string,
): Set<string> | undefined {
  if (query.trim() === '') return undefined
  return new Set(
    tidy
      .filter(entry =>
        matchesSearch([entry.title, texts.get(entry.key) ?? ''], query),
      )
      .map(({ key }) => key),
  )
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
