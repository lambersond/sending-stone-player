import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable } from './game-table'
import {
  POLL_INTERVAL,
  useTableView,
  type Connection,
} from '@/hooks/use-table-view'
import { characterSheet, offeredDiceView } from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { Character, TableSeat } from '@/types/character'
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
// The dialog is APP-B's, tested beside it; nothing here opens it.
jest.mock('@/components/dice-entry/dice-entry-dialog', () => ({
  DiceEntryDialog: () => {},
}))

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
