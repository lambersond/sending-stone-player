import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable } from '../components/game-table/game-table'
import { TOASTS_KEY } from '@/features/rolling/utils/roll-toasts'
import { useTableView } from '@/features/table/hooks/use-table-view'
import {
  characterSheet,
  manualDiceView,
  mockTableView,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import { posts, rollServer } from '@/utils/test-utils'
import type { Character, TableSeat } from '@/types/character'
import type { TableView } from '@/types/table'

/*
 * The page's one renderer (v0.44): GameTable gives it to the sheet's pane and to the Combat and
 * Chat column beside it, so that every roll on the page tumbles over the whole of it, the chat's
 * dice tray's among them. The 3D dice need WebGL, so the renderer is a stand-in, counted as it's
 * made, ready, each throw counted.
 */
const mockRenderers = jest.fn()
const mockThrows = jest.fn(async () => {})
jest.mock('@lambersond/3d-dice-core', () => ({
  ...jest.requireActual('@lambersond/3d-dice-core'),
  DiceRenderer: jest.fn().mockImplementation(() => {
    mockRenderers()
    return {
      isReady: true,
      subscribe: () => () => {},
      ensure: () => {},
      dispose: () => {},
      roll: mockThrows,
    }
  }),
}))
jest.mock('@/features/table/hooks/use-table-view', () => ({
  useTableView: jest.fn(),
}))

const GAME = 'https://my-game.forge-vtt.com'

const thorin: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: GAME,
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

const view = (fields: Partial<TableView> = {}): TableView =>
  mockTableView({
    sheet: toTableSheet(characterSheet(), GAME),
    rollsToTable: ['ability'],
    ...fields,
  })

const table = (
  initial: TableView,
  fields: { seat?: TableSeat; typing?: boolean } = {},
) => {
  jest
    .mocked(useTableView)
    .mockReturnValue({ view: initial, connection: 'live', readAgain: () => {} })
  return render(
    <GameTable
      character={thorin}
      initialView={initial}
      seat={fields.seat}
      setManualDice={fields.typing ? async () => {} : undefined}
    />,
  )
}

/** The chat, shown from the phone's bottom nav, and its dice tray opened. */
async function openTray(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    within(screen.getByRole('navigation', { name: 'Table' })).getByRole(
      'button',
      { name: /^Chat/ },
    ),
  )
  const chat = within(screen.getByRole('region', { name: 'Chat' }))
  await user.click(chat.getByRole('button', { name: 'Roll dice' }))
  return chat
}

/** 2d6 + 1d8, picked in the tray. */
async function twoD6AndD8(
  user: ReturnType<typeof userEvent.setup>,
  chat: ReturnType<typeof within>,
) {
  for (const size of ['d6', 'd6', 'd8']) {
    await user.click(chat.getByRole('button', { name: `Add a ${size}` }))
  }
}

let answers: Record<string, Record<string, unknown>>

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(TOASTS_KEY, 'off')
  mockRenderers.mockClear()
  mockThrows.mockClear()
  answers = {}
  rollServer(answers)
})

