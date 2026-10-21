/* eslint-disable unicorn/no-null -- the API uses null for no chapter, as Foundry does */
import type { NoteChapterView, NoteEntryView, NotesView } from '@/types/notes'

/*
 * The journal notes' routes as the app answers them (round 0.34.0 §8.6), for the page's tests:
 * each book by its seat's API base, read with 204 while unchanged, and changed by what's sent to
 * it, as a simple server would, so a test sees what it wrote come back. A test may answer a write
 * itself, as a refusal, or another address, as the sheet's own.
 */

type Sent = { url: string; method: string; body?: unknown }
type Answer = { status: number; body?: unknown }

const respond = ({ status, body }: Answer) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (body === undefined) throw new SyntaxError('no body')
      return body
    },
  } as Response)

/** An empty book, ready, for a seat's API base. */
export function emptyBook(fields: Partial<NotesView> = {}): NotesView {
  return {
    version: 1,
    kind: 'personal',
    journal: null,
    live: true,
    enabled: true,
    connected: true,
    canAdd: true,
    chapters: [],
    entries: [],
    ...fields,
  }
}

/** A chapter as a book lists it. */
export function noteChapter(
  fields: Partial<NoteChapterView> = {},
): NoteChapterView {
  const at = fields.createdAt ?? new Date().toISOString()
  return {
    id: 'sessionChapter01',
    title: 'Session 1',
    html: '',
    createdAt: at,
    modifiedAt: at,
    modifiedBy: 'Thorin',
    modifiedIn: 'app',
    state: 'synced',
    canRename: true,
    stamp: 'n:0000000000000b',
    ...fields,
  }
}

/** An entry as a book lists it. */
export function noteEntry(fields: Partial<NoteEntryView> = {}): NoteEntryView {
  const at = fields.createdAt ?? new Date().toISOString()
  return {
    id: 'goblinCaveNote01',
    chapterId: null,
    title: 'The goblin cave',
    html: '<p>30 gp</p>',
    body: '30 gp',
    createdAt: at,
    author: { name: 'Thorin' },
    modifiedAt: at,
    modifiedBy: 'Thorin',
    modifiedIn: 'app',
    state: 'synced',
    canEdit: true,
    canDelete: true,
    stamp: 'n:0000000000000c',
    ...fields,
  }
}

/**
 * Serves these books through `fetch`, by API base: `{ '/api/characters/char-1': book }`.
 * @param elsewhere - Answers any other address, such as a sheet's texts.
 */
export function serveNotes(
  books: Record<string, NotesView>,
  elsewhere?: (url: string, init: RequestInit) => Promise<Response>,
) {
  let made = 0
  const server = {
    books,
    sent: [] as Sent[],
    /** Answers a write in place of the server's own, where it returns an answer. */
    answer: undefined as ((sent: Sent) => Answer | undefined) | undefined,
  }
  const bump = (book: NotesView) => {
    book.version += 1
  }
  globalThis.fetch = jest.fn((async (url: string, init: RequestInit = {}) => {
    const at = url.indexOf('/notes')
    const book = at === -1 ? undefined : server.books[url.slice(0, at)]
    if (!book) {
      return elsewhere ? elsewhere(url, init) : respond({ status: 404 })
    }
    const parsed = new URL(url, 'http://app')
    const method = init.method ?? 'GET'
    const rest = parsed.pathname.slice(parsed.pathname.indexOf('/notes') + 6)
    if (method === 'GET') {
      const asked = parsed.searchParams
      if (
        asked.get('version') === String(book.version) &&
        asked.get('live') === (book.live ? '1' : '0')
      ) {
        return respond({ status: 204 })
      }
      // A copy, as a response is: jsdom has no structuredClone.
      // eslint-disable-next-line unicorn/prefer-structured-clone
      return respond({ status: 200, body: JSON.parse(JSON.stringify(book)) })
    }
    const body =
      typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    const sent = { url, method, body }
    server.sent.push(sent)
    const answered = server.answer?.(sent)
    if (answered) return respond(answered)
    if (rest === '/preview') {
      return respond({
        status: 200,
        body: { html: `<p>${String(body.body)}</p>`, headings: [] },
      })
    }
    const id = decodeURIComponent(rest.slice(1))
    if (method === 'POST') {
      made += 1
      const made16 = `madeHere${String(made).padStart(8, '0')}`
      if (body.role === 'chapter') {
        book.chapters.push(
          noteChapter({
            id: made16,
            title: body.title,
            stamp: `w:${made16}.0`,
          }),
        )
      } else {
        book.entries.push(
          noteEntry({
            id: made16,
            title: body.title,
            body: body.body ?? '',
            html: `<p>${String(body.body ?? '')}</p>`,
            chapterId: body.chapterId ?? null,
            stamp: `w:${made16}.0`,
          }),
        )
      }
      bump(book)
      return respond({
        status: 201,
        body: { id: made16, stamp: `w:${made16}.0` },
      })
    }
    const entry = book.entries.find(note => note.id === id)
    const chapter = book.chapters.find(note => note.id === id)
    if (method === 'PATCH' && body && !('resolve' in body)) {
      if (entry) {
        Object.assign(entry, {
          title: body.title,
          body: body.body ?? entry.body,
          html: `<p>${String(body.body ?? entry.body)}</p>`,
          chapterId: body.chapterId ?? null,
        })
      } else if (chapter) {
        chapter.title = body.title
      } else {
        return respond({ status: 404 })
      }
      bump(book)
      return respond({ status: 200, body: { stamp: `w:${id}.1` } })
    }
    if (method === 'DELETE') {
      if (!entry) return respond({ status: 404 })
      book.entries = book.entries.filter(note => note.id !== id)
      bump(book)
      return respond({ status: 200, body: {} })
    }
    bump(book)
    return respond({ status: 200, body: { stamp: `w:${id}.2` } })
  }) as typeof fetch)
  return server
}
