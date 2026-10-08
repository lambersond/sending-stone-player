import { act, renderHook } from '@testing-library/react'
import { useWaitingPrompts } from './use-waiting-prompts'
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
})
