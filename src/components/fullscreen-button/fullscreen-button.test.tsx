import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { FullscreenButton } from './fullscreen-button'
import { TABLE_HEADER_BOX } from '@/constants/buttons'
import {
  DESKTOP,
  fakeDevice,
  fakeFullscreen,
  IPHONE,
  PIXEL,
} from '@/mocks/fullscreen'

/** The icon a button shows, by lucide's name for it. */
const iconOf = (button: HTMLElement) =>
  button.querySelector('svg')?.getAttribute('class')

describe('components/game-table/fullscreen-button', () => {
  let fullscreen: ReturnType<typeof fakeFullscreen>
  let device: ReturnType<typeof fakeDevice>
  const on = (
    userAgent: string,
    options: {
      enabled?: boolean
      standalone?: boolean
      displayMode?: 'browser' | 'standalone' | 'fullscreen'
    } = {},
  ) => {
    fullscreen = fakeFullscreen({ enabled: options.enabled ?? true })
    device = fakeDevice({ userAgent, ...options })
  }
  afterEach(() => {
    fullscreen.restore()
    device.restore()
  })

  it('fills the screen, and back, its label and icon following', async () => {
    on(DESKTOP)
    render(<FullscreenButton />)

    const button = screen.getByRole('button', { name: 'Full screen' })
    expect(button).toHaveAttribute('title', 'Full screen')
    expect(button).not.toHaveAttribute('aria-pressed')
    expect(iconOf(button)).toContain('lucide-maximize')

    await userEvent.click(button)
    expect(fullscreen.requestFullscreen).toHaveBeenCalledWith({
      navigationUI: 'hide',
    })
    const exit = await screen.findByRole('button', { name: 'Exit full screen' })
    expect(exit).toHaveAttribute('title', 'Exit full screen')
    expect(iconOf(exit)).toContain('lucide-minimize')

    await userEvent.click(exit)
    expect(fullscreen.exitFullscreen).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByRole('button', { name: 'Full screen' }),
    ).toBeInTheDocument()
  })

  it('follows the page out of full screen however it leaves', async () => {
    on(DESKTOP)
    render(<FullscreenButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Full screen' }))
    await screen.findByRole('button', { name: 'Exit full screen' })

    act(() => fullscreen.change(null))

    expect(
      screen.getByRole('button', { name: 'Full screen' }),
    ).toBeInTheDocument()
  })

  it('explains, on an iPhone, how to add the app to the Home Screen instead', async () => {
    on(IPHONE, { enabled: false, standalone: false })
    render(<FullscreenButton />)

    const button = screen.getByRole('button', { name: 'Full screen' })
    expect(iconOf(button)).toContain('lucide-maximize')
    await userEvent.click(button)

    const modal = screen.getByRole('dialog', { name: 'Full screen on iPhone' })
    const paragraphs = within(modal)
      .getAllByText(/./, { selector: 'p' })
      .map(({ textContent }) => textContent)
    expect(paragraphs).toEqual([
      "iPhone doesn't let websites fill the whole screen. Add Sending Stone to your Home Screen instead: it opens there without Safari's bars.",
      "In Safari, tap Share, then Add to Home Screen, and open Sending Stone from your Home Screen. You'll sign in once more there.",
    ])
    expect(fullscreen.requestFullscreen).not.toHaveBeenCalled()
    // Its own way out, beside the modal's Close.
    expect(
      within(modal).getByRole('button', { name: 'Close' }),
    ).toBeInTheDocument()

    await userEvent.click(within(modal).getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    ['Safari says so', { standalone: true }],
    ['it matches display-mode: fullscreen', { displayMode: 'fullscreen' }],
    ['it matches display-mode: standalone', { displayMode: 'standalone' }],
  ] as const)(
    'shows nothing in the iPhone Home Screen app, where %s',
    (_name, mode) => {
      on(IPHONE, { enabled: false, ...mode })
      const { container } = render(<FullscreenButton />)

      expect(container).toBeEmptyDOMElement()
    },
  )

  it("shows nothing in a browser that can't fill the screen, off an iPhone", () => {
    on(PIXEL, { enabled: false })
    const { container } = render(<FullscreenButton />)

    expect(container).toBeEmptyDOMElement()
  })

  it.each([
    ['an installed Android app', PIXEL, 'standalone'],
    ['an iPad Home Screen app', DESKTOP, 'fullscreen'],
  ] as const)(
    'keeps the toggle in %s, which can fill the screen',
    async (_name, userAgent, displayMode) => {
      on(userAgent, { displayMode })
      render(<FullscreenButton />)

      await userEvent.click(screen.getByRole('button', { name: 'Full screen' }))

      expect(fullscreen.requestFullscreen).toHaveBeenCalledTimes(1)
    },
  )

  it('keeps its room, empty, on the server and until the page hydrates', () => {
    // The icon's own size, from the button once hydrated: lucide's classes aside.
    on(DESKTOP)
    const { unmount } = render(<FullscreenButton />)
    const glyph = iconOf(screen.getByRole('button', { name: 'Full screen' }))
      ?.split(' ')
      .filter(name => !name.startsWith('lucide'))
    unmount()
    fullscreen.restore()
    device.restore()
    // On the server, whatever the device: it can't tell yet.
    on(IPHONE, { enabled: false, standalone: true })

    const page = new DOMParser().parseFromString(
      renderToString(<FullscreenButton />),
      'text/html',
    ).body

    expect(page.children).toHaveLength(1)
    const room = page.firstElementChild
    expect(room?.tagName).toBe('SPAN')
    expect(room?.getAttribute('aria-hidden')).toBe('true')
    expect(room?.getAttribute('class')).toBe(TABLE_HEADER_BOX)
    expect(room?.children).toHaveLength(1)
    expect(room?.firstElementChild?.getAttribute('class')?.split(' ')).toEqual(
      glyph,
    )
    expect(page.querySelector('button')).toBeNull()
  })
})
