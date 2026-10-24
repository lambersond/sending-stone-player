import { act, renderHook } from '@testing-library/react'
import { useEndTurn } from './use-end-turn'
import { CHECK_EVERY, GM_SEND_KEY, SEND_KEY } from './use-table-rolls'
import { POLL_INTERVAL } from './use-table-view'
import { mockTurnCombat } from '@/mocks/sending-stone'
import { END_TURN_ARMS_AFTER } from '@/utils/end-turn'
import type { RollKind } from '@/types/roll'
import type { EndableTurn, TableCombat } from '@/types/table'

const API = '/api/characters/char-1'
const KINDS: RollKind[] = ['skill', 'endConcentration', 'endTurn']

const thorins: EndableTurn = {
  combatId: 'cmbt1',
  round: 1,
  combatantId: 'c-thorin',
}
const brakkas: EndableTurn = {
  combatId: 'cmbt1',
  round: 1,
  combatantId: 'c-brakka',
  companion: { key: 'wolfBrakka', name: 'Brakka' },
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

/** A tap or a hold's end, and what the app answers at once. */
const ending = (end: () => void) =>
  act(async () => {
    end()
    await Promise.resolve()
  })

type Props = {
  combat?: TableCombat | undefined
  kinds?: RollKind[]
  gm?: boolean
}

const render = (props: Props = {}) =>
  renderHook(
    ({ combat, kinds = KINDS, gm = false }: Props) =>
      useEndTurn({ api: API, gm, combat, kinds }),
    { initialProps: { combat: mockTurnCombat(), ...props } as Props },
  )

/** The End Turns sent, by their bodies, in order. */
const posted = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => ({
      url,
      body: JSON.parse(String(init?.body)) as unknown,
    }))

/** The game's answers to a sent End Turn: taken, then each way asked after, the last for good. */
const answering = (...views: object[]) => {
  jest.mocked(fetch).mockImplementation(async (_url, init) => {
    if (init?.method === 'POST') return respond(202, { id: 'req-1' })
    const view = views.length > 1 ? views.shift() : views[0]
    return respond(200, { id: 'req-1', ...view })
  })
}

/** The game's answers to each End Turn sent, by its id, in order, the last for good. */
const answeringEach = (ways: Record<string, object[]>) => {
  let made = 0
  jest.mocked(fetch).mockImplementation(async (url, init) => {
    if (init?.method === 'POST') {
      made += 1
      return respond(202, { id: `req-${made}` })
    }
    const id = String(url).split('/').pop() ?? ''
    const answers = ways[id]
    const view = answers.length > 1 ? answers.shift() : answers[0]
    return respond(200, { id, ...view })
  })
}