describe('components/game-table, the page’s dice', () => {
  it('throws a roll from the sheet on the page’s one renderer, as before', async () => {
    const user = userEvent.setup()
    table(view())

    const sheet = screen.getByRole('region', { name: 'Character' })
    await user.click(
      within(sheet).getByRole('button', { name: 'Strength check, +4' }),
    )
    await waitFor(() => expect(mockThrows).toHaveBeenCalledTimes(1))
    expect(mockRenderers).toHaveBeenCalledTimes(1)
  })

  it('puts the dice tray in the chat pane itself, with nothing between, as the tray caps its height by its parent’s', () => {
    table(view())
    const chat = screen.getByRole('region', { name: 'Chat' })
    const toggle = within(chat).getByRole('button', { name: 'Roll dice' })
    const panel = document.querySelector(
      `#${CSS.escape(toggle.getAttribute('aria-controls') ?? '')}`,
    )
    // The tray's column, its bar and its panel, which the tray's own test holds to its parent's
    // height less 6rem: a wrapper between it and the pane would leave the cap nothing to measure.
    expect(panel?.parentElement?.parentElement).toBe(chat)
  })

  it('rolls the chat’s dice tray on the same renderer, sends the plain roll and says what the game made of it', async () => {
    const user = userEvent.setup()
    answers['req-1'] = { status: 'done', visible: true, total: 17, rolls: [] }
    table(view({ rollsToTable: ['ability', 'plainRoll'] }))
    const chat = await openTray(user)
    expect(
      chat.getByText('Made in your Gamemaster’s game too, with the same dice.'),
    ).toBeInTheDocument()
    await twoD6AndD8(user, chat)
    await user.click(chat.getByRole('button', { name: 'Roll 2d6 + 1d8' }))

    await waitFor(() => expect(mockThrows).toHaveBeenCalledTimes(1))
    expect(mockRenderers).toHaveBeenCalledTimes(1)
    const [sent] = posts()
    expect(sent.url).toBe('/api/characters/char-1/rolls')
    expect(sent.body).toMatchObject({
      kind: 'plainRoll',
      plainRoll: {
        terms: [
          { faces: 6, count: 2 },
          { faces: 8, count: 1 },
        ],
      },
    })
    const latest = chat.getByRole('status', { name: 'Latest roll' })
    await waitFor(() => expect(latest).toHaveTextContent('At the table: 17'), {
      timeout: 3000,
    })
    expect(latest).toHaveTextContent('Dice (2d6 + 1d8)')
    // Never among the sheet's own rolls.
    expect(
      within(screen.getByRole('region', { name: 'Your rolls' })).queryByText(
        /^Dice/,
      ),
    ).toBeNull()
  })

  it('asks for the dice typed in, with Manual Dice on, by a dialog of its own, and sends them typed', async () => {
    const user = userEvent.setup()
    table(
      manualDiceView(
        { offered: true, on: true },
        {
          sheet: toTableSheet(characterSheet(), GAME),
          rollsToTable: ['ability', 'plainRoll'],
        },
      ),
      { typing: true },
    )
    const chat = await openTray(user)
    await twoD6AndD8(user, chat)
    await user.click(chat.getByRole('button', { name: 'Roll 2d6 + 1d8' }))

    const dialog = within(
      await screen.findByRole('dialog', { name: 'Dice (2d6 + 1d8)' }),
    )
    expect(
      within(dialog.getByRole('group', { name: '2d6' }))
        .getAllByRole('textbox')
        .map(box => box.getAttribute('aria-label')),
    ).toEqual(['d6 1 of 2', 'd6 2 of 2'])
    expect(
      within(dialog.getByRole('group', { name: '+1d8' })).getByRole('textbox'),
    ).toHaveAccessibleName('d8')
    for (const key of ['3', '5', '7']) {
      await user.click(dialog.getByRole('button', { name: key }))
    }
    await user.click(dialog.getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0].body).toMatchObject({
      kind: 'plainRoll',
      dice: [
        { faces: 6, results: [3, 5] },
        { faces: 8, results: [7] },
      ],
      typed: true,
    })
    // Typed in, nothing tumbles.
    expect(mockThrows).not.toHaveBeenCalled()
  })

  it('rolls on the app’s dice alone with a module before 0.43.0, and says why the game makes none', async () => {
    const user = userEvent.setup()
    table(view({ rollsToTable: ['ability', 'formula'] }))
    const chat = await openTray(user)
    expect(
      chat.getByText(
        'Your Gamemaster’s Sending Stone module makes these from version 0.43.0.',
      ),
    ).toBeInTheDocument()
    await user.click(chat.getByRole('button', { name: 'Add a d20' }))
    await user.click(chat.getByRole('button', { name: 'Roll 1d20' }))
    await waitFor(() => expect(mockThrows).toHaveBeenCalledTimes(1))
    expect(chat.getByRole('status', { name: 'Latest roll' })).toHaveTextContent(
      'Dice (1d20)',
    )
    expect(posts()).toHaveLength(0)
  })

  it('rolls as the character at the Gamemaster’s page too, through their seat, named', async () => {
    const user = userEvent.setup()
    const api = '/api/campaigns/c1/characters/actor-thorin'
    table(view({ rollsToTable: ['ability', 'plainRoll'] }), {
      seat: { role: 'gm', api, key: 'gm:c1:thorin' },
    })
    const chat = await openTray(user)
    await user.click(chat.getByRole('button', { name: 'Add a d20' }))
    await user.click(chat.getByRole('button', { name: 'Roll 1d20' }))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]).toMatchObject({
      url: `${api}/rolls`,
      body: { kind: 'plainRoll', label: 'Dice (1d20)' },
    })
  })
})
