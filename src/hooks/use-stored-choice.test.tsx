import { act, renderHook } from '@testing-library/react'
import { useStoredChoice } from './use-stored-choice'

const LAYOUTS = ['list', 'columns', 'table'] as const

describe('hooks/use-stored-choice', () => {
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
})
