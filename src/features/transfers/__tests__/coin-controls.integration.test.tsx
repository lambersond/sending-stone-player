import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CHECK_EVERY } from '@/constants/lifecycle'
import { TOASTS_KEY } from '@/features/rolling/utils/roll-toasts'
import { CharacterPane } from '@/features/sheet/components/character-pane/character-pane'
import { GameTable } from '@/features/table/components/game-table/game-table'
import { useTableView } from '@/features/table/hooks/use-table-view'
import { TableApiContext } from '@/hooks/use-table-api'
import {
  fullerSheet,
  purse,
  shapedSheet,
  tableMoves,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import { advance, respond } from '@/utils/test-utils'
import type { Character, TableSeat } from '@/types/character'
import type { TableMoves } from '@/types/party'
import type { CharacterSheet } from '@/types/sending-stone'
import type { TableView } from '@/types/table'

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock(
  '@lambersond/3d-dice-react',
  () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
)
// The table's view, as a test gives it.
jest.mock('@/features/table/hooks/use-table-view', () => ({
  ...jest.requireActual('@/features/table/hooks/use-table-view'),
  useTableView: jest.fn(),
}))

const GAME = 'https://my-game.forge-vtt.com'

const GM_SEAT: TableSeat = {
  role: 'gm',
  api: '/api/campaigns/c1/characters/actorThorin1',
  key: 'gm:c1:actorThorin1',
}

/** Thorin's sheet, holding these coins: 2 pp and 3 gp unless said. */
const holding = (held: Parameters<typeof purse>[0]): CharacterSheet => {
  const sheet = fullerSheet()
  return fullerSheet({
    inventory: { ...sheet.inventory, currency: purse(held) },
  })
}

/** What a page is given of its campaign: its coins' switch, and where it may move to. */
type Given = {
  coins?: TableView['coins']
  moves?: TableMoves
  sheet?: CharacterSheet
  seat?: TableSeat
}

const pane = ({ coins, moves, sheet, seat }: Given) => {
  const sheetPane = (
    <CharacterPane
      characterId={seat?.key ?? 'char-1'}
      name='Thorin Oakenshield'
      sheet={toTableSheet(sheet ?? holding({ pp: 2, gp: 3 }), GAME)}
      moves={moves}
      coins={coins}
      actorId='actorThorin1'
    />
  )
  return seat ? (
    <TableApiContext value={seat}>{sheetPane}</TableApiContext>
  ) : (
    sheetPane
  )
}

/** A campaign that lets coins be changed, its game paying with other coins, with moves off. */
const CHANGING: Given = { coins: { change: true } }

/** Thorin's sheet on its Inventory tab: its coins changed from here unless said, no moves. */
const renderCoins = async (given = CHANGING, user = userEvent.setup()) => {
  const view = render(pane(given))
  await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
  return {
    user,
    ...view,
    rerenderWith: (next: Given) => view.rerender(pane(next)),
  }
}

/** The Currency row's buttons, as they read, in their order. */
const rowButtons = () =>
  within(screen.getByRole('group', { name: 'Currency' }))
    .getAllByRole('button')
    .map(button => button.textContent)
const changeButton = () => screen.getByRole('button', { name: 'Add or remove' })

/** What was posted, and where. */
const posts = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }))

/** Remove so many gold pieces, in the dialog the row's button opens. */
const removeGold = async (
  user: ReturnType<typeof userEvent.setup>,
  gold: string,
) => {
  await user.click(changeButton())
  const dialog = within(
    screen.getByRole('dialog', { name: 'Add or remove coins' }),
  )
  await user.click(dialog.getByRole('radio', { name: 'Remove' }))
  await user.type(dialog.getByRole('textbox', { name: 'Gold' }), gold)
  return dialog
}

