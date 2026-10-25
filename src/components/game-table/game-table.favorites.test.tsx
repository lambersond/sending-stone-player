/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable } from './game-table'
import { useTableView } from '@/hooks/use-table-view'
import {
  favoritedResult,
  favoritingTableView,
  fullerSheet,
  removalInventory,
} from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { Character } from '@/types/character'
import type { SheetFavorite } from '@/types/sending-stone'
import type { TableView } from '@/types/table'

// Add to favorites and Remove from favorites, from module 0.37.0, wired from the table's view
// through the pane to what's sent and followed, at the character's player's seat.

jest.mock('@/hooks/use-table-view', () => ({
  ...jest.requireActual('@/hooks/use-table-view'),
  useTableView: jest.fn(),
}))
// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const GAME = 'https://my-game.forge-vtt.com'

const thorin: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: GAME,
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actorThorin1',
}

/** The Rope made a favorite, as the module sends it, with no picture. */
const ROPE: SheetFavorite = {
  type: 'item',
  id: 'ropeThorin01',
  itemType: 'loot',
  name: 'Rope',
  img: null,
}

/** Thorin's table view while the game takes his favorites, with these his favorites. */
const tableView = (
  fields: Partial<TableView> = {},
  favorites: SheetFavorite[] = [],
): TableView =>
  favoritingTableView({
    sheet: toTableSheet(
      fullerSheet({ inventory: removalInventory(), favorites }),
      GAME,
    ),
    sheetVersion: 'v1',
    ...fields,
  })

const renderTable = async (shown: TableView) => {
  jest.mocked(useTableView).mockReturnValue({ view: shown, connection: 'live' })
  const user = userEvent.setup()
  render(<GameTable character={thorin} initialView={shown} />)
  await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
  return user
}

const respond = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response

/** What was posted, and where: never a description an opened row loads. */
const posts = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }))

/** The Rope's row on the Inventory tab. */
const ropeRow = () => {
  const item = within(screen.getByRole('region', { name: 'Loot' }))
    .getByText('Rope')
    .closest('li') as HTMLElement
  return (item.querySelector(':scope > details > summary') ??
    item.firstElementChild) as HTMLElement
}

/** The game's answer to a favorite: taken, then as given. */
const answering = (answer: object) =>
  jest.mocked(fetch).mockImplementation(async (url, init) => {
    if (init?.method === 'POST') return respond(202, { id: 'req-1' })
    if (String(url).endsWith('/rolls/req-1')) return respond(200, answer)
    // An opened row's description, which never comes.
    return new Promise<Response>(() => {})
  })

describe('components/game-table, favorites from the app, from module 0.37.0', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
    // The tray, not the toasts, which would say the same again.
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
    // Nothing answers, unless a test says.
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('adds an item to the favorites from its row through the seat, with Send to the table off, saying so in the tray', async () => {
    answering(favoritedResult({ id: 'req-1' }))
    const user = await renderTable(tableView())
    fireEvent.contextMenu(ropeRow(), { button: 2 })
    const menu = screen.getByRole('menu', { name: 'Rope' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(item => item.textContent),
    ).toEqual(['Add to favorites'])
    await user.click(within(menu).getByRole('menuitem'))

    expect(posts()).toEqual([
      {
        url: '/api/characters/char-1/rolls',
        body: {
          kind: 'favorite',
          favorite: { type: 'item', id: 'ropeThorin01', op: 'add' },
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
      },
    ])
    expect(
      await screen.findByText('Added to favorites', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
  })

  it('removes one of the favorites as the sheet has them', async () => {
    const user = await renderTable(tableView({}, [ROPE]))
    fireEvent.contextMenu(ropeRow(), { button: 2 })
    await user.click(
      within(screen.getByRole('menu', { name: 'Rope' })).getByRole('menuitem', {
        name: 'Remove from favorites',
      }),
    )
    expect(posts()).toEqual([
      expect.objectContaining({
        body: expect.objectContaining({
          kind: 'favorite',
          favorite: { type: 'item', id: 'ropeThorin01', op: 'remove' },
        }),
      }),
    ])
  })

  it.each([
    ['the game takes no favorites', { favorites: undefined }],
    ['the character is no longer in the game', { connected: false }],
  ])('offers no favorites entry where %s', async (_name, fields) => {
    await renderTable(tableView(fields))
    expect(fireEvent.contextMenu(ropeRow(), { button: 2 })).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
