import { createRef } from 'react'
import { act, renderHook } from '@testing-library/react'
import { useWidth } from './use-width'

describe('hooks/use-width', () => {
  const Observer = globalThis.ResizeObserver
  afterEach(() => {
    globalThis.ResizeObserver = Observer
  })

  it("measures an element at once, and again as it's resized, until it's gone", () => {
    let resized: (() => void) | undefined
    const disconnect = jest.fn()
    globalThis.ResizeObserver = jest.fn((callback: () => void) => {
      resized = callback
      return { observe: jest.fn(), unobserve: jest.fn(), disconnect }
    }) as unknown as typeof ResizeObserver
    const element = document.createElement('div')
    let width = 800
    Object.defineProperty(element, 'offsetWidth', { get: () => width })

    const ref = { current: element }

    const { result, unmount } = renderHook(() => useWidth(ref))
    expect(result.current).toBe(800)

    width = 390
    act(() => resized?.())
    expect(result.current).toBe(390)

    unmount()
    expect(disconnect).toHaveBeenCalled()
  })

  it('is 0 for no element', () => {
    const ref = createRef<HTMLDivElement>()
    const { result } = renderHook(() => useWidth(ref))
    expect(result.current).toBe(0)
  })
})
