import { act, renderHook } from '@testing-library/react'
import {
  CHECK_EVERY,
  GM_SEND_KEY,
  SEND_KEY,
  type TableRollState,
} from './use-table-rolls'
import { useTurnUndo } from './use-turn-undo'
import { mockTurnCombat } from '@/mocks/sending-stone'
import type { RollKind } from '@/types/roll'
import type { EndableTurn, TableCombat } from '@/types/table'

const API = '/api/characters/char-1'
const KINDS: RollKind[] = ['skill', 'endTurn', 'undoEndTurn']

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

/** The fight as the page shows it, on someone's turn. */
const on = (currentId: string, fields: Partial<TableCombat> = {}) =>
  mockTurnCombat({ currentId, ...fields })
/** The fight while a combatant hidden from players acts, which the page shows as no one. */
const hiddenActing = () => {
  const combat = mockTurnCombat()
  delete combat.currentId
  return combat
}

/** The End Turn the page sent last, and how far it got. */
const sentWith = (
  way: Partial<TableRollState>,
  turn: EndableTurn = thorins,
): { turn: EndableTurn; way: TableRollState } => ({
  turn,
  way: { status: 'sending', ...way } as TableRollState,
})
/** Thorin's End Turn, made in the game. */
const done = (requestId = 'req-1', turn: EndableTurn = thorins) =>
  sentWith({ status: 'done', requestId, visible: true, rolls: [] }, turn)

/** Brakka's turn, as the page names it, with who acts now. */
const brakkaLeft = {
  combatId: 'cmbt1',
  round: 1,
  combatantId: 'c-brakka',
  name: 'Brakka',
  mine: false,
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

type Props = {
  combat?: TableCombat
  kinds?: RollKind[]
  gm?: boolean
  sent?: { turn: EndableTurn; way: TableRollState }
}

const render = (props: Props = {}) =>
  renderHook(
    ({ combat, kinds = KINDS, gm = false, sent }: Props) =>
      useTurnUndo({ api: API, gm, combat, kinds, sent }),
    { initialProps: { combat: on('c-thorin'), ...props } as Props },
  )

/** The Undos sent, by their bodies, in order. */
const posted = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => ({
      url,
      body: JSON.parse(String(init?.body)) as unknown,
    }))

/** The game's answers to a sent Undo: taken, then each way asked after, the last for good. */
const answering = (...views: object[]) => {
  jest.mocked(fetch).mockImplementation(async (_url, init) => {
    if (init?.method === 'POST') return respond(202, { id: 'undo-1' })
    const view = views.length > 1 ? views.shift() : views[0]
    return respond(200, { id: 'undo-1', ...view })
  })
}

/** A tap on Undo, and what the app answers at once. */
const undoing = (undo: () => void) =>
  act(async () => {
    undo()
    await Promise.resolve()
  })

