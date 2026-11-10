import { act, renderHook } from '@testing-library/react'
import { useDiceAsks } from './use-dice-asks'
import { tableIceKnife } from '@/mocks/dice-asks'
import type { DiceEntry } from '@/types/dice-entry'
import type { LocalFormula, TableRollState } from '@/types/roll'
import type { TableDiceAsk } from '@/types/table'

const NOW = Date.parse('2026-11-10T12:00:10Z')
/** Ice Knife's 2d6 cold, waiting 50 s more, asked for Thorin's damage `roll-thorin-1`. */
const ask = tableIceKnife({ expiresAt: new Date(NOW + 50_000).toISOString() })

/** The pane's rolls' ways: that damage sent from this device, or none. */
const sentHere: ReadonlyMap<string, TableRollState> = new Map([
  ['damage-1', { status: 'rolling', requestId: 'roll-thorin-1' }],
])
const sentNowhere: ReadonlyMap<string, TableRollState> = new Map()
/** That damage sent from this device, before the app has told it the roll's id. */
const sentNoIdYet: ReadonlyMap<string, TableRollState> = new Map([
  ['damage-1', { status: 'sending' }],
])

/** The dialog, as the hook asks it: each entry, and how to close it. */
let asked: {
  entry: DiceEntry
  close: (values?: number[][]) => void
}[] = []
const enter = jest.fn(
  (entry: DiceEntry) =>
    new Promise<number[][] | undefined>(resolve => {
      asked.push({ entry, close: resolve })
    }),
)
const kept = { kind: 'formula', id: 'dice-1' } as LocalFormula
const logAnswer = jest.fn(() => kept)
const sendAnswer = jest.fn()

type Hook = ReturnType<typeof useDiceAsks>

/** The hook, on a pane listing these asks. */
const render = ({
  asks = [ask] as TableDiceAsk[],
  states = sentHere,
  sending = true,
} = {}) =>
  renderHook(
    props => useDiceAsks({ ...props, enter, logAnswer, sendAnswer, sending }),
    { initialProps: { asks, states } },
  )

/** Close the dialog open, as the player or itself does, and let the hook see it. */
const close = async (values?: number[][]) => {
  await act(async () => {
    asked.at(-1)?.close(values)
  })
}

describe('features/rolling/hooks/use-dice-asks (module 0.45.0)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    asked = []
  })
  afterEach(() => {
    jest.useRealTimers()
    document.body.replaceChildren()
  })

  it('opens the dialog by itself on the device that sent the roll, and sends what was typed', async () => {
    const { result } = render()

    expect(enter).toHaveBeenCalledTimes(1)
    expect(asked[0].entry.title).toBe('Ice Knife: Shard Explosion')
    expect(result.current.offered).toEqual([])
    await close([[3, 5]])

    expect(logAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ total: 8, typed: true }),
    )
    expect(sendAnswer).toHaveBeenCalledWith(kept, 'ask1', [
      { roll: 0, term: 0, results: [3, 5] },
    ])
  })

  it.each([
    ['on another of the player’s devices', { states: sentNowhere }],
    ['where this device doesn’t send their rolls', { sending: false }],
  ])(
    'offers it on the banner %s, opening it only on Type in',
    async (_, given) => {
      const { result } = render(given)

      expect(enter).not.toHaveBeenCalled()
      expect(result.current.offered).toEqual([ask])
      act(() => result.current.typeIn(ask))
      expect(enter).toHaveBeenCalledTimes(1)
      expect(result.current.offered).toEqual([])
    },
  )

  it('opens it by itself once the roll’s id comes, where the view listed it before', () => {
    const asks = [ask]
    const { result, rerender } = render({ asks, states: sentNoIdYet })
    expect(enter).not.toHaveBeenCalled()
    expect(result.current.offered).toEqual([ask])

    // The same view, as a poll that finds nothing new leaves it; only the roll's way changes.
    rerender({ asks, states: sentHere })
    expect(enter).toHaveBeenCalledTimes(1)
    expect(result.current.offered).toEqual([])
  })

  it.each([
    ['typed in', (ask: TableDiceAsk, hook: Hook) => hook.typeIn(ask)],
    ['let the game roll', (ask: TableDiceAsk, hook: Hook) => hook.leave(ask)],
  ])(
    'never asks again for one %s from the banner before the roll’s id came',
    (_, take) => {
      const asks = [ask]
      const { result, rerender } = render({ asks, states: sentNoIdYet })
      act(() => take(ask, result.current))
      const asked = enter.mock.calls.length

      rerender({ asks, states: sentHere })
      expect(enter).toHaveBeenCalledTimes(asked)
    },
  )

  it('offers it on the banner while the player types in a text field, as the chat’s, and never opens it by itself after', () => {
    const chat = document.createElement('textarea')
    document.body.append(chat)
    chat.focus()

    const asks = [ask]
    const { result, rerender } = render({ asks })
    expect(enter).not.toHaveBeenCalled()
    expect(result.current.offered).toEqual([ask])

    chat.blur()
    rerender({ asks, states: new Map(sentHere) })
    expect(enter).not.toHaveBeenCalled()
    expect(result.current.offered).toEqual([ask])
  })

  it('lets the game roll every die where the player says so, in the dialog or on the banner', async () => {
    render()
    await close()
    expect(sendAnswer).toHaveBeenLastCalledWith(kept, 'ask1', [])

    const other = render({ states: sentNowhere })
    act(() => other.result.current.leave(ask))
    expect(sendAnswer).toHaveBeenCalledTimes(2)
    expect(sendAnswer).toHaveBeenLastCalledWith(kept, 'ask1', [])
    expect(other.result.current.offered).toEqual([])
  })

  it('sends nothing where the dialog closed by itself, its time out', async () => {
    render()
    jest.setSystemTime(Date.parse(ask.expiresAt))
    await close()
    expect(sendAnswer).not.toHaveBeenCalled()
  })

  it('closes the dialog, sending nothing, once the ask closes elsewhere', async () => {
    const { rerender } = render()
    const { signal } = asked[0].entry

    rerender({ asks: [], states: sentHere })
    expect(signal?.aborted).toBe(true)
    await close()
    expect(sendAnswer).not.toHaveBeenCalled()
  })

  it('asks again for one a view lists again after leaving it out, as one that lost it for a moment', async () => {
    const { result, rerender } = render()
    rerender({ asks: [], states: sentHere })
    await close()
    rerender({ asks: [ask], states: sentHere })

    expect(enter).toHaveBeenCalledTimes(2)
    expect(asked[1].entry.signal?.aborted).toBe(false)
    expect(result.current.offered).toEqual([])
    expect(sendAnswer).not.toHaveBeenCalled()
  })

  it('takes each ask once on a page, however often its view lists it', () => {
    const { rerender } = render()
    rerender({ asks: [{ ...ask }], states: sentHere })
    rerender({ asks: [ask], states: new Map(sentHere) })
    expect(enter).toHaveBeenCalledTimes(1)
  })

  it('sends nothing for a dialog the pane closes as it goes', async () => {
    const { unmount } = render()
    unmount()
    await close()
    expect(sendAnswer).not.toHaveBeenCalled()
  })
})
