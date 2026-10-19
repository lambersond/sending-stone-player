import { act, renderHook } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { usePartySheet } from './use-party-sheet'
import { POLL_INTERVAL } from './use-table-view'
import type { PartyView } from '@/types/party'

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))

const refresh = jest.fn()

const API = '/api/characters/char-1/party/company'

const sheet: NonNullable<PartyView['sheet']> = {
  members: [{ id: 'thorin', name: 'Thorin Oakenshield', own: true }],
  inventory: {
    sections: [],
    containers: [],
    currency: [],
    // eslint-disable-next-line unicorn/no-null -- the sheet uses null for none
    encumbrance: null,
    // eslint-disable-next-line unicorn/no-null -- the sheet uses null for none
    attunement: null,
  },
  // eslint-disable-next-line unicorn/no-null -- the sheet uses null for none
  description: null,
}
const initial: PartyView = {
  version: 3,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  group: { id: 'company', name: 'The Company', primary: true },
  sheet,
  sheetVersion: '2026-10-19T12:00:00.000Z',
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

describe('hooks/use-party-sheet', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    visibility = 'visible'
    jest
      .spyOn(document, 'visibilityState', 'get')
      .mockImplementation(() => visibility)
    globalThis.fetch = jest.fn()
    jest.mocked(useRouter).mockReturnValue({ refresh } as any)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('asks for news with the version, liveness and sheet it has, keeping its view on 204', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(204))
    const { result } = renderHook(() => usePartySheet(API, initial))

    expect(result.current).toEqual({
      view: initial,
      state: 'ready',
      connection: 'live',
    })
    await advance(POLL_INTERVAL)

    expect(fetch).toHaveBeenCalledWith(
      `${API}?version=3&live=1&sheet=2026-10-19T12%3A00%3A00.000Z`,
      { cache: 'no-store', signal: expect.any(AbortSignal) },
    )
    expect(result.current.view).toBe(initial)
  })

  it('takes a newer view, keeping the sheet it has where it was left out as unchanged', async () => {
    const newer = { ...initial, version: 4, live: false, sheet: undefined }
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, newer))
    const { result } = renderHook(() => usePartySheet(API, initial))

    await advance(POLL_INTERVAL)

    expect(result.current.view).toEqual({ ...newer, sheet })
    jest.mocked(fetch).mockResolvedValueOnce(respond(204))
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      `${API}?version=4&live=0&sheet=2026-10-19T12%3A00%3A00.000Z`,
      expect.anything(),
    )
  })

  it('takes a new sheet, and none where the sheet has gone', async () => {
    const changed = {
      ...initial,
      version: 4,
      sheet: { ...sheet, description: 'b4c5d6e7f8091a' },
      sheetVersion: '2026-10-19T12:05:00.000Z',
    }
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, changed))
    const { result } = renderHook(() => usePartySheet(API, initial))

    await advance(POLL_INTERVAL)
    expect(result.current.view).toEqual(changed)

    const withheld = {
      ...initial,
      version: 5,
      sheet: undefined,
      sheetVersion: undefined,
      withheld: { reason: 'tooLarge' as const },
    }
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, withheld))
    await advance(POLL_INTERVAL)
    expect(result.current.view).toEqual(withheld)
    expect(result.current.view).not.toHaveProperty('sheet', sheet)
  })

  it('without a view, fetches one at once, loading until then', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, initial))
    const { result } = renderHook(() => usePartySheet(API))

    expect(result.current).toEqual({
      view: undefined,
      state: 'loading',
      connection: 'live',
    })
    await advance(0)

    expect(fetch).toHaveBeenCalledWith(API, expect.anything())
    expect(result.current).toEqual({
      view: initial,
      state: 'ready',
      connection: 'live',
    })
  })

  it('is gone on 404, and asks no more', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(404))
    const { result } = renderHook(() => usePartySheet(API, initial))

    await advance(POLL_INTERVAL)
    expect(result.current.state).toBe('gone')
    await advance(POLL_INTERVAL * 5)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('once signed out, renders the page again, which sends the viewer to sign in, and asks no more', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(401))
    const { result } = renderHook(() => usePartySheet(API, initial))

    await advance(POLL_INTERVAL)
    expect(refresh).toHaveBeenCalledTimes(1)
    // Nothing was taken away in Foundry: the sheet stays as it was until the page is rendered
    // again.
    expect(result.current).toEqual({
      view: initial,
      state: 'ready',
      connection: 'live',
    })
    await advance(POLL_INTERVAL * 5)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('says it is reconnecting while the server cannot be reached, waiting longer each time', async () => {
    jest
      .mocked(fetch)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(respond(500))
      .mockResolvedValueOnce(respond(204))
    const { result } = renderHook(() => usePartySheet(API, initial))

    await advance(POLL_INTERVAL)
    expect(result.current.connection).toBe('reconnecting')
    expect(result.current.view).toBe(initial)
    await advance(POLL_INTERVAL * 2)
    expect(fetch).toHaveBeenCalledTimes(2)
    await advance(POLL_INTERVAL * 4)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(result.current.connection).toBe('live')
  })

  it('waits while the page is in the background, and catches up once it is back', async () => {
    visibility = 'hidden'
    jest.mocked(fetch).mockResolvedValue(respond(204))
    renderHook(() => usePartySheet(API, initial))

    await advance(POLL_INTERVAL * 3)
    expect(fetch).not.toHaveBeenCalled()

    visibility = 'visible'
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('stops asking once it is gone from the page', async () => {
    const { unmount } = renderHook(() => usePartySheet(API, initial))

    unmount()
    await advance(POLL_INTERVAL * 3)
    expect(fetch).not.toHaveBeenCalled()
  })
})
