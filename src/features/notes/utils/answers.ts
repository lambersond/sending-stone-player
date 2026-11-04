import type {
  NoteInput,
  NoteRefusal,
  NotesView,
  NoteWriteAnswer,
} from '@/types/notes'

/** The app's own refusals, as a write's answer names them. */
const REFUSALS = new Set<string>([
  'invalid',
  'not-yours',
  'changed',
  'saving',
  'conflict',
  'chapter',
  'foundry-only',
  'private',
  'unknown',
  'headings',
  'gone',
  'full',
  'busy',
] satisfies NoteRefusal[])

/** A response's JSON, or nothing where it has none. */
export async function bodyOf(
  response: Response,
): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json()
    return body && typeof body === 'object'
      ? (body as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/** What a write answered, from its response. */
export async function answerOf(response: Response): Promise<NoteWriteAnswer> {
  const body = await bodyOf(response)
  if (response.ok) {
    return {
      ok: true,
      ...(typeof body.id === 'string' && { id: body.id }),
      ...(typeof body.stamp === 'string' && { stamp: body.stamp }),
    }
  }
  // Not there: the note was deleted meanwhile, or the book is no longer the seat's, which the
  // read that follows says.
  if (response.status === 404) return { ok: false, reason: 'changed' }
  // Signed out, or the server failing: nothing was wrong with the note, which is still there.
  if (response.status === 401 || response.status >= 500) {
    return { ok: false, reason: 'network' }
  }
  const reason =
    typeof body.reason === 'string' && REFUSALS.has(body.reason)
      ? (body.reason as NoteRefusal)
      : 'invalid'
  const lines = Array.isArray(body.lines)
    ? body.lines.filter((line): line is number => Number.isInteger(line))
    : undefined
  return {
    ok: false,
    reason,
    ...(typeof body.field === 'string' && { field: body.field }),
    ...(lines && { lines }),
  }
}

/** The ids of a book's notes and chapters, as a view holds them. */
export function idsOf(view: NotesView | undefined): Set<string> {
  return new Set([
    ...(view?.chapters ?? []).map(({ id }) => id),
    ...(view?.entries ?? []).map(({ id }) => id),
  ])
}

/**
 * The note or chapter a create made, where its answer was lost: one in the book now that wasn't
 * as it was sent, that the seat may change, holding just what was sent.
 */
export function madeFrom(
  view: NotesView | undefined,
  input: NoteInput,
  before: Set<string>,
): { id: string; stamp: string } | undefined {
  const title = input.title.trim()
  if (input.role === 'chapter') {
    return view?.chapters.find(
      chapter =>
        !before.has(chapter.id) && chapter.canRename && chapter.title === title,
    )
  }
  return view?.entries.find(
    entry =>
      !before.has(entry.id) &&
      entry.canEdit &&
      entry.title === title &&
      entry.body === (input.body ?? '') &&
      (entry.chapterId ?? undefined) === (input.chapterId ?? undefined),
  )
}
