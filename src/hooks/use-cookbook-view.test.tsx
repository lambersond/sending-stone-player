/* eslint-disable unicorn/no-null -- the view uses null for an absent value */
import { act, renderHook } from '@testing-library/react'
import { forgetCookbook, useCookbookView } from './use-cookbook-view'
import { COOKBOOK_POLL_EVERY } from '@/constants/cookbook'
import type { CookbookView } from '@/types/cookbook'

const URL_OF = '/api/characters/char-1/cookbook'

/** A card as the route answers it: dishes on, linked, none sent yet. */
const cardView = (fields: Partial<CookbookView> = {}): CookbookView => ({
  version: '9f2c41d0aa1e',
  enabled: true,
  live: true,
  link: {
    hint: 'U2d4',
    createdAt: '2026-10-24T18:00:00.000Z',
    lastUsedAt: null,
  },
  dishes: [],
  ...fields,
})

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

/** The addresses read, in order. */
const reads = () => jest.mocked(fetch).mock.calls.map(([url]) => String(url))

let visibility: DocumentVisibilityState = 'visible'

describe('hooks/use-cookbook-view', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    visibility = 'visible'
    jest
      .spyOn(document, 'visibilityState', 'get')
      .mockImplementation(() => visibility)
    globalThis.fetch = jest.fn().mockResolvedValue(respond(204))
  })

  afterEach(() => {
    act(() => forgetCookbook())
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('reads the card at once, then every COOKBOOK_POLL_EVERY from the version it has, a 204 keeping the view', async () => {
    const view = cardView()
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, view))
    const { result } = renderHook(() =>
      useCookbookView('char-1', { active: true }),
    )
    expect(result.current.view).toBeUndefined()
    await advance(0)
    expect(fetch).toHaveBeenCalledWith(URL_OF, {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
    expect(result.current.view).toEqual(view)

    await advance(COOKBOOK_POLL_EVERY - 1)
    expect(fetch).toHaveBeenCalledTimes(1)
    await advance(1)
    expect(reads()).toEqual([URL_OF, `${URL_OF}?version=9f2c41d0aa1e`])
    expect(result.current.view).toBe(view)

    // A change is a new view, and the next read is from its version.
    const later = cardView({ version: '0000000000aa', enabled: false })
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, later))
    await advance(COOKBOOK_POLL_EVERY)
    expect(result.current.view).toEqual(later)
    await advance(COOKBOOK_POLL_EVERY)
    expect(reads().at(-1)).toBe(`${URL_OF}?version=0000000000aa`)
  })

  it('reads nothing while the page is hidden, and at once when it shows again', async () => {
    visibility = 'hidden'
    renderHook(() => useCookbookView('char-1', { active: true }))
    await advance(COOKBOOK_POLL_EVERY * 3)
    expect(fetch).not.toHaveBeenCalled()

    visibility = 'visible'
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await advance(0)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reads nothing while not active, and at once once it is', async () => {
    const { rerender } = renderHook(
      ({ active }) => useCookbookView('char-1', { active }),
      { initialProps: { active: false } },
    )
    await advance(COOKBOOK_POLL_EVERY * 3)
    expect(fetch).not.toHaveBeenCalled()

    rerender({ active: true })
    await advance(0)
    expect(fetch).toHaveBeenCalledTimes(1)

    // Out of view again, it stops.
    rerender({ active: false })
    await advance(COOKBOOK_POLL_EVERY * 3)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('doubles the wait after each failure, up to two minutes, and an answer resets it', async () => {
    jest.mocked(fetch).mockResolvedValue(respond(500))
    renderHook(() => useCookbookView('char-1', { active: true }))
    await advance(0)
    expect(fetch).toHaveBeenCalledTimes(1)

    // 30 s, 60 s, then 120 s, and no longer.
    for (const [wait, count] of [
      [30_000, 2],
      [60_000, 3],
      [120_000, 4],
      [120_000, 5],
    ] as const) {
      await advance(wait - 1)
      expect(fetch).toHaveBeenCalledTimes(count - 1)
      await advance(1)
      expect(fetch).toHaveBeenCalledTimes(count)
    }

    // A network failure counts too.
    jest.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'))
    await advance(120_000)
    expect(fetch).toHaveBeenCalledTimes(6)

    jest.mocked(fetch).mockResolvedValue(respond(204))
    await advance(120_000)
    expect(fetch).toHaveBeenCalledTimes(7)
    await advance(COOKBOOK_POLL_EVERY)
    expect(fetch).toHaveBeenCalledTimes(8)
  })

  it('keeps what it showed through a failure', async () => {
    const view = cardView()
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(200, view))
      .mockResolvedValueOnce(respond(500))
    const { result } = renderHook(() =>
      useCookbookView('char-1', { active: true }),
    )
    await advance(0)
    await advance(COOKBOOK_POLL_EVERY)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result.current.view).toBe(view)
  })

  it('reads at once on reload(), and polls a full wait after it', async () => {
    const { result } = renderHook(() =>
      useCookbookView('char-1', { active: true }),
    )
    await advance(0)
    await advance(COOKBOOK_POLL_EVERY - 5000)
    expect(fetch).toHaveBeenCalledTimes(1)

    const revoked = cardView({ link: null })
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, revoked))
    await act(() => result.current.reload())
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result.current.view).toEqual(revoked)

    await advance(COOKBOOK_POLL_EVERY - 1)
    expect(fetch).toHaveBeenCalledTimes(2)
    await advance(1)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('reads again after a read under way, when reload() is asked for during it', async () => {
    const held = Promise.withResolvers<Response>()
    jest.mocked(fetch).mockImplementationOnce(() => held.promise)
    const { result } = renderHook(() =>
      useCookbookView('char-1', { active: true }),
    )
    await advance(0)
    expect(fetch).toHaveBeenCalledTimes(1)

    const revoked = cardView({ link: null })
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, revoked))
    let reloaded = false
    act(() => {
      void result.current.reload().then(() => {
        reloaded = true
      })
    })
    await advance(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(reloaded).toBe(false)

    // The read that started before the revoke answers as it was then; the one after says so.
    await act(async () => held.resolve(respond(200, cardView())))
    await advance(0)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(reloaded).toBe(true)
    expect(result.current.view).toEqual(revoked)
  })

  it('reads once on reload() out of view, polling nothing after it', async () => {
    const { result } = renderHook(() =>
      useCookbookView('char-1', { active: false }),
    )
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, cardView()))
    await act(() => result.current.reload())
    expect(reads()).toEqual([URL_OF])
    expect(result.current.view).toEqual(cardView())
    await advance(COOKBOOK_POLL_EVERY * 3)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the code just made across an unmount and a mount, until it’s set to none', async () => {
    const first = renderHook(() => useCookbookView('char-1', { active: true }))
    await advance(0)
    act(() => first.result.current.setFresh('sscb_madeJustNow'))
    expect(first.result.current.fresh).toBe('sscb_madeJustNow')
    first.unmount()

    // As when the Biography tab is chosen again.
    const again = renderHook(() => useCookbookView('char-1', { active: true }))
    expect(again.result.current.fresh).toBe('sscb_madeJustNow')
    // Another character's card holds none of it.
    const other = renderHook(() => useCookbookView('char-2', { active: true }))
    expect(other.result.current.fresh).toBeUndefined()

    act(() => again.result.current.setFresh(undefined))
    expect(again.result.current.fresh).toBeUndefined()
    again.unmount()
    const later = renderHook(() => useCookbookView('char-1', { active: true }))
    expect(later.result.current.fresh).toBeUndefined()
  })

  it('passes over the card’s own read for a code just made, keeping the code through a failure and a read of its link, forgetting it for another code’s', async () => {
    const code = 'sscb_madeJustNowU2d4'
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(200, cardView({ link: null })))
    const { result } = renderHook(() =>
      useCookbookView('char-1', { active: true }),
    )
    await advance(0)

    // Its card's own read, here unchanged and so still without a link, is passed over.
    act(() => result.current.setFresh(code))
    await act(() => result.current.reload())
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result.current.fresh).toBe(code)

    jest.mocked(fetch).mockResolvedValueOnce(respond(500))
    await advance(COOKBOOK_POLL_EVERY)
    expect(result.current.fresh).toBe(code)

    jest.mocked(fetch).mockResolvedValueOnce(respond(200, cardView()))
    await advance(COOKBOOK_POLL_EVERY * 2)
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(result.current.view?.link?.hint).toBe('U2d4')
    expect(result.current.fresh).toBe(code)

    // Made again on the player's other device.
    const elsewhere = cardView({
      version: '0b7e5512c3d4',
      link: {
        hint: 'WXYZ',
        createdAt: '2026-10-24T19:00:00.000Z',
        lastUsedAt: null,
      },
    })
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, elsewhere))
    await advance(COOKBOOK_POLL_EVERY)
    expect(result.current.view).toBe(elsewhere)
    expect(result.current.fresh).toBeUndefined()
  })

  it('forgets the code just made once a later read finds no link, unchanged (204) from the view it holds', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(200, cardView({ link: null })))
    const { result } = renderHook(() =>
      useCookbookView('char-1', { active: true }),
    )
    await advance(0)
    act(() => result.current.setFresh('sscb_madeJustNowU2d4'))
    await act(() => result.current.reload())
    expect(result.current.fresh).toBe('sscb_madeJustNowU2d4')

    await advance(COOKBOOK_POLL_EVERY)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(result.current.fresh).toBeUndefined()
  })

  it('starts a card mounted again from the view it last read, and reads it at once from its version', async () => {
    const view = cardView()
    jest.mocked(fetch).mockResolvedValueOnce(respond(200, view))
    const first = renderHook(() => useCookbookView('char-1', { active: true }))
    await advance(0)
    first.unmount()

    const again = renderHook(() => useCookbookView('char-1', { active: true }))
    expect(again.result.current.view).toBe(view)
    await advance(0)
    expect(reads()).toEqual([URL_OF, `${URL_OF}?version=9f2c41d0aa1e`])
  })

  it('reads nothing more once unmounted, and keeps nothing it read after', async () => {
    const held = Promise.withResolvers<Response>()
    jest.mocked(fetch).mockImplementationOnce(() => held.promise)
    const { unmount } = renderHook(() =>
      useCookbookView('char-1', { active: true }),
    )
    await advance(0)
    unmount()
    await act(async () => held.resolve(respond(200, cardView())))
    await advance(COOKBOOK_POLL_EVERY * 3)
    expect(fetch).toHaveBeenCalledTimes(1)
    const again = renderHook(() => useCookbookView('char-1', { active: false }))
    expect(again.result.current.view).toBeUndefined()
  })
})
