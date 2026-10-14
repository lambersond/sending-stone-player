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

/** The switch for entering dice results by hand, among the settings. */
const manualSwitch = () =>
  within(settings()).getByRole('switch', {
    name: 'Enter dice results manually',
  })

/** The choice of how rolls show, among the settings. */
const results = () =>
  within(settings()).getByRole('radiogroup', { name: 'Roll results' })

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

  describe('entering dice results manually, from module 0.26.0', () => {
    const HINT = 'Type in what your own dice show, instead of rolling here.'

    it('M2 shows only where the game lets players, off and disabled, marked Coming soon, with its hint', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <SheetSettings toasts={{ on: true, onChange: jest.fn() }} />,
      )
      await user.click(cog())
      expect(
        within(settings()).queryByRole('switch', {
          name: 'Enter dice results manually',
        }),
      ).toBeNull()
      expect(within(settings()).queryByText('Coming soon')).toBeNull()

      rerender(
        <SheetSettings toasts={{ on: true, onChange: jest.fn() }} manualDice />,
      )
      expect(manualSwitch()).not.toBeChecked()
      expect(manualSwitch()).toBeDisabled()
      expect(manualSwitch()).toHaveAccessibleDescription(`Coming soon ${HINT}`)
      // In the light theme, in the accent's deeper shade: the accent on its tint falls short of
      // WCAG AA this small.
      const chip = within(settings()).getByText('Coming soon')
      expect(chip).toHaveClass(
        'rounded-full',
        'text-primary-hover',
        'dark:text-primary',
      )
      expect(chip).not.toHaveClass('text-primary')
      await user.click(manualSwitch())
      expect(manualSwitch()).not.toBeChecked()
      expect(settings()).toBeInTheDocument()
    })

    it('M3 comes after Send to the table and before Roll results, never taking focus', async () => {
      const user = userEvent.setup()
      const { unmount } = render(
        <SheetSettings
          send={{ on: true, onChange: jest.fn() }}
          manualDice
          toasts={{ on: true, onChange: jest.fn() }}
        />,
      )
      await user.click(cog())
      const send = within(settings()).getByRole('switch', {
        name: 'Send to the table',
      })
      expect(within(settings()).getAllByRole('switch')).toEqual([
        send,
        manualSwitch(),
      ])
      expect(manualSwitch().compareDocumentPosition(results())).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      await waitFor(() => expect(send).toHaveFocus())
      unmount()

      // Without Send to the table, the first setting that can change takes it.
      render(
        <SheetSettings manualDice toasts={{ on: true, onChange: jest.fn() }} />,
      )
      await user.click(cog())
      await waitFor(() =>
        expect(
          within(results()).getByRole('radio', { name: 'Toasts' }),
        ).toHaveFocus(),
      )
    })
  })

  describe('roll results', () => {
    const TOASTS =
      'Each roll pops up at the top of the screen for 4 seconds; one you need to act on stays until you do.'
    const BANNER = 'Your rolls stay in a banner at the bottom of the sheet.'

    it('S1 offers toasts or the banner, one of them, saying more of the one chosen, staying open', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const { rerender } = render(
        <SheetSettings toasts={{ on: true, onChange }} />,
      )
      await user.click(cog())

      const [toasts, banner] = within(results()).getAllByRole('radio')
      expect(toasts).toHaveAccessibleName('Toasts')
      expect(banner).toHaveAccessibleName('Banner')
      expect(toasts).toHaveAttribute('aria-checked', 'true')
      expect(banner).toHaveAttribute('aria-checked', 'false')
      expect(results()).toHaveAccessibleDescription(TOASTS)
      await user.click(banner)
      expect(onChange).toHaveBeenCalledWith(false)
      expect(settings()).toBeInTheDocument()

      rerender(<SheetSettings toasts={{ on: false, onChange }} />)
      expect(
        within(results()).getByRole('radio', { name: 'Banner' }),
      ).toHaveAttribute('aria-checked', 'true')
      expect(
        within(results()).getByRole('radio', { name: 'Toasts' }),
      ).toHaveAttribute('aria-checked', 'false')
      expect(results()).toHaveAccessibleDescription(BANNER)
      await user.click(within(results()).getByRole('radio', { name: 'Toasts' }))
      expect(onChange).toHaveBeenLastCalledWith(true)
      // A segmented control, as the Actions tab's layouts are picked.
      expect(results()).toHaveClass('flex', 'rounded-lg', 'border')
    })

    it('S2 comes after Send to the table and before the theme, captioned Roll results', async () => {
      const user = userEvent.setup()
      render(
        <SheetSettings
          send={{ on: true, onChange: jest.fn() }}
          toasts={{ on: true, onChange: jest.fn() }}
        />,
      )
      await user.click(cog())

      const send = within(settings()).getByRole('switch', {
        name: 'Send to the table',
      })
      expect(within(settings()).getAllByRole('switch')).toEqual([send])
      expect(within(settings()).queryByText('Roll toasts')).toBeNull()
      expect(within(settings()).getByText('Roll results')).toBeInTheDocument()
      const theme = within(settings()).getByRole('radiogroup', {
        name: 'Theme',
      })
      expect(send.compareDocumentPosition(results())).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(results().compareDocumentPosition(theme)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
    })

    it('S3 comes first without Send to the table, taking focus', async () => {
      const user = userEvent.setup()
      render(<SheetSettings toasts={{ on: true, onChange: jest.fn() }} />)
      await user.click(cog())

      await waitFor(() =>
        expect(
          within(results()).getByRole('radio', { name: 'Toasts' }),
        ).toHaveFocus(),
      )
    })
  })
})
