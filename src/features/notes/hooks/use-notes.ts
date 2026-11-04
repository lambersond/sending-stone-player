import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react'
import { useRouter } from 'next/navigation'
import { POLL_INTERVAL, POLL_MOST_DELAY } from '@/constants/polling'
import {
  answerOf,
  bodyOf,
  idsOf,
  madeFrom,
} from '@/features/notes/utils/answers'
import { retryDelay } from '@/utils/polling'
import { seenQuery } from '@/utils/seen-query'
import type {
  Book,
  DraftChange,
  NoteDraft,
  NotePick,
  NotesState,
} from '@/features/notes/types'
import type {
  NoteChange,
  NoteInput,
  NoteOrder,
  NoteOrderResolve,
  NoteResolve,
  NotesView,
  NoteWriteAnswer,
} from '@/types/notes'

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

/**
 * Reads a book while it's active: at once without a view kept, else after POLL_INTERVAL, then
 * every POLL_INTERVAL while the page is visible, backing off on failures; one read at a time, and
 * one asked for meanwhile once it's done. 404 is gone, and nothing of it stays on the page. 401
 * stops it, and the page is rendered again, as the table's poll does.
 * @returns whether the seat may no longer see the book, whether reading it failed since it was
 * mounted, and `refresh`, which reads it at once while it's polled.
 */
function useBookReads(
  api: string,
  active: boolean,
): {
  gone: boolean
  failing: boolean
  refresh: RefObject<(() => Promise<void>) | undefined>
} {
  // The book the seat may no longer see, and whether reading it failed since it was mounted.
  const [goneFrom, setGoneFrom] = useState<string>()
  const [failing, setFailing] = useState(false)
  const gone = goneFrom === api
  // Reads the book at once, while it's polled: after a change, so the list shows it.
  const refresh = useRef<() => Promise<void>>(undefined)
  const router = useRouter()
  // Signed out, as in another tab, or once the session lapsed: the page is rendered again, which
  // sends them to sign in and back.
  const signedOut = useEffectEvent(() => router.refresh())

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
        ? `?${seenQuery({ version: held.version, live: held.live })}`
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
        if (response.status === 401) {
          stopped = true
          signedOut()
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
      timer = setTimeout(
        tick,
        retryDelay(POLL_INTERVAL, failures, POLL_MOST_DELAY),
      )
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

  return { gone, failing, refresh }
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
  const { gone, failing, refresh } = useBookReads(api, active)

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
    [api, refresh],
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
