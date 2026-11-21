import { act, renderHook } from '@testing-library/react'
import { useWidth } from './use-width'

/** An element whose width is what `width` says at the time. */
function sized(width: { now: number }) {
  const element = document.createElement('div')
  Object.defineProperty(element, 'offsetWidth', { get: () => width.now })
  return element
}

describe('hooks/use-width', () => {
  const Observer = globalThis.ResizeObserver
  afterEach(() => {
    globalThis.ResizeObserver = Observer
  })

  /** A stand-in for the browser's: each observer made, its callback, what it watches, its end. */
  function observers() {
    const made: {
      resized: () => void
      watched: Element[]
      disconnect: jest.Mock
    }[] = []
    globalThis.ResizeObserver = jest.fn((callback: () => void) => {
      const each = {
        resized: callback,
        watched: [] as Element[],
        disconnect: jest.fn(),
      }
      made.push(each)
      return {
        observe: (element: Element) => each.watched.push(element),
        unobserve: jest.fn(),
        disconnect: each.disconnect,
      }
    }) as unknown as typeof ResizeObserver
    return made
  }

  it("measures an element at once, and again as it's resized; its watch ends as it goes, the last width kept", () => {
    const made = observers()
    const width = { now: 800 }
    const element = sized(width)

    const { result, rerender } = renderHook(
      ({ element }: { element: HTMLElement | null }) => useWidth(element),
      { initialProps: { element } as { element: HTMLElement | null } },
    )
    expect(result.current).toBe(800)

    width.now = 390
    act(() => made[0].resized())
    expect(result.current).toBe(390)

    rerender({ element: null })
    expect(made[0].disconnect).toHaveBeenCalled()
    expect(result.current).toBe(390)
  })

  it("watches the element drawn in its place, as the favorites' card once Reorder closes (ROADMAP item 75)", () => {
    const made = observers()
    const first = sized({ now: 800 })
    const secondWidth = { now: 390 }
    const second = sized(secondWidth)

    const { result, rerender } = renderHook(
      ({ element }: { element: HTMLElement | null }) => useWidth(element),
      { initialProps: { element: first } as { element: HTMLElement | null } },
    )
    expect(result.current).toBe(800)

    rerender({ element: second })
    expect(result.current).toBe(390)
    expect(made[0].disconnect).toHaveBeenCalled()
    expect(made.at(-1)?.watched).toEqual([second])

    secondWidth.now = 720
    act(() => made.at(-1)?.resized())
    expect(result.current).toBe(720)
  })

  it('is 0 until an element is drawn', () => {
    const { result } = renderHook(() => useWidth(null))
    expect(result.current).toBe(0)
  })
})
