import { act, renderHook } from '@testing-library/react'
import { useSettle } from './use-settle'
import type { TableRollState } from '@/types/roll'

const SETTLE = 1000

/** A command sent for the key `fav`: its line's local id and whether the sheet agrees yet. */
type Sent = { id: string; agreed: boolean }

const stateOf = (status: TableRollState['status']) =>
  new Map<string, TableRollState>([['line-1', { status }]])

const settling = (missing: 'waiting' | 'idle') =>
  renderHook(
    ({ states }: { states: ReadonlyMap<string, TableRollState> }) =>
      useSettle<Sent>({
        states,
        settleMs: SETTLE,
        missing,
        agrees: ({ agreed }) => agreed,
      }),
    { initialProps: { states: new Map() } },
  )

describe('features/sheet/hooks/use-settle', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it.each([
    ['sending', 'waiting', true],
    ['rolling', 'idle', true],
    ['failed', 'waiting', false],
    ['refused', 'waiting', false],
    ['expired', 'idle', false],
  ] as const)(
    'a command %s (missing %s) waits: %s, however long it takes',
    (status, missing, waits) => {
      const { result, rerender } = settling(missing)
      act(() => result.current.sent('fav', { id: 'line-1', agreed: false }))
      rerender({ states: stateOf(status) })
      act(() => jest.advanceTimersByTime(SETTLE * 3))
      const { waitingOf, last } = result.current
      expect(waitingOf(last('fav'))).toBe(waits)
    },
  )

  it('waits for one made until the sheet agrees, or until it settles from its send', () => {
    const { result, rerender } = settling('idle')
    act(() => result.current.sent('fav', { id: 'line-1', agreed: false }))
    rerender({ states: stateOf('done') })
    act(() => jest.advanceTimersByTime(SETTLE - 1))
    expect(result.current.waitingOf(result.current.last('fav'))).toBe(true)
    expect(result.current.waitingOf({ id: 'line-1', agreed: true })).toBe(false)
    act(() => jest.advanceTimersByTime(1))
    expect(result.current.waitingOf(result.current.last('fav'))).toBe(false)
  })

  it.each([
    ['waiting', true],
    ['idle', false],
  ] as const)(
    'a command whose way is not yet heard of, missing %s, waits: %s, until it settles',
    (missing, waits) => {
      const { result } = settling(missing)
      act(() => result.current.sent('fav', { id: 'line-1', agreed: false }))
      expect(result.current.waitingOf(result.current.last('fav'))).toBe(waits)
      act(() => jest.advanceTimersByTime(SETTLE))
      expect(result.current.waitingOf(result.current.last('fav'))).toBe(false)
    },
  )

  it('settles a command at once, and waits for it afresh once unsettled', () => {
    const { result, rerender } = settling('waiting')
    act(() => result.current.sent('fav', { id: 'line-1', agreed: false }))
    rerender({ states: stateOf('done') })
    act(() => result.current.settleNow('line-1'))
    expect(result.current.waitingOf(result.current.last('fav'))).toBe(false)
    act(() => result.current.unsettle('line-1'))
    expect(result.current.waitingOf(result.current.last('fav'))).toBe(true)
    act(() => jest.advanceTimersByTime(SETTLE))
    expect(result.current.waitingOf(result.current.last('fav'))).toBe(false)
  })

  it('keeps the last command sent for each key, and none for a key never sent', () => {
    const { result } = settling('idle')
    act(() => {
      result.current.sent('fav', { id: 'line-1', agreed: false })
      result.current.sent('fav', { id: 'line-2', agreed: true })
    })
    expect(result.current.last('fav')).toEqual({ id: 'line-2', agreed: true })
    expect(result.current.last('other')).toBeUndefined()
    expect(result.current.waitingOf(result.current.last('other'))).toBe(false)
  })

  it('clears its timers as the pane goes', () => {
    const { result, unmount } = settling('waiting')
    act(() => result.current.sent('fav', { id: 'line-1', agreed: false }))
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })
})
