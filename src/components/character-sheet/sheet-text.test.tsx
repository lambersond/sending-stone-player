import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DescriptionLinks,
  type DescriptionActions,
} from './description-actions'
import { SheetText } from './sheet-text'

const ORIGIN = { name: 'Second Wind' }

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
      <SheetText characterId='char-1' hash='2b3c4d5e6f7081' origin={ORIGIN} />,
    )

    expect(screen.getByText('Loading…')).toHaveAttribute('aria-busy', 'true')
    expect(await screen.findByText('Take one more action.')).toBeInTheDocument()
    expect(screen.getByText('Take one more action.').parentElement).toHaveClass(
      'sheet-text',
    )
    unmount()

    render(
      <SheetText characterId='char-1' hash='2b3c4d5e6f7081' origin={ORIGIN} />,
    )
    expect(screen.getByText('Take one more action.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('says when it could not load one, and tries again on request', async () => {
    const user = userEvent.setup()
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(false))
      .mockResolvedValueOnce(respond(true, '<p>Bold and hardy.</p>'))
    render(
      <SheetText characterId='char-1' hash='3c4d5e6f708192' origin={ORIGIN} />,
    )

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
      <SheetText characterId='char-1' hash='4d5e6f708192a3' origin={ORIGIN} />,
    )

    unmount()

    const { signal } = jest.mocked(fetch).mock.calls[0][1] as RequestInit
    expect(signal?.aborted).toBe(true)
  })

  it('never shows a description in place of another, while that one loads', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(true, '<p>The first.</p>'))
      .mockReturnValueOnce(new Promise(() => {}))
    const { rerender } = render(
      <SheetText characterId='char-1' hash='5e6f708192a3b4' origin={ORIGIN} />,
    )
    expect(await screen.findByText('The first.')).toBeInTheDocument()

    rerender(
      <SheetText characterId='char-1' hash='6f708192a3b4c5' origin={ORIGIN} />,
    )

    expect(screen.queryByText('The first.')).toBeNull()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('draws a description from before the module marked its links as text, with nothing to act on', async () => {
    const actions: DescriptionActions = {
      roll: jest.fn(),
      rollDamage: jest.fn(),
      rollFormula: jest.fn(),
      takes: () => true,
      ask: jest.fn(),
      abilities: [],
      conditions: [],
      showConditions: jest.fn(),
    }
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        respond(
          true,
          '<p>Make a <span class="roll">DC 15 Dexterity</span> saving throw or take <span class="roll" data-formula="2d6">2d6</span> damage and be <span class="ref">Prone</span>.</p>',
        ),
      )
    render(
      <DescriptionLinks actions={actions}>
        <SheetText characterId='char-1' hash='708192a3b4c5d6' origin={ORIGIN} />
      </DescriptionLinks>,
    )

    expect(await screen.findByText('2d6')).not.toHaveClass('roll')
    expect(screen.getByText('DC 15 Dexterity')).not.toHaveClass('roll')
    expect(screen.getByText('Prone')).toHaveClass('ref')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('shows it loading where there is no browser to draw it with, as on the server', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(true, '<p>Drawn later.</p>'))
    const parser = globalThis.DOMParser
    Reflect.deleteProperty(globalThis, 'DOMParser')
    try {
      render(
        <SheetText
          characterId='char-1'
          hash='8192a3b4c5d6e7'
          origin={ORIGIN}
        />,
      )
      await screen.findByText('Loading…')
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(screen.getByText('Loading…')).toBeInTheDocument()
      expect(screen.queryByText('Drawn later.')).toBeNull()
    } finally {
      globalThis.DOMParser = parser
    }
  })
})
