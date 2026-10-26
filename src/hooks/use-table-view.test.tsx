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
    const { result } = renderHook(() =>
      useTableView('/api/characters/char-1', initial),
    )

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

  it('asks for news with the rolls the game takes from the player, as it has them', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(200, { ...newer, rollsToTable: [] }))
    renderHook(() =>
      useTableView('/api/characters/char-1', {
        ...initial,
        rollsToTable: ['skill', 'save'],
      }),
    )

    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1&rolls=skill%2Csave',
      expect.anything(),
    )

    jest.mocked(fetch).mockResolvedValueOnce(respond(204))
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=4&live=0',
      expect.anything(),
    )
  })

  it("asks for news at the Gamemaster's seat with where their rolls go, as it has it (#156)", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        respond(200, { ...newer, gm: { rolls: 'update' } }),
      )
    renderHook(() =>
      useTableView('/api/campaigns/c1/characters/balin', {
        ...initial,
        rollsToTable: ['skill'],
        gm: { rolls: 'made' },
      }),
    )

    // Without it the server, which compares it too, never says nothing is new.
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/campaigns/c1/characters/balin/table?version=3&live=1&rolls=skill&gm=made',
      expect.anything(),
    )

    jest.mocked(fetch).mockResolvedValueOnce(respond(204))
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/campaigns/c1/characters/balin/table?version=4&live=0&gm=update',
      expect.anything(),
    )
  })

  it("asks for news with where the Gamemaster's rolls as the player's character stand, as it has it (#156)", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(200, { ...newer, gmRollsKey: 'key-2' }))
    renderHook(() =>
      useTableView('/api/characters/char-1', {
        ...initial,
        gmRollsKey: 'key-1',
      }),
    )

    // Without it the server, which compares it too, never says nothing is new.
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1&gmrolls=key-1',
      expect.anything(),
    )
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=4&live=0&gmrolls=key-2',
      expect.anything(),
    )
  })

  it('asks for news saying whether the seat may move items and coins, as it has it, from module 0.31.0', async () => {
    const moves = { parties: [], characters: [{ id: 'vex', name: 'Vex' }] }
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, { ...newer, moves }))
    renderHook(() => useTableView('/api/characters/char-1', initial))

    // Without it the server, which compares it too, never says nothing is new once moves are on.
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1',
      expect.anything(),
    )
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, newer))
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=4&live=0&moves=1',
      expect.anything(),
    )
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=4&live=0',
      expect.anything(),
    )
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
    const { result } = renderHook(() =>
      useTableView('/api/characters/char-1', start),
    )

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
    const { result } = renderHook(() =>
      useTableView('/api/characters/char-1', initial),
    )

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
    renderHook(() => useTableView('/api/characters/char-1', initial))

    await advance(POLL_INTERVAL)
    await advance(POLL_INTERVAL * 10)

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rests in the background and catches up on return', async () => {
    jest.mocked(fetch).mockResolvedValue(respond(204))
    renderHook(() => useTableView('/api/characters/char-1', initial))

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
    const { unmount } = renderHook(() =>
      useTableView('/api/characters/char-1', initial),
    )

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
      useTableView('/api/characters/char-1', initial),
    )

    await advance(POLL_INTERVAL)
    unmount()
    await advance(0)

    expect(result.current.connection).toBe('live')
  })
})

describe('hooks/use-table-view, typing in their own dice, from module 0.32.0', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    jest.mocked(useRouter).mockReturnValue({ refresh } as any)
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("says the player's choice is on where the view it has says so, and only then", async () => {
    const typing: TableView = {
      ...initial,
      manualDice: { offered: true, on: true },
    }
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        respond(200, { ...typing, manualDice: { offered: true, on: false } }),
      )
      .mockResolvedValueOnce(respond(204))
    renderHook(() => useTableView('/api/characters/char-1', typing))

    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1&typed=1',
      expect.anything(),
    )
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1',
      expect.anything(),
    )
  })
})

describe('hooks/use-table-view, removing items, from module 0.33.0', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    jest.mocked(useRouter).mockReturnValue({ refresh } as any)
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('asks for news saying whether the seat may remove items, as it has it', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(200, { ...initial, removes: true }))
      .mockResolvedValueOnce(respond(200, initial))
      .mockResolvedValueOnce(respond(204))
    renderHook(() => useTableView('/api/characters/char-1', initial))

    // Without it the server, which compares it too, never says nothing is new once removals are.
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1',
      expect.anything(),
    )
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1&removes=1',
      expect.anything(),
    )
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1',
      expect.anything(),
    )
  })
})

describe('hooks/use-table-view, favorites, from module 0.37.0', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    jest.mocked(useRouter).mockReturnValue({ refresh } as any)
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('asks for news saying whether the player may change the favorites, as it has it', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(200, { ...initial, favorites: true }))
      .mockResolvedValueOnce(respond(200, initial))
      .mockResolvedValueOnce(respond(204))
    renderHook(() => useTableView('/api/characters/char-1', initial))

    // Without it, a page answered 204 would go on offering favorites once its game stopped
    // fetching.
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1',
      expect.anything(),
    )
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1&favorites=1',
      expect.anything(),
    )
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1',
      expect.anything(),
    )
  })

  it('asks with removes before favorites, where the seat may do both', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        respond(200, { ...initial, removes: true, favorites: true }),
      )
      .mockResolvedValueOnce(respond(204))
    renderHook(() => useTableView('/api/characters/char-1', initial))

    await advance(POLL_INTERVAL)
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1&removes=1&favorites=1',
      expect.anything(),
    )
  })
})

describe("hooks/use-table-view, a player's own effects, from module 0.39.0", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    jest.mocked(useRouter).mockReturnValue({ refresh } as any)
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('asks for news saying whether the player may change the effects, as it has it', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(200, { ...initial, effects: true }))
      .mockResolvedValueOnce(respond(200, initial))
      .mockResolvedValueOnce(respond(204))
    renderHook(() => useTableView('/api/characters/char-1', initial))

    // Without it, a page answered 204 would go on offering the controls once its game stopped
    // fetching, or its campaign's switch went off.
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1',
      expect.anything(),
    )
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1&effects=1',
      expect.anything(),
    )
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1',
      expect.anything(),
    )
  })

  it('asks with favorites before effects, where the player may change both', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        respond(200, { ...initial, favorites: true, effects: true }),
      )
      .mockResolvedValueOnce(respond(204))
    renderHook(() => useTableView('/api/characters/char-1', initial))

    await advance(POLL_INTERVAL)
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/table?version=3&live=1&favorites=1&effects=1',
      expect.anything(),
    )
  })
})
