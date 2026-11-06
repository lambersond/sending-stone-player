import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from '../components/character-pane/character-pane'
import { ROLL_KINDS } from '@/constants/sending-stone'
import { SEND_KEY } from '@/features/rolling/constants'
import { TOASTS_KEY } from '@/features/rolling/utils/roll-toasts'
import { characterSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { RollKind } from '@/types/roll'
import type { CharacterSheet } from '@/types/sending-stone'

/*
 * Thorin's hit points and temporary hit points set from the Character tab's tile (module 0.44.0),
 * through the real pane, with the campaign's rolls off and this device's Send to the table off:
 * the change asked, the request posted, the tile waiting, and what the tray and the toasts say of
 * it, as the game answers.
 */

// Without WebGL the renderer is never ready, so nothing waits on dice.
jest.mock(
  '@lambersond/3d-dice-react',
  () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
)

const GAME = 'https://my-game.forge-vtt.com'

/** Thorin before the GM's fall: 22 of 30, 3 temporary. */
const BEFORE = { value: 22, max: 30, temp: 3 }

/** Thorin, at these hit points. */
const thorin = (hp = BEFORE): CharacterSheet => characterSheet({ hp })

/**
 * The game, which answers each request by its id as `answers` says at the time: everything
 * posted, in order. One it hasn't answered is still on its way.
 */
const answering = (answers: Record<string, Record<string, unknown>> = {}) => {
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
      json: async () => ({ id, status: 'pending', ...answers[id] }),
    } as Response
  }) as typeof fetch
  return posted
}

/** Thorin's pane, the rolls off unless said, hit points set from here unless said. */
const pane = (
  sheet: CharacterSheet = thorin(),
  {
    kinds = [],
    hitPoints = true,
  }: { kinds?: RollKind[]; hitPoints?: boolean } = {},
) => (
  <CharacterPane
    characterId='char-thorin'
    name='Thorin'
    sheet={toTableSheet(sheet, GAME)}
    rollsToTable={kinds}
    {...(hitPoints && { hitPoints: true })}
  />
)

const tile = (name = 'Hit points: 22 of 30, 3 temporary. Change hit points') =>
  screen.getByRole('button', { name })
const tray = () => screen.getByRole('region', { name: 'Your rolls' })

/** The GM's fall of 4, taken from the tile: temporary 3 → 0, then hit points 22 → 21; saved. */
const fall = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(tile())
  const dialog = await screen.findByRole('dialog', { name: 'Hit points' })
  const fewer = (name: string) => within(dialog).getByRole('button', { name })
  for (let tap = 0; tap < 3; tap += 1) {
    await user.click(fewer('One temporary hit point fewer'))
  }
  await user.click(fewer('One hit point fewer'))
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))
}

/** What the game's set hit points are said to be, as its result says them. */
const SET = {
  status: 'done',
  visible: true,
  rolls: [],
  hitPoints: { value: 21, temp: 0, max: 30 },
}

// The game is asked after a request once a second, which a busy machine may be slow to get to.
jest.setTimeout(20_000)

beforeEach(() => {
  globalThis.localStorage.clear()
  globalThis.localStorage.setItem(SEND_KEY, 'off')
  globalThis.localStorage.setItem(TOASTS_KEY, 'off')
})

describe('hit points set from the tile, from module 0.44.0', () => {
  it('sends the change from what the tile showed, the rolls and Send to the table off, and says it’s made as the game says', async () => {
    const user = userEvent.setup()
    const answers: Record<string, Record<string, unknown>> = {}
    const posted = answering(answers)
    const { rerender } = render(pane())

    await fall(user)

    expect(posted).toEqual([
      {
        kind: 'hitPoints',
        hitPoints: {
          op: 'set',
          value: 21,
          temp: 0,
          from: { value: 22, temp: 3 },
        },
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      },
    ])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(tile()).toHaveAttribute('aria-disabled', 'true')
    expect(tile()).toHaveAccessibleDescription('Waiting for the game')
    await waitFor(() =>
      expect(tray()).toHaveTextContent('Hit points 22 → 21 · temporary 3 → 0'),
    )

    answers['req-1'] = SET
    await waitFor(
      () => expect(tray()).toHaveTextContent('Hit points now 21 / 30'),
      { timeout: 5000 },
    )
    // The sheet shows it: the tile no longer waits.
    rerender(pane(thorin({ value: 21, max: 30, temp: 0 })))
    expect(tile('Hit points: 21 of 30. Change hit points')).not.toHaveAttribute(
      'aria-disabled',
    )
  })

  it('says why the game didn’t, and lets them try again at once', async () => {
    const user = userEvent.setup()
    answering({ 'req-1': { status: 'failed', reason: 'changed' } })
    render(pane())

    await fall(user)

    await waitFor(
      () =>
        expect(tray()).toHaveTextContent(
          'Couldn’t set your hit points: they changed in Foundry; look again',
        ),
      { timeout: 5000 },
    )
    expect(tile()).not.toHaveAttribute('aria-disabled')
  })

  it('pops up its toast as the game says the numbers are, where the rolls pop up', async () => {
    const user = userEvent.setup()
    globalThis.localStorage.removeItem(TOASTS_KEY)
    answering({ 'req-1': SET })
    render(pane())

    await fall(user)

    const toasts = screen.getByRole('log', { name: 'Roll results' })
    await waitFor(
      () => {
        expect(toasts).toHaveTextContent('Hit points 22 → 21 · temporary 3 → 0')
        expect(toasts).toHaveTextContent('Hit points now 21 / 30')
      },
      { timeout: 5000 },
    )
  })

  it('reads as before where the campaign doesn’t let the player, whatever the rolls', () => {
    globalThis.localStorage.setItem(SEND_KEY, 'on')
    answering()
    render(pane(thorin(), { kinds: [...ROLL_KINDS], hitPoints: false }))

    expect(screen.queryByRole('button', { name: /^Hit points:/ })).toBeNull()
    expect(screen.getByText('+3 temp')).toBeVisible()
  })
})
