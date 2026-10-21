import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable } from './game-table'
import { useTableView } from '@/hooks/use-table-view'
import {
  fullerSheet,
  removalInventory,
  removingTableView,
} from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { Character, TableSeat } from '@/types/character'
import type { CharacterSheet } from '@/types/sending-stone'
import type { TableView } from '@/types/table'

// Remove…, from module 0.33.0, wired from the table's view through the pane to what's sent and
// followed: for the character's player and for the Gamemaster at its page.

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

/** Thorin's things, as the removal stand-ins have them, and his handaxe, which rolls. */
const removalSheet = (): CharacterSheet => {
  const fuller = fullerSheet()
  const [weapons] = fuller.inventory.sections
  const inventory = removalInventory()
  return fullerSheet({
    inventory: {
      ...inventory,
      sections: [
        {
          ...weapons,
          items: [
            {
              ...weapons.items[1],
              activation: '1 Action',
              toHit: 7,
              attackId: 'handaxeAttack',
              damage: [
                { formula: '1d6 + 4', type: 'Slashing', healing: false },
              ],
            },
          ],
        },
        ...inventory.sections,
      ],
    },
  })
}

const thorin: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: GAME,
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actorThorin1',
}
const GM_SEAT: TableSeat = {
  role: 'gm',
  api: '/api/campaigns/c1/characters/actorThorin1',
  key: 'gm:c1:actorThorin1',
}

const tableView = (fields: Partial<TableView> = {}): TableView =>
  removingTableView({
    sheet: toTableSheet(removalSheet(), GAME),
    sheetVersion: 'v1',
    ...fields,
  })

