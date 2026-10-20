import { act, renderHook } from '@testing-library/react'
import { useTransfers } from './use-transfers'
import { CHECK_EVERY } from '@/hooks/use-table-rolls'
import type { LocalMove } from '@/hooks/use-sheet-roller'

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

const rope: LocalMove = {
  verb: 'take',
  things: '1 Rope',
  other: 'The Iron Company',
  item: 'rope',
}
const takeRope = {
  from: 'company',
  to: 'thorin',
  items: [{ id: 'rope', quantity: 1 }],
}
const takeGold = { from: 'company', to: 'thorin', currency: { gp: 5 } }
const sent = () =>
  JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)) as Record<
    string,
    unknown
  >

describe('hooks/use-transfers', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('sends a move through the API given, follows it, and keeps the latest until dismissed', async () => {
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-1' }))
    const { result } = renderHook(() => useTransfers({ role: 'player' }))

    act(() => result.current.take('/api/characters/char-1', rope, takeRope))
    expect(fetch).toHaveBeenCalledWith(
      '/api/characters/char-1/rolls',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(sent()).toEqual({
      kind: 'transfer',
      transfer: takeRope,
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    })
    expect(result.current.latest).toEqual({
      move: rope,
      state: { status: 'sending' },
    })
    expect([...result.current.pending]).toEqual(['rope'])

    act(() => result.current.take('/api/characters/char-1', rope, takeGold))
    expect([...result.current.pending].toSorted()).toEqual(['coins', 'rope'])

    jest
      .mocked(fetch)
      .mockResolvedValue(
        respond(200, { id: 'req-1', status: 'done', rolls: [] }),
      )
    await advance(CHECK_EVERY)
    expect(result.current.latest?.state.status).toBe('done')
    expect(result.current.pending.size).toBe(0)
    act(() => result.current.dismiss())
    expect(result.current.latest).toBeUndefined()
  })

  it("names the Gamemaster's moves, for the character's player to be shown them by", () => {
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-1' }))
    const { result } = renderHook(() => useTransfers({ role: 'gm' }))

    act(() =>
      result.current.take('/api/campaigns/c1/characters/vex', rope, takeRope),
    )
    expect(sent()).toMatchObject({ label: 'Take 1 Rope from The Iron Company' })
  })

  it('says why a move was refused, and stops waiting on it', async () => {
    jest.mocked(fetch).mockResolvedValue(respond(409, { reason: 'moving' }))
    const { result } = renderHook(() => useTransfers({ role: 'player' }))

    act(() => result.current.take('/api/characters/char-1', rope, takeRope))
    await advance(0)
    expect(result.current.latest?.state).toEqual({
      status: 'refused',
      reason: 'moving',
    })
    expect(result.current.pending.size).toBe(0)
  })

  it('gives up following once the page goes', async () => {
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-1' }))
    const { result, unmount } = renderHook(() =>
      useTransfers({ role: 'player' }),
    )
    act(() => result.current.take('/api/characters/char-1', rope, takeRope))
    await advance(0)
    const signal = jest.mocked(fetch).mock.lastCall?.[1]?.signal
    unmount()
    expect(signal?.aborted).toBe(true)
    await advance(CHECK_EVERY * 3)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
