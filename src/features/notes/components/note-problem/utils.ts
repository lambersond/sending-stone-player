import type { NoteState } from '@/types/notes'

/** The states a note has a problem to show in, and choices to make. */
const PROBLEMS = new Set<NoteState>(['conflict', 'gone', 'failed', 'deleting'])

/** Has a note in this state a problem to show, and choices to make? */
export function hasProblem(state: NoteState): boolean {
  return PROBLEMS.has(state)
}
