import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from '../components/character-pane/character-pane'
import { TOASTS_KEY } from '@/features/rolling/utils/roll-toasts'
import { summoningSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { RollKind } from '@/types/roll'

/*
 * Summon activities, from module 0.54.0, as Thorin's sheet casts them at the table: Find Familiar
 * from the Spells tab, its creature and type chosen in the picker, and Pack of Wolves from the
 * Features tab, used at once with its one creature. Nothing is placed from the app: the tray says
 * who places the creature in Foundry, from the card.
 */

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock(
  '@lambersond/3d-dice-react',
  () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
)

const GAME = 'https://my-game.forge-vtt.com'

/** The rolls the game takes: spells and features used. */
const KINDS: RollKind[] = ['use']

/**
 * The game, which makes each request as it answers it by its id: everything posted, in order. One
 * it hasn't answered is still on its way.
 */
const answering = (answers: Record<string, Record<string, unknown>>) => {
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
    const answer = answers[id] ?? { status: 'pending' }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id, ...answer }),
    } as Response
  }) as typeof fetch
  return posted
}

/** A summon activity used, as the game made it: its card posted, nothing placed. */
const CAST = {
  status: 'done',
  visible: true,
  rolls: [],
  use: { type: 'summon' },
  damage: null,
}

const pane = () => (
  <CharacterPane
    characterId='char-thorin'
    name='Thorin'
    sheet={toTableSheet(summoningSheet(), GAME)}
    rollsToTable={KINDS}
  />
)

/** A tab of the sheet, shown. */
const show = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }))

// The game is asked after a request once a second, which a busy machine may be slow to get to.
jest.setTimeout(20_000)

describe('summon activities at the table, from module 0.54.0', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
    // These test the tray, whose words a roll's toast would say again.
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
  })

  it('casts Find Familiar as the creature and type chosen, at no one, and says who places it', async () => {
    const user = userEvent.setup()
    const posted = answering({ 'req-1': CAST })
    render(pane())
    await show(user, 'Spells')

    await user.click(screen.getByRole('button', { name: 'Cast Find Familiar' }))
    const picker = screen.getByRole('dialog', { name: 'Find Familiar' })
    await user.click(within(picker).getByRole('radio', { name: 'Owl' }))
    await user.click(within(picker).getByRole('radio', { name: 'Fey' }))
    expect(fetch).not.toHaveBeenCalled()
    await user.click(within(picker).getByRole('button', { name: 'Cast' }))

    expect(posted[0]).toEqual({
      kind: 'use',
      item: 'findFamiliar',
      activity: 'ffSummon',
      targets: [],
      slot: 'spell1',
      summon: { profile: 'owlProfile000000', type: 'fey' },
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    })
    await waitFor(
      () =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Cast at the table · your Gamemaster places the creature in Foundry',
        ),
      { timeout: 5000 },
    )
  })

  it('uses Pack of Wolves at once with its one creature, and says the creatures are placed', async () => {
    const user = userEvent.setup()
    const posted = answering({ 'req-1': CAST })
    render(pane())
    await show(user, 'Features')

    await user.click(screen.getByRole('button', { name: 'Use Pack of Wolves' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(posted[0]).toEqual({
      kind: 'use',
      item: 'packOfWolves',
      activity: 'pwSummon',
      targets: [],
      slot: null,
      summon: { profile: 'wolvesProfile000' },
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    })
    await waitFor(
      () =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Used at the table · your Gamemaster places the creatures in Foundry',
        ),
      { timeout: 5000 },
    )
  })
})
