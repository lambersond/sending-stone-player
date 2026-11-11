import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTheme } from 'next-themes'
import { GameTable } from '../components/game-table/game-table'
import { useTableView } from '@/features/table/hooks/use-table-view'
import { characterSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { Character, TableSeat } from '@/types/character'
import type { TableView } from '@/types/table'

// Help (ROADMAP item 12) on a character's page: opened from the header's button and from every
// cog's How to use Sending Stone, the page's one panel, focus going back to what opened it; its
// box reading the page's own view and switches.

jest.mock('@/features/table/hooks/use-table-view', () => ({
  useTableView: jest.fn(),
}))
jest.mock('next-themes', () => ({ useTheme: jest.fn() }))
// The 3D dice need WebGL; the sheet rolls without them.
jest.mock(
  '@lambersond/3d-dice-react',
  () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
)

const GAME = 'https://my-game.forge-vtt.com'

const character: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: GAME,
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'thorin',
}

/** Thorin's view, his game taking checks and saves, and letting him type in his dice. */
const view = (fields: Partial<TableView> = {}): TableView => ({
  version: 3,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  connected: true,
  messages: [],
  sheet: toTableSheet(characterSheet(), GAME),
  sheetVersion: 'v1',
  rollsToTable: ['skill', 'save'],
  manualDice: { offered: true, on: false },
  ...fields,
})

const renderTable = (shown: TableView, seat?: TableSeat) => {
  jest.mocked(useTableView).mockReturnValue({ view: shown, connection: 'live' })
  return render(
    <GameTable
      character={character}
      initialView={shown}
      seat={seat}
      markChatRead={jest.fn(async () => {})}
      setManualDice={jest.fn(async () => {})}
    />,
  )
}

const help = () => screen.getByRole('dialog', { name: 'Help' })
/** What the box says of a row. */
const says = (label: string) =>
  within(help()).getByText(label, { selector: 'dt' }).nextSibling?.textContent

describe('components/game-table, Help', () => {
  beforeEach(() => {
    jest
      .mocked(useTheme)
      .mockReturnValue({ theme: 'system', setTheme: jest.fn(), themes: [] })
  })

  it('opens from the header’s button at its title, its box reading the page, and gives the button focus back', async () => {
    const user = userEvent.setup()
    renderTable(view())
    const button = screen.getByRole('button', { name: 'Help' })

    await user.click(button)
    expect(
      within(help()).getByRole('heading', { level: 2, name: 'Help' }),
    ).toHaveFocus()
    expect(says('Your rolls')).toBe('Made in your Gamemaster’s game too')
    // The player's own switch, as the page holds it.
    expect(says('Typing in your dice')).toBe('Allowed: turn it on in Settings')

    await user.click(within(help()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Help' })).toBeNull()
    expect(button).toHaveFocus()
  })

  it('opens from the cog’s How to use Sending Stone, the same panel, and gives the cog focus back on Escape', async () => {
    const user = userEvent.setup()
    renderTable(view())
    const cog = screen.getByRole('button', { name: 'Settings' })

    await user.click(cog)
    await user.click(
      screen.getByRole('button', { name: 'How to use Sending Stone' }),
    )
    expect(screen.getAllByRole('dialog', { name: 'Help' })).toHaveLength(1)
    // Read on: Combat's heading takes focus from its chip.
    await user.click(within(help()).getByRole('button', { name: 'Combat' }))
    expect(
      within(help()).getByRole('heading', { level: 3, name: 'Combat' }),
    ).toHaveFocus()
    // The browser closes the dialog on Escape, then tells it so.
    const dialog = help() as HTMLDialogElement
    dialog.open = false
    fireEvent(dialog, new Event('close'))

    expect(screen.queryByRole('dialog', { name: 'Help' })).toBeNull()
    expect(cog).toHaveFocus()
  })

  it('shows the Gamemaster what their player sees, with where their own rolls go', async () => {
    const user = userEvent.setup()
    renderTable(view({ manualDice: undefined, gm: { rolls: 'made' } }), {
      role: 'gm',
      api: '/api/campaigns/c1/characters/thorin',
      key: 'gm:c1:thorin',
    })

    await user.click(screen.getByRole('button', { name: 'Help' }))
    expect(within(help()).getByText('What your player sees')).toBeVisible()
    expect(says('Your rolls here')).toBe(
      'Made in your game as Thorin, marked GM',
    )
  })
})
