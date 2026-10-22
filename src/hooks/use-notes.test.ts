/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
import { createElement } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import {
  forgetNotes,
  hasDraft,
  journalOpen,
  useNotes,
  type NoteDraft,
} from './use-notes'
import { POLL_INTERVAL } from './use-table-view'
import { JournalCard } from '@/components/notes'
import { mockNotesView } from '@/mocks/sending-stone'
import type { NotesView } from '@/types/notes'

const API = '/api/characters/char-1'
const OTHER = '/api/characters/char-2/party/company'

const respond = (status: number, body?: unknown) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (body === undefined) throw new SyntaxError('no body')
      return body
    },
  } as Response)

/**
 * The notes' routes, as the app answers them: the book, with 204 while the version and liveness
 * asked about are its own; and each write as `answer` says.
 */
const serve = (
  fields: Partial<NotesView> = {},
  answer: (url: string, init: RequestInit) => Promise<Response> = () =>
    respond(201, { id: 'newNoteId0000001', stamp: 'w:new.0' }),
) => {
  const server = { view: mockNotesView(fields), status: 200 }
  globalThis.fetch = jest.fn((async (url: string, init: RequestInit = {}) => {
    if (init.method && init.method !== 'GET') return answer(url, init)
    if (server.status !== 200) return respond(server.status)
    const query = new URL(url, 'http://app').searchParams
    if (
      query.get('version') === String(server.view.version) &&
      query.get('live') === (server.view.live ? '1' : '0')
    ) {
      return respond(204)
    }
    return respond(200, server.view)
  }) as typeof fetch)
  return server
}

/** The book's reads, by the URL each asked. */
const reads = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([, init]) => !init?.method || init.method === 'GET')
    .map(([url]) => String(url))

const draft = (fields: Partial<NoteDraft> = {}): NoteDraft => ({
  key: 'new',
  role: 'entry',
  title: '',
  body: '',
  chapterId: null,
  started: { title: '', body: '', chapterId: null },
  opener: 'new',
  ...fields,
})

/** Lets what's waiting on the timers and the fetches run, as far as the time given. */
const pass = (ms = 0) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })

/** Sends a note, Wolves, answered as the server answers it. */
const createWolves = async (result: {
  current: ReturnType<typeof useNotes>
}) => {
  let answer: unknown
  await act(async () => {
    answer = await result.current.create({
      role: 'entry',
      title: 'Wolves',
      body: 'Three.',
      chapterId: null,
    })
  })
  return answer
}

const leaving = () => {
  const event = new Event('beforeunload', { cancelable: true })
  globalThis.dispatchEvent(event)
  return event.defaultPrevented
}

