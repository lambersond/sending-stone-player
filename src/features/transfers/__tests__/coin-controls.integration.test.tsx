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
const changeButton = () =>
  screen.getByRole('button', { name: 'Add or take away' })

/** What was posted, and where. */
const posts = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }))

/** Take away so many gold pieces, in the dialog the row's button opens. */
const takeAway = async (
  user: ReturnType<typeof userEvent.setup>,
  gold: string,
) => {
  await user.click(changeButton())
  const dialog = within(
    screen.getByRole('dialog', { name: 'Add or take away coins' }),
  )
  await user.click(dialog.getByRole('radio', { name: 'Take away' }))
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

  it('offers Add or take away on the Currency row before Send to, and Hand out after it, with moves off and no coins held too', async () => {
    const { unmount } = await renderCoins({
      coins: { change: true },
      moves: tableMoves({ handOut: { change: true } }),
    })
    expect(rowButtons()).toEqual(['Add or take away', 'Send to', 'Hand out'])
    expect(changeButton()).toHaveAttribute('aria-haspopup', 'dialog')
    unmount()

    // Its own switch: there to add to an empty purse, where there's nothing to send or hand out.
    const empty = await renderCoins({
      coins: { change: false },
      moves: tableMoves({ handOut: { change: false } }),
      sheet: holding({}),
    })
    expect(rowButtons()).toEqual(['Add or take away'])
    empty.unmount()

    // Hand out with the coins' switch off, as moves have their own, a single copper being a coin
    // to hand out: but only where the module hands coins out, and there's another character to
    // hand them to.
    const moving = await renderCoins({
      moves: tableMoves({ handOut: { change: true } }),
      sheet: holding({ cp: 1 }),
    })
    expect(rowButtons()).toEqual(['Send to', 'Hand out'])
    moving.unmount()
    await renderCoins({
      coins: { change: true },
      moves: tableMoves({ handOut: { change: true }, characters: [] }),
    })
    expect(rowButtons()).toEqual(['Add or take away', 'Send to'])
  })

  it('offers none where the campaign lets no coins be changed, nor while the character is transformed', async () => {
    const { unmount } = await renderCoins({ moves: tableMoves() })
    expect(rowButtons()).toEqual(['Send to'])
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
    expect(
      screen.queryByRole('button', { name: 'Add or take away' }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send to' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hand out' })).toBeNull()
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
      const dialog = await takeAway(user, '5')
      expect(
        dialog.getByText(
          'You take away 5 gp. You hold only 3 gp, so other coins pay for the rest.',
        ),
      ).toBeVisible()
      await user.click(dialog.getByRole('button', { name: 'Take away coins' }))

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
        screen.getByText('Taking it away in your Gamemaster’s game…'),
      ).toBeInTheDocument()
      // All three of the row's wait on it, as the app refuses another change or a move of its
      // coins; and the row says so once, by its label, as a party's does, with no spinner in a
      // button.
      const row = screen.getByRole('group', { name: 'Currency' })
      expect(row).toHaveAttribute('aria-busy', 'true')
      for (const name of ['Add or take away', 'Send to', 'Hand out']) {
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
      screen.getByRole('dialog', { name: 'Add or take away coins' }),
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

  it('hands coins out through the seat’s API as a move to each of those ticked, the tray saying what each got and what else the game used', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValue(
        respond(200, {
          id: 'req-1',
          status: 'done',
          visible: true,
          rolls: [],
          transfer: {
            from: 'actorThorin1',
            to: null,
            items: [],
            currency: { gp: 2 },
            each: ['actorVex0001', 'actorBram001'],
            used: { pp: 1 },
          },
        }),
      )
    const { user } = await renderCoins({
      coins: { change: true },
      moves: tableMoves({
        handOut: { change: true },
        characters: [
          { id: 'actorVex0001', name: 'Vex' },
          { id: 'actorBram001', name: 'Bram' },
        ],
      }),
    })
    await user.click(screen.getByRole('button', { name: 'Hand out' }))
    const dialog = within(
      screen.getByRole('dialog', { name: 'Hand out coins' }),
    )
    await user.click(dialog.getByRole('checkbox', { name: 'Select all' }))
    await user.type(dialog.getByRole('textbox', { name: 'Gold' }), '2')
    expect(
      dialog.getByText(
        'You hand out 2 gp each to Vex and Bram: 4 gp in all. You hold only 3 gp, so other coins pay for the rest.',
      ),
    ).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Hand out' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(posts()).toEqual([
      {
        url: '/api/characters/char-1/rolls',
        body: {
          kind: 'transfer',
          transfer: {
            from: 'actorThorin1',
            each: ['actorVex0001', 'actorBram001'],
            currency: { gp: 2 },
          },
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
      },
    ])
    expect(
      await screen.findByText(
        'Handed out 2 gp each to Vex and Bram, using 1 pp',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
  })

  it('hands out by what the game says of moves paying with other coins, whatever the coins’ own switch is', async () => {
    // Coins' switch off, so the page has no word of its own on other coins: the moves' says none.
    const { user } = await renderCoins({
      moves: tableMoves({ handOut: { change: false } }),
    })
    await user.click(screen.getByRole('button', { name: 'Hand out' }))
    const dialog = within(
      screen.getByRole('dialog', { name: 'Hand out coins' }),
    )
    await user.click(dialog.getByRole('checkbox', { name: 'Vex' }))
    await user.type(dialog.getByRole('textbox', { name: 'Gold' }), '5')

    expect(
      dialog.getByText(
        'You hold only 3 gp of the 5 gp in all, and your Gamemaster’s game doesn’t pay with other coins.',
      ),
    ).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Hand out' }))
    expect(posts()).toEqual([])
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
    for (const name of ['Add or take away', 'Send to', 'Hand out']) {
      expect(within(row).getByRole('button', { name })).toBeEnabled()
    }
  })

  it('keeps its dialog open as the campaign stops letting coins be changed, and says so of what’s sent', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValue(respond(409, { reason: 'unavailable' }))
    const { user, rerenderWith } = await renderCoins()
    const dialog = await takeAway(user, '1')

    rerenderWith({})
    // Its button is gone; the dialog isn't, with what was typed in it.
    expect(
      screen.queryByRole('button', { name: 'Add or take away' }),
    ).toBeNull()
    expect(dialog.getByText('You take away 1 gp.')).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Take away coins' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      await screen.findByText(
        'Not taken away: your Gamemaster’s game isn’t changing coins now',
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
      expect(rowButtons()).toEqual(['Add or take away', 'Send to', 'Hand out'])
    })

    it('offers none at a character no longer in the game, whatever its view says', async () => {
      await renderTable(tableView({ connected: false }))
      expect(
        screen.queryByRole('button', { name: 'Add or take away' }),
      ).toBeNull()
      expect(screen.queryByRole('button', { name: 'Hand out' })).toBeNull()
    })
  })
})
