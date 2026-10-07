import { act, renderHook } from '@testing-library/react'
import {
  CHECK_EVERY,
  FOLLOW_FOR,
  SEND_KEY,
  toRollRequest,
  useTableRolls,
} from './use-table-rolls'
import type { LocalCheck, SheetRoll } from './use-sheet-roller'
import type { RollKind } from '@/types/roll'

const perception: SheetRoll = {
  label: 'Perception check',
  modifier: 4,
  advantage: 'adv',
  extras: [
    { sign: 1, count: 1, sides: 4 },
    { sign: -1, flat: 1 },
    { sign: 1, count: 2, sides: 6 },
  ],
  source: { kind: 'skill', key: 'prc' },
  explicit: true,
}

const check = (fields: Partial<LocalCheck> = {}): LocalCheck => ({
  kind: 'check',
  id: 'r1',
  label: 'Perception check',
  total: 28,
  modifier: 4,
  advantage: 'adv',
  d20s: [17, 3],
  natural: 17,
  extras: [
    { text: '+1d4', values: [2], value: 2 },
    { text: '−1', values: [], value: -1 },
    { text: '+2d6', values: [5, 1], value: 6 },
  ],
  at: 0,
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

const render = (kinds: RollKind[] = ['skill', 'save']) =>
  renderHook(props => useTableRolls('char-1', props.kinds), {
    initialProps: { kinds },
  })

describe('hooks/use-table-rolls', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('toRollRequest', () => {
    it('asks for the roll as it was made, with every die thrown, in order', () => {
      expect(
        toRollRequest(perception, { kind: 'skill', key: 'prc' }, check()),
      ).toEqual({
        kind: 'skill',
        key: 'prc',
        mode: 1,
        explicit: true,
        extras: perception.extras,
        dice: [
          { faces: 20, results: [17, 3] },
          { faces: 4, results: [2] },
          { faces: 6, results: [5, 1] },
        ],
      })
    })

    it('asks for initiative in its combat, and a death save, which name nothing', () => {
      const plain = { label: 'Initiative', modifier: 2 }
      const thrown = check({ advantage: 'dis', d20s: [9, 4], extras: [] })
      expect(
        toRollRequest(plain, { kind: 'initiative', combatId: 'cmbt1' }, thrown),
      ).toEqual({
        kind: 'initiative',
        combatId: 'cmbt1',
        mode: -1,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [9, 4] }],
      })
      expect(
        toRollRequest(
          plain,
          { kind: 'death' },
          check({ advantage: undefined, d20s: [11], extras: [] }),
        ),
      ).toMatchObject({ kind: 'death', mode: 0 })
    })
  })

  it('sends a roll the game takes, and follows it until the game has made it', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValueOnce(respond(200, { id: 'req-1', status: 'rolling' }))
      .mockResolvedValueOnce(
        respond(200, { id: 'req-1', status: 'done', visible: true, total: 23 }),
      )
    const { result } = render()
    expect(result.current.available).toBe(true)
    expect(result.current.sending).toBe(true)

    act(() => result.current.send(perception, check()))
    expect(result.current.states.get('r1')).toEqual({ status: 'sending' })
    expect(fetch).toHaveBeenCalledWith('/api/characters/char-1/rolls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        toRollRequest(perception, { kind: 'skill', key: 'prc' }, check()),
      ),
      signal: expect.any(AbortSignal),
    })

    await advance(CHECK_EVERY)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/rolls/req-1',
      { cache: 'no-store', signal: expect.any(AbortSignal) },
    )
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'rolling',
    })

    await advance(CHECK_EVERY)
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'done',
      visible: true,
      total: 23,
    })
    await advance(CHECK_EVERY * 5)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it.each<[string, RollKind[], SheetRoll]>([
    ['a roll the game does not take', ['save'], perception],
    ['a roll the game cannot make', ['skill'], { label: 'Axe', modifier: 5 }],
  ])("doesn't send %s", (_, kinds, roll) => {
    const { result } = render(kinds)

    act(() => result.current.send(roll, check()))

    expect(fetch).not.toHaveBeenCalled()
    expect(result.current.states.size).toBe(0)
  })

  it('takes no rolls while the game takes none', () => {
    const { result } = render([])

    expect(result.current.available).toBe(false)
    act(() => result.current.send(perception, check()))
    expect(fetch).not.toHaveBeenCalled()
  })

  it("doesn't send rolls from a device the player turned sending off on, remembering it", () => {
    const { result } = render()

    act(() => result.current.setSending(false))
    expect(result.current.sending).toBe(false)
    expect(globalThis.localStorage.getItem(SEND_KEY)).toBe('off')
    act(() => result.current.send(perception, check()))
    expect(fetch).not.toHaveBeenCalled()

    act(() => result.current.setSending(true))
    act(() => result.current.send(perception, check()))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('sends with what the game takes as it changes', () => {
    const { result, rerender } = render(['save'])

    rerender({ kinds: ['skill'] })
    act(() => result.current.send(perception, check()))

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['the app refused it', respond(422, { reason: 'not-dying' }), 'not-dying'],
    ['too many were sent', respond(429, { reason: 'busy' }), 'busy'],
    ['the app failed', respond(500), 'error'],
  ])('says why a roll was not sent when %s', async (_, response, reason) => {
    jest.mocked(fetch).mockResolvedValueOnce(response)
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(0)

    expect(result.current.states.get('r1')).toEqual({
      status: 'refused',
      reason,
    })
  })

  it('says when the app could not be reached', async () => {
    jest.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'))
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(0)

    expect(result.current.states.get('r1')).toEqual({
      status: 'refused',
      reason: 'network',
    })
  })

  it("keeps asking through a failed check, and gives up on a roll that's never answered", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue(respond(200, { id: 'req-1', status: 'rolling' }))
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(CHECK_EVERY * 2)
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'rolling',
    })

    await advance(FOLLOW_FOR)
    expect(result.current.states.get('r1')).toEqual({ status: 'lost' })
  })

  it('stops following a roll the page may no longer see', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValueOnce(respond(404))
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(CHECK_EVERY)

    expect(result.current.states.get('r1')).toEqual({ status: 'lost' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('stops following its rolls once gone', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
    const { result, unmount } = render()

    act(() => result.current.send(perception, check()))
    await advance(0)
    const { signal } = jest.mocked(fetch).mock.calls[0][1] as RequestInit
    unmount()

    expect(signal?.aborted).toBe(true)
    await advance(CHECK_EVERY * 3)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