describe('features/transfers/coin-controls, from module 0.49.0', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
    // The tray, not the toasts, which would say the same again.
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
    // Nothing answers, unless a test says.
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
  })

  it('offers Add or remove on the Currency row before Give, with moves off and no coins held too', async () => {
    // Changed on purpose (item give): Send to and Hand out are one Give, after Add or remove.
    const { unmount } = await renderCoins({
      coins: { change: true },
      moves: tableMoves({ handOut: { change: true } }),
    })
    expect(rowButtons()).toEqual(['Add or remove', 'Give'])
    expect(changeButton()).toHaveAttribute('aria-haspopup', 'dialog')
    unmount()

    // Its own switch: there to add to an empty purse, where there's nothing to give.
    const empty = await renderCoins({
      coins: { change: false },
      moves: tableMoves({ handOut: { change: false } }),
      sheet: holding({}),
    })
    expect(rowButtons()).toEqual(['Add or remove'])
    empty.unmount()

    // Give with the coins' switch off, as moves have their own, a single copper being a coin to
    // give.
    await renderCoins({
      moves: tableMoves({ handOut: { change: true } }),
      sheet: holding({ cp: 1 }),
    })
    expect(rowButtons()).toEqual(['Give'])
  })

  it('offers none where the campaign lets no coins be changed, nor while the character is transformed', async () => {
    const { unmount } = await renderCoins({ moves: tableMoves() })
    expect(rowButtons()).toEqual(['Give'])
    unmount()

    const shaped = shapedSheet()
    await renderCoins({
      coins: { change: true },
      moves: tableMoves({ handOut: { change: true } }),
      sheet: {
        ...shaped,
        inventory: { ...shaped.inventory, currency: purse({ gp: 3 }) },
      },
    })
    expect(screen.queryByRole('button', { name: 'Add or remove' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Currency' })).toBeNull()
  })

  it('takes coins away through the seat’s API, the tray following it to what the game says it used', async () => {
    jest.useFakeTimers()
    try {
      const answers = [
        { id: 'req-1', status: 'rolling' },
        {
          id: 'req-1',
          status: 'done',
          visible: true,
          rolls: [],
          // As a jsonb column gives it back.
          coins: { currency: { gp: 5 }, op: 'remove', used: { pp: 1 } },
        },
      ]
      jest.mocked(fetch).mockImplementation(async (url, init) => {
        if (init?.method === 'POST') return respond(202, { id: 'req-1' })
        if (url === '/api/characters/char-1/rolls/req-1') {
          return respond(200, answers.length > 1 ? answers.shift() : answers[0])
        }
        return new Promise<Response>(() => {})
      })
      const { user } = await renderCoins(
        {
          coins: { change: true },
          moves: tableMoves({ handOut: { change: true } }),
        },
        userEvent.setup({ advanceTimers: jest.advanceTimersByTime }),
      )
      const dialog = await removeGold(user, '5')
      expect(
        dialog.getByText(
          'You remove 5 gp. You hold only 3 gp, so other coins pay for the rest.',
        ),
      ).toBeVisible()
      await user.click(dialog.getByRole('button', { name: 'Remove coins' }))

      expect(screen.queryByRole('dialog')).toBeNull()
      // A player's change is called nothing, as their page needs no name for it.
      expect(posts()).toEqual([
        {
          url: '/api/characters/char-1/rolls',
          body: {
            kind: 'coins',
            coins: { op: 'remove', currency: { gp: 5 } },
            mode: 0,
            explicit: false,
            extras: [],
            dice: [],
          },
        },
      ])

      await advance(CHECK_EVERY)
      expect(
        screen.getByText('Removing it in your Gamemaster’s game…'),
      ).toBeInTheDocument()
      // Both of the row's wait on it, as the app refuses another change or a move of its coins;
      // and the row says so once, by its label, as a party's does, with no spinner in a button.
      const row = screen.getByRole('group', { name: 'Currency' })
      expect(row).toHaveAttribute('aria-busy', 'true')
      for (const name of ['Add or remove', 'Give']) {
        const button = within(row).getByRole('button', { name })
        expect(button).toBeDisabled()
        expect(button).toHaveAttribute('aria-busy', 'true')
        expect(button.querySelector('svg')).toBeNull()
      }
      expect(
        screen.getByText('Currency').parentElement?.querySelectorAll('svg'),
      ).toHaveLength(1)

      await advance(CHECK_EVERY)
      expect(screen.getByText('Paid 5 gp, using 1 pp')).toBeInTheDocument()
      expect(changeButton()).toBeEnabled()
      expect(row).not.toHaveAttribute('aria-busy')
    } finally {
      jest.useRealTimers()
    }
  })

  // Review round 1 (item give): changing coins rolls nothing, so the change itself shows the tray
  // on a tab that shows it only once something's been done there, as Effects.
  it('shows the tray on Effects once it has removed coins, as changing them rolls nothing', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValue(
        respond(200, {
          id: 'req-1',
          status: 'done',
          visible: true,
          rolls: [],
          coins: { currency: { gp: 5 }, op: 'remove', used: { pp: 1 } },
        }),
      )
    const { user } = await renderCoins()
    const show = (tab: RegExp) =>
      user.click(screen.getByRole('tab', { name: tab }))
    await show(/^Effects/)
    expect(screen.queryByRole('region', { name: 'Your rolls' })).toBeNull()

    await show(/^Inventory/)
    const dialog = await removeGold(user, '5')
    await user.click(dialog.getByRole('button', { name: 'Remove coins' }))
    await show(/^Effects/)
    const tray = screen.getByRole('region', { name: 'Your rolls' })
    expect(
      await within(tray).findByText(
        'Paid 5 gp, using 1 pp',
        {},
        { timeout: 3000 },
      ),
    ).toBeVisible()
  })

  it('changes them as the Gamemaster in the character’s name, called as their page calls it', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValue(
        respond(200, {
          id: 'req-1',
          status: 'done',
          visible: true,
          rolls: [],
          coins: { op: 'add', currency: { gp: 5 }, used: null },
        }),
      )
    const { user } = await renderCoins({
      coins: { change: true },
      seat: GM_SEAT,
    })
    await user.click(changeButton())
    const dialog = within(
      screen.getByRole('dialog', { name: 'Add or remove coins' }),
    )
    await user.click(dialog.getByRole('radio', { name: 'Add' }))
    await user.type(dialog.getByRole('textbox', { name: 'Gold' }), '5')
    expect(dialog.getByText('Thorin Oakenshield adds 5 gp.')).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Add coins' }))

    const [{ url, body }] = posts()
    expect(url).toBe('/api/campaigns/c1/characters/actorThorin1/rolls')
    expect(body).toMatchObject({
      kind: 'coins',
      label: 'Add 5 gp',
      coins: { op: 'add', currency: { gp: 5 } },
    })
    expect(
      await screen.findByText(
        'Thorin Oakenshield received 5 gp',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
  })

  it('leaves the row’s buttons be while an item, not coins, is on its way', async () => {
    const { user } = await renderCoins({
      coins: { change: true },
      moves: tableMoves({ handOut: { change: true } }),
    })
    await user.click(screen.getByText('Plain Ring'))
    await user.click(screen.getByRole('button', { name: 'Give Plain Ring' }))
    const giving = screen.getByRole('dialog', { name: 'Give Plain Ring' })
    await user.click(within(giving).getByRole('button', { name: 'Give' }))

    expect(
      screen.getByRole('button', { name: 'Give Plain Ring' }),
    ).toBeDisabled()
    const row = screen.getByRole('group', { name: 'Currency' })
    expect(row).not.toHaveAttribute('aria-busy')
    for (const name of ['Add or remove', 'Give']) {
      expect(within(row).getByRole('button', { name })).toBeEnabled()
    }
  })

  it('keeps its dialog open as the campaign stops letting coins be changed, and says so of what’s sent', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValue(respond(409, { reason: 'unavailable' }))
    const { user, rerenderWith } = await renderCoins()
    const dialog = await removeGold(user, '1')

    rerenderWith({})
    // Its button is gone; the dialog isn't, with what was typed in it.
    expect(screen.queryByRole('button', { name: 'Add or remove' })).toBeNull()
    expect(dialog.getByText('You remove 1 gp.')).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Remove coins' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      await screen.findByText(
        'Not removed: your Gamemaster’s game isn’t changing coins now',
      ),
    ).toBeInTheDocument()
  })

  describe('at the table', () => {
    const thorin: Character = {
      id: 'char-1',
      name: 'Thorin Oakenshield',
      gameUrl: GAME,
      campaignTitle: 'The Lonely Mountain',
      campaignId: 'c1',
      actorId: 'actorThorin1',
    }
    /** Thorin's view while the game lets his coins be changed and hands them out. */
    const tableView = (fields: Partial<TableView> = {}): TableView => ({
      version: 3,
      live: true,
      campaign: { title: 'The Lonely Mountain' },
      connected: true,
      messages: [],
      sheet: toTableSheet(holding({ pp: 2, gp: 3 }), GAME),
      sheetVersion: 'v1',
      moves: tableMoves({ handOut: { change: true } }),
      coins: { change: true },
      ...fields,
    })
    const renderTable = async (shown: TableView) => {
      jest.mocked(useTableView).mockReturnValue({
        view: shown,
        connection: 'live',
        readAgain: () => {},
      })
      const user = userEvent.setup()
      render(<GameTable character={thorin} initialView={shown} />)
      await user.click(screen.getByRole('tab', { name: /^Inventory/ }))
    }

    it('offers the row’s buttons from what the table’s view says of coins and moves', async () => {
      await renderTable(tableView())
      expect(rowButtons()).toEqual(['Add or remove', 'Give'])
    })

    it('offers none at a character no longer in the game, whatever its view says', async () => {
      await renderTable(tableView({ connected: false }))
      expect(screen.queryByRole('button', { name: 'Add or remove' })).toBeNull()
      expect(screen.queryByRole('group', { name: 'Currency' })).toBeNull()
    })
  })
})
