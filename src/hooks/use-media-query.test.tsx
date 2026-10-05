import { act, renderHook } from '@testing-library/react'
import { useMediaQuery } from './use-media-query'

/** A window whose width can be changed, matching `(min-width: 64rem)` from 1024 pixels. */
const resizable = (width: number) => {
  const listeners = new Set<() => void>()
  const list = {
    get matches() {
      return width >= 1024
    },
    addEventListener: (_: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) =>
      listeners.delete(listener),
  }
  jest
    .spyOn(globalThis, 'matchMedia')
    .mockImplementation(() => list as unknown as MediaQueryList)
  return {
    listeners,
    resize: (next: number) =>
      act(() => {
        width = next
        for (const listener of listeners) listener()
      }),
  }
}

describe('hooks/use-media-query', () => {
  afterEach(() => jest.restoreAllMocks())

  it('follows the window as it changes', () => {
    const browser = resizable(800)
    const { result, unmount } = renderHook(() =>
      useMediaQuery('(min-width: 64rem)'),
    )
    expect(result.current).toBe(false)

    browser.resize(1280)
    expect(result.current).toBe(true)

    browser.resize(600)
    expect(result.current).toBe(false)

    unmount()
    expect(browser.listeners.size).toBe(0)
  })

  it('asks the window about the query given', () => {
    resizable(1280)
    renderHook(() => useMediaQuery('(min-width: 64rem)'))

    expect(globalThis.matchMedia).toHaveBeenCalledWith('(min-width: 64rem)')
  })
})
