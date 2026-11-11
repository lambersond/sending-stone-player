import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelpPanel } from './help-panel'
import type { TableView } from '@/types/table'

const view = (fields: Partial<TableView> = {}): TableView => ({
  version: 1,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  connected: true,
  messages: [],
  ...fields,
})

const SECTIONS = [
  'Rolling',
  'Hold for more',
  'Dice tray',
  'Typing in your own dice',
  'Hit points and rests',
  'Combat',
  'Settings',
  'What your Gamemaster turns on',
]

const renderPanel = (fields: { gm?: boolean; shown?: TableView } = {}) =>
  render(
    <HelpPanel
      open
      onClose={jest.fn()}
      gm={fields.gm ?? false}
      name='Thorin'
      playing
      view={fields.shown ?? view()}
      typing={{ on: true }}
    />,
  )

const panel = () => screen.getByRole('dialog', { name: 'Help' })

describe('features/help/components/help-panel', () => {
  afterEach(() => {
    delete (Element.prototype as Partial<Element>).scrollIntoView
  })

  it('opens at its title for the player: the box, then the Go to chips and the eight sections', () => {
    renderPanel({
      shown: view({ rollsToTable: ['skill', 'dice'], laterDice: true }),
    })

    expect(
      screen.getByRole('heading', { level: 2, name: 'Help' }),
    ).toHaveFocus()
    expect(panel()).toHaveTextContent(/^HelpPlaying from Sending Stone/)
    const [box, ...sections] = within(panel()).getAllByRole('region')
    expect(box).toHaveAccessibleName('In this game, for Thorin')
    expect(within(box).getByText('Dice an item rolls later')).toBeVisible()
    const chips = within(
      screen.getByRole('navigation', { name: 'Go to a section' }),
    ).getAllByRole('button')
    expect(chips.map(chip => chip.textContent)).toEqual(SECTIONS)
    expect(
      sections.map(section => within(section).getByRole('heading').textContent),
    ).toEqual(SECTIONS)
    // Shown where the campaign's module asks for those dice (H6 B).
    expect(screen.getByText('Dice an item rolls later.')).toBeVisible()
  })

  it('shows the Gamemaster what their player sees, after the seat’s note, the same words where the game isn’t polling now', () => {
    renderPanel({
      gm: true,
      shown: view({ gm: { rolls: 'off' }, rollsToTable: [], laterDice: true }),
    })

    expect(panel()).toHaveTextContent(/^HelpWhat your player sees/)
    expect(
      screen.getByText(/^At your player’s sheet\. .* you roll as Thorin, /),
    ).toBeVisible()
    expect(
      within(panel())
        .getAllByRole('heading', { level: 3 })
        .map(heading => heading.textContent),
    ).toEqual(['In this game, for Thorin', ...SECTIONS])
    // As the campaign's module said last, at either seat, polling or not (H6 B).
    expect(screen.getByText('Dice an item rolls later.')).toBeVisible()
  })

  it.each([
    ['smoothly', false, 'smooth'],
    ['at once, for reduced motion', true, 'auto'],
  ])(
    'moves focus to a chip’s section heading, and scrolls it to the top %s',
    async (_how, reduced, behavior) => {
      const scrolled = jest.fn()
      Element.prototype.scrollIntoView = scrolled
      jest
        .spyOn(globalThis, 'matchMedia')
        .mockReturnValue({ matches: reduced } as MediaQueryList)
      const user = userEvent.setup()
      renderPanel()

      await user.click(
        screen.getByRole('button', { name: 'Typing in your own dice' }),
      )

      const heading = screen.getByRole('heading', {
        level: 3,
        name: 'Typing in your own dice',
      })
      expect(heading).toHaveFocus()
      expect(scrolled).toHaveBeenCalledTimes(1)
      expect(scrolled.mock.contexts[0]).toBe(heading)
      expect(scrolled).toHaveBeenCalledWith({ block: 'start', behavior })
    },
  )
})
