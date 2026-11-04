import { LOOSE_TITLE } from '@/features/notes/constants'
import type { JournalGroup } from '@/features/notes/types'
import type { NoteGroupView, NoteState, NotesView } from '@/types/notes'

/**
 * A book's groups: the notes in no chapter first, then each chapter as `chapters` lists them,
 * oldest first, each holding its notes in `entries`' order, which is the server's, never sorted
 * here. A note whose chapter the seat doesn't see is in no chapter.
 */
export function groupsOf(view: NotesView): JournalGroup[] {
  const known = new Set(view.chapters.map(({ id }) => id))
  const orderOf = (chapterId: string | null): NoteGroupView =>
    view.groups.find(group => group.chapterId === chapterId) ?? {
      chapterId,
      state: 'synced',
      stamp: '',
    }
  const loose: JournalGroup = {
    chapterId: null,
    title: LOOSE_TITLE,
    entries: view.entries.filter(
      ({ chapterId }) => chapterId === null || !known.has(chapterId),
    ),
    order: orderOf(null),
  }
  return [
    loose,
    ...view.chapters.map((chapter, index) => ({
      chapterId: chapter.id,
      chapter,
      n: index + 1,
      title: chapter.title,
      entries: view.entries.filter(({ chapterId }) => chapterId === chapter.id),
      order: orderOf(chapter.id),
    })),
  ]
}

/** The states the contents' warning mark, and the card's count, take as a choice to make. */
const CHOICES = new Set<NoteState>(['conflict', 'gone', 'failed'])

/** Does a note or chapter in this state wait on the seat's choice? A delete waiting doesn't. */
export function needsChoice(state: NoteState): boolean {
  return CHOICES.has(state)
}

/** Does a group wait on the seat's choice: its chapter, a note in it, or its order? */
export function groupNeedsChoice(group: JournalGroup): boolean {
  return (
    (group.chapter !== undefined && needsChoice(group.chapter.state)) ||
    group.entries.some(({ state }) => needsChoice(state)) ||
    group.order.state === 'conflict' ||
    group.order.state === 'failed'
  )
}

/** A group's key among its siblings: its chapter's id, or '' for the notes in no chapter. */
export const keyOf = (chapterId: string | null) => chapterId ?? ''
