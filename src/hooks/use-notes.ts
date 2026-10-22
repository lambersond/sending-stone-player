import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { POLL_INTERVAL } from '@/hooks/use-table-view'
import type {
  NoteChange,
  NoteInput,
  NoteOrder,
  NoteOrderResolve,
  NoteRefusal,
  NoteResolve,
  NoteRole,
  NotesView,
  NoteWriteAnswer,
} from '@/types/notes'

/** The longest wait between attempts while the server cannot be reached. */
const MAX_DELAY = 30_000

/**
 * What's being written: a new note ('new'), a new chapter ('new-chapter'), or a change to the note
 * or chapter of that id, from the stamp it started at (§8.8); what it started as, so that a
 * change can be told from none; what opened it; and where focus was in it as it last unmounted.
 */
export type NoteDraft = {
  key: string
  role: NoteRole
  title: string
  body: string
  chapterId: string | null
  stamp?: string
  started: { title: string; body: string; chapterId: string | null }
  /** The control that opened it, found again to give focus back to (§9.6). */
  opener: 'new' | 'new-in' | 'new-chapter' | 'edit' | 'problem-edit' | 'rename'
  /**
   * Where focus was, inside the editor, as it unmounted: put back once it's mounted again (§9.6).
   */
  focus?: { field: 'chapter' | 'title' | 'body'; start?: number; end?: number }
  /**
   * Sent, and not yet answered: its fields hold still and Cancel waits till then, so what's kept is
   * what was typed. Kept here rather than in the editor, so an editor mounted again meanwhile, as
   * when another tab is chosen and this one again, can't send it a second time.
   */
  saving?: true
}

/**
 * A draft as it's set: the draft itself, none, or what it becomes from the one held now, which
 * the change is given at once, as the store holds it then.
 */
export type DraftChange =
  | NoteDraft
  | undefined
  | ((held: NoteDraft | undefined) => NoteDraft | undefined)

export type NotesState = 'loading' | 'ready' | 'gone' | 'failed'

/** What the journal's reader shows: a note, or a group's page, the loose group's as null. */
export type NotePick = { note: string } | { group: string | null }

/**
 * What a page holds of one book: what it last saw of it, what's being written in it, and whether
 * its journal is open, with what its reader shows (round 0.35.0 §8.2).
 */
type Book = {
  view?: NotesView
  draft?: NoteDraft
  open?: { pick?: NotePick }
}

/*
 * The page's store of books, by the seat's API base, for as long as the page is loaded: in memory
 * only, never in the browser's storage, as a note's text never goes there. An API base is one
 * user's, as its routes answer only them, so nothing of one user's is shown another. The Biography
 * tab and the party's Description unmount whenever another tab is chosen, the sheet arriving moves
 * the journal's card to another place, and the party panel unmounts as it closes: the store is what
 * keeps the book in view, an open editor's text, and the journal open, across all of them. It's
 * written only on the client, in effects and event handlers, so a server render, which shares the
 * module with every request, never holds a book.
 */
const books = new Map<string, Book>()
const listeners = new Map<string, Set<() => void>>()

function subscribe(api: string, listener: () => void): () => void {
  const held = listeners.get(api) ?? new Set()
  held.add(listener)
  listeners.set(api, held)
  return () => {
    held.delete(listener)
    if (held.size === 0) listeners.delete(api)
  }
}

/** Keeps what a page holds of a book, or forgets it, and tells each section showing it. */
function put(api: string, book?: Book): void {
  if (
    book &&
    (book.view !== undefined ||
      book.draft !== undefined ||
      book.open !== undefined)
  ) {
    books.set(api, book)
  } else {
    books.delete(api)
  }
  for (const listener of listeners.get(api) ?? []) listener()
  guardLeaving()
}

/** Has the draft been changed from what it started as? */
export function draftChanged(draft: NoteDraft): boolean {
  const { started } = draft
  return (
    draft.title !== started.title ||
    draft.body !== started.body ||
    draft.chapterId !== started.chapterId
  )
}

/** Asks the browser's own "Leave site?" question. */
function askBeforeLeaving(event: BeforeUnloadEvent): void {
  event.preventDefault()
}

let guarding = false

/**
 * While any book's draft differs from what it started as, leaving the page asks first. The store
 * keeps the handler, not the sections, as a draft waits with its section unmounted, on another of
 * the sheet's tabs or with the party panel closed, and still asks.
 */
function guardLeaving(): void {
  const unsaved = [...books.values()].some(
    ({ draft }) => draft !== undefined && draftChanged(draft),
  )
  if (unsaved === guarding) return
  guarding = unsaved
  if (unsaved) globalThis.addEventListener('beforeunload', askBeforeLeaving)
  else globalThis.removeEventListener('beforeunload', askBeforeLeaving)
}

