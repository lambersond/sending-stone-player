import { act, renderHook } from '@testing-library/react'
import { useKeyboardInset } from './use-keyboard-inset'

/** A visual viewport, as a browser with an on-screen keyboard gives one. */
class Viewport extends EventTarget {
  height = 844
  offsetTop = 0
}

describe('hooks/use-keyboard-inset', () => {
  const innerHeight = globalThis.innerHeight
  const matchMedia = globalThis.matchMedia
  let viewport: Viewport

  /** The screen this wide, as `sm` sees it. */
  const bordered = (wide: boolean) => {
    globalThis.matchMedia = (query: string) =>
      ({
        matches: wide && query === '(min-width: 640px)',
        media: query,
      }) as MediaQueryList
  }

  /** A keyboard up, leaving this much of the window shown, from this far down. */
  const keyboard = (height: number, offsetTop = 0) =>
    act(() => {
      viewport.height = height
      viewport.offsetTop = offsetTop
      viewport.dispatchEvent(new Event('resize'))
    })

  beforeEach(() => {
    viewport = new Viewport()
    Object.defineProperty(globalThis, 'visualViewport', {
      configurable: true,
      value: viewport,
    })
    globalThis.innerHeight = 844
    bordered(false)
  })

  afterEach(() => {
    globalThis.innerHeight = innerHeight
    globalThis.matchMedia = matchMedia
    Object.defineProperty(globalThis, 'visualViewport', {
      configurable: true,
      value: undefined,
    })
  })

  it('sets nothing with no keyboard up', () => {
    const { result } = renderHook(() => useKeyboardInset(true))
    expect(result.current).toBeUndefined()
  })

  it('fits a full-screen dialog to what the keyboard leaves of the window, below 640 px', () => {
    const { result } = renderHook(() => useKeyboardInset(true))
    keyboard(500, 12)
    expect(result.current).toEqual({
      marginBlock: 0,
      bottom: 'auto',
      minHeight: 0,
      top: '12px',
      height: '500px',
    })
  })

  it('caps a bordered dialog’s height to it, a little in from its edges, from 640 px, a phone turned sideways or a tablet', () => {
    bordered(true)
    globalThis.innerHeight = 1024
    viewport.height = 1024
    const { result } = renderHook(() => useKeyboardInset(true))
    keyboard(620, 0)
    expect(result.current).toEqual({
      marginBlock: 0,
      bottom: 'auto',
      minHeight: 0,
      top: '8px',
      maxHeight: '604px',
    })
  })

  it('places a bordered dialog a little below where the viewport has scrolled to', () => {
    bordered(true)
    globalThis.innerHeight = 1024
    viewport.height = 1024
    const { result } = renderHook(() => useKeyboardInset(true))
    keyboard(620, 40)
    expect(result.current).toMatchObject({ top: '48px', maxHeight: '604px' })
  })

  it('follows the viewport as it scrolls', () => {
    const { result } = renderHook(() => useKeyboardInset(true))
    keyboard(500, 0)
    act(() => {
      viewport.offsetTop = 40
      viewport.dispatchEvent(new Event('scroll'))
    })
    expect(result.current?.top).toBe('40px')
  })

  it('clears it all once the viewport is as tall as the window again, a rounding pixel aside', () => {
    const { result } = renderHook(() => useKeyboardInset(true))
    keyboard(500)
    expect(result.current).toBeDefined()
    keyboard(843.5)
    expect(result.current).toBeUndefined()
  })

  it('sets nothing while the dialog is closed, and stops listening', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useKeyboardInset(active),
      { initialProps: { active: true } },
    )
    keyboard(500)
    rerender({ active: false })
    expect(result.current).toBeUndefined()
    keyboard(400)
    expect(result.current).toBeUndefined()
  })

  it('sets nothing where the browser has no visual viewport', () => {
    Object.defineProperty(globalThis, 'visualViewport', {
      configurable: true,
      value: undefined,
    })
    const { result } = renderHook(() => useKeyboardInset(true))
    expect(result.current).toBeUndefined()
  })
})
