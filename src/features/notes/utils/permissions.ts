import type { NoteChapterView, NoteEntryView, NoteState } from '@/types/notes'

/*
 * What the seat may do to a note or chapter, offered only where the server would take it (round
 * 0.35.0 §8.13): nothing in a book that takes no change (`canAdd` false), and nothing that would
 * be refused while a change refused by the game waits on a choice.
 */

/** Edit: the seat may change it, here, and no choice waits on it. */
export function mayEdit(entry: NoteEntryView, canAdd: boolean): boolean {
  return (
    canAdd &&
    entry.canEdit &&
    !entry.foundryOnly &&
    entry.state !== 'conflict' &&
    entry.state !== 'gone'
  )
}

/** Delete: the seat may delete it, it isn't being deleted, and no choice waits on it. */
export function mayDelete(entry: NoteEntryView, canAdd: boolean): boolean {
  return (
    canAdd &&
    entry.canDelete &&
    entry.state !== 'deleting' &&
    entry.state !== 'conflict' &&
    entry.state !== 'gone'
  )
}

/** Rename: the seat may rename the chapter, and no choice waits on it. */
export function mayRename(chapter: NoteChapterView, canAdd: boolean): boolean {
  return (
    canAdd &&
    chapter.canRename &&
    chapter.state !== 'conflict' &&
    chapter.state !== 'gone'
  )
}

/** The states a note may be moved in: as the game has it, or its change waiting or on its way. */
const SETTLED = new Set<NoteState>(['synced', 'waiting', 'saving'])

/**
 * Move to a chapter: Edit's rights, for it's the change Edit's Chapter field makes; a note settled
 * with the game or on its way to it, as a move folded into a refused change would send that
 * change's title; and a chapter to go to.
 */
export function mayMove(
  entry: NoteEntryView,
  canAdd: boolean,
  chapters: readonly NoteChapterView[],
): boolean {
  return (
    mayEdit(entry, canAdd) && SETTLED.has(entry.state) && chapters.length > 0
  )
}
