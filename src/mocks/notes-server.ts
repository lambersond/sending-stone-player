import type { Answer, Sent } from '@/mocks/types'
import type {
  NoteChapterView,
  NoteEntryView,
  NotesTidyView,
  NotesView,
} from '@/types/notes'

/*
 * The journal notes' routes as the app answers them (round 0.34.0 §8.6), for the page's tests:
 * each book by its seat's API base, read with 204 while unchanged, and changed by what's sent to
 * it, as a simple server would, so a test sees what it wrote come back. A test may answer a write
 * itself, as a refusal, or another address, as the sheet's own.
 */

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
    canReorder: true,
    orders: true,
    chapters: [],
    groups: [],
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
 * Thorin's Tidy 5e Sheets journal as a book shows it (module 0.45.0): an entry of Tidy's current
 * sheet, first seen and changed since, and a box of its Classic sheet there before the app could
 * see it; Tidy active.
 */
export function tidyJournal(
  fields: Partial<NotesTidyView> = {},
): NotesTidyView {
  return {
    active: true,
    installed: true,
    classicGone: false,
    entries: [
      {
        key: 'journal:tidyRavenhill01',
        from: 'journal',
        title: 'Ravenhill',
        html: '<p>The ravens speak of the old watch.</p>',
        secret: false,
        firstSeenAt: '2026-11-03T18:00:00.000Z',
        changedAt: '2026-11-05T18:00:00.000Z',
      },
      {
        key: 'classic:notes3',
        from: 'classic',
        title: 'Quests',
        html: '<p>Return the key to Dale.</p>',
        secret: false,
        firstSeenAt: null,
        changedAt: null,
      },
    ],
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
  globalThis.fetch = jest.fn((async (url: string, init: RequestInit = {}) => {
    const at = url.indexOf('/notes')
    const book = at === -1 ? undefined : server.books[url.slice(0, at)]
    if (!book) {
      return elsewhere ? elsewhere(url, init) : respond({ status: 404 })
    }
    const parsed = new URL(url, 'http://app')
    const method = init.method ?? 'GET'
    const rest = parsed.pathname.slice(parsed.pathname.indexOf('/notes') + 6)
    if (method === 'GET') return respond(read(book, parsed.searchParams))
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
    if (rest === '/order') return respond(order(book, method, body))
    const id = decodeURIComponent(rest.slice(1))
    if (method === 'POST') {
      made += 1
      return respond(
        add(book, body, `madeHere${String(made).padStart(8, '0')}`),
      )
    }
    return respond(change(book, method, id, body))
  }) as typeof fetch)
  return server
}

/** A book read: 204 while it's the version and liveness asked about, else a copy of it. */
function read(book: NotesView, asked: URLSearchParams): Answer {
  if (
    asked.get('version') === String(book.version) &&
    asked.get('live') === (book.live ? '1' : '0')
  ) {
    return { status: 204 }
  }
  // A copy, as a response is.
  // eslint-disable-next-line unicorn/prefer-structured-clone -- jsdom has no structuredClone
  return { status: 200, body: JSON.parse(JSON.stringify(book)) }
}

/**
 * A new order of a group's notes (round 0.35.0 §7.6): the book's notes as asked, the group's in its
 * order, after the others, as each group is read in its notes' order.
 */
function order(
  book: NotesView,
  method: string,
  body: { ids: string[] },
): Answer {
  if (method === 'PUT') {
    const moved = new Set<string>(body.ids)
    const ordered = body.ids
      .map((id: string) => book.entries.find(note => note.id === id))
      .filter((note): note is NoteEntryView => note !== undefined)
    book.entries = [
      ...book.entries.filter(note => !moved.has(note.id)),
      ...ordered,
    ]
  }
  bump(book)
  return { status: 200, body: { stamp: `g:${book.version}` } }
}

/** A chapter or an entry added to a book, by the id the server made for it. */
function add(
  book: NotesView,
  body: {
    role?: string
    title: string
    body?: string
    chapterId?: string | null
  },
  made16: string,
): Answer {
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
  return {
    status: 201,
    body: { id: made16, stamp: `w:${made16}.0` },
  }
}

/** A note of a book changed, deleted, or otherwise written. */
function change(
  book: NotesView,
  method: string,
  id: string,
  body: { title: string; body?: string; chapterId?: string | null } | undefined,
): Answer {
  const entry = book.entries.find(note => note.id === id)
  const chapter = book.chapters.find(note => note.id === id)
  if (method === 'PATCH' && body && !('resolve' in body)) {
    if (entry) {
      const from = entry.chapterId
      Object.assign(entry, {
        title: body.title,
        body: body.body ?? entry.body,
        html: `<p>${String(body.body ?? entry.body)}</p>`,
        chapterId: body.chapterId ?? null,
      })
      // Moved to another chapter, it's last in it (round 0.35.0 §2.3).
      if (entry.chapterId !== from) {
        book.entries = [...book.entries.filter(note => note !== entry), entry]
      }
    } else if (chapter) {
      chapter.title = body.title
    } else {
      return { status: 404 }
    }
    bump(book)
    return { status: 200, body: { stamp: `w:${id}.1` } }
  }
  if (method === 'DELETE') {
    if (!entry) return { status: 404 }
    book.entries = book.entries.filter(note => note.id !== id)
    bump(book)
    return { status: 200, body: {} }
  }
  bump(book)
  return { status: 200, body: { stamp: `w:${id}.2` } }
}

/** A book's version, one on for each change. */
function bump(book: NotesView) {
  book.version += 1
}
