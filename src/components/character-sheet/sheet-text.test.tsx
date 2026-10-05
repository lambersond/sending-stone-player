import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SheetText } from './sheet-text'

const respond = (ok: boolean, html = '') =>
  ({ ok, status: ok ? 200 : 404, json: async () => ({ html }) }) as Response

describe('components/character-sheet/sheet-text', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn()
  })

  it('loads a description, then shows it again at once', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(true, '<p>Take one more action.</p>'))
    const { unmount } = render(
      <SheetText characterId='char-1' hash='2b3c4d5e6f7081' />,
    )

    expect(screen.getByText('Loading…')).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByText('Take one more action.')).toBeInTheDocument()
    expect(screen.getByText('Take one more action.').parentElement).toHaveClass(
      'sheet-text',
    )
    unmount()

    render(<SheetText characterId='char-1' hash='2b3c4d5e6f7081' />)
    expect(screen.getByText('Take one more action.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('says when it could not load one, and tries again on request', async () => {
    const user = userEvent.setup()
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(false))
      .mockResolvedValueOnce(respond(true, '<p>Bold and hardy.</p>'))
    render(<SheetText characterId='char-1' hash='3c4d5e6f708192' />)

    expect(
      await screen.findByText(
        /Couldn’t load the description|Couldn't load the description/,
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Bold and hardy.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('stops loading one no longer shown', () => {
    jest.mocked(fetch).mockReturnValueOnce(new Promise(() => {}))
    const { unmount } = render(
      <SheetText characterId='char-1' hash='4d5e6f708192a3' />,
    )

    unmount()

    const { signal } = jest.mocked(fetch).mock.calls[0][1] as RequestInit
    expect(signal?.aborted).toBe(true)
  })
})
