import { act, renderHook } from '@testing-library/react'
import { useSendChoice } from './use-send-choice'

describe('features/rolling/hooks/use-send-choice', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it.each([
    { who: "a player's", gm: false, key: 'sending-stone:send-rolls' },
    { who: "the Gamemaster's", gm: true, key: 'sending-stone:send-rolls:gm' },
  ])(
    'keeps $who Send to the table, on until turned off, under its own key',
    ({ gm, key }) => {
      const { result } = renderHook(() => useSendChoice(gm))
      expect(result.current[0]).toBe('on')

      act(() => result.current[1]('off'))
      expect(result.current[0]).toBe('off')
      expect(localStorage.getItem(key)).toBe('off')
      expect(localStorage.length).toBe(1)
    },
  )
})
