/* eslint-disable unicorn/no-null -- the Fullscreen API's absent element is null */
import { act, renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useFullscreen } from './use-fullscreen'
import { DESKTOP, fakeDevice, fakeFullscreen, IPHONE } from '@/mocks/fullscreen'

/** Let what the browser does a moment after it's asked happen. */
const settle = () => act(async () => {})

describe('hooks/use-fullscreen', () => {
  let fullscreen: ReturnType<typeof fakeFullscreen>
  let device: ReturnType<typeof fakeDevice>
  beforeEach(() => {
    fullscreen = fakeFullscreen()
    device = fakeDevice({ userAgent: DESKTOP })
  })
  afterEach(() => {
    fullscreen.restore()
    device.restore()
  })

  it('is unsupported where the browser has no Fullscreen API, as on an iPhone', () => {
    fullscreen.restore()
    fullscreen = fakeFullscreen({ enabled: false })

    const { result } = renderHook(() => useFullscreen())

    expect(result.current.supported).toBe(false)
    expect(result.current.active).toBe(false)
  })

  it('fills the screen with the whole page, never one element of it, hiding what the browser can', async () => {
    const { result } = renderHook(() => useFullscreen())
    expect(result.current).toMatchObject({ supported: true, active: false })

    act(() => result.current.enter())
    // Asked within the click itself, as the browser requires.
    expect(fullscreen.requestFullscreen).toHaveBeenCalledTimes(1)
    expect(fullscreen.requestFullscreen).toHaveBeenCalledWith({
      navigationUI: 'hide',
    })
    expect(fullscreen.requestFullscreen.mock.contexts[0]).toBe(
      document.documentElement,
    )
    await settle()

    expect(fullscreen.current()).toBe(document.documentElement)
    expect(result.current.active).toBe(true)
  })

  it('follows the page out of full screen however it leaves, such as by Escape', async () => {
    const { result } = renderHook(() => useFullscreen())
    act(() => result.current.enter())
    await settle()

    act(() => fullscreen.change(null))

    expect(result.current.active).toBe(false)
  })

  it("isn't active for another element filling the screen, as a video does", () => {
    const { result } = renderHook(() => useFullscreen())

    act(() => fullscreen.change(document.body))

    expect(result.current.active).toBe(false)
  })

  it('leaves full screen only while something fills it', async () => {
    const { result } = renderHook(() => useFullscreen())

    act(() => result.current.exit())
    expect(fullscreen.exitFullscreen).not.toHaveBeenCalled()

    act(() => result.current.enter())
    await settle()
    act(() => result.current.exit())
    await settle()

    expect(fullscreen.exitFullscreen).toHaveBeenCalledTimes(1)
    expect(result.current.active).toBe(false)
  })

  it('leaves the page as it was where the browser refuses, as a webview may', async () => {
    const refusal = Promise.reject(new TypeError('Permissions check failed'))
    const handled = jest.spyOn(refusal, 'catch')
    fullscreen.requestFullscreen.mockReturnValueOnce(refusal)
    const { result } = renderHook(() => useFullscreen())

    expect(() => act(() => result.current.enter())).not.toThrow()
    await settle()

    // The refusal is handled, and settles quietly.
    expect(handled).toHaveBeenCalledTimes(1)
    await expect(handled.mock.results[0].value).resolves.toBeUndefined()
    expect(result.current.active).toBe(false)
  })

  it('stays in full screen when the page using it goes, as between the pages a game fills', async () => {
    const { result, unmount } = renderHook(() => useFullscreen())
    act(() => result.current.enter())
    await settle()

    unmount()
    await settle()

    expect(fullscreen.exitFullscreen).not.toHaveBeenCalled()
    expect(fullscreen.current()).toBe(document.documentElement)
  })

  it.each([
    ['says Safari on iOS runs it from the Home Screen', { standalone: true }],
    ['matches display-mode: standalone', { displayMode: 'standalone' }],
    // The iPhone Home Screen app matches this, not standalone.
    ['matches display-mode: fullscreen', { displayMode: 'fullscreen' }],
  ] as const)('runs as an app of its own where it %s', (_name, mode) => {
    device.restore()
    device = fakeDevice({ userAgent: IPHONE, ...mode })

    const { result } = renderHook(() => useFullscreen())

    expect(result.current.standalone).toBe(true)
    expect(device.matchMedia).toHaveBeenCalledWith(
      '(display-mode: standalone), (display-mode: fullscreen)',
    )
  })

  it("knows an iPhone, and that a browser tab isn't an app of its own", () => {
    device.restore()
    device = fakeDevice({ userAgent: IPHONE, standalone: false })

    const { result } = renderHook(() => useFullscreen())

    expect(result.current).toMatchObject({ ios: true, standalone: false })
  })

  it('says nothing on the server, nor in the first render in the browser', async () => {
    device.restore()
    device = fakeDevice({ userAgent: IPHONE, standalone: true })
    const { result } = renderHook(() => useFullscreen())
    act(() => result.current.enter())
    await settle()

    function Probe() {
      const { supported, standalone, ios, active } = useFullscreen()
      return <p>{JSON.stringify({ supported, standalone, ios, active })}</p>
    }

    expect(renderToString(<Probe />)).toContain(
      JSON.stringify({
        supported: false,
        standalone: false,
        ios: false,
        active: false,
      }).replaceAll('"', '&quot;'),
    )
  })
})
