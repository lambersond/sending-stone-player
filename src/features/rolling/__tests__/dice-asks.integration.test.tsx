import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SEND_KEY } from '@/features/rolling/constants'
import { TOASTS_KEY } from '@/features/rolling/utils/roll-toasts'
import { CharacterPane } from '@/features/sheet/components/character-pane/character-pane'
import { tableIceKnife } from '@/mocks/dice-asks'
import { characterSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { TableDiceAsk } from '@/types/table'

/*
 * The dice the game asks a typing player for later in their roll's run (module 0.45.0), through
 * the real pane, its banner and the real dice dialog: on a device that didn't send the roll, the
 * banner's Type in opens the dialog, and Done posts what was typed as its answer, kept in the
 * tray; an ask closed elsewhere closes its dialog, and nothing is posted.
 */

// Without WebGL the renderer is never ready, so nothing waits on dice.
jest.mock(
  '@lambersond/3d-dice-react',
  () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
)

const GAME = 'https://my-game.forge-vtt.com'

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

/** Ice Knife's 2d6 cold, waiting a minute. */
const ask = () =>
  tableIceKnife({ expiresAt: new Date(Date.now() + 60_000).toISOString() })

/** Thorin's pane, typing in his dice, the game taking his damage and its asks' answers. */
const pane = (diceAsks: TableDiceAsk[]) => (
  <CharacterPane
    characterId='char-thorin'
    name='Thorin'
    sheet={toTableSheet(characterSheet(), GAME)}
    rollsToTable={['damage', 'dice']}
    rollFeatures={['manualDice']}
    manualDice={{ on: true, onChange: jest.fn() }}
    diceAsks={diceAsks}
  />
)

const banner = () =>
  screen.getByRole('region', { name: 'The game asks for your dice' })

// The game is asked after a request once a second, which a busy machine may be slow to get to.
jest.setTimeout(20_000)

beforeEach(() => {
  globalThis.localStorage.clear()
  globalThis.localStorage.setItem(SEND_KEY, 'on')
  globalThis.localStorage.setItem(TOASTS_KEY, 'off')
})

describe('the dice the game asks for, from module 0.45.0', () => {
  it('opens the dialog from the banner, posts what was typed as its answer, and keeps it in the tray', async () => {
    const user = userEvent.setup()
    const posted = answering()
    render(pane([ask()]))

    await user.click(
      within(banner()).getByRole('button', {
        name: 'Type in 2d6 Cold for Ice Knife: Shard Explosion',
      }),
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Ice Knife: Shard Explosion',
    })
    expect(dialog).toHaveTextContent('The game asks for these dice')
    await user.click(within(dialog).getByRole('textbox', { name: 'd6 1 of 2' }))
    await user.keyboard('35')
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toEqual({
      kind: 'dice',
      diceAsk: 'ask1',
      answer: [{ roll: 0, term: 0, results: [3, 5] }],
      typed: true,
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    // Taken: the banner offers it no more.
    expect(
      screen.queryByRole('region', { name: 'The game asks for your dice' }),
    ).toBeNull()
    const tray = screen.getByRole('region', { name: 'Your rolls' })
    expect(tray).toHaveTextContent('Ice Knife: Shard Explosion')
    expect(tray).toHaveTextContent('2d6 Cold (3, 5)')
  })

  it('closes the dialog, posting nothing, once the ask closes elsewhere', async () => {
    const user = userEvent.setup()
    const posted = answering()
    const { rerender } = render(pane([ask()]))

    await user.click(
      within(banner()).getByRole('button', {
        name: 'Type in 2d6 Cold for Ice Knife: Shard Explosion',
      }),
    )
    await screen.findByRole('dialog', { name: 'Ice Knife: Shard Explosion' })
    rerender(pane([]))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(posted).toEqual([])
  })
})
