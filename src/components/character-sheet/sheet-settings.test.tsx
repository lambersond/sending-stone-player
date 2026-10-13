import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTheme } from 'next-themes'
import { LAYOUTS } from './actions-layout'
import { SheetSettings } from './sheet-settings'

jest.mock('next-themes', () => ({ useTheme: jest.fn() }))

const setTheme = jest.fn()

/** The cog that opens the settings. */
const cog = () => screen.getByRole('button', { name: 'Settings' })

/** The settings, open. */
const settings = () => screen.getByRole('dialog', { name: 'Settings' })

describe('components/character-sheet/sheet-settings', () => {
  beforeEach(() => {
    jest.mocked(useTheme).mockReturnValue({
      theme: 'system',
      setTheme,
      themes: [],
    })
  })

  it('opens from a cog to the settings, its first one taking focus', async () => {
    const user = userEvent.setup()
    render(<SheetSettings send={{ on: true, onChange: jest.fn() }} />)

    expect(cog()).toHaveAttribute('aria-haspopup', 'dialog')
    expect(cog()).toHaveAttribute('aria-expanded', 'false')
    expect(cog()).toHaveAttribute('title', 'Settings')
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(cog())

    expect(cog()).toHaveAttribute('aria-expanded', 'true')
    const toggle = within(settings()).getByRole('switch', {
      name: 'Send to the table',
    })
    await waitFor(() => expect(toggle).toHaveFocus())
  })

  it("switches this device's rolls to the table or not, as the game takes them", async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    const { rerender } = render(<SheetSettings send={{ on: true, onChange }} />)
    await user.click(cog())

    const toggle = within(settings()).getByRole('switch', {
      name: 'Send to the table',
    })
    expect(toggle).toBeChecked()
    expect(toggle).toHaveAccessibleDescription(
      'Your rolls here are made in your Gamemaster’s game too, with the same dice.',
    )
    await user.click(toggle)
    expect(onChange).toHaveBeenCalledWith(false)

    rerender(<SheetSettings send={{ on: false, onChange }} />)
    expect(
      within(settings()).getByRole('switch', { name: 'Send to the table' }),
    ).not.toBeChecked()

    rerender(<SheetSettings />)
    expect(within(settings()).queryByRole('switch')).toBeNull()
  })

  it('chooses the theme, its first choice taking focus without the switch', async () => {
    const user = userEvent.setup()
    render(<SheetSettings />)
    await user.click(cog())

    const theme = within(settings()).getByRole('radiogroup', { name: 'Theme' })
    const light = within(theme).getByRole('radio', { name: 'Light' })
    await waitFor(() => expect(light).toHaveFocus())
    await user.click(within(theme).getByRole('radio', { name: 'Dark' }))

    expect(setTheme).toHaveBeenCalledWith('dark')
    expect(settings()).toBeInTheDocument()
  })

  it('chooses how the Actions tab is laid out, where the sheet offers more than one', async () => {
    const user = userEvent.setup()
    const choose = jest.fn()
    const offered = LAYOUTS.filter(({ id }) => id !== 'columns')
    const { rerender } = render(<SheetSettings />)
    await user.click(cog())
    expect(within(settings()).queryByRole('group')).toBeNull()

    rerender(
      <SheetSettings
        send={{ on: true, onChange: jest.fn() }}
        layouts={{ offered, layout: 'list', choose }}
      />,
    )
    const picker = within(settings()).getByRole('group', {
      name: 'Actions layout',
    })
    expect(
      within(picker)
        .getAllByRole('button')
        .map(button => [
          button.textContent,
          button.getAttribute('aria-pressed'),
        ]),
    ).toEqual([
      ['List', 'true'],
      ['Table', 'false'],
    ])
    await user.click(within(picker).getByRole('button', { name: 'Table' }))

    expect(choose).toHaveBeenCalledWith('table')
    expect(settings()).toBeInTheDocument()
    // In order: the switch, the theme, then the layout.
    const theme = within(settings()).getByRole('radiogroup', { name: 'Theme' })
    expect(
      within(settings()).getByRole('switch').compareDocumentPosition(theme),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(theme.compareDocumentPosition(picker)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('closes on Escape, giving the cog back its focus', async () => {
    const user = userEvent.setup()
    render(<SheetSettings send={{ on: true, onChange: jest.fn() }} />)
    await user.click(cog())
    const toggle = within(settings()).getByRole('switch')
    await waitFor(() => expect(toggle).toHaveFocus())

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(cog()).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(cog()).toHaveFocus())
  })

  it('closes on a click elsewhere, or on the cog again', async () => {
    const user = userEvent.setup()
    render(
      <>
        <p>Elsewhere</p>
        <SheetSettings />
      </>,
    )

    await user.click(cog())
    await user.click(screen.getByText('Elsewhere'))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(cog())
    expect(settings()).toBeInTheDocument()
    await user.click(cog())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  describe('roll toasts', () => {
    const HINT =
      'Each roll’s result pops up at the top of the screen for 4 seconds. Tap one to clear it.'

    it('S1 switches whether rolls pop up as toasts, staying open', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const { rerender } = render(
        <SheetSettings toasts={{ on: true, onChange }} />,
      )
      await user.click(cog())

      const toggle = within(settings()).getByRole('switch', {
        name: 'Roll toasts',
      })
      expect(toggle).toBeChecked()
      expect(toggle).toHaveAccessibleDescription(HINT)
      await user.click(toggle)
      expect(onChange).toHaveBeenCalledWith(false)
      expect(settings()).toBeInTheDocument()

      rerender(<SheetSettings toasts={{ on: false, onChange }} />)
      expect(
        within(settings()).getByRole('switch', { name: 'Roll toasts' }),
      ).not.toBeChecked()
      await user.click(
        within(settings()).getByRole('switch', { name: 'Roll toasts' }),
      )
      expect(onChange).toHaveBeenLastCalledWith(true)
    })

    it('S2 comes after Send to the table and before the theme, each described by its own hint', async () => {
      const user = userEvent.setup()
      render(
        <SheetSettings
          send={{ on: true, onChange: jest.fn() }}
          toasts={{ on: true, onChange: jest.fn() }}
        />,
      )
      await user.click(cog())

      const [send, toasts] = within(settings()).getAllByRole('switch')
      expect(send).toHaveAccessibleName('Send to the table')
      expect(send).toHaveAccessibleDescription(
        'Your rolls here are made in your Gamemaster’s game too, with the same dice.',
      )
      expect(toasts).toHaveAccessibleName('Roll toasts')
      expect(toasts).toHaveAccessibleDescription(HINT)
      const theme = within(settings()).getByRole('radiogroup', {
        name: 'Theme',
      })
      expect(send.compareDocumentPosition(toasts)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(toasts.compareDocumentPosition(theme)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    })

    it('S3 comes first without Send to the table, taking focus', async () => {
      const user = userEvent.setup()
      render(<SheetSettings toasts={{ on: true, onChange: jest.fn() }} />)
      await user.click(cog())

      const toggle = within(settings()).getByRole('switch', {
        name: 'Roll toasts',
      })
      expect(within(settings()).getAllByRole('switch')).toEqual([toggle])
      await waitFor(() => expect(toggle).toHaveFocus())
    })
  })
})