describe('hooks/use-end-turn', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('offers a turn once it has been shown for a moment, not before', async () => {
    const { result } = render()

    expect(result.current.turn).toEqual(thorins)
    expect(result.current.offered).toBe(false)
    await advance(END_TURN_ARMS_AFTER - 1)
    expect(result.current.offered).toBe(false)
    // Nothing is sent before it's offered.
    await ending(() => result.current.end(thorins))
    expect(fetch).not.toHaveBeenCalled()

    await advance(1)
    expect(result.current.offered).toBe(true)
    expect(result.current.way).toBeUndefined()
  })

  it('sends exactly the turn given, and nothing else, and follows it until it has ended', async () => {
    answering({ status: 'rolling' }, { status: 'done', visible: true })
    const { result } = render()
    await advance(END_TURN_ARMS_AFTER)

    await ending(() => result.current.end(thorins))
    expect(posted()).toEqual([
      {
        url: `${API}/rolls`,
        body: {
          kind: 'endTurn',
          turn: { combatId: 'cmbt1', round: 1, combatantId: 'c-thorin' },
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
      },
    ])
    expect(result.current.way).toEqual({ status: 'sending' })
    expect(result.current.offered).toBe(false)

    await advance(CHECK_EVERY)
    expect(fetch).toHaveBeenLastCalledWith(`${API}/rolls/req-1`, {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
    expect(result.current.way).toMatchObject({ status: 'rolling' })
    await advance(CHECK_EVERY)
    expect(result.current.way).toMatchObject({
      status: 'done',
      requestId: 'req-1',
    })
    expect(result.current.offered).toBe(false)
  })

  it("sends a companion's turn as the character's, its words left out", async () => {
    answering({ status: 'rolling' })
    const { result } = render({
      combat: mockTurnCombat({ currentId: 'c-brakka' }),
    })
    await advance(END_TURN_ARMS_AFTER)

    expect(result.current.turn).toEqual(brakkas)
    await ending(() => result.current.end(brakkas))
    expect(posted()).toEqual([
      {
        url: `${API}/rolls`,
        body: {
          kind: 'endTurn',
          turn: { combatId: 'cmbt1', round: 1, combatantId: 'c-brakka' },
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
      },
    ])
  })

  it('sends one for a turn, however often it’s asked: at once, on its way, or once it has ended', async () => {
    answering({ status: 'rolling' }, { status: 'done', visible: true })
    const { result } = render()
    await advance(END_TURN_ARMS_AFTER)

    // A tap and a hold together.
    await ending(() => {
      result.current.end(thorins)
      result.current.end(thorins)
    })
    expect(posted()).toHaveLength(1)
    await advance(CHECK_EVERY)
    await ending(() => result.current.end(thorins))
    expect(posted()).toHaveLength(1)
    await advance(CHECK_EVERY)
    expect(result.current.way).toMatchObject({ status: 'done' })
    await ending(() => result.current.end(thorins))
    expect(posted()).toHaveLength(1)
  })

  it('sends nothing for a turn no longer shown, though another is offered', async () => {
    const { result, rerender } = render()
    await advance(END_TURN_ARMS_AFTER)

    // The poll moved on to Brakka's, which is offered in its turn.
    rerender({ combat: mockTurnCombat({ currentId: 'c-brakka' }) })
    await advance(END_TURN_ARMS_AFTER)
    expect(result.current.offered).toBe(true)
    await ending(() => result.current.end(thorins))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('offers a new turn a moment after the poll shows it, and forgets the last one’s way', async () => {
    answering({ status: 'done', visible: true })
    const { result, rerender } = render()
    await advance(END_TURN_ARMS_AFTER)
    await ending(() => result.current.end(thorins))
    await advance(CHECK_EVERY)
    expect(result.current.way).toMatchObject({ status: 'done' })

    rerender({ combat: mockTurnCombat({ currentId: 'c-brakka' }) })
    expect(result.current.turn).toEqual(brakkas)
    expect(result.current.way).toBeUndefined()
    expect(result.current.offered).toBe(false)
    await advance(END_TURN_ARMS_AFTER - 1)
    expect(result.current.offered).toBe(false)
    await advance(1)
    expect(result.current.offered).toBe(true)
  })

  it('offers a turn ended before once it’s shown again, as after a rewind', async () => {
    answering({ status: 'done', visible: true })
    const { result, rerender } = render()
    await advance(END_TURN_ARMS_AFTER)
    await ending(() => result.current.end(thorins))
    await advance(CHECK_EVERY)

    rerender({ combat: mockTurnCombat({ currentId: 'c-brakka' }) })
    await advance(END_TURN_ARMS_AFTER)
    // The Gamemaster's Previous Turn, back to Thorin in the same round.
    rerender({ combat: mockTurnCombat() })
    expect(result.current.way).toBeUndefined()
    await advance(END_TURN_ARMS_AFTER)
    expect(result.current.offered).toBe(true)
    await ending(() => result.current.end(thorins))
    expect(posted()).toHaveLength(2)
  })

  it('offers a turn ended before once a newer view still shows it, though no poll showed the turn between', async () => {
    answering({ status: 'done', visible: true })
    const thorinsTurn = mockTurnCombat()
    const { result, rerender } = render({ combat: thorinsTurn })
    await advance(END_TURN_ARMS_AFTER)
    await ending(() => result.current.end(thorins))
    await advance(CHECK_EVERY)
    expect(result.current.way).toMatchObject({ status: 'done' })

    // Drawn again with the view it had: still ended.
    rerender({ combat: thorinsTurn })
    await advance(END_TURN_ARMS_AFTER)
    expect(result.current.offered).toBe(false)

    // The game went on to Brakka's, and the Gamemaster's Previous Turn came back to Thorin's,
    // between two polls: the next view shows his turn again.
    rerender({ combat: mockTurnCombat() })
    expect(result.current.way).toBeUndefined()
    expect(result.current.offered).toBe(false)
    await advance(END_TURN_ARMS_AFTER)
    expect(result.current.offered).toBe(true)
    await ending(() => result.current.end(thorins))
    expect(posted()).toHaveLength(2)
  })

  it('offers a turn the app refused as moved on again once a newer view still shows it', async () => {
    jest.mocked(fetch).mockResolvedValue(respond(422, { reason: 'moved' }))
    const { result, rerender } = render()
    await advance(END_TURN_ARMS_AFTER)
    await ending(() => result.current.end(thorins))
    await advance(0)
    expect(result.current.offered).toBe(false)

    // Gone on and come back between two polls.
    rerender({ combat: mockTurnCombat() })
    await advance(END_TURN_ARMS_AFTER)
    expect(result.current.offered).toBe(true)
    await ending(() => result.current.end(thorins))
    expect(posted()).toHaveLength(2)
  })

  it('offers a turn again two polls after the game said it ended, where the view shown already had it back', async () => {
    answering({ status: 'rolling' }, { status: 'done', visible: true })
    const { result, rerender } = render()
    await advance(END_TURN_ARMS_AFTER)
    await ending(() => result.current.end(thorins))
    await advance(CHECK_EVERY)
    // Ended, and brought back by the Gamemaster, before a poll that shows Thorin's turn again;
    // then the game's answer, which can't tell that view from one before it ended.
    rerender({ combat: mockTurnCombat() })
    await advance(CHECK_EVERY)
    expect(result.current.way).toMatchObject({ status: 'done' })
    expect(result.current.offered).toBe(false)

    await advance(2 * POLL_INTERVAL - 1)
    expect(result.current.way).toMatchObject({ status: 'done' })
    await advance(1)
    expect(result.current.way).toBeUndefined()
    expect(result.current.offered).toBe(false)
    await advance(END_TURN_ARMS_AFTER)
    expect(result.current.offered).toBe(true)
    await ending(() => result.current.end(thorins))
    expect(posted()).toHaveLength(2)
  })

  it.each([
    { status: 'done', visible: true },
    { status: 'failed', reason: 'moved' },
  ])(
    'keeps an End Turn’s late answer, %p, off the turn shown now, and tells it as the last sent',
    async late => {
      answering({ status: 'rolling' }, late)
      const { result, rerender } = render()
      await advance(END_TURN_ARMS_AFTER)
      await ending(() => result.current.end(thorins))
      expect(result.current.sent).toEqual({
        turn: thorins,
        way: { status: 'sending' },
      })
      await advance(CHECK_EVERY)
      expect(result.current.sent?.way).toMatchObject({ status: 'rolling' })

      // The poll shows Brakka's turn, still the seat's, before the game answers Thorin's.
      rerender({ combat: mockTurnCombat({ currentId: 'c-brakka' }) })
      expect(result.current.way).toBeUndefined()
      await advance(CHECK_EVERY)
      expect(result.current.sent?.turn).toEqual(thorins)
      expect(result.current.sent?.way).toMatchObject({
        ...late,
        requestId: 'req-1',
      })
      expect(result.current.way).toBeUndefined()
      expect(result.current.offered).toBe(true)
      await ending(() => result.current.end(brakkas))
      expect(posted()).toHaveLength(2)
      expect(result.current.sent).toEqual({
        turn: brakkas,
        way: { status: 'sending' },
      })
    },
  )

  it('tells the last End Turn sent alone, though an earlier one is answered after it', async () => {
    answeringEach({
      'req-1': [{ status: 'rolling' }, { status: 'done', visible: true }],
      'req-2': [{ status: 'rolling' }],
    })
    const { result, rerender } = render()
    await advance(END_TURN_ARMS_AFTER)
    await ending(() => result.current.end(thorins))
    await advance(CHECK_EVERY)
    rerender({ combat: mockTurnCombat({ currentId: 'c-brakka' }) })
    await advance(END_TURN_ARMS_AFTER)
    await ending(() => result.current.end(brakkas))

    // Thorin's is answered; Brakka's is the last sent, still on its way.
    await advance(CHECK_EVERY - END_TURN_ARMS_AFTER)
    expect(result.current.sent).toEqual({
      turn: brakkas,
      way: { status: 'sending' },
    })
    await advance(END_TURN_ARMS_AFTER)
    expect(result.current.sent?.turn).toEqual(brakkas)
    expect(result.current.sent?.way).toMatchObject({
      status: 'rolling',
      requestId: 'req-2',
    })
  })

  it('sends one for the turn shown from two calls at once, though an earlier turn’s End Turn is answered between them', async () => {
    answeringEach({
      'req-1': [{ status: 'rolling' }, { status: 'failed', reason: 'error' }],
      'req-2': [{ status: 'rolling' }],
    })
    const { result, rerender } = render()
    await advance(END_TURN_ARMS_AFTER)
    await ending(() => result.current.end(thorins))
    await advance(CHECK_EVERY)
    rerender({ combat: mockTurnCombat({ currentId: 'c-brakka' }) })
    await advance(END_TURN_ARMS_AFTER)

    // A tap and a hold on Brakka's turn, with Thorin's refused between them.
    await act(async () => {
      result.current.end(brakkas)
      await jest.advanceTimersByTimeAsync(CHECK_EVERY - END_TURN_ARMS_AFTER)
      result.current.end(brakkas)
    })
    expect(posted()).toHaveLength(2)
  })

  it.each(['busy', 'network', 'unavailable'])(
    'offers a turn again once refused %p',
    async reason => {
      jest
        .mocked(fetch)
        .mockResolvedValue(
          reason === 'network'
            ? Promise.reject(new Error('offline'))
            : respond(reason === 'busy' ? 429 : 409, { reason }),
        )
      const { result } = render()
      await advance(END_TURN_ARMS_AFTER)

      await ending(() => result.current.end(thorins))
      await advance(0)
      expect(result.current.way).toEqual({ status: 'refused', reason })
      expect(result.current.offered).toBe(true)
      await ending(() => result.current.end(thorins))
      expect(posted()).toHaveLength(2)
    },
  )

  it.each(['moved', 'not-turn'])(
    'offers that turn no more once the app refuses it %p',
    async reason => {
      jest.mocked(fetch).mockResolvedValue(respond(422, { reason }))
      const { result } = render()
      await advance(END_TURN_ARMS_AFTER)

      await ending(() => result.current.end(thorins))
      await advance(0)
      expect(result.current.way).toEqual({ status: 'refused', reason })
      expect(result.current.offered).toBe(false)
      await ending(() => result.current.end(thorins))
      expect(posted()).toHaveLength(1)
    },
  )

  it('offers that turn no more once the game refuses it as moved on, but again once it answers nothing', async () => {
    answering({ status: 'failed', reason: 'moved' })
    const { result, rerender } = render()
    await advance(END_TURN_ARMS_AFTER)
    await ending(() => result.current.end(thorins))
    await advance(CHECK_EVERY)
    expect(result.current.way).toMatchObject({
      status: 'failed',
      reason: 'moved',
    })
    expect(result.current.offered).toBe(false)

    // Another turn, whose End Turn the game never answers.
    answering({ status: 'lost' })
    rerender({ combat: mockTurnCombat({ round: 2 }) })
    await advance(END_TURN_ARMS_AFTER)
    await ending(() => result.current.end({ ...thorins, round: 2 }))
    await advance(CHECK_EVERY)
    expect(result.current.way).toMatchObject({ status: 'lost' })
    expect(result.current.offered).toBe(true)
  })

  it('offers no turn with Send to the table off on this device, the Gamemaster’s switch apart', async () => {
    globalThis.localStorage.setItem(SEND_KEY, 'off')
    const { result, rerender } = render()
    await advance(END_TURN_ARMS_AFTER)
    expect(result.current.turn).toBeUndefined()
    expect(result.current.offered).toBe(false)
    await ending(() => result.current.end(thorins))
    expect(fetch).not.toHaveBeenCalled()

    // The Gamemaster's page reads its own switch, which is on.
    rerender({ combat: mockTurnCombat(), gm: true })
    expect(result.current.turn).toEqual(thorins)
    globalThis.localStorage.setItem(GM_SEND_KEY, 'off')
    rerender({ combat: mockTurnCombat(), gm: true })
    expect(result.current.turn).toBeUndefined()
  })

  it("offers no turn where the game doesn't take it, nor anyone else's", async () => {
    const { result, rerender } = render({ kinds: ['skill'] })
    await advance(END_TURN_ARMS_AFTER)
    expect(result.current.turn).toBeUndefined()
    expect(result.current.offered).toBe(false)
    await ending(() => result.current.end(thorins))

    rerender({ combat: mockTurnCombat({ currentId: 'c-goblin' }) })
    await advance(END_TURN_ARMS_AFTER)
    expect(result.current.turn).toBeUndefined()
    expect(result.current.offered).toBe(false)
    rerender({ combat: undefined })
    expect(result.current.turn).toBeUndefined()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('stops following once the page goes', async () => {
    answering({ status: 'rolling' })
    const { result, unmount } = render()
    await advance(END_TURN_ARMS_AFTER)
    await ending(() => result.current.end(thorins))
    const signal = jest.mocked(fetch).mock.calls[0][1]?.signal

    unmount()
    expect(signal?.aborted).toBe(true)
    await advance(CHECK_EVERY * 3)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('arms no timer once the page goes', async () => {
    const timeouts = jest.spyOn(globalThis, 'clearTimeout')
    const { unmount } = render()
    unmount()
    expect(timeouts).toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })
})