const renderTable = async (shown: TableView, seat?: TableSeat) => {
  jest.mocked(useTableView).mockReturnValue({ view: shown, connection: 'live' })
  const user = userEvent.setup()
  render(
    <GameTable
      character={seat ? { ...thorin, id: seat.key } : thorin}
      initialView={shown}
      seat={seat}
    />,
  )
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

/** An item's row in a section of the Inventory tab, by its name: its summary, or the row. */
const rowOf = (section: string, name: string) => {
  const item = within(screen.getByRole('region', { name: section }))
    .getByText(name)
    .closest('li') as HTMLElement
  return (item.querySelector(':scope > details > summary') ??
    item.firstElementChild) as HTMLElement
}

/** Opens Remove… for a row, from its menu, and the dialog it opens. */
const removeFrom = async (
  user: ReturnType<typeof userEvent.setup>,
  row: HTMLElement,
  title: string,
) => {
  fireEvent.contextMenu(row, { button: 2 })
  await user.click(screen.getByRole('menuitem', { name: 'Remove…' }))
  return screen.getByRole('dialog', { name: title })
}

/** The game's answers to a removal: taken, then as given. */
const answering = (...answers: object[]) =>
  jest.mocked(fetch).mockImplementation(async (url, init) => {
    if (init?.method === 'POST') return respond(202, { id: 'req-1' })
    if (String(url).endsWith('/rolls/req-1')) {
      return respond(200, answers.length > 1 ? answers.shift() : answers[0])
    }
    // An opened row's description, which never comes.
    return new Promise<Response>(() => {})
  })
const removed = (item: string, quantity: number) => ({
  id: 'req-1',
  status: 'done',
  visible: true,
  rolls: [],
  removed: { item, quantity },
})

describe('components/game-table, removing an item, from module 0.33.0', () => {
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

  it('removes part of a stack through the seat, with moves off, closing at once and saying so in the tray', async () => {
    answering(removed('potionThorin', 2))
    const user = await renderTable(tableView())
    const dialog = await removeFrom(
      user,
      rowOf('Consumables', 'Potion of Healing'),
      'Remove Potion of Healing?',
    )
    await user.click(within(dialog).getByRole('button', { name: 'One fewer' }))
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(posts()).toEqual([
      {
        url: '/api/characters/char-1/rolls',
        body: {
          kind: 'remove',
          remove: { item: 'potionThorin', quantity: 2, held: 3 },
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
      },
    ])
    expect(
      await screen.findByText(
        'Removed 2 Potion of Healing',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
  })

  it('never says a removal was typed in, whatever the device does of dice', async () => {
    const user = await renderTable(
      tableView({ manualDice: { offered: true, on: true } }),
    )
    const dialog = await removeFrom(user, rowOf('Loot', 'Rope'), 'Remove Rope?')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
    expect(posts()[0].body).not.toHaveProperty('typed')
    expect(posts()[0].body).not.toHaveProperty('label')
  })

  it('removes as the Gamemaster in the character’s name, called as their page calls it', async () => {
    answering(removed('ropeThorin01', 1))
    const user = await renderTable(tableView(), GM_SEAT)
    const dialog = await removeFrom(user, rowOf('Loot', 'Rope'), 'Remove Rope?')
    expect(within(dialog).getByText('Thorin removes 1 Rope.')).toBeVisible()
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(posts()).toEqual([
      {
        url: '/api/campaigns/c1/characters/actorThorin1/rolls',
        body: {
          kind: 'remove',
          remove: { item: 'ropeThorin01', quantity: 1, held: 1 },
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
          label: 'Remove 1 Rope',
        },
      },
    ])
    expect(
      await screen.findByText('Thorin removed 1 Rope', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
  })

  it.each([
    [409, 'moving', 'Not removed: it’s on its way already'],
    [422, 'short', 'Not removed: you haven’t that many'],
    [422, 'changed', 'Not removed: how many there are has changed. Try again'],
    [
      409,
      'unavailable',
      'Not removed: your Gamemaster’s game can’t remove items now',
    ],
  ])(
    'says why the app turned it away: %s %s',
    async (status, reason, words) => {
      jest.mocked(fetch).mockResolvedValue(respond(status, { reason }))
      const user = await renderTable(tableView())
      const dialog = await removeFrom(
        user,
        rowOf('Loot', 'Rope'),
        'Remove Rope?',
      )
      await user.click(within(dialog).getByRole('button', { name: 'Remove' }))
      expect(await screen.findByText(words)).toBeInTheDocument()
    },
  )

  it('gives the row focus before the dialog opens, for the browser to give it back: a summary, and an item that rolls’ name', async () => {
    const user = await renderTable(tableView())
    const focus = jest.spyOn(HTMLElement.prototype, 'focus')
    const showModal = jest.spyOn(HTMLDialogElement.prototype, 'showModal')
    /** Whether the row was focused, since so many calls, before the dialog last opened. */
    const focusedFirst = (row: HTMLElement, since: number) =>
      focus.mock.contexts.some(
        (focused, index) =>
          index >= since &&
          focused === row &&
          focus.mock.invocationCallOrder[index] <
            showModal.mock.invocationCallOrder.at(-1)!,
      )

    const backpack = rowOf('Containers', 'Backpack')
    expect(backpack.tagName).toBe('SUMMARY')
    await removeFrom(user, backpack, 'Remove Backpack?')
    expect(focusedFirst(backpack, 0)).toBe(true)
    expect(backpack).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    const handaxe = screen.getByRole('button', {
      name: /^Handaxe/,
      expanded: false,
    })
    const since = focus.mock.calls.length
    await removeFrom(user, handaxe, 'Remove Handaxe?')
    expect(focusedFirst(handaxe, since)).toBe(true)
    expect(handaxe).toHaveFocus()
  })

  it.each([
    ['the game removes nothing', { removes: undefined }],
    ['the character is no longer in the game', { connected: false }],
  ])('offers no Remove… where %s', async (_name, fields) => {
    await renderTable(tableView(fields))
    expect(fireEvent.contextMenu(rowOf('Loot', 'Rope'), { button: 2 })).toBe(
      true,
    )
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
