import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable } from './game-table'
import {
  POLL_INTERVAL,
  useTableView,
  type Connection,
} from '@/hooks/use-table-view'
import {
  characterSheet,
  fullerSheet,
  manualDiceView,
  offeredDiceView,
} from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { Character, TableSeat } from '@/types/character'
import type { CharacterSheet } from '@/types/sending-stone'
import type { TableView } from '@/types/table'

// The switch for typing in their own dice (module 0.32.0): remembered on every device, the
// player's change shown at once, and another device's taken up only once a view could know it.

jest.mock('@/hooks/use-table-view', () => ({
  ...jest.requireActual('@/hooks/use-table-view'),
  useTableView: jest.fn(),
}))
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))
// The dice entry dialog is APP-B's, tested beside it: here as it is, to see where it opens.

const sheet = toTableSheet(characterSheet(), 'https://my-game.forge-vtt.com')

const character: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

let current: { view: TableView; connection: Connection }

/** The view the table polled last: always a new one, as a poll's. */
const polled = (fields: Partial<TableView> = {}) => {
  current = { ...current, view: offeredDiceView({ sheet, ...fields }) }
}

/** A save the test settles. */
function saving() {
  const settle: {
    resolve?: () => void
    reject?: (error: Error) => void
  } = {}
  const save = jest.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        settle.resolve = resolve
        settle.reject = reject
      }),
  )
  return { save, settle }
}

const table = (
  setManualDice?: (on: boolean) => Promise<void>,
  seat?: TableSeat,
) => (
  <GameTable
    character={character}
    initialView={current.view}
    seat={seat}
    setManualDice={setManualDice}
  />
)

const switchOf = () =>
  within(screen.getByRole('dialog', { name: 'Settings' })).queryByRole(
    'switch',
    {
      name: 'Enter dice results manually',
    },
  )

describe('components/game-table, typing in their own dice', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
    current = { view: offeredDiceView({ sheet }), connection: 'live' }
    jest.mocked(useTableView).mockImplementation(() => current)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("shows the player's change at once, keeps it over a view polled before it was saved, and takes up another device's after", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const { save, settle } = saving()
    const { rerender } = render(table(save))
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    await user.click(switchOf()!)
    expect(save).toHaveBeenCalledWith(true)
    expect(switchOf()).toBeChecked()

    // A view polled while it saved still says what was stored before.
    polled()
    rerender(table(save))
    expect(switchOf()).toBeChecked()

    await act(async () => settle.resolve?.())
    // And one polled just before it settled, arriving a moment after.
    await act(async () => jest.advanceTimersByTime(POLL_INTERVAL - 500))
    polled()
    rerender(table(save))
    expect(switchOf()).toBeChecked()

    // Once one agrees, the switch is the stored choice.
    polled({ manualDice: { offered: true, on: true } })
    rerender(table(save))
    expect(switchOf()).toBeChecked()

    // Turned off on another device, a while later: taken up.
    await act(async () => jest.advanceTimersByTime(POLL_INTERVAL * 2))
    polled()
    rerender(table(save))
    expect(switchOf()).not.toBeChecked()
  })

  it('takes up a view that disagrees once more than a poll has passed since the save settled', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const { save, settle } = saving()
    const { rerender } = render(table(save))
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    await user.click(switchOf()!)
    await act(async () => settle.resolve?.())
    await act(async () => jest.advanceTimersByTime(POLL_INTERVAL + 1))
    // Another device turned it off after this one turned it on.
    polled()
    rerender(table(save))
    expect(switchOf()).not.toBeChecked()
  })

  it('shows what is stored again where the save failed, saying nothing', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const { save, settle } = saving()
    render(table(save))
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    await user.click(switchOf()!)
    expect(switchOf()).toBeChecked()
    await act(async () => settle.reject?.(new Error('offline')))

    expect(switchOf()).not.toBeChecked()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  // Each row as long as the rest: jest takes a last parameter a row lacks for `done`.
  it.each<[string, Partial<TableView>, boolean, TableSeat | undefined]>([
    [
      'where the game no longer offers it',
      { manualDice: { offered: false, on: true } },
      true,
      undefined,
    ],
    [
      "for a character no longer the campaign's",
      { connected: false },
      true,
      undefined,
    ],
    [
      "on the Gamemaster's page, which has nowhere to remember it",
      {},
      false,
      {
        role: 'gm',
        api: '/api/campaigns/c1/characters/actor-thorin',
        key: 'gm:c1:actor-thorin',
      },
    ],
  ])('offers no switch %s', async (_name, fields, player, seat) => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    polled(fields)
    render(table(player ? saving().save : undefined, seat))
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    expect(switchOf()).toBeNull()
  })
})

