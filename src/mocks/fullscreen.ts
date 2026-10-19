/* eslint-disable unicorn/no-null -- the Fullscreen API's absent element is null */

// jsdom has no Fullscreen API: a stand-in for tests, as a browser that has one behaves. Whatever is
// asked to fill the screen does, a moment later, and the document says so; each change is told
// with a `fullscreenchange` event, as the browser tells it.

/** The Fullscreen API's members this stands in for, to remove afterwards. */
const MEMBERS = ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen']

export function fakeFullscreen({ enabled = true }: { enabled?: boolean } = {}) {
  let element: Element | null = null
  const change = (next: Element | null) => {
    element = next
    document.dispatchEvent(new Event('fullscreenchange'))
  }
  Object.defineProperty(document, 'fullscreenEnabled', {
    configurable: true,
    // A browser without the API, such as Safari on an iPhone, has nothing there.
    get: () => (enabled ? true : undefined),
  })
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => element,
  })
  // Whatever element is asked to fill the screen does: the page's own, or the wrong one.
  const requestFullscreen = jest.fn(function (this: Element) {
    // eslint-disable-next-line unicorn/no-this-outside-of-class -- the element it's called on
    return Promise.resolve().then(() => change(this))
  })
  const exitFullscreen = jest.fn(() =>
    Promise.resolve().then(() => change(null)),
  )
  Element.prototype.requestFullscreen = requestFullscreen
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: exitFullscreen,
  })
  return {
    requestFullscreen,
    exitFullscreen,
    /** Something outside the page fills the screen or ends it, such as Escape or a video. */
    change,
    /** What fills the screen now. */
    current: () => element,
    restore() {
      for (const member of MEMBERS) Reflect.deleteProperty(document, member)
      Reflect.deleteProperty(Element.prototype, 'requestFullscreen')
    },
  }
}

/**
 * A phone or tablet as the page sees it: its browser's name for itself, and whether it runs as an
 * app of its own from the Home Screen, as Safari on iOS says, or by the display mode.
 */
export function fakeDevice({
  userAgent,
  standalone,
  displayMode = 'browser',
}: {
  userAgent: string
  standalone?: boolean
  displayMode?: 'browser' | 'standalone' | 'fullscreen'
}) {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    get: () => userAgent,
  })
  if (standalone !== undefined) {
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: standalone,
    })
  }
  const matchMedia = jest.spyOn(globalThis, 'matchMedia').mockImplementation(
    query =>
      ({
        matches: query.includes(`(display-mode: ${displayMode})`),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
  return {
    matchMedia,
    restore() {
      Reflect.deleteProperty(navigator, 'userAgent')
      Reflect.deleteProperty(navigator, 'standalone')
      matchMedia.mockRestore()
    },
  }
}

export const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
export const PIXEL =
  'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
export const DESKTOP =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