/** What a server render holds of a book: nothing, ever. */
function onServer(): Book | undefined {
  return
}

/**
 * Is something being written in this book? A host reads it to choose the tab it opens on (§9.3).
 */
export function hasDraft(api: string): boolean {
  return books.get(api)?.draft !== undefined
}

/**
 * Is this book's journal open? A host reads it to choose the tab it opens on, so a journal open
 * where the card was is open again where the card is now (round 0.35.0 §8.2-§8.3).
 */
export function journalOpen(api: string): boolean {
  return books.get(api)?.open !== undefined
}

/** Forgets every book the page holds, as a reload does. */
export function forgetNotes(): void {
  for (const api of books.keys()) put(api)
}

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
async function bodyOf(response: Response): Promise<Record<string, unknown>> {
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
async function answerOf(response: Response): Promise<NoteWriteAnswer> {
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
function idsOf(view: NotesView | undefined): Set<string> {
  return new Set([
    ...(view?.chapters ?? []).map(({ id }) => id),
    ...(view?.entries ?? []).map(({ id }) => id),
  ])
}

/**
 * The note or chapter a create made, where its answer was lost: one in the book now that wasn't
 * as it was sent, that the seat may change, holding just what was sent.
 */
function madeFrom(
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

/**
 * A book of notes through a seat's API (its base + '/notes'): fetched when first active, then
 * polled every POLL_INTERVAL while active and the page is visible, with ?version=&live= for 204
 * while nothing changed; at once after each change sent. 404 is 'gone'. Backs off on failures as
 * useTableView does. What it last held of the book, and what's being written in it, are kept in
 * the page's store by book, so a card mounted again starts from them; and so is whether its journal
 * is open, with what its reader shows, so a card mounted again, as when the sheet arrives, shows it
 * open again where it was.
 */
export function useNotes(
  api: string,
  { active }: { active: boolean },
): {
  view?: NotesView
  state: NotesState
  create(input: NoteInput): Promise<NoteWriteAnswer>
  change(id: string, change: NoteChange): Promise<NoteWriteAnswer>
  remove(id: string, stamp: string): Promise<NoteWriteAnswer>
  resolve(id: string, choice: NoteResolve): Promise<NoteWriteAnswer>
  /** Sends a new order of a group's notes (module 0.35.0). */
  reorder(order: NoteOrder): Promise<NoteWriteAnswer>
  /** Sends the seat's choice where the game didn't take a group's order (module 0.35.0). */
  resolveOrder(choice: NoteOrderResolve): Promise<NoteWriteAnswer>
  preview(
    body: string,
  ): Promise<{ html: string; headings: number[] } | undefined>
  /** What's being written in this book, if anything: one thing at a time. */
  draft?: NoteDraft
  setDraft(draft: DraftChange): void
  /** The journal open, and what its reader shows; none while it's closed. */
  open?: { pick?: NotePick }
  /** Opens the journal afresh, its reader on nothing picked yet, or closes it. */
  setOpen(open: boolean): void
  /** What the reader shows, kept while the journal is open, so a card mounted again shows it. */
  setPick(pick: NotePick): void
} {
  const book = useSyncExternalStore(
    useCallback(listener => subscribe(api, listener), [api]),
    () => books.get(api),
    onServer,
  )
  // The book the seat may no longer see, and whether reading it failed since it was mounted.
  const [goneFrom, setGoneFrom] = useState<string>()
  const [failing, setFailing] = useState(false)
  const gone = goneFrom === api
  // Reads the book at once, while it's polled: after a change, so the list shows it.
  const refresh = useRef<() => Promise<void>>(undefined)

  useEffect(() => {
    if (!active || gone) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let stopped = false
    let running: Promise<void> | undefined
    let again = false

    const poll = async () => {
      const held = books.get(api)?.view
      const query = held
        ? `?${new URLSearchParams({
            version: String(held.version),
            live: held.live ? '1' : '0',
          })}`
        : ''
      try {
        const response = await fetch(`${api}/notes${query}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        // Read for a section since unmounted, or no longer in view: nothing of it is kept.
        if (controller.signal.aborted) return
        if (response.status === 404) {
          // No longer the seat's to see: nothing of it stays on the page.
          stopped = true
          put(api)
          setGoneFrom(api)
          return
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        if (response.status === 200) {
          const view = (await response.json()) as NotesView
          if (controller.signal.aborted) return
          put(api, { ...books.get(api), view })
        }
        failures = 0
        setFailing(false)
      } catch {
        if (controller.signal.aborted) return
        failures += 1
        setFailing(true)
      }
    }

    // One read at a time; one asked for meanwhile runs once it's done, as a change may have
    // been made after the read started.
    const read = async () => {
      if (running) {
        again = true
        return running
      }
      running = (async () => {
        do {
          again = false
          await poll()
        } while (again && !stopped && !controller.signal.aborted)
      })()
      try {
        await running
      } finally {
        running = undefined
      }
    }

    const schedule = () => {
      clearTimeout(timer)
      if (stopped || controller.signal.aborted) return
      const delay = failures
        ? Math.min(POLL_INTERVAL * 2 ** failures, MAX_DELAY)
        : POLL_INTERVAL
      timer = setTimeout(tick, delay)
    }

    const tick = async () => {
      timer = undefined
      if (document.visibilityState !== 'hidden') await read()
      schedule()
    }

    refresh.current = async () => {
      clearTimeout(timer)
      timer = undefined
      await read()
      schedule()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && timer) {
        clearTimeout(timer)
        void tick()
      }
    }

    // Without a view to show, it's read at once; with one kept from before, it's asked after in
    // a while, from the version it has.
    timer = setTimeout(tick, books.get(api)?.view ? POLL_INTERVAL : 0)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      controller.abort()
      clearTimeout(timer)
      refresh.current = undefined
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [api, active, gone])

  const write = useCallback(
    async (
      path: string,
      method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      body?: unknown,
    ): Promise<NoteWriteAnswer> => {
      let answer: NoteWriteAnswer
      try {
        const response = await fetch(`${api}/notes${path}`, {
          method,
          cache: 'no-store',
          ...(body !== undefined && {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
        })
        answer = await answerOf(response)
      } catch {
        answer = { ok: false, reason: 'network' }
        // A change or a delete is kept as it was sent or not at all, so it's simply sent again. A
        // create answered by nothing may have made its note all the same, which only a read tells.
        if (method !== 'POST') return answer
      }
      // Kept or refused, the book is read again at once, so the list shows what's there now.
      await refresh.current?.()
      return answer
    },
    [api],
  )

  const create = useCallback(
    async (input: NoteInput): Promise<NoteWriteAnswer> => {
      const before = idsOf(books.get(api)?.view)
      const answer = await write('', 'POST', input)
      if (answer.ok || answer.reason !== 'network') return answer
      // Its answer lost on the way back, it may have been kept all the same, and as the server
      // names a note itself, sending it again would make a second. The book has been read again
      // since: one there now that wasn't as it was sent, just as it was sent, is this one.
      const made = madeFrom(books.get(api)?.view, input, before)
      return made ? { ok: true, id: made.id, stamp: made.stamp } : answer
    },
    [api, write],
  )
  const change = useCallback(
    (id: string, made: NoteChange) =>
      write(`/${encodeURIComponent(id)}`, 'PATCH', made),
    [write],
  )
  const remove = useCallback(
    (id: string, stamp: string) =>
      write(
        `/${encodeURIComponent(id)}?${new URLSearchParams({ stamp })}`,
        'DELETE',
      ),
    [write],
  )
  const resolve = useCallback(
    (id: string, choice: NoteResolve) =>
      write(`/${encodeURIComponent(id)}`, 'PATCH', choice),
    [write],
  )
  const reorder = useCallback(
    (order: NoteOrder) => write('/order', 'PUT', order),
    [write],
  )
  const resolveOrder = useCallback(
    (choice: NoteOrderResolve) => write('/order', 'PATCH', choice),
    [write],
  )
  const preview = useCallback(
    async (body: string) => {
      try {
        const response = await fetch(`${api}/notes/preview`, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        })
        if (!response.ok) return
        const shown = await bodyOf(response)
        if (typeof shown.html !== 'string') return
        const headings = Array.isArray(shown.headings)
          ? shown.headings.filter((line): line is number =>
              Number.isInteger(line),
            )
          : []
        return { html: shown.html, headings }
      } catch {
        return
      }
    },
    [api],
  )
  const setDraft = useCallback(
    (next: DraftChange) => {
      const held = books.get(api)
      const draft = typeof next === 'function' ? next(held?.draft) : next
      if (draft === held?.draft) return
      put(api, { ...held, draft })
    },
    [api],
  )
  const setOpen = useCallback(
    (open: boolean) => {
      const held = books.get(api)
      if (!open && held?.open === undefined) return
      put(api, { ...held, open: open ? {} : undefined })
    },
    [api],
  )
  const setPick = useCallback(
    (pick: NotePick) => {
      const held = books.get(api)
      // Only while it's open: a pick never opens it.
      if (!held?.open) return
      put(api, { ...held, open: { pick } })
    },
    [api],
  )

  const view = gone ? undefined : book?.view
  let state: NotesState = 'loading'
  if (gone) state = 'gone'
  else if (view) state = 'ready'
  else if (failing) state = 'failed'
  return {
    view,
    state,
    create,
    change,
    remove,
    resolve,
    reorder,
    resolveOrder,
    preview,
    draft: gone ? undefined : book?.draft,
    setDraft,
    open: gone ? undefined : book?.open,
    setOpen,
    setPick,
  }
}