/** Thorin with Second Wind, a use whose healing the game says is due, after it. */
function winded(): CharacterSheet {
  const sheet = fullerSheet()
  /* eslint-disable unicorn/no-null -- the sheet has null for none */
  const targets = {
    self: true,
    area: false,
    count: null,
    perLevel: null,
    affects: 'self',
  } as const
  /* eslint-enable unicorn/no-null */
  return {
    ...sheet,
    actions: sheet.actions.map(section => ({
      ...section,
      actions: section.actions.map(action =>
        action.id === 'second-wind'
          ? { ...action, activity: { id: 'windHeal', type: 'heal', targets } }
          : action,
      ),
    })),
  }
}

describe('components/game-table, typing in their own dice on another tab', () => {
  const posted: Record<string, unknown>[] = []
  const fetched = globalThis.fetch

  beforeEach(() => {
    globalThis.localStorage.clear()
    posted.length = 0
    // The game takes the use, then says its healing is due.
    globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posted.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return {
          ok: true,
          status: 202,
          json: async () => ({ id: `req-${posted.length}` }),
        } as Response
      }
      const id = String(url).split('/').at(-1) ?? ''
      const answer =
        id === 'req-1'
          ? {
              status: 'done',
              visible: true,
              rolls: [],
              use: { type: 'heal' },
              damage: {
                critical: false,
                plannable: true,
                healing: true,
                rolls: [
                  {
                    formula: '1d10 + 5',
                    type: 'healing',
                    dice: [{ faces: 10, number: 1 }],
                  },
                ],
              },
            }
          : { status: 'pending' }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id, ...answer }),
      } as Response
    }) as typeof fetch
    current = {
      view: manualDiceView(
        { offered: true, on: true },
        {
          sheet: toTableSheet(winded(), 'https://my-game.forge-vtt.com'),
          rollsToTable: ['use', 'damage'],
        },
      ),
      connection: 'live',
    }
    jest.mocked(useTableView).mockImplementation(() => current)
  })

  afterEach(() => {
    globalThis.fetch = fetched
  })

  // A phone or tablet, as below the wide layout: the sheet a tab, hidden while another is shown.
  it.each(['Combat', 'Chat'])(
    "opens the dice dialog from a roll's toast over the %s tab, never inside the sheet's hidden tab",
    async tab => {
      const user = userEvent.setup()
      render(table(async () => {}))
      await user.click(screen.getByRole('tab', { name: /^Actions/ }))
      await user.click(
        screen.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }),
      )
      // While typing, its healing waits in the toast for a tap.
      const roll = await screen.findByRole(
        'button',
        { name: 'Roll healing' },
        { timeout: 4000 },
      )
      expect(posted).toHaveLength(1)

      await user.click(
        within(screen.getByRole('navigation', { name: 'Table' })).getByRole(
          'button',
          { name: new RegExp(`^${tab}`) },
        ),
      )
      const pane = document.querySelector('#character-pane')
      expect(pane).toHaveClass('hidden')
      await user.click(roll)

      const dialog = screen.getByRole('dialog', { name: 'Second Wind healing' })
      expect(dialog).toHaveProperty('open', true)
      expect(pane?.contains(dialog)).toBe(false)
      expect(dialog.parentElement?.closest('.hidden')).toBeNull()

      // And it works there: the healing typed in is sent.
      await user.click(within(dialog).getByRole('button', { name: '7' }))
      await user.click(within(dialog).getByRole('button', { name: 'Done' }))
      await waitFor(() => expect(posted).toHaveLength(2))
      expect(posted[1]).toMatchObject({
        kind: 'damage',
        use: 'req-1',
        dice: [{ faces: 10, results: [7] }],
        typed: true,
      })
    },
  )
})
