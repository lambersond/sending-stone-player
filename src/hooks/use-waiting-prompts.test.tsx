import { act, renderHook } from '@testing-library/react'
import { useShownPrompts, useWaitingPrompts } from './use-waiting-prompts'
import type { TablePrompt } from '@/types/table'

const NOW = Date.parse('2026-10-08T12:05:00Z')

const prompt = (id: string, expiresAt: string): TablePrompt => ({
  id,
  type: 'save',
  abilities: ['dex'],
  expiresAt,
})

describe('hooks/use-waiting-prompts', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('drops each save the game asks for as its time runs out, with nothing new from the game', () => {
    const prompts = [
      prompt('msg1-thorin', '2026-10-08T12:06:00.000Z'),
      prompt('msg2-thorin', '2026-10-08T12:08:00.000Z'),
      prompt('msg0-thorin', '2026-10-08T12:04:00.000Z'),
    ]
    const { result } = renderHook(() => useWaitingPrompts(prompts))
    expect(result.current.map(({ id }) => id)).toEqual([
      'msg1-thorin',
      'msg2-thorin',
    ])

    act(() => jest.advanceTimersByTime(60_100))
    expect(result.current.map(({ id }) => id)).toEqual(['msg2-thorin'])

    act(() => jest.advanceTimersByTime(120_000))
    expect(result.current).toEqual([])
  })

  it('is empty while the game asks nothing', () => {
    const { result } = renderHook(() => useWaitingPrompts())
    expect(result.current).toEqual([])
  })

  it('never counts a notice of how one Midi-QOL asked closed as waiting', () => {
    const prompts: TablePrompt[] = [
      { ...prompt('k1-thorin', '2026-10-08T12:06:00.000Z'), source: 'midi' },
      {
        ...prompt('k2-thorin', '2026-10-08T12:06:00.000Z'),
        source: 'midi',
        closed: 'rolled',
      },
    ]
    const { result } = renderHook(() => useWaitingPrompts(prompts))
    expect(result.current.map(({ id }) => id)).toEqual(['k1-thorin'])
  })
})

describe('hooks/use-waiting-prompts, useShownPrompts', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  /** What Midi-QOL asks, its time up in ten seconds. */
  const midi: TablePrompt = {
    ...prompt('k1-thorin', '2026-10-08T12:05:10.000Z'),
    source: 'midi',
  }

  it('shows what Midi-QOL asks fifteen seconds past its time, while the game says what became of it, and a card’s save until its time', () => {
    const card = prompt('msg1-thorin', '2026-10-08T12:05:10.000Z')
    const { result } = renderHook(() => useShownPrompts([midi, card]))
    expect(result.current.map(({ id }) => id)).toEqual([
      'k1-thorin',
      'msg1-thorin',
    ])

    act(() => jest.advanceTimersByTime(10_100))
    expect(result.current.map(({ id }) => id)).toEqual(['k1-thorin'])

    act(() => jest.advanceTimersByTime(15_000))
    expect(result.current).toEqual([])
  })

  it('drops one the view drops, as gone or answered, at once, with no notice', () => {
    const { result, rerender } = renderHook(
      ({ prompts }: { prompts: TablePrompt[] }) => useShownPrompts(prompts),
      { initialProps: { prompts: [midi] } },
    )
    expect(result.current).toEqual([midi])

    rerender({ prompts: [] })
    expect(result.current).toEqual([])
  })

  it('shows how one closed six seconds from when this page saw it, though the view moves on meanwhile', () => {
    const { result, rerender } = renderHook(
      ({ prompts }: { prompts: TablePrompt[] }) => useShownPrompts(prompts),
      { initialProps: { prompts: [midi] } },
    )
    act(() => jest.advanceTimersByTime(3000))
    rerender({ prompts: [{ ...midi, closed: 'rolled' }] })
    expect(result.current).toEqual([{ ...midi, closed: 'rolled' }])

    // The next view no longer has it, as the app's six seconds were up first.
    act(() => jest.advanceTimersByTime(2000))
    rerender({ prompts: [] })
    expect(result.current).toEqual([{ ...midi, closed: 'rolled' }])

    act(() => jest.advanceTimersByTime(3900))
    expect(result.current).toEqual([{ ...midi, closed: 'rolled' }])
    act(() => jest.advanceTimersByTime(200))
    expect(result.current).toEqual([])
  })
})