describe('hooks/use-turn-undo', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('offers nothing before the End Turn is made, though the page shows the turn moved on', () => {
    const { result, rerender } = render({ sent: sentWith({}) })
    expect(result.current.offer).toBeUndefined()

    // The game moves the turn before it answers, so the poll may show it first.
    rerender({ combat: on('c-brakka'), sent: sentWith({ status: 'rolling' }) })
    expect(result.current.offer).toBeUndefined()
    expect(result.current.way).toBeUndefined()
  })

  it('offers nothing while the page still shows the ended turn, then the first other turn it shows', () => {
    const { result, rerender } = render({ sent: done() })
    expect(result.current.offer).toBeUndefined()

    rerender({ combat: on('c-brakka'), sent: done() })
    expect(result.current.offer).toEqual({
      requestId: 'req-1',
      turn: thorins,
      left: brakkaLeft,
    })
  })

  it('takes the turn the page shows as the answer comes, where it has moved on already', () => {
    const { result, rerender } = render({
      combat: on('c-brakka'),
      sent: sentWith({ status: 'rolling', requestId: 'req-1' }),
    })
    expect(result.current.offer).toBeUndefined()

    rerender({ combat: on('c-brakka'), sent: done() })
    expect(result.current.offer).toEqual({
      requestId: 'req-1',
      turn: thorins,
      left: brakkaLeft,
    })
  })

  it('keeps it while the page shows that turn in newer views, the same object or not', () => {
    const { result, rerender } = render({
      combat: on('c-brakka'),
      sent: done(),
    })
    const offered = result.current.offer

    rerender({ combat: on('c-brakka'), sent: done() })
    expect(result.current.offer).toBe(offered)
  })

  it('withdraws it for good once the page shows another turn: on to the Bat’s, and back to Brakka’s', () => {
    const sent = done()
    const { result, rerender } = render({ combat: on('c-brakka'), sent })
    expect(result.current.offer).toBeDefined()

    rerender({ combat: on('c-bat'), sent })
    expect(result.current.offer).toBeUndefined()
    rerender({ combat: on('c-brakka'), sent })
    expect(result.current.offer).toBeUndefined()
  })

  it('withdraws it for good once the page shows the ended turn again', () => {
    const sent = done()
    const { result, rerender } = render({ combat: on('c-brakka'), sent })
    expect(result.current.offer).toBeDefined()

    rerender({ combat: on('c-thorin'), sent })
    expect(result.current.offer).toBeUndefined()
    rerender({ combat: on('c-brakka'), sent })
    expect(result.current.offer).toBeUndefined()
  })

  it('withdraws it for good once the page shows the same combatant’s turn a round on, and back', () => {
    const sent = done()
    const { result, rerender } = render({ combat: on('c-brakka'), sent })
    expect(result.current.offer).toBeDefined()

    // Brakka's turn again, a round later: another turn, though the same one acts.
    rerender({ combat: on('c-brakka', { round: 2 }), sent })
    expect(result.current.offer).toBeUndefined()
    rerender({ combat: on('c-brakka'), sent })
    expect(result.current.offer).toBeUndefined()
  })

  it('offers it across a round onto the same combatant: Thorin alone to act, his turn again', () => {
    const left = {
      combatId: 'cmbt1',
      round: 2,
      combatantId: 'c-thorin',
      name: 'Thorin',
      mine: true,
    }
    // The page shows round 2 already as the answer comes.
    const { result } = render({
      combat: on('c-thorin', { round: 2 }),
      sent: done(),
    })
    expect(result.current.offer).toEqual({
      requestId: 'req-1',
      turn: thorins,
      left,
    })

    // Or still round 1's, then round 2's.
    const late = render({ sent: done() })
    expect(late.result.current.offer).toBeUndefined()
    late.rerender({ combat: on('c-thorin', { round: 2 }), sent: done() })
    expect(late.result.current.offer).toEqual({
      requestId: 'req-1',
      turn: thorins,
      left,
    })
  })

  it('offers nothing for a combat not started, though it names who was acting, nor once it starts again', () => {
    // Reset straight after the End Turn: no turn is shown, so there's none to take back to.
    const { result, rerender } = render({ sent: done() })
    rerender({ combat: on('c-brakka', { started: false }), sent: done() })
    expect(result.current.offer).toBeUndefined()
    rerender({ combat: on('c-brakka'), sent: done() })
    expect(result.current.offer).toBeUndefined()

    // Offered on Brakka's turn, then the combat reset.
    const sent = done()
    const reset = render({ combat: on('c-brakka'), sent })
    expect(reset.result.current.offer).toBeDefined()
    reset.rerender({ combat: on('c-brakka', { started: false }), sent })
    expect(reset.result.current.offer).toBeUndefined()
    reset.rerender({ combat: on('c-brakka'), sent })
    expect(reset.result.current.offer).toBeUndefined()
  })

  it('offers nothing where the one acting next is hidden from players, nor once the page shows another after', () => {
    const sent = done()
    const { result, rerender } = render({ combat: hiddenActing(), sent })
    expect(result.current.offer).toBeUndefined()

    rerender({ combat: on('c-brakka'), sent })
    expect(result.current.offer).toBeUndefined()
  })

  it('offers nothing once the page shows another combat, or none', () => {
    const sent = done()
    const { result, rerender } = render({
      combat: on('c-brakka', { id: 'cmbt2' }),
      sent,
    })
    expect(result.current.offer).toBeUndefined()

    const next = render({ combat: on('c-brakka'), sent })
    expect(next.result.current.offer).toBeDefined()
    next.rerender({ combat: undefined, sent })
    expect(next.result.current.offer).toBeUndefined()
    next.rerender({ combat: on('c-brakka'), sent })
    expect(next.result.current.offer).toBeUndefined()
    rerender({ combat: on('c-brakka'), sent })
    expect(result.current.offer).toBeUndefined()
  })

  it('says who acts now is the viewer’s own character, after a companion’s End Turn', () => {
    const { result } = render({
      combat: on('c-thorin', { round: 2 }),
      sent: done('req-1', brakkas),
    })

    expect(result.current.offer).toEqual({
      requestId: 'req-1',
      turn: brakkas,
      left: {
        combatId: 'cmbt1',
        round: 2,
        combatantId: 'c-thorin',
        name: 'Thorin',
        mine: true,
      },
    })
  })

  it('sends exactly the End Turn it takes back and the turn it left, and nothing else', async () => {
    answering({ status: 'rolling' })
    const { result } = render({ combat: on('c-brakka'), sent: done() })

    await undoing(() => result.current.undo())
    expect(posted()).toEqual([
      {
        url: `${API}/rolls`,
        body: {
          kind: 'undoEndTurn',
          undo: 'req-1',
          turn: { combatId: 'cmbt1', round: 1, combatantId: 'c-brakka' },
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
      },
    ])
  })

  it('sends one Undo for an End Turn, however often it’s asked: at once, or later', async () => {
    answering({ status: 'rolling' })
    const { result } = render({ combat: on('c-brakka'), sent: done() })
    const { undo } = result.current

    await undoing(() => {
      undo()
      undo()
    })
    expect(posted()).toHaveLength(1)
    await undoing(() => undo())
    await advance(CHECK_EVERY)
    await undoing(() => result.current.undo())
    expect(posted()).toHaveLength(1)
  })

  it('offers it no more once it’s sent, and follows its way, with the End Turn it’s for, whichever turn is shown', async () => {
    answering({ status: 'rolling' }, { status: 'done', visible: true })
    const sent = done()
    const { result, rerender } = render({ combat: on('c-brakka'), sent })

    await undoing(() => result.current.undo())
    expect(result.current.offer).toBeUndefined()
    expect(result.current.way).toEqual({ status: 'sending', for: 'req-1' })

    await advance(CHECK_EVERY)
    expect(fetch).toHaveBeenLastCalledWith(`${API}/rolls/undo-1`, {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    })
    expect(result.current.way).toMatchObject({
      status: 'rolling',
      requestId: 'undo-1',
      for: 'req-1',
    })
    // The game takes the turn back before it answers: the page shows Thorin's again.
    rerender({ combat: on('c-thorin'), sent })
    await advance(CHECK_EVERY)
    expect(result.current.way).toMatchObject({
      status: 'done',
      requestId: 'undo-1',
      for: 'req-1',
    })
    expect(result.current.offer).toBeUndefined()
  })

  it('tells an Undo refused by the app, and offers it no more', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValue(respond(422, { reason: 'not-undoable' }))
    const { result } = render({ combat: on('c-brakka'), sent: done() })

    await undoing(() => result.current.undo())
    expect(result.current.way).toEqual({
      status: 'refused',
      reason: 'not-undoable',
      for: 'req-1',
    })
    expect(result.current.offer).toBeUndefined()
    await undoing(() => result.current.undo())
    expect(posted()).toHaveLength(1)
  })

  it('offers nothing where the game takes no Undo', () => {
    const { result } = render({
      combat: on('c-brakka'),
      sent: done(),
      kinds: ['skill', 'endTurn'],
    })

    expect(result.current.offer).toBeUndefined()
  })

  it('offers nothing with Send to the table off on this device, the seat’s own switch', async () => {
    globalThis.localStorage.setItem(SEND_KEY, 'off')
    const { result } = render({ combat: on('c-brakka'), sent: done() })
    expect(result.current.offer).toBeUndefined()
    await undoing(() => result.current.undo())
    expect(fetch).not.toHaveBeenCalled()

    // The Gamemaster's is a switch of its own.
    const gm = render({ combat: on('c-brakka'), sent: done(), gm: true })
    expect(gm.result.current.offer).toBeDefined()
    globalThis.localStorage.setItem(GM_SEND_KEY, 'off')
    const gmOff = render({ combat: on('c-brakka'), sent: done(), gm: true })
    expect(gmOff.result.current.offer).toBeUndefined()
  })

  it('offers nothing for an End Turn refused, failed or lost', () => {
    for (const way of [
      { status: 'refused' as const, reason: 'moved' },
      { status: 'failed' as const, reason: 'moved', requestId: 'req-1' },
      { status: 'lost' as const, requestId: 'req-1' },
    ]) {
      const { result } = render({ combat: on('c-brakka'), sent: sentWith(way) })
      expect(result.current.offer).toBeUndefined()
    }
  })

  it('starts afresh for another End Turn, even once the last was taken back', async () => {
    answering({ status: 'rolling' })
    const { result, rerender } = render({
      combat: on('c-brakka'),
      sent: done(),
    })
    await undoing(() => result.current.undo())
    expect(result.current.offer).toBeUndefined()

    // Brakka's turn ended next, from the page.
    rerender({
      combat: on('c-brakka'),
      sent: sentWith({ status: 'rolling', requestId: 'req-2' }, brakkas),
    })
    expect(result.current.offer).toBeUndefined()
    rerender({ combat: on('c-goblin'), sent: done('req-2', brakkas) })
    expect(result.current.offer).toEqual({
      requestId: 'req-2',
      turn: brakkas,
      left: {
        combatId: 'cmbt1',
        round: 1,
        combatantId: 'c-goblin',
        name: 'Goblin',
        mine: false,
      },
    })
    await undoing(() => result.current.undo())
    expect(posted().map(({ body }) => body)).toMatchObject([
      { undo: 'req-1' },
      { undo: 'req-2', turn: { combatantId: 'c-goblin' } },
    ])
  })

  it('starts afresh for another End Turn after one whose turn moved on', () => {
    const { result, rerender } = render({
      combat: on('c-brakka'),
      sent: done(),
    })
    rerender({ combat: on('c-bat'), sent: done() })
    expect(result.current.offer).toBeUndefined()

    rerender({
      combat: on('c-goblin'),
      sent: done('req-2', {
        combatId: 'cmbt1',
        round: 1,
        combatantId: 'c-bat',
        companion: { key: 'scene1-batToken', name: 'Bat' },
      }),
    })
    expect(result.current.offer).toMatchObject({
      requestId: 'req-2',
      left: { combatantId: 'c-goblin' },
    })
  })

  it('stops following its Undo once the page is gone', async () => {
    answering({ status: 'rolling' })
    const { result, unmount } = render({ combat: on('c-brakka'), sent: done() })
    await undoing(() => result.current.undo())

    const [, init] = jest.mocked(fetch).mock.calls[0]
    unmount()
    expect(init?.signal?.aborted).toBe(true)
    await advance(CHECK_EVERY * 3)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
