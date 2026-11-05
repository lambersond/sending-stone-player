import { act, renderHook } from '@testing-library/react'
import { useCompanionView } from './use-companion-view'
import { POLL_INTERVAL } from '@/constants/polling'
import { mockCompanionSheet, mockCompanionView } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import { advance, respond } from '@/utils/test-utils'

const API = '/api/characters/char-1/companions/wolfBrakka'

let visibility: DocumentVisibilityState = 'visible'

describe('hooks/use-companion-view', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    visibility = 'visible'
    jest
      .spyOn(document, 'visibilityState', 'get')
      .mockImplementation(() => visibility)
    globalThis.fetch = jest.fn().mockResolvedValue(respond(204))
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('asks with everything the server compares, as the last answer has it', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      respond(
        200,
        mockCompanionView({
          gm: { rolls: 'update' },
          gmRollsKey: 'r1:done',
          manualDice: { offered: true, on: true },
          sheetVersion: '2026-10-25T09:00:00.000Z',
        }),
      ),
    )
    renderHook(() => useCompanionView(API, { active: true }))
    await advance(0)
    expect(fetch).toHaveBeenCalledWith(`${API}/table`, {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })

    await advance(POLL_INTERVAL)

    const url = new URL(
      jest.mocked(fetch).mock.lastCall?.[0] as string,
      'https://app.test',
    )
    expect(url.pathname).toBe(`${API}/table`)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      version: '7',
      live: '1',
      rolls: 'attack,damage,use,itemDamage,recharge;modifiers',
      gm: 'update',
      gmrolls: 'r1:done',
      typed: '1',
      sheet: '2026-10-25T09:00:00.000Z',
    })
  })

  it('leaves out what the view has none of', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      respond(
        200,
        mockCompanionView({
          live: false,
          rollsToTable: [],
          rollFeatures: [],
        }),
      ),
    )
    renderHook(() => useCompanionView(API, { active: true }))
    await advance(POLL_INTERVAL)

    expect(fetch).toHaveBeenLastCalledWith(
      `${API}/table?version=7&live=0`,
      expect.anything(),
    )
  })

  it('asks once as it mounts though not shown, and never again while not shown', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, mockCompanionView()))
    const { result } = renderHook(() =>
      useCompanionView(API, { active: false }),
    )
    await advance(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.current.view?.version).toBe(7)

    await advance(POLL_INTERVAL * 4)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('asks at once when shown again, then every few seconds while shown', async () => {
    const { rerender } = renderHook(
      ({ active }) => useCompanionView(API, { active }),
      { initialProps: { active: false } },
    )
    await advance(0)
    expect(fetch).toHaveBeenCalledTimes(1)

    rerender({ active: true })
    await advance(0)
    expect(fetch).toHaveBeenCalledTimes(2)

    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenCalledTimes(3)
    await advance(POLL_INTERVAL)
    expect(fetch).toHaveBeenCalledTimes(4)

    rerender({ active: false })
    await advance(POLL_INTERVAL * 3)
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('asks nothing while the page is in the background, and at once when it comes back', async () => {
    renderHook(() => useCompanionView(API, { active: true }))
    await advance(0)
    expect(fetch).toHaveBeenCalledTimes(1)

    visibility = 'hidden'
    await advance(POLL_INTERVAL * 2)
    expect(fetch).toHaveBeenCalledTimes(1)

    visibility = 'visible'
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('keeps the sheet it has when the server leaves an unchanged one out', async () => {
    const sheet = toTableSheet(mockCompanionSheet(), 'https://my-game.test')
    const sheetVersion = '2026-10-25T09:00:00.000Z'
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        respond(200, mockCompanionView({ sheet, sheetVersion })),
      )
      .mockResolvedValueOnce(
        respond(200, mockCompanionView({ version: 8, sheetVersion })),
      )
    const { result } = renderHook(() => useCompanionView(API, { active: true }))
    await advance(0)
    expect(result.current.view?.sheet).toEqual(sheet)

    await advance(POLL_INTERVAL)

    expect(result.current.view?.version).toBe(8)
    expect(result.current.view?.sheet).toEqual(sheet)
  })

  it('is gone once the server answers 404, its last view kept with nothing to roll, and asks no more', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(200, mockCompanionView()))
      .mockResolvedValueOnce(respond(404))
    const { result } = renderHook(() => useCompanionView(API, { active: true }))
    await advance(0)
    expect(result.current.gone).toBe(false)

    await advance(POLL_INTERVAL)

    expect(result.current.gone).toBe(true)
    expect(result.current.view).toMatchObject({
      version: 7,
      companion: { key: 'wolfBrakka' },
      connected: false,
    })
    expect(result.current.view?.rollsToTable).toBeUndefined()

    await advance(POLL_INTERVAL * 3)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('asks no more once signed out', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(401))
    const { result } = renderHook(() => useCompanionView(API, { active: true }))
    await advance(POLL_INTERVAL * 3)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual({ gone: false, connection: 'live' })
  })

  it('backs off while the server cannot be reached, saying it is reconnecting, then recovers', async () => {
    jest
      .mocked(fetch)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(200, mockCompanionView()))
    const { result } = renderHook(() => useCompanionView(API, { active: true }))
    await advance(0)
    expect(result.current.connection).toBe('reconnecting')
    expect(result.current.view).toBeUndefined()

    await advance(POLL_INTERVAL * 2 - 1)
    expect(fetch).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result.current.connection).toBe('reconnecting')

    await advance(POLL_INTERVAL * 4)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(result.current.connection).toBe('live')
    expect(result.current.view?.version).toBe(7)
  })

  it.each([404, 401])(
    'is live again, asking no more, when a failed read is followed by a %i',
    async status => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(500))
        .mockResolvedValueOnce(respond(status))
      const { result } = renderHook(() =>
        useCompanionView(API, { active: true }),
      )
      await advance(0)
      expect(result.current.connection).toBe('reconnecting')

      await advance(POLL_INTERVAL * 20)

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(result.current.connection).toBe('live')
      expect(result.current.gone).toBe(status === 404)
    },
  )
})
