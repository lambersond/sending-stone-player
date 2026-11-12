import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CHECK_EVERY } from '@/constants/lifecycle'
import { SEND_KEY } from '@/features/rolling/constants'
import { TOASTS_KEY } from '@/features/rolling/utils/roll-toasts'
import { GameTable } from '@/features/table/components/game-table/game-table'
import { useTableView } from '@/features/table/hooks/use-table-view'
import { tableIceKnife } from '@/mocks/dice-asks'
import { characterSheet, manualDiceView } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { Character } from '@/types/character'
import type { Connection, TableDiceAsk, TableView } from '@/types/table'

/*
 * The dice the game asks a typing player for later in their roll's run (module 0.44.0), from the
 * table's view through the character's sheet, its banner and the real dice dialog, to what's
 * posted: on the device that sent the roll, the dialog opens by itself, even where the view listed
 * the ask before the app had told this page its roll's id; on another of the player's devices, the
 * banner's Type in opens it, and it closes, posting nothing, once the ask closes elsewhere.
 */

jest.mock('@/features/table/hooks/use-table-view', () => ({
  ...jest.requireActual('@/features/table/hooks/use-table-view'),
  useTableView: jest.fn(),
}))
// Without WebGL the renderer is never ready, so nothing waits on dice.
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
  actorId: 'actor-thorin',
}

let current: { view: TableView; connection: Connection }

/** Thorin's view, typing in his dice, the game taking his checks and the dice it asks for. */
const polled = (diceAsks?: TableDiceAsk[]) => {
  current = {
    connection: 'live',
    view: manualDiceView(
      { offered: true, on: true },
      {
        sheet: toTableSheet(characterSheet(), GAME),
        rollsToTable: ['ability', 'dice'],
        ...(diceAsks && { diceAsks }),
      },
    ),
  }
}

// The player's page, where typing in their dice is remembered on every device.
const table = () => (
  <GameTable
    character={character}
    initialView={current.view}
    setManualDice={async () => {}}
  />
)

/** The game, taking every request and making none yet: everything posted, in order. */
const answering = () => {
  const posted: Record<string, unknown>[] = []
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
    return {
      ok: true,
      status: 200,
      json: async () => ({ id, status: 'rolling' }),
    } as Response
  }) as typeof fetch
  return posted
}

/** Ice Knife's 2d6 cold, waiting a minute, asked in the run of the roll `command`. */
const ask = (command: string) =>
  tableIceKnife({
    command,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })

const banner = () =>
  screen.queryByRole('region', { name: 'The game asks for your dice' })

const asking = () =>
  screen.queryByRole('dialog', { name: 'Ice Knife: Shard Explosion' })

describe('the dice the game asks for, from the table’s view, from module 0.44.0', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.localStorage.setItem(SEND_KEY, 'on')
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
    polled()
    jest
      .mocked(useTableView)
      .mockImplementation(() => ({ ...current, readAgain: () => {} }))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('opens the dialog by itself on the device that sent the roll, once its id is known here, and posts what was typed as its answer, kept in the tray', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const posted = answering()
    const { rerender } = render(table())

    await user.click(screen.getByRole('button', { name: 'Strength check, +4' }))
    const check = await screen.findByRole('dialog', { name: 'Strength check' })
    await user.click(within(check).getByRole('button', { name: '1' }))
    await user.click(within(check).getByRole('button', { name: '5' }))
    await user.click(within(check).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(posted).toHaveLength(1))

    // The view lists its ask before this page has looked after the roll, and learnt its id.
    polled([ask('req-1')])
    rerender(table())
    expect(banner()).not.toBeNull()
    expect(asking()).toBeNull()

    await act(async () => jest.advanceTimersByTime(CHECK_EVERY))
    const dialog = await screen.findByRole('dialog', {
      name: 'Ice Knife: Shard Explosion',
    })
    expect(banner()).toBeNull()
    expect(dialog).toHaveTextContent('The game asks for these dice')
    await user.click(within(dialog).getByRole('button', { name: '3' }))
    await user.click(within(dialog).getByRole('button', { name: '5' }))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(posted).toHaveLength(2))
    expect(posted[1]).toEqual({
      kind: 'dice',
      diceAsk: 'ask1',
      answer: [{ roll: 0, term: 0, results: [3, 5] }],
      typed: true,
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    })
    const tray = screen.getByRole('region', { name: 'Your rolls' })
    await waitFor(() =>
      expect(tray).toHaveTextContent('Ice Knife: Shard Explosion'),
    )
    expect(tray).toHaveTextContent('2d6 Cold (3, 5)')
  })

  it('offers it on the banner of another of the player’s devices, and closes its dialog, posting nothing, once it closes elsewhere', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    const posted = answering()
    polled([ask('roll-thorin-1')])
    const { rerender } = render(table())

    expect(asking()).toBeNull()
    await user.click(
      within(banner()!).getByRole('button', {
        name: 'Type in 2d6 Cold for Ice Knife: Shard Explosion',
      }),
    )
    expect(asking()).not.toBeNull()

    polled()
    rerender(table())
    await waitFor(() => expect(asking()).toBeNull())
    expect(posted).toEqual([])
  })
})