describe('hooks/use-notes', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    forgetNotes()
  })

  afterEach(() => {
    act(() => forgetNotes())
    jest.useRealTimers()
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
  })

  it('reads the book at once when first active, and not before', async () => {
    serve()
    const { result, rerender } = renderHook(
      ({ active }) => useNotes(API, { active }),
      { initialProps: { active: false } },
    )
    await pass(POLL_INTERVAL * 3)
    expect(fetch).not.toHaveBeenCalled()
    expect(result.current.state).toBe('loading')

    rerender({ active: true })
    await pass()

    expect(reads()).toEqual([`${API}/notes`])
    expect(fetch).toHaveBeenCalledWith(`${API}/notes`, {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
    expect(result.current.state).toBe('ready')
    expect(result.current.view?.entries.map(({ title }) => title)).toEqual([
      'The goblin cave',
      'Waiting',
    ])
  })

  it('polls with the version and liveness it has, keeping its view while nothing changed', async () => {
    const server = serve()
    const { result } = renderHook(() => useNotes(API, { active: true }))
    await pass()
    const first = result.current.view

    await pass(POLL_INTERVAL)
    expect(reads().at(-1)).toBe(`${API}/notes?version=3&live=1`)
    expect(result.current.view).toBe(first)

    server.view = mockNotesView({ version: 4, live: false })
    await pass(POLL_INTERVAL)
    expect(result.current.view?.version).toBe(4)
    await pass(POLL_INTERVAL)
    expect(reads().at(-1)).toBe(`${API}/notes?version=4&live=0`)
  })

  it('stops polling once it’s no longer active', async () => {
    serve()
    const { rerender } = renderHook(({ active }) => useNotes(API, { active }), {
      initialProps: { active: true },
    })
    await pass()
    rerender({ active: false })
    jest.mocked(fetch).mockClear()

    await pass(POLL_INTERVAL * 5)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('pauses while the page is hidden, and catches up as soon as it’s shown', async () => {
    serve()
    renderHook(() => useNotes(API, { active: true }))
    await pass()
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    jest.mocked(fetch).mockClear()
    await pass(POLL_INTERVAL * 5)
    expect(fetch).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await pass()
    expect(reads()).toEqual([`${API}/notes?version=3&live=1`])
  })

  it('is gone on a 404, which takes the book’s view and draft from the page', async () => {
    const server = serve()
    const { result, unmount } = renderHook(() =>
      useNotes(API, { active: true }),
    )
    await pass()
    act(() => result.current.setDraft(draft({ title: 'Half written' })))
    expect(hasDraft(API)).toBe(true)

    server.status = 404
    await pass(POLL_INTERVAL)

    expect(result.current.state).toBe('gone')
    expect(result.current.view).toBeUndefined()
    expect(result.current.draft).toBeUndefined()
    expect(hasDraft(API)).toBe(false)
    // And it asks no more.
    jest.mocked(fetch).mockClear()
    await pass(POLL_INTERVAL * 5)
    expect(fetch).not.toHaveBeenCalled()
    unmount()

    // Mounted again, it has nothing of the book to show.
    server.status = 200
    const again = renderHook(() => useNotes(API, { active: false }))
    expect(again.result.current.state).toBe('loading')
    expect(again.result.current.view).toBeUndefined()
  })

  it('backs off while the book can’t be read, as the table does', async () => {
    serve()
    jest.mocked(fetch).mockImplementation(() => respond(500))
    const { result } = renderHook(() => useNotes(API, { active: true }))
    await pass()
    expect(result.current.state).toBe('failed')
    expect(fetch).toHaveBeenCalledTimes(1)

    await pass(POLL_INTERVAL * 2 - 1)
    expect(fetch).toHaveBeenCalledTimes(1)
    await pass(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    await pass(POLL_INTERVAL * 4)
    expect(fetch).toHaveBeenCalledTimes(3)

    // Read again, it's ready.
    serve()
    await pass(POLL_INTERVAL * 8)
    expect(result.current.state).toBe('ready')
  })

  it.each([
    [
      'a fetch that fails',
      () => {
        globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('down')))
      },
    ],
    [
      'no fetch at all',
      () => {
        // @ts-expect-error -- a browser with no fetch
        globalThis.fetch = undefined
      },
    ],
    [
      'a fetch that answers nothing',
      () => {
        globalThis.fetch = jest.fn() as unknown as typeof fetch
      },
    ],
  ])('never throws with %s', async (_, broken) => {
    broken()
    const { result } = renderHook(() => useNotes(API, { active: true }))
    await pass()
    expect(result.current.state).toBe('failed')
    await act(async () => {
      await expect(
        result.current.create({ role: 'chapter', title: 'Session 1' }),
      ).resolves.toEqual({ ok: false, reason: 'network' })
      await expect(result.current.preview('### Loot')).resolves.toBeUndefined()
    })
  })

  it('sends a new note, then reads the book again at once, before it answers', async () => {
    const server = serve()
    const { result } = renderHook(() => useNotes(API, { active: true }))
    await pass()
    server.view = mockNotesView({ version: 4 })

    let answer: unknown
    await act(async () => {
      answer = await result.current.create({
        role: 'entry',
        title: 'Wolves',
        body: 'Three.',
        chapterId: null,
      })
    })

    expect(answer).toEqual({
      ok: true,
      id: 'newNoteId0000001',
      stamp: 'w:new.0',
    })
    expect(fetch).toHaveBeenCalledWith(`${API}/notes`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'entry',
        title: 'Wolves',
        body: 'Three.',
        chapterId: null,
      }),
    })
    expect(reads().at(-1)).toBe(`${API}/notes?version=3&live=1`)
    expect(result.current.view?.version).toBe(4)
  })

  describe('a create whose answer is lost on its way back', () => {
    const wolves = {
      ...mockNotesView().entries[0],
      id: 'madeAfterAll0001',
      chapterId: null,
      title: 'Wolves',
      body: 'Three.',
      html: '<p>Three.</p>',
      stamp: 'w:made.0',
    }
    it('answers it made, with its id, where the book read again holds it, so it isn’t sent twice', async () => {
      const server = serve({}, async () => {
        // Kept, then the answer lost, as on a phone that drops the network.
        const held = server.view
        server.view = mockNotesView({
          version: held.version + 1,
          entries: [...held.entries, wolves],
        })
        throw new TypeError('Failed to fetch')
      })
      const { result } = renderHook(() => useNotes(API, { active: true }))
      await pass()
      expect(await createWolves(result)).toEqual({
        ok: true,
        id: 'madeAfterAll0001',
        stamp: 'w:made.0',
      })
      expect(reads()).toHaveLength(2)
    })

    it.each([
      ['wasn’t kept', (view: NotesView) => view],
      [
        'was there already, as it was sent',
        (view: NotesView) => view,
        [wolves],
      ],
      [
        'holds something else',
        (view: NotesView) => ({
          ...view,
          version: view.version + 1,
          entries: [...view.entries, { ...wolves, body: 'Four.' }],
        }),
      ],
    ])(
      'answers that it couldn’t be reached where the note %s',
      async (_, after, before: (typeof wolves)[] = []) => {
        const server = serve(
          { entries: [...mockNotesView().entries, ...before] },
          async () => {
            server.view = after(server.view)
            throw new TypeError('Failed to fetch')
          },
        )
        const { result } = renderHook(() => useNotes(API, { active: true }))
        await pass()
        expect(await createWolves(result)).toEqual({
          ok: false,
          reason: 'network',
        })
      },
    )

    it('sends a change or a delete answered by nothing again, rather than reading the book first', async () => {
      serve({}, () => Promise.reject(new TypeError('Failed to fetch')))
      const { result } = renderHook(() => useNotes(API, { active: true }))
      await pass()
      await act(async () => {
        await expect(
          result.current.remove('goblinCaveNote01', 'n:1'),
        ).resolves.toEqual({ ok: false, reason: 'network' })
      })
      expect(reads()).toHaveLength(1)
    })
  })

  it('changes, deletes and settles notes, and previews one, each at its own address', async () => {
    serve({}, async () => respond(200, { stamp: 'w:abc.1' }))
    const { result } = renderHook(() => useNotes(API, { active: true }))
    await pass()
    await act(async () => {
      await expect(
        result.current.change('goblinCaveNote01', {
          title: 'Goblin cave',
          body: '',
          chapterId: null,
          stamp: 'n:1',
        }),
      ).resolves.toEqual({ ok: true, stamp: 'w:abc.1' })
      await result.current.remove('goblinCaveNote01', 'w:abc.1')
      await result.current.resolve('goblinCaveNote01', {
        resolve: 'mine',
        stamp: 'w:abc.2',
      })
    })
    const writes = jest
      .mocked(fetch)
      .mock.calls.filter(([, init]) => init?.method)
      .map(([url, init]) => [url, init?.method, init?.body])
    expect(writes).toEqual([
      [
        `${API}/notes/goblinCaveNote01`,
        'PATCH',
        JSON.stringify({
          title: 'Goblin cave',
          body: '',
          chapterId: null,
          stamp: 'n:1',
        }),
      ],
      [`${API}/notes/goblinCaveNote01?stamp=w%3Aabc.1`, 'DELETE', undefined],
      [
        `${API}/notes/goblinCaveNote01`,
        'PATCH',
        JSON.stringify({ resolve: 'mine', stamp: 'w:abc.2' }),
      ],
    ])

    jest
      .mocked(fetch)
      .mockImplementationOnce(() =>
        respond(200, { html: '<h5>Loot</h5>', headings: [2, 'x'] }),
      )
    await act(async () => {
      await expect(result.current.preview('### Loot\n#x')).resolves.toEqual({
        html: '<h5>Loot</h5>',
        headings: [2],
      })
    })
    expect(fetch).toHaveBeenLastCalledWith(`${API}/notes/preview`, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: '### Loot\n#x' }),
    })
    jest.mocked(fetch).mockImplementationOnce(() => respond(404))
    await act(async () => {
      await expect(result.current.preview('a')).resolves.toBeUndefined()
    })
  })

  it('sends a new order of a group’s notes, and a choice on a refused one, at the order’s address, then reads the book again', async () => {
    serve({}, async () => respond(200, { stamp: 'g:0123456789abcdef' }))
    const { result } = renderHook(() => useNotes(API, { active: true }))
    await pass()
    await act(async () => {
      await expect(
        result.current.reorder({
          chapterId: 'sessionChapter01',
          ids: ['wolvesNote000001', 'goblinCaveNote01'],
          stamp: 'g:fedcba9876543210',
        }),
      ).resolves.toEqual({ ok: true, stamp: 'g:0123456789abcdef' })
    })
    expect(reads()).toHaveLength(2)
    await act(async () => {
      await result.current.resolveOrder({
        chapterId: null,
        resolve: 'theirs',
        stamp: 'g:0123456789abcdef',
      })
    })
    expect(reads()).toHaveLength(3)
    const writes = jest
      .mocked(fetch)
      .mock.calls.filter(([, init]) => init?.method)
      .map(([url, init]) => [url, init?.method, init?.body])
    expect(writes).toEqual([
      [
        `${API}/notes/order`,
        'PUT',
        JSON.stringify({
          chapterId: 'sessionChapter01',
          ids: ['wolvesNote000001', 'goblinCaveNote01'],
          stamp: 'g:fedcba9876543210',
        }),
      ],
      [
        `${API}/notes/order`,
        'PATCH',
        JSON.stringify({
          chapterId: null,
          resolve: 'theirs',
          stamp: 'g:0123456789abcdef',
        }),
      ],
    ])
  })

  it('answers an order refused, with why', async () => {
    serve({}, () => respond(409, { reason: 'changed' }))
    const { result } = renderHook(() => useNotes(API, { active: true }))
    await pass()
    await act(async () => {
      await expect(
        result.current.reorder({ chapterId: null, ids: ['a'], stamp: 'g:1' }),
      ).resolves.toEqual({ ok: false, reason: 'changed' })
    })
  })

  it.each([
    [
      422,
      { reason: 'headings', lines: [2, 4] },
      { ok: false, reason: 'headings', lines: [2, 4] },
    ],
    [
      400,
      { reason: 'invalid', field: 'title' },
      { ok: false, reason: 'invalid', field: 'title' },
    ],
    [409, { reason: 'saving' }, { ok: false, reason: 'saving' }],
    [429, { reason: 'busy' }, { ok: false, reason: 'busy' }],
    [409, { reason: 'something new' }, { ok: false, reason: 'invalid' }],
    [415, undefined, { ok: false, reason: 'invalid' }],
    // The note deleted meanwhile, or the book no longer the seat's, which the read after says.
    [404, undefined, { ok: false, reason: 'changed' }],
    [401, undefined, { ok: false, reason: 'network' }],
    [500, undefined, { ok: false, reason: 'network' }],
  ])('answers a refusal, %s, with why', async (status, body, answer) => {
    serve({}, () => respond(status, body))
    const { result } = renderHook(() => useNotes(API, { active: true }))
    await pass()
    await act(async () => {
      await expect(
        result.current.create({ role: 'chapter', title: 'Session 2' }),
      ).resolves.toEqual(answer)
    })
    // The book is read again, whatever the answer.
    expect(reads()).toHaveLength(2)
  })

  describe('the page’s store', () => {
    it('shows the last view at once when mounted again, and polls from its version', async () => {
      serve()
      const first = renderHook(() => useNotes(API, { active: true }))
      await pass()
      first.unmount()
      jest.mocked(fetch).mockClear()

      const { result } = renderHook(() => useNotes(API, { active: true }))
      expect(result.current.state).toBe('ready')
      expect(result.current.view?.version).toBe(3)
      await pass(POLL_INTERVAL - 1)
      expect(fetch).not.toHaveBeenCalled()
      await pass(1)
      expect(reads()).toEqual([`${API}/notes?version=3&live=1`])
    })

    it('keeps a draft across an unmount, one for each book, until it’s cleared', async () => {
      serve()
      const { result, unmount } = renderHook(() =>
        useNotes(API, { active: true }),
      )
      const other = renderHook(() => useNotes(OTHER, { active: false }))
      await pass()
      act(() => result.current.setDraft(draft({ title: 'Wolves' })))
      act(() =>
        result.current.setDraft(held => held && { ...held, body: 'Three.' }),
      )
      expect(other.result.current.draft).toBeUndefined()
      expect(hasDraft(API)).toBe(true)
      expect(hasDraft(OTHER)).toBe(false)
      unmount()

      const again = renderHook(() => useNotes(API, { active: true }))
      expect(again.result.current.draft).toMatchObject({
        title: 'Wolves',
        body: 'Three.',
      })
      act(() => again.result.current.setDraft(undefined))
      expect(again.result.current.draft).toBeUndefined()
      expect(hasDraft(API)).toBe(false)
      // An update of a draft gone is nothing.
      act(() =>
        again.result.current.setDraft(held => held && { ...held, body: 'x' }),
      )
      expect(hasDraft(API)).toBe(false)
    })

    it('keeps the journal open, and what its reader shows, across an unmount', async () => {
      serve()
      const { result, unmount } = renderHook(() =>
        useNotes(API, { active: true }),
      )
      await pass()
      expect(result.current.open).toBeUndefined()
      expect(journalOpen(API)).toBe(false)
      // A pick never opens it.
      act(() => result.current.setPick({ note: 'goblinCaveNote01' }))
      expect(result.current.open).toBeUndefined()

      act(() => result.current.setOpen(true))
      expect(result.current.open).toEqual({})
      expect(journalOpen(API)).toBe(true)
      expect(journalOpen(OTHER)).toBe(false)
      act(() => result.current.setPick({ note: 'goblinCaveNote01' }))
      act(() => result.current.setPick({ group: null }))
      unmount()

      const again = renderHook(() => useNotes(API, { active: false }))
      expect(again.result.current.open).toEqual({ pick: { group: null } })
      // Opened afresh, from the card's button, it holds no pick.
      act(() => again.result.current.setOpen(true))
      expect(again.result.current.open).toEqual({})
      act(() => again.result.current.setOpen(false))
      expect(again.result.current.open).toBeUndefined()
      expect(journalOpen(API)).toBe(false)
      // Closing what's closed is nothing.
      act(() => again.result.current.setOpen(false))
      expect(journalOpen(API)).toBe(false)
    })

    it('keeps a book that’s only open, with no view or draft yet', () => {
      serve()
      const { result } = renderHook(() => useNotes(API, { active: false }))
      act(() => result.current.setOpen(true))
      expect(journalOpen(API)).toBe(true)
      act(() => result.current.setOpen(false))
      expect(journalOpen(API)).toBe(false)
    })

    it('forgets the journal open, and its pick, on a 404', async () => {
      const server = serve()
      const { result } = renderHook(() => useNotes(API, { active: true }))
      await pass()
      act(() => result.current.setOpen(true))
      act(() => result.current.setPick({ note: 'goblinCaveNote01' }))
      server.status = 404
      await pass(POLL_INTERVAL)
      expect(result.current.state).toBe('gone')
      expect(result.current.open).toBeUndefined()
      expect(journalOpen(API)).toBe(false)
    })

    it('writes nothing to the browser’s storage', async () => {
      const setItem = jest.spyOn(Storage.prototype, 'setItem')
      try {
        serve()
        const { result } = renderHook(() => useNotes(API, { active: true }))
        await pass()
        act(() => result.current.setDraft(draft({ title: 'Secret plans' })))
        await act(async () => {
          await result.current.create({ role: 'chapter', title: 'Session 2' })
        })
        expect(setItem).not.toHaveBeenCalled()
      } finally {
        setItem.mockRestore()
      }
    })

    it('asks before the page is left while a draft differs from what it started as, with no section mounted too', async () => {
      serve()
      const { result, unmount } = renderHook(() =>
        useNotes(API, { active: true }),
      )
      await pass()
      expect(leaving()).toBe(false)

      // Opened, but nothing written yet.
      act(() => result.current.setDraft(draft()))
      expect(leaving()).toBe(false)
      act(() => result.current.setDraft(draft({ title: 'Wolves' })))
      expect(leaving()).toBe(true)

      // The section unmounted, as on another of the sheet's tabs: the draft still asks.
      unmount()
      expect(leaving()).toBe(true)

      // Saved or discarded, it no longer does.
      const again = renderHook(() => useNotes(API, { active: false }))
      act(() => again.result.current.setDraft(undefined))
      expect(leaving()).toBe(false)
    })

    it('stops asking once the book is gone', async () => {
      const server = serve()
      const { result } = renderHook(() => useNotes(API, { active: true }))
      await pass()
      act(() => result.current.setDraft(draft({ title: 'Wolves' })))
      expect(leaving()).toBe(true)
      server.status = 404
      await pass(POLL_INTERVAL)
      expect(leaving()).toBe(false)
    })

    it('holds nothing on a server render, which fetches nothing', () => {
      jest.useRealTimers()
      serve()
      const html = renderToString(
        createElement(JournalCard, {
          api: API,
          role: 'player',
          kind: 'personal',
          name: 'Thorin',
          active: true,
          look: 'sheet',
        }),
      )
      expect(html).toContain('Loading notes…')
      expect(hasDraft(API)).toBe(false)
      expect(journalOpen(API)).toBe(false)
      expect(fetch).not.toHaveBeenCalled()
      // Nothing kept of a book: mounted in the browser after, it starts from nothing.
      const { result } = renderHook(() => useNotes(API, { active: false }))
      expect(result.current.view).toBeUndefined()
    })
  })

  it('reads the book again once a change is answered, even while a read is on its way', async () => {
    let release: (() => void) | undefined
    const server = serve()
    const { result } = renderHook(() => useNotes(API, { active: true }))
    await pass()
    // The next read hangs until released.
    const held = jest.mocked(fetch).getMockImplementation()!
    jest.mocked(fetch).mockImplementation((async (
      url: string,
      init?: RequestInit,
    ) => {
      if (!init?.method && !release) {
        await new Promise<void>(resolve => {
          release = resolve
        })
      }
      return held(url, init)
    }) as typeof fetch)
    await pass(POLL_INTERVAL)
    server.view = mockNotesView({ version: 5 })
    let done = false
    act(() => {
      void result.current
        .create({ role: 'chapter', title: 'Session 2' })
        .then(() => {
          done = true
        })
    })
    await pass()
    expect(done).toBe(false)
    release?.()
    await waitFor(() => expect(done).toBe(true))
    expect(result.current.view?.version).toBe(5)
  })
})
