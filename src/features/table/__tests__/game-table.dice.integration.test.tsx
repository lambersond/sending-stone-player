import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable } from '../components/game-table/game-table'
import { TOASTS_KEY } from '@/features/rolling/utils/roll-toasts'
import { useTableView } from '@/features/table/hooks/use-table-view'
import { characterSheet, mockTableView } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import { rollServer } from '@/utils/test-utils'
import type { Character } from '@/types/character'
import type { TableView } from '@/types/table'

/*
 * The page's one renderer (v0.44): GameTable gives it to the sheet's pane and to the Combat and
 * Chat column beside it, so that every roll on the page tumbles over the whole of it. The 3D dice
 * need WebGL, so the renderer is a stand-in, counted as it's made, ready, each throw counted.
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

const table = (initial: TableView) => (
  <GameTable character={thorin} initialView={initial} />
)

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(TOASTS_KEY, 'off')
  mockRenderers.mockClear()
  mockThrows.mockClear()
  rollServer()
})

describe('components/game-table, the page’s dice', () => {
  it('throws a roll from the sheet on the page’s one renderer, as before', async () => {
    const initial = view()
    jest
      .mocked(useTableView)
      .mockReturnValue({ view: initial, connection: 'live' })
    const user = userEvent.setup()
    render(table(initial))

    const sheet = screen.getByRole('region', { name: 'Character' })
    await user.click(
      within(sheet).getByRole('button', { name: 'Strength check, +4' }),
    )
    await waitFor(() => expect(mockThrows).toHaveBeenCalledTimes(1))
    expect(mockRenderers).toHaveBeenCalledTimes(1)
  })
})
