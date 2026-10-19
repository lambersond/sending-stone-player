import { act, render } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { FullscreenGuard } from './fullscreen-guard'
import { fakeFullscreen } from '@/mocks/fullscreen'

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }))

describe('components/game-table/fullscreen-guard', () => {
  let fullscreen: ReturnType<typeof fakeFullscreen>
  beforeEach(() => {
    fullscreen = fakeFullscreen()
  })
  afterEach(() => fullscreen.restore())

  /** The guard on a page, which then goes to each of these in turn. */
  const visiting = (...pathnames: string[]) => {
    const [first, ...rest] = pathnames
    jest.mocked(usePathname).mockReturnValue(first)
    const view = render(<FullscreenGuard />)
    for (const pathname of rest) {
      jest.mocked(usePathname).mockReturnValue(pathname)
      view.rerender(<FullscreenGuard />)
    }
    return view
  }

  it('renders nothing', () => {
    const { container } = visiting('/characters/c1')

    expect(container).toBeEmptyDOMElement()
  })

  it.each([
    ['the back arrow to the list', '/characters/c1', '/characters'],
    [
      "the Gamemaster's back arrow",
      '/campaigns/c1/characters/thorin',
      '/campaigns',
    ],
    ['a party page for home', '/characters/c1/party/company', '/'],
  ])(
    'ends full screen on leaving the pages a game fills, by %s',
    (_name, from, to) => {
      act(() => fullscreen.change(document.documentElement))
      visiting(from, to)

      expect(fullscreen.exitFullscreen).toHaveBeenCalledTimes(1)
    },
  )

  it.each([
    [
      'a character to its party',
      '/characters/c1',
      '/characters/c1/party/company',
    ],
    [
      'a party back to its character',
      '/characters/c1/party/company',
      '/characters/c1',
    ],
    [
      "the Gamemaster's character to its party",
      '/campaigns/c1/characters/thorin',
      '/campaigns/c1/party/company',
    ],
  ])('keeps full screen from %s', (_name, from, to) => {
    act(() => fullscreen.change(document.documentElement))
    visiting(from, to)

    expect(fullscreen.exitFullscreen).not.toHaveBeenCalled()
  })

  it('leaves alone an element another feature made full screen', () => {
    act(() => fullscreen.change(document.body))
    visiting('/characters/c1', '/characters')

    expect(fullscreen.exitFullscreen).not.toHaveBeenCalled()
  })

  it('does nothing while nothing fills the screen', () => {
    visiting('/characters/c1', '/characters')

    expect(fullscreen.exitFullscreen).not.toHaveBeenCalled()
  })
})
