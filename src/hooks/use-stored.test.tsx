import { act, renderHook } from '@testing-library/react'
import { useStoredChoice, useStoredSet } from './use-stored'

const LAYOUTS = ['list', 'columns', 'table'] as const

describe('hooks/use-stored', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    localStorage.clear()
  })

  it('has the fallback until a choice is made, then remembers it in this browser', () => {
    const { result } = renderHook(() =>
      useStoredChoice('layout', LAYOUTS, 'list'),
    )
    expect(result.current[0]).toBe('list')

    act(() => result.current[1]('table'))

    expect(result.current[0]).toBe('table')
    expect(localStorage.getItem('layout')).toBe('table')
  })

  it('has what this browser remembers, and tells everything using it of a new choice', () => {
    localStorage.setItem('shared', 'columns')
    const first = renderHook(() => useStoredChoice('shared', LAYOUTS, 'list'))
    const second = renderHook(() => useStoredChoice('shared', LAYOUTS, 'list'))
    expect(first.result.current[0]).toBe('columns')

    act(() => first.result.current[1]('table'))

    expect(second.result.current[0]).toBe('table')
  })

  it("has the fallback for a choice it doesn't know", () => {
    localStorage.setItem('odd', 'grid')
    const { result } = renderHook(() => useStoredChoice('odd', LAYOUTS, 'list'))
    expect(result.current[0]).toBe('list')
  })

  it("keeps a choice for the page alone where the browser can't keep it", () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('The operation is insecure.')
    })
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('The operation is insecure.')
    })
    const { result } = renderHook(() =>
      useStoredChoice('private', LAYOUTS, 'list'),
    )
    expect(result.current[0]).toBe('list')

    act(() => result.current[1]('columns'))

    expect(result.current[0]).toBe('columns')
  })

  describe('useStoredSet', () => {
    it('starts empty, and adds a name or takes it out, as this browser keeps it', () => {
      const { result } = renderHook(() => useStoredSet('closed'))
      expect([...result.current[0]]).toEqual([])

      act(() => result.current[1]('action/weapons'))
      act(() => result.current[1]('bonus/features'))
      expect([...result.current[0]]).toEqual([
        'action/weapons',
        'bonus/features',
      ])
      expect(localStorage.getItem('closed')).toBe(
        '["action/weapons","bonus/features"]',
      )

      act(() => result.current[1]('action/weapons'))
      expect([...result.current[0]]).toEqual(['bonus/features'])
    })

    it('reads only names, from what this browser keeps', () => {
      localStorage.setItem('kept', '["a", 2, "b"]')
      expect([
        ...renderHook(() => useStoredSet('kept')).result.current[0],
      ]).toEqual(['a', 'b'])
      localStorage.setItem('odd', '{"a": 1}')
      expect([
        ...renderHook(() => useStoredSet('odd')).result.current[0],
      ]).toEqual([])
      localStorage.setItem('broken', '[')
      expect([
        ...renderHook(() => useStoredSet('broken')).result.current[0],
      ]).toEqual([])
    })
  })
})
