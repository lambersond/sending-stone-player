import { TIDY_CLASSIC, TIDY_CLASSIC_GONE } from '@/constants/notes'
import type { NotesTidyView, NoteTidyView } from '@/types/notes'
import type { HeldTidy } from '@/utils/notes/types'

// A character's Tidy 5e Sheets journal as a seat sees it (module 0.45.0), beside its personal book:
// read only, in Tidy's order, each entry under the title Tidy shows it by, with the dates the app
// keeps for it; and whether Tidy can change it in Foundry now.

/** Tidy's order: its current sheet's entries, then its Classic sheet's boxes, each by its place. */
function inTidyOrder(a: HeldTidy['entries'][number], b: typeof a): number {
  if (a.source !== b.source) return a.source === 'journal' ? -1 : 1
  return a.sort - b.sort
}

/**
 * An entry's title as Tidy shows it: its own, or for none, "Journal Entry {n}" for one of the
 * current sheet's, `n` its place among them, and a Classic box's heading.
 */
export function tidyTitle(
  entry: Pick<
    HeldTidy['entries'][number],
    'source' | 'entryId' | 'title' | 'sort'
  >,
): string {
  if (entry.title.trim() !== '') return entry.title
  if (entry.source === 'journal') return `Journal Entry ${entry.sort}`
  return TIDY_CLASSIC[entry.entryId as keyof typeof TIDY_CLASSIC] ?? ''
}

/** Whether a Tidy version no longer shows the Classic sheet's boxes: 14 and later. */
function classicGone(version: string | null): boolean {
  const major = Number.parseInt(version ?? '', 10)
  return Number.isInteger(major) && major >= TIDY_CLASSIC_GONE
}

/**
 * A character's Tidy journal as a seat sees it: none where it holds no entries. Tidy is taken as
 * active and installed where the hello said nothing of it, as no line can say otherwise then.
 */
export function tidyViewOf(
  held: HeldTidy | undefined,
): NotesTidyView | undefined {
  if (!held || held.entries.length === 0) return
  const entries: NoteTidyView[] = held.entries
    .toSorted(inTidyOrder)
    .map(entry => ({
      key: `${entry.source}:${entry.entryId}`,
      from: entry.source,
      title: tidyTitle(entry),
      html: entry.html,
      secret: entry.secret,
      firstSeenAt: entry.firstSeenAt?.toISOString() ?? null,
      changedAt: entry.changedAt?.toISOString() ?? null,
    }))
  return {
    active: held.active !== false,
    installed: held.active === null || held.version !== null,
    classicGone: classicGone(held.version),
    entries,
  }
}
