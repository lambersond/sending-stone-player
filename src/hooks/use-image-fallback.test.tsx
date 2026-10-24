/* eslint-disable unicorn/no-null -- the game's icons use null for none */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useImageFallback } from './use-image-fallback'

/** What the helper last gave the picture, for its ref. */
let given: ReturnType<typeof useImageFallback> | undefined

/** A picture drawn as the components draw theirs: the image while it's shown, else its fallback. */
function Picture({ src }: Readonly<{ src?: string | null }>) {
  const fallback = useImageFallback(src)
  given = fallback
  if (!src || !fallback.shown) return <span>fallback</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={fallback.ref} src={src} alt='' onError={fallback.onError} />
}

const image = () => document.querySelector('img')

/** An image's decode, which jsdom has none of, as a browser's answers it. */
const decodes = (decode: () => Promise<void>) =>
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    writable: true,
    value: decode,
  })

/** Every image as a browser has one once it's done loading, with this width. */
const loaded = (naturalWidth: number) => {
  jest
    .spyOn(HTMLImageElement.prototype, 'complete', 'get')
    .mockReturnValue(true)
  jest
    .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
    .mockReturnValue(naturalWidth)
}

describe('hooks/use-image-fallback', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
    given = undefined
  })

  it('draws the fallback for no address', () => {
    const { rerender } = render(<Picture />)
    expect(given?.shown).toBe(false)
    expect(image()).toBeNull()
    expect(screen.getByText('fallback')).toBeInTheDocument()

    // As a condition's or an entry's icon has none.
    rerender(<Picture src={null} />)
    expect(given?.shown).toBe(false)
    expect(image()).toBeNull()
  })

  it('draws an image with an address, its ref on the image', () => {
    render(<Picture src='https://game/thorin.webp' />)
    expect(given?.shown).toBe(true)
    expect(image()).toHaveAttribute('src', 'https://game/thorin.webp')
    expect(given?.ref.current).toBe(image())
  })

  it('falls back as its error is heard, and tries a new address afresh', () => {
    const { rerender } = render(<Picture src='https://game/thorin.webp' />)
    fireEvent.error(image()!)
    expect(given?.shown).toBe(false)
    expect(image()).toBeNull()

    rerender(<Picture src='https://game/thorin-2.webp' />)
    expect(given?.shown).toBe(true)
    expect(image()).toHaveAttribute('src', 'https://game/thorin-2.webp')
  })

  it('falls back where it failed before it was mounted, its error never heard', async () => {
    // As a page drawn on the server has it: the image done loading and broken before React
    // hydrates, so no error event reaches it.
    loaded(0)
    decodes(() => Promise.reject(new Error('EncodingError')))
    render(<Picture src='https://game/thorin.webp' />)
    expect(await screen.findByText('fallback')).toBeInTheDocument()
    expect(given?.shown).toBe(false)
    expect(image()).toBeNull()
  })

  it('checks an address given once it was mounted, as it does the first', async () => {
    loaded(0)
    decodes(() => Promise.reject(new Error('EncodingError')))
    const { rerender } = render(<Picture />)
    rerender(<Picture src='https://game/thorin.webp' />)
    expect(await screen.findByText('fallback')).toBeInTheDocument()
    expect(image()).toBeNull()
  })

  it('keeps one done loading that decodes with no size of its own, as an SVG may', async () => {
    loaded(0)
    const decode = jest.fn(() => Promise.resolve())
    decodes(decode)
    render(<Picture src='https://game/thorin.svg' />)
    await waitFor(() => expect(decode).toHaveBeenCalled())
    await act(async () => {})
    expect(given?.shown).toBe(true)
    expect(image()).toHaveAttribute('src', 'https://game/thorin.svg')
  })

  it('reads nothing more of one done loading with a size: it has loaded', async () => {
    loaded(64)
    const decode = jest.fn(() => Promise.reject(new Error('EncodingError')))
    decodes(decode)
    render(<Picture src='https://game/thorin.webp' />)
    await act(async () => {})
    expect(decode).not.toHaveBeenCalled()
    expect(image()).toHaveAttribute('src', 'https://game/thorin.webp')
  })

  it('leaves one still loading to its error event', async () => {
    jest
      .spyOn(HTMLImageElement.prototype, 'complete', 'get')
      .mockReturnValue(false)
    jest
      .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
      .mockReturnValue(0)
    const decode = jest.fn(() => Promise.reject(new Error('EncodingError')))
    decodes(decode)
    render(<Picture src='https://game/thorin.webp' />)
    await act(async () => {})
    expect(decode).not.toHaveBeenCalled()
    expect(image()).toHaveAttribute('src', 'https://game/thorin.webp')
  })
})
