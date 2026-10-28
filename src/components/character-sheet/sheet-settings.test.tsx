import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTheme } from 'next-themes'
import { LAYOUTS } from './actions-layout'
import { SheetSettings } from './sheet-settings'
import { TableApiContext } from '@/hooks/use-table-api'
import type { TableSeat } from '@/types/character'

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

/** The switch for damage on its own, among the settings. */
const aloneSwitch = () =>
  within(settings()).getByRole('switch', { name: 'Damage on its own' })

/** A switch's track, which draws it on or off. */
const trackOf = (input: HTMLElement) => input.nextElementSibling as HTMLElement

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
    // Changed on purpose (round 0.39.0 §3.4): the cog has a Help group now, at its end.
    expect(
      within(settings()).queryByRole('group', { name: 'Actions layout' }),
    ).toBeNull()

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

  describe('entering dice results manually, from module 0.32.0', () => {
    const HINT = 'Type in what your own dice show, instead of rolling here.'

    it('M2 shows only where the game lets the player, a switch they turn, described by its hint, never Coming soon', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const { rerender } = render(
        <SheetSettings toasts={{ on: true, onChange: jest.fn() }} />,
      )
      await user.click(cog())
      expect(
        within(settings()).queryByRole('switch', {
          name: 'Enter dice results manually',
        }),
      ).toBeNull()

      rerender(
        <SheetSettings
          toasts={{ on: true, onChange: jest.fn() }}
          manualDice={{ on: false, onChange }}
        />,
      )
      expect(manualSwitch()).not.toBeChecked()
      expect(manualSwitch()).toBeEnabled()
      expect(manualSwitch()).toHaveAccessibleDescription(HINT)
      expect(screen.queryByText(/Coming soon/)).toBeNull()
      await user.click(manualSwitch())
      expect(onChange).toHaveBeenLastCalledWith(true)
      expect(settings()).toBeInTheDocument()

      rerender(
        <SheetSettings
          toasts={{ on: true, onChange: jest.fn() }}
          manualDice={{ on: true, onChange }}
        />,
      )
      expect(manualSwitch()).toBeChecked()
      await user.click(manualSwitch())
      expect(onChange).toHaveBeenLastCalledWith(false)
      expect(onChange).toHaveBeenCalledTimes(2)
      expect(screen.queryByText(/Coming soon/)).toBeNull()
    })

    it('M3 comes after Send to the table and before Roll results, taking focus first only without Send', async () => {
      const user = userEvent.setup()
      const { unmount } = render(
        <SheetSettings
          send={{ on: true, onChange: jest.fn() }}
          manualDice={{ on: false, onChange: jest.fn() }}
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

      // Without Send to the table, it's the first setting, and takes focus.
      render(
        <SheetSettings
          manualDice={{ on: false, onChange: jest.fn() }}
          toasts={{ on: true, onChange: jest.fn() }}
        />,
      )
      await user.click(cog())
      await waitFor(() => expect(manualSwitch()).toHaveFocus())
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
      // The one chosen, small on the accent's tint, in the accent deep enough to read there.
      expect(
        within(results()).getByRole('radio', { name: 'Banner' }),
      ).toHaveClass('bg-primary/10', 'text-primary-text')
      expect(
        within(results()).getByRole('radio', { name: 'Toasts' }),
      ).not.toHaveClass('text-primary-text')
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

  describe('damage on its own, from module 0.36.0', () => {
    const HINT =
      'Damage you roll goes to your Gamemaster’s game with no attack or saving throw made there, for your Gamemaster to apply.'
    const GM_HINT =
      'Damage you roll goes to your game with no attack or saving throw made there, for you to apply.'

    it('shows only with `alone`, right after Send to the table and before Enter dice results manually, a child of it', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const { rerender } = render(
        <SheetSettings
          send={{ on: true, onChange: jest.fn() }}
          manualDice={{ on: false, onChange: jest.fn() }}
        />,
      )
      await user.click(cog())
      expect(
        within(settings()).queryByRole('switch', { name: 'Damage on its own' }),
      ).toBeNull()

      rerender(
        <SheetSettings
          send={{ on: true, onChange: jest.fn() }}
          alone={{ on: false, onChange, disabled: false }}
          manualDice={{ on: false, onChange: jest.fn() }}
          toasts={{ on: true, onChange: jest.fn() }}
        />,
      )
      const send = within(settings()).getByRole('switch', {
        name: 'Send to the table',
      })
      expect(within(settings()).getAllByRole('switch')).toEqual([
        send,
        aloneSwitch(),
        manualSwitch(),
      ])
      expect(aloneSwitch()).toHaveAccessibleName('Damage on its own')
      expect(aloneSwitch()).toHaveAccessibleDescription(HINT)
      expect(aloneSwitch()).toBeEnabled()
      expect(aloneSwitch()).not.toBeChecked()
      // Set in beneath Send to the table, with no rule of its own above it.
      const box = aloneSwitch().closest('label')?.parentElement as HTMLElement
      expect(box).toHaveClass('ml-1', 'border-l', 'border-border', 'pl-4')
      expect(box).not.toHaveClass('border-t', 'pt-3')
      expect(send.closest('label')?.parentElement as HTMLElement).toHaveClass(
        'border-t',
        'pt-3',
      )

      await user.click(aloneSwitch())
      expect(onChange).toHaveBeenCalledWith(true)
      expect(settings()).toBeInTheDocument()
    })

    it('says, where the game takes its choices from module 0.41.0, that they are made as it is rolled', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <SheetSettings
          send={{ on: true, onChange: jest.fn() }}
          alone={{
            on: true,
            onChange: jest.fn(),
            disabled: false,
            choices: true,
          }}
        />,
      )
      await user.click(cog())
      expect(aloneSwitch()).toHaveAccessibleDescription(
        `${HINT} You choose a spell’s level, a weapon’s mode and its ammunition as you roll, and whether to spend what it uses.`,
      )

      // Without them, today's words.
      rerender(
        <SheetSettings
          send={{ on: true, onChange: jest.fn() }}
          alone={{
            on: true,
            onChange: jest.fn(),
            disabled: false,
            choices: false,
          }}
        />,
      )
      expect(aloneSwitch()).toHaveAccessibleDescription(HINT)

      // And while Send to the table is off, only that it must be on first.
      rerender(
        <SheetSettings
          send={{ on: false, onChange: jest.fn() }}
          alone={{
            on: true,
            onChange: jest.fn(),
            disabled: true,
            choices: true,
          }}
        />,
      )
      expect(aloneSwitch()).toHaveAccessibleDescription(
        'Turn on Send to the table first.',
      )
    })

    it('says so in the Gamemaster’s words at their seat, with its choices', async () => {
      const user = userEvent.setup()
      render(
        <TableApiContext
          value={{
            role: 'gm',
            api: '/api/campaigns/c1/characters/a1',
            key: 'gm:c1:a1',
          }}
        >
          <SheetSettings
            send={{ on: true, onChange: jest.fn() }}
            alone={{
              on: true,
              onChange: jest.fn(),
              disabled: false,
              choices: true,
            }}
          />
        </TableApiContext>,
      )
      await user.click(cog())

      expect(aloneSwitch()).toHaveAccessibleDescription(
        `${GM_HINT} You choose a spell’s level, a weapon’s mode and its ammunition as you roll, and whether to spend what it uses.`,
      )
    })

    it("says, at the Gamemaster's seat, that they apply it", async () => {
      const user = userEvent.setup()
      render(
        <TableApiContext
          value={{
            role: 'gm',
            api: '/api/campaigns/c1/characters/a1',
            key: 'gm:c1:a1',
          }}
        >
          <SheetSettings
            send={{ on: true, onChange: jest.fn() }}
            alone={{ on: true, onChange: jest.fn(), disabled: false }}
          />
        </TableApiContext>,
      )
      await user.click(cog())

      expect(aloneSwitch()).toBeChecked()
      expect(aloneSwitch()).toHaveAccessibleDescription(GM_HINT)
    })

    it('is drawn and announced off while Send to the table is off, though it is stored on, saying why', async () => {
      const user = userEvent.setup()
      const onChange = jest.fn()
      const { rerender } = render(
        <SheetSettings
          send={{ on: false, onChange: jest.fn() }}
          alone={{ on: true, onChange, disabled: true }}
        />,
      )
      await user.click(cog())

      expect(aloneSwitch()).toBeDisabled()
      expect(aloneSwitch()).not.toBeChecked()
      expect(aloneSwitch()).toHaveAccessibleDescription(
        'Turn on Send to the table first.',
      )
      expect(aloneSwitch().closest('label')).toHaveClass(
        'cursor-not-allowed',
        'opacity-60',
      )
      expect(aloneSwitch().closest('label')).not.toHaveClass('cursor-pointer')
      expect(trackOf(aloneSwitch())).toHaveClass('bg-border')
      expect(trackOf(aloneSwitch())).not.toHaveClass('bg-primary')
      expect(trackOf(aloneSwitch()).firstElementChild).toHaveClass('left-0.5')
      await user.click(aloneSwitch())
      expect(onChange).not.toHaveBeenCalled()

      // The stored choice comes back once Send to the table is on.
      rerender(
        <SheetSettings
          send={{ on: true, onChange: jest.fn() }}
          alone={{ on: true, onChange, disabled: false }}
        />,
      )
      expect(aloneSwitch()).toBeEnabled()
      expect(aloneSwitch()).toBeChecked()
      expect(aloneSwitch()).toHaveAccessibleDescription(HINT)
      expect(aloneSwitch().closest('label')).toHaveClass('cursor-pointer')
      expect(trackOf(aloneSwitch())).toHaveClass('bg-primary')
      expect(trackOf(aloneSwitch()).firstElementChild).toHaveClass('left-4.5')
    })

    it('gives every switch a label 44 pixels tall', async () => {
      const user = userEvent.setup()
      render(
        <SheetSettings
          send={{ on: true, onChange: jest.fn() }}
          alone={{ on: false, onChange: jest.fn(), disabled: false }}
          manualDice={{ on: false, onChange: jest.fn() }}
        />,
      )
      await user.click(cog())

      const switches = within(settings()).getAllByRole('switch')
      expect(switches).toHaveLength(3)
      for (const each of switches) {
        expect(each.closest('label')).toHaveClass('min-h-11')
      }
    })
  })
  describe('Configure Magical Cookbook (round 0.39.0)', () => {
    it('is offered with `cookbook` alone, last among the settings, so the first still takes focus', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <SheetSettings send={{ on: true, onChange: jest.fn() }} />,
      )
      await user.click(cog())
      expect(
        within(settings()).queryByRole('button', {
          name: 'Configure Magical Cookbook',
        }),
      ).toBeNull()

      rerender(
        <SheetSettings
          send={{ on: true, onChange: jest.fn() }}
          layouts={{
            offered: LAYOUTS.filter(({ id }) => id !== 'columns'),
            layout: 'list',
            choose: jest.fn(),
          }}
          cookbook={{ onOpen: jest.fn() }}
        />,
      )
      const item = within(settings()).getByRole('button', {
        name: 'Configure Magical Cookbook',
      })
      expect(item).toHaveAttribute('aria-haspopup', 'dialog')
      expect(item).toHaveClass('min-h-11')
      // After the Actions layout, and before Help, the settings' last.
      const layout = within(settings()).getByRole('group', {
        name: 'Actions layout',
      })
      const help = within(settings()).getByRole('group', { name: 'Help' })
      expect(layout.compareDocumentPosition(item)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      expect(item.compareDocumentPosition(help)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      )
      await user.keyboard('{Escape}')
      await user.click(cog())
      await waitFor(() =>
        expect(
          within(settings()).getByRole('switch', { name: 'Send to the table' }),
        ).toHaveFocus(),
      )
    })

    it('gives the cog focus, closes the settings, then opens the book', async () => {
      const user = userEvent.setup()
      const onOpenChange = jest.fn()
      const focused: unknown[] = []
      const onOpen = jest.fn(() => {
        // The cog has focus, and the settings have been told to close already, as it opens.
        focused.push(document.activeElement, onOpenChange.mock.lastCall)
      })
      render(
        <SheetSettings cookbook={{ onOpen }} onOpenChange={onOpenChange} />,
      )
      await user.click(cog())
      expect(onOpenChange).toHaveBeenLastCalledWith(true)
      await user.click(
        within(settings()).getByRole('button', {
          name: 'Configure Magical Cookbook',
        }),
      )
      expect(onOpen).toHaveBeenCalledTimes(1)
      expect(focused).toEqual([cog(), [false]])
      expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
      expect(onOpenChange).toHaveBeenLastCalledWith(false)
      expect(cog()).toHaveFocus()
    })

    it('tells its owner as it opens and closes, whether or not the book is offered', async () => {
      const user = userEvent.setup()
      const onOpenChange = jest.fn()
      render(<SheetSettings onOpenChange={onOpenChange} />)
      await user.click(cog())
      expect(onOpenChange.mock.calls).toEqual([[true]])
      await user.keyboard('{Escape}')
      expect(onOpenChange.mock.calls).toEqual([[true], [false]])
      await user.click(cog())
      await user.click(cog())
      expect(onOpenChange.mock.calls).toEqual([
        [true],
        [false],
        [true],
        [false],
      ])
    })
  })

  describe('Help (round 0.39.0)', () => {
    it.each<[string, TableSeat | undefined]>([
      ['a player’s', undefined],
      [
        'the Gamemaster’s',
        { role: 'gm', api: '/api/campaigns/c1/characters/a1', key: 'gm:c1:a1' },
      ],
    ])(
      'ends %s cog with Report a bug and Request a feature, each opening its form in a new tab',
      async (_whose, seat) => {
        const user = userEvent.setup()
        render(
          <TableApiContext value={seat}>
            <SheetSettings
              send={{ on: true, onChange: jest.fn() }}
              cookbook={seat ? undefined : { onOpen: jest.fn() }}
            />
          </TableApiContext>,
        )
        await user.click(cog())
        const help = within(settings()).getByRole('group', { name: 'Help' })
        // Last of all.
        expect(settings().lastElementChild).toBe(help)
        expect(
          within(help)
            .getAllByRole('link')
            .map(link => [
              link.textContent,
              link.getAttribute('href'),
              link.getAttribute('target'),
            ]),
        ).toEqual([
          [
            'Report a bug (opens in a new tab)',
            'https://github.com/lambersond/sending-stone-player/issues/new?template=bug_report.yml',
            '_blank',
          ],
          [
            'Request a feature (opens in a new tab)',
            'https://github.com/lambersond/sending-stone-player/issues/new?template=feature_request.yml',
            '_blank',
          ],
        ])
        // The first setting still takes focus.
        await waitFor(() =>
          expect(
            within(settings()).getByRole('switch', {
              name: 'Send to the table',
            }),
          ).toHaveFocus(),
        )
      },
    )
  })
})
