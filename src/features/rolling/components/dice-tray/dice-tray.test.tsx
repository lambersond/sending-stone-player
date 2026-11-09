import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiceTray } from './dice-tray'
import { rollServer } from '@/utils/test-utils'

// No WebGL here: the renderer is never ready, so each roll lands at once, on the app's own dice;
// but for a suite's renderer made ready, whose dice land when it says.
const mockRenderer = { isReady: false, roll: jest.fn() }
jest.mock('@lambersond/3d-dice-react', () => ({
  ...jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
  useDiceRenderer: () => mockRenderer,
}))

const SIZES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

const tray = () =>
  render(
    <DiceTray
      characterId='char-1'
      kinds={['skill', 'formula', 'plainRoll']}
      typing={false}
    />,
  )

const toggle = () => screen.getByRole('button', { name: 'Roll dice' })
const add = (size: string) =>
  screen.getByRole('button', { name: `Add a ${size}` })

beforeEach(() => {
  localStorage.clear()
  mockRenderer.isReady = false
  mockRenderer.roll.mockReset()
  rollServer()
})

describe('features/rolling/components/dice-tray', () => {
  it('opens and closes from its bar, closed at first, its dice kept between', async () => {
    const user = userEvent.setup()
    tray()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('group', { name: 'Add a die' })).toBeNull()

    await user.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    await user.click(add('d6'))
    await user.click(toggle())
    expect(screen.queryByRole('group', { name: 'Add a die' })).toBeNull()
    await user.click(toggle())
    expect(
      within(screen.getByRole('list', { name: 'Dice to roll' })).getByText(
        '1d6',
      ),
    ).toBeInTheDocument()
  })

  it('has a button for each size, d4 to d100, each showing its size and its shape', async () => {
    const user = userEvent.setup()
    tray()
    await user.click(toggle())
    const sizes = within(screen.getByRole('group', { name: 'Add a die' }))
      .getAllByRole('button')
      .map(button => [button.textContent, button.querySelector('svg') !== null])
    expect(sizes).toEqual(SIZES.map(size => [size, true]))
    expect(screen.getByText(/^Tap a die to add it/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Pick dice to roll' }),
    ).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Clear' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('shows the dice picked as chips with one fewer and one more, the number added, and Roll naming them', async () => {
    const user = userEvent.setup()
    tray()
    await user.click(toggle())
    await user.click(add('d8'))
    await user.click(add('d6'))
    await user.click(screen.getByRole('button', { name: 'One d6 more' }))
    await user.click(screen.getByRole('button', { name: 'Raise the modifier' }))

    const chips = within(screen.getByRole('list', { name: 'Dice to roll' }))
    expect(
      chips.getAllByRole('listitem').map(chip => chip.textContent),
    ).toEqual(['2d6', '1d8'])
    expect(
      within(screen.getByRole('group', { name: 'Modifier' })).getByText('+1'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Roll 2d6 + 1d8 + 1' }),
    ).not.toHaveAttribute('aria-disabled', 'true')

    await user.click(screen.getByRole('button', { name: 'One d8 fewer' }))
    expect(chips.getAllByRole('listitem')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.queryByRole('list', { name: 'Dice to roll' })).toBeNull()
    expect(
      within(screen.getByRole('group', { name: 'Modifier' })).getByText('+0'),
    ).toBeInTheDocument()
  })

  it('keeps keyboard focus as the last die of a size goes with its chip: on the next chip, else the one before, else that size’s add', async () => {
    const user = userEvent.setup()
    tray()
    await user.click(toggle())
    for (const size of ['d6', 'd8', 'd20']) await user.click(add(size))
    const fewer = (size: string) =>
      screen.getByRole('button', { name: `One ${size} fewer` })

    fewer('d8').focus()
    await user.keyboard('{Enter}')
    expect(fewer('d20')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(fewer('d6')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('list', { name: 'Dice to roll' })).toBeNull()
    expect(add('d6')).toHaveFocus()
  })

  it('says, at 20 dice, that it takes no more, on every way to add one', async () => {
    const user = userEvent.setup()
    tray()
    await user.click(toggle())
    for (let die = 0; die < 20; die++) await user.click(add('d20'))
    expect(add('d4')).toHaveAttribute('aria-disabled', 'true')
    expect(add('d4')).toHaveAccessibleDescription('At most 20 dice')
    expect(
      screen.getByRole('button', { name: 'One d20 more' }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('says the latest roll as it lands, and where the game makes it', async () => {
    const user = userEvent.setup()
    tray()
    await user.click(toggle())
    await user.click(add('d100'))
    await user.click(screen.getByRole('button', { name: 'Roll 1d100' }))
    await waitFor(() =>
      expect(
        screen.getByRole('status', { name: 'Latest roll' }),
      ).toHaveTextContent('Dice (1d100)'),
    )
    expect(
      screen.getByText(
        'Made in your Gamemaster’s game too, with the same dice.',
      ),
    ).toBeInTheDocument()
    // Its dice kept for the next roll.
    expect(
      screen.getByRole('button', { name: 'Roll 1d100' }),
    ).toBeInTheDocument()
  })

  it('says "Rolling…" while its dice tumble over the page, then the roll once they land', async () => {
    const user = userEvent.setup()
    const dice: { land?: () => void } = {}
    mockRenderer.isReady = true
    mockRenderer.roll.mockReturnValue(
      new Promise<void>(resolve => {
        dice.land = resolve
      }),
    )
    tray()
    await user.click(toggle())
    await user.click(add('d20'))
    await user.click(screen.getByRole('button', { name: 'Roll 1d20' }))

    const latest = screen.getByRole('status', { name: 'Latest roll' })
    await waitFor(() => expect(latest).toHaveTextContent('Rolling…'))
    expect(latest).not.toHaveTextContent('Dice (1d20)')
    act(() => dice.land?.())
    await waitFor(() => expect(latest).toHaveTextContent('Dice (1d20)'))
    expect(latest).not.toHaveTextContent('Rolling…')
  })
})
