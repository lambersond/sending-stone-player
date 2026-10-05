import { act, renderHook } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { POLL_INTERVAL, useTableView } from './use-table-view'
import type { TableView } from '@/types/table'

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))

const refresh = jest.fn()
const initial: TableView = {
  version: 3,
  live: true,
  connected: true,
  messages: [],
}
const newer: TableView = {
  ...initial,
  version: 4,
  live: false,
  campaign: { title: 'The Lonely Mountain' },
}

const respond = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })

let visibility: DocumentVisibilityState = 'visible'

describe('hooks/use-table-view', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    visibility = 'visible'
    jest
      .spyOn(document, 'visibilityState', 'get')
      .mockImplementation(() => visibility)
    jest.mocked(useRouter).mockReturnValue({ refresh } as any)
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('asks for news with the version and liveness it has, and takes a newer view', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, newer))
    const { result } = renderHook(() => useTableView('char-1', initial))

    expect(result.current).toEqual({ view: initial, connection: 'live' })
    await advance(POLL_INTERVAL)

    expect(fetch).toHaveBeenCalledWith(
      '/api/characters/char-1/table?version=3&live=1',
      {
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      },
    )
    expect(result.current.view).toBe(newer)

    jest.mocked(fetch).mockResolvedValueOnce(respond(204))
    await advance(POLL_INTERVAL)

    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=4&live=0',
      expect.anything(),
    )
    expect(result.current.view).toBe(newer)
  })

  it('keeps the sheet it has when the server leaves out an unchanged one', async () => {
    const sheet = { ac: 18 } as TableView['sheet']
    const start = {
      ...initial,
      sheet,
      sheetVersion: '2026-10-05T12:00:00.000Z',
    }
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        respond(200, { ...newer, sheetVersion: start.sheetVersion }),
      )
    const { result } = renderHook(() => useTableView('char-1', start))

    await advance(POLL_INTERVAL)

    expect(fetch).toHaveBeenCalledWith(
      '/api/characters/char-1/table?version=3&live=1&sheet=2026-10-05T12%3A00%3A00.000Z',
      expect.anything(),
    )
    expect(result.current.view).toEqual({
      ...newer,
      sheet,
      sheetVersion: start.sheetVersion,
    })

    // A changed sheet replaces it; no sheet at all clears it.
    const changed = { ac: 20 } as TableView['sheet']
    jest.mocked(fetch).mockResolvedValueOnce(
      respond(200, {
        ...newer,
        version: 5,
        sheet: changed,
        sheetVersion: 'v2',
      }),
    )
    await advance(POLL_INTERVAL)
    expect(result.current.view.sheet).toBe(changed)

    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(200, { ...newer, version: 6 }))
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=5&live=0&sheet=v2',
      expect.anything(),
    )
    expect(result.current.view.sheet).toBeUndefined()
  })

  it('backs off while the server is unreachable, then recovers', async () => {
    jest
      .mocked(fetch)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(204))
    const { result } = renderHook(() => useTableView('char-1', initial))

    await advance(POLL_INTERVAL)
    expect(result.current.connection).toBe('reconnecting')

    await advance(POLL_INTERVAL * 2 - 1)
    expect(fetch).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result.current.connection).toBe('reconnecting')

    await advance(POLL_INTERVAL * 4)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(result.current.connection).toBe('live')
  })

  it.each([401, 404])('stops and lets the page explain a %s', async status => {
    jest.mocked(fetch).mockResolvedValue(respond(status))
    renderHook(() => useTableView('char-1', initial))

    await advance(POLL_INTERVAL)
    await advance(POLL_INTERVAL * 10)

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rests in the background and catches up on return', async () => {
    jest.mocked(fetch).mockResolvedValue(respond(204))
    renderHook(() => useTableView('char-1', initial))

    visibility = 'hidden'
    await advance(POLL_INTERVAL * 3)
    expect(fetch).not.toHaveBeenCalled()

    visibility = 'visible'
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('stops when the page goes away', async () => {
    let request: RequestInit | undefined
    jest.mocked(fetch).mockImplementation((_, init) => {
      request = init
      return new Promise(() => {})
    })
    const { unmount } = renderHook(() => useTableView('char-1', initial))

    await advance(POLL_INTERVAL)
    unmount()

    expect(request?.signal?.aborted).toBe(true)
  })

  it('ignores a request aborted on the way out', async () => {
    jest.mocked(fetch).mockImplementation(
      (_, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const { result, unmount } = renderHook(() =>
      useTableView('char-1', initial),
    )

    await advance(POLL_INTERVAL)
    unmount()
    await advance(0)

    expect(result.current.connection).toBe('live')
  })
})
