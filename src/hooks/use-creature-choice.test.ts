import { act, renderHook } from '@testing-library/react'
import { CREATURE_KEY, useCreatureChoice } from './use-creature-choice'

const KEYS = ['wolfBrakka', 'sceneFrost-tokenImp']

describe('hooks/use-creature-choice', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    sessionStorage.clear()
    localStorage.clear()
  })

  it("has the character's own until another is chosen, then keeps the choice for this tab, per seat", () => {
    const { result } = renderHook(() => useCreatureChoice('c1:thorin', KEYS))
    expect(result.current[0]).toBe('self')

    act(() => result.current[1]('wolfBrakka'))

    expect(result.current[0]).toBe('wolfBrakka')
    expect(sessionStorage.getItem(`${CREATURE_KEY}:c1:thorin`)).toBe(
      'wolfBrakka',
    )
    // Never shared with the other tabs of this browser.
    expect(localStorage.length).toBe(0)
  })

  it('keeps each seat its own choice', () => {
    sessionStorage.setItem(`${CREATURE_KEY}:c1:thorin`, 'wolfBrakka')

    expect(
      renderHook(() => useCreatureChoice('c1:thorin', KEYS)).result.current[0],
    ).toBe('wolfBrakka')
    expect(
      renderHook(() => useCreatureChoice('c1:vex', KEYS)).result.current[0],
    ).toBe('self')
  })

  it('has the character’s own where the companion kept is no longer listed', () => {
    sessionStorage.setItem(`${CREATURE_KEY}:c1:thorin`, 'wolfBrakka')

    const { result } = renderHook(() =>
      useCreatureChoice('c1:thorin', ['sceneFrost-tokenImp']),
    )
    expect(result.current[0]).toBe('self')
  })

  it("has the character's own where the tab can't keep anything, and still switches for the page", () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('The operation is insecure.')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('The operation is insecure.')
    })
    const { result } = renderHook(() => useCreatureChoice('c2:thorin', KEYS))
    expect(result.current[0]).toBe('self')

    act(() => result.current[1]('sceneFrost-tokenImp'))

    expect(result.current[0]).toBe('sceneFrost-tokenImp')
  })
})
