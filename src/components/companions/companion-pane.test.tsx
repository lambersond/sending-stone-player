/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompanionPane } from './companion-pane'
import { useCreature } from '@/hooks/use-creature'
import {
  biteAction,
  mockCompanionSheet,
  mockCompanionView,
  sheetAction,
  TEXTS,
} from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { TableSeat } from '@/types/character'
import type { CompanionView } from '@/types/table'
import type { RowCompanion } from '@/utils/companion-row'

/*
 * A companion's pane (module 0.36.0), its view and rolls through its own routes, which `fetch`
 * stands in for here. The 3D dice need WebGL: a renderer that's never ready, so that rolls
 * resolve at once, each shown in the tray.
 */
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

// The pane's rolls' button, in toasts, reads the creature the pane is for: here it says it.
jest.mock('@/components/character-sheet/rolls-button', () => ({
  RollsButton: function Probe() {
    const creature = useCreature()
    return <output aria-label='Creature'>{JSON.stringify(creature)}</output>
  },
}))

const GAME = 'https://my-game.forge-vtt.com'
const SEAT: TableSeat = {
  role: 'player',
  api: '/api/characters/char-1',
  key: 'char-1',
}
const API = '/api/characters/char-1/companions/wolfBrakka'

const BRAKKA: RowCompanion = {
  key: 'wolfBrakka',
  name: 'Brakka',
  kind: 'owned',
}

/** Its description's links: a save, its damage, a check, and a roll of luck. */
const LINKS =
  '<p>Make a <span class="ss-save roll" data-n="0" data-ability="str" data-dc="15">DC 15 Strength</span> saving throw or take <span class="ss-damage roll" data-n="1" data-formulas="2d6" data-types="fire">2d6 fire</span>.' +
  ' Then a <span class="ss-check roll" data-n="2" data-checks="skill:str:ath" data-dc="12">DC 12 Strength (Athletics)</span> check.' +
  ' Lucky: <span class="ss-roll roll" data-n="3" data-formula="1d4">1d4</span></p>'

/** Brakka's sheet: its Bite and a Howl with a check and a formula of its own. */
const brakkaSheet = () =>
  toTableSheet(
    mockCompanionSheet({
      features: [
        {
          id: 'wolf',
          label: 'Features',
          text: null,
          features: [
            {
              id: 'pack',
              name: 'Pack Tactics',
              img: null,
              kind: 'Monster Feature',
              requirements: null,
              activation: null,
              passive: true,
              uses: null,
              text: TEXTS.secondWind,
            },
          ],
        },
      ],
      actions: [
        {
          id: 'action',
          label: 'Actions',
          actions: [
            biteAction(),
            sheetAction({
              id: 'howl',
              name: 'Howl',
              activity: {
                id: 'howlCheck',
                type: 'check',
                targets: {
                  self: false,
                  area: false,
                  count: null,
                  perLevel: null,
                  affects: null,
                },
              },
              check: {
                checks: [{ type: 'skill', ability: 'cha', key: 'itm' }],
                dc: 12,
                own: true,
              },
              rollFormula: { formula: '1d4', name: 'Echo' },
            }),
          ],
        },
      ],
    }),
    GAME,
  )

type Route = { status: number; body?: unknown }

/**
 * The companion's routes: its view, as `views` gives it next (the last one kept), its rolls,
 * answered by id as `answers` says at the time, and its descriptions. Everything asked, in order.
 */
const routes = (
  views: (CompanionView | Route)[],
  answers: Record<string, Record<string, unknown>> = {},
) => {
  const asked: { url: string; method: string; body?: unknown }[] = []
  let view = 0
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    asked.push({
      url: String(url),
      method,
      ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}),
    })
    const path = String(url)
    if (path.startsWith(`${API}/table`)) {
      const next = views[Math.min(view, views.length - 1)]
      view += 1
      const route: Route =
        'status' in next && !('version' in next)
          ? (next as Route)
          : { status: 200, body: next }
      return {
        ok: route.status === 200,
        status: route.status,
        json: async () => route.body,
      } as Response
    }
    if (path.includes('/texts/')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ html: LINKS }),
      } as Response
    }
    if (method === 'POST') {
      const posts = asked.filter(each => each.method === 'POST').length
      return {
        ok: true,
        status: 202,
        json: async () => ({ id: `req-${posts}` }),
      } as Response
    }
    const id = path.split('/').at(-1) ?? ''
    return {
      ok: true,
      status: 200,
      json: async () => ({ id, status: 'pending', ...answers[id] }),
    } as Response
  }) as typeof fetch
  return asked
}

const brakkaView = (fields: Partial<CompanionView> = {}): CompanionView =>
  mockCompanionView({
    companion: BRAKKA,
    sheet: brakkaSheet(),
    rollsToTable: ['ability', 'skill', 'attack', 'damage', 'use', 'formula'],
    rollFeatures: [],
    ...fields,
  })

type Props = Partial<Parameters<typeof CompanionPane>[0]>

const pane = (props: Props = {}) => (
  <CompanionPane
    seat={SEAT}
    companion={BRAKKA}
    name='Brakka'
    character='Thorin'
    shown
    gone={false}
    {...props}
  />
)

const posts = (asked: ReturnType<typeof routes>) =>
  asked.filter(({ method }) => method === 'POST')

const tableAsks = (asked: ReturnType<typeof routes>) =>
  asked.filter(({ url }) => url.startsWith(`${API}/table`))

beforeEach(() => {
  globalThis.localStorage.clear()
  globalThis.sessionStorage.clear()
  globalThis.localStorage.setItem(TOASTS_KEY, 'off')
})

describe('CompanionPane', () => {
  it('reads and rolls through the companion’s own routes', async () => {
    const user = userEvent.setup()
    const asked = routes([brakkaView()])
    render(pane())
    await user.click(
      await screen.findByRole('button', { name: 'Strength check, +4' }),
    )
    expect(tableAsks(asked)[0].url).toBe(`${API}/table`)
    expect(posts(asked)).toEqual([
      expect.objectContaining({
        url: `${API}/rolls`,
        body: expect.objectContaining({ kind: 'ability' }),
      }),
    ])
  })

  it('asks for its view only while it’s shown, and at once when shown again', async () => {
    jest.useFakeTimers()
    try {
      const asked = routes([brakkaView()])
      const { rerender } = render(pane({ shown: false }))
      await act(async () => {})
      // Asked once as it mounts, hidden or not, and no more while hidden.
      expect(tableAsks(asked)).toHaveLength(1)
      await act(async () => {
        jest.advanceTimersByTime(10_000)
      })
      expect(tableAsks(asked)).toHaveLength(1)
      rerender(pane({ shown: true }))
      await act(async () => {})
      expect(tableAsks(asked)).toHaveLength(2)
      await act(async () => {
        jest.advanceTimersByTime(3000)
      })
      expect(tableAsks(asked)).toHaveLength(3)
      rerender(pane({ shown: false }))
      await act(async () => {
        jest.advanceTimersByTime(10_000)
      })
      expect(tableAsks(asked)).toHaveLength(3)
    } finally {
      jest.useRealTimers()
    }
  })

  it('says so, and offers nothing, once the companion is no longer its character’s', async () => {
    routes([brakkaView({ connected: false, rollsToTable: undefined })])
    render(pane())
    expect(
      await screen.findByText(
        'Brakka is no longer with Thorin in your Gamemaster’s game. Its sheet is as it was; nothing more can be rolled for it here.',
      ),
    ).toHaveAttribute('role', 'note')
    expect(
      screen.getByRole('button', { name: 'Strength check, +4' }),
    ).toBeDisabled()
  })

  it('says it’s gone under its sheet’s tabs, above the sheet, as the prototype draws it', async () => {
    routes([brakkaView({ connected: false, rollsToTable: undefined })])
    render(pane())
    const note = await screen.findByRole('note')
    const tabs = screen.getByRole('tablist', { name: 'Character sheet' })
    const sheet = document.querySelector('#creature-wolfBrakka-sheet-panel')
    expect(
      tabs.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      sheet &&
        note.compareDocumentPosition(sheet) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('says it’s gone once its route says so: over its sheet, or alone', async () => {
    const asked = routes([brakkaView(), { status: 404 }])
    const { rerender } = render(pane({ shown: false }))
    await screen.findByRole('tablist', {
      name: 'Character sheet',
      hidden: true,
    })
    rerender(pane({ shown: true }))
    expect(await screen.findByRole('note')).toHaveTextContent(
      'Brakka is no longer with Thorin in your Gamemaster’s game. Its sheet is as it was; nothing more can be rolled for it here.',
    )
    expect(tableAsks(asked)).toHaveLength(2)
    // A companion gone before its sheet came says so alone.
    routes([{ status: 404 }])
    render(
      pane({
        companion: { ...BRAKKA, key: 'wolfBrakka' },
        name: 'Bat 2',
      }),
    )
    expect(
      await screen.findByText(
        'Bat 2 is no longer with Thorin in your Gamemaster’s game.',
      ),
    ).toHaveAttribute('role', 'note')
  })

  it('says its sheet hasn’t arrived yet, taking focus itself, then hands it to its sheet', async () => {
    let answer: ((view: CompanionView) => void) | undefined
    globalThis.fetch = jest.fn(
      () =>
        new Promise(resolve => {
          answer = view =>
            resolve({
              ok: true,
              status: 200,
              json: async () => view,
            } as Response)
        }),
    ) as unknown as typeof fetch
    render(pane({ name: 'Bat 2' }))
    expect(
      screen.getByText('Bat 2’s sheet hasn’t arrived yet.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('tablist', { name: 'Character sheet' }),
    ).toBeNull()
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('id', 'creature-panel-wolfBrakka')
    expect(panel).toHaveAttribute('aria-labelledby', 'creature-tab-wolfBrakka')
    expect(panel).toHaveAttribute('tabindex', '0')
    act(() => panel.focus())
    await act(async () => answer?.(brakkaView()))
    const tab = await screen.findByRole('tab', { name: 'Character' })
    expect(tab).toHaveFocus()
    expect(panel).not.toHaveAttribute('tabindex')
  })

  it('says its sheet was too large to send, and how large where it was told', async () => {
    routes([
      brakkaView({
        sheet: undefined,
        sheetWithheld: {
          reason: 'tooLarge',
          bytes: 3_050_000,
          limit: 2_000_000,
        },
      }),
    ])
    const { unmount } = render(pane())
    expect(
      await screen.findByText('Brakka’s sheet is too large to send (3.1 MB).'),
    ).toBeInTheDocument()
    unmount()
    routes([
      brakkaView({
        sheet: undefined,
        sheetWithheld: { reason: 'tooLarge', bytes: null, limit: null },
      }),
    ])
    render(pane())
    expect(
      await screen.findByText('Brakka’s sheet is too large to send.'),
    ).toBeInTheDocument()
  })

  it('types in its dice as its character’s are typed, where its view offers it', async () => {
    const user = userEvent.setup()
    const onChange = jest.fn()
    routes([brakkaView({ manualDice: { offered: true, on: false } })])
    render(pane({ manualDice: { on: false, onChange } }))
    await user.click(await screen.findByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('switch', { name: /Enter dice results/ }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('is the creature its row names, numbered, and its character’s', async () => {
    globalThis.localStorage.setItem(TOASTS_KEY, 'on')
    routes([brakkaView()])
    render(
      pane({
        companion: { ...BRAKKA, kind: 'summoned', from: 'Find Familiar' },
        name: 'Bat 2',
      }),
    )
    const creature = await screen.findByRole('status', { name: 'Creature' })
    expect(JSON.parse(creature.textContent ?? '')).toEqual({
      name: 'Bat 2',
      relation: { kind: 'summoned', of: 'Thorin', from: 'Find Familiar' },
      character: 'Thorin',
    })
    expect(screen.getByRole('heading', { name: 'Bat 2' })).toBeInTheDocument()
  })

  it('acts right after its character, as its view says, with no initiative of its own to roll', async () => {
    routes([brakkaView({ initiative: { mode: 'after', after: 'Thorin' } })])
    render(pane())
    expect(
      await screen.findByRole('group', {
        name: 'Initiative, +2, acts right after Thorin',
      }),
    ).toHaveTextContent('After Thorin')
    expect(screen.queryByRole('button', { name: /^Initiative/ })).toBeNull()
  })

  describe('gone', () => {
    it('locks every roll on its sheet, its tabs still working, and throws and posts nothing', async () => {
      const user = userEvent.setup()
      const asked = routes([brakkaView()])
      render(pane({ gone: true }))
      const ability = await screen.findByRole('button', {
        name: 'Strength check, +4',
      })
      expect(ability).toBeDisabled()
      expect(ability).toHaveClass('cursor-not-allowed', 'opacity-50')
      await user.click(screen.getByRole('tab', { name: 'Actions' }))
      expect(screen.getByRole('tab', { name: 'Actions' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(
        screen.getByRole('button', { name: /^Bite attack/ }),
      ).toBeDisabled()
      expect(
        screen.getByRole('button', { name: /^Bite damage/ }),
      ).toBeDisabled()
      // An activity's own check and formula.
      expect(screen.getByRole('button', { name: /^Howl, / })).toBeDisabled()
      expect(screen.getByRole('button', { name: /^Roll Howl/ })).toBeDisabled()
      // A description's save, damage, check and formula, as it opens.
      await user.click(screen.getByRole('tab', { name: 'Features' }))
      await user.click(screen.getByText('Pack Tactics'))
      const save = await screen.findByRole('button', { name: 'DC 15 Strength' })
      expect(save).toBeDisabled()
      expect(
        screen.getByRole('button', { name: '2d6 fire, roll damage' }),
      ).toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'DC 12 Strength (Athletics)' }),
      ).toBeDisabled()
      expect(
        screen.getByRole('button', { name: '1d4, roll it' }),
      ).toBeDisabled()
      for (const button of [
        save,
        screen.getByRole('button', { name: '2d6 fire, roll damage' }),
        screen.getByRole('button', { name: '1d4, roll it' }),
      ]) {
        await user.click(button)
      }
      await user.click(screen.getByRole('tab', { name: 'Character' }))
      await user.click(
        screen.getByRole('button', { name: 'Strength check, +4' }),
      )
      expect(posts(asked)).toHaveLength(0)
      // Nothing was rolled here either: the tray still has no roll.
      expect(screen.getByRole('status')).toHaveTextContent(
        /^Tap an ability, skill or attack to roll it/,
      )
    })

    it('rolls nothing from a menu opened before it left', async () => {
      const user = userEvent.setup()
      const asked = routes([brakkaView()])
      const { rerender } = render(pane())
      await user.click(await screen.findByRole('tab', { name: 'Features' }))
      await user.click(screen.getByText('Pack Tactics'))
      await user.click(
        await screen.findByRole('button', { name: 'DC 15 Strength' }),
      )
      const menu = screen.getByRole('menu')
      rerender(pane({ gone: true }))
      await user.click(
        within(menu).getByRole('menuitem', { name: /^Roll my Strength save/ }),
      )
      expect(posts(asked)).toHaveLength(0)
      expect(screen.getByRole('status')).toHaveTextContent(
        /^Tap an ability, skill or attack to roll it/,
      )
    })

    it('locks the damage of an attack made before it left', async () => {
      const user = userEvent.setup()
      const views: CompanionView[] = [brakkaView()]
      const asked = routes(views, {
        'req-1': {
          status: 'done',
          visible: true,
          total: 17,
          attack: { outcome: 'hit' },
          damage: {
            critical: false,
            plannable: true,
            rolls: [
              {
                formula: '1d8 + 3',
                type: 'slashing',
                dice: [{ faces: 8, number: 1 }],
              },
            ],
          },
        },
      })
      const { rerender } = render(pane())
      await user.click(await screen.findByRole('tab', { name: 'Actions' }))
      await user.click(screen.getByRole('button', { name: /^Bite attack/ }))
      const roll = await screen.findByRole(
        'button',
        { name: 'Roll damage' },
        { timeout: 3000 },
      )
      expect(roll).toBeEnabled()
      rerender(pane({ gone: true }))
      expect(screen.getByRole('button', { name: 'Roll damage' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Roll damage' }))
      expect(posts(asked)).toHaveLength(1)
    })
  })

  it('is hidden while another is shown, its panel out of the page', async () => {
    routes([brakkaView()])
    render(pane({ shown: false }))
    const panel = document.querySelector('#creature-panel-wolfBrakka')
    expect(panel).toHaveAttribute('hidden')
    expect(panel).toHaveClass('hidden')
    expect(within(panel as HTMLElement).queryByRole('tab')).toBeNull()
  })
})

describe('the Gamemaster’s seat', () => {
  it('says the game is theirs', async () => {
    routes([brakkaView({ connected: false })])
    render(
      pane({
        seat: {
          role: 'gm',
          api: '/api/characters/char-1',
          key: 'gm:c1:char-1',
        },
      }),
    )
    expect(
      await screen.findByText(/Brakka is no longer with Thorin in your game\./),
    ).toBeInTheDocument()
  })
})

/** Brakka's sheet, its own Dexterity save +4, not its character's. */
const nimble = () => {
  const sheet = mockCompanionSheet()
  return toTableSheet(
    mockCompanionSheet({
      abilities: sheet.abilities.map(ability =>
        ability.id === 'dex' ? { ...ability, save: 4 } : ability,
      ),
    }),
    GAME,
  )
}

/** Brakka's view, asked a Dexterity save as the game asks companions, from module 0.41.0. */
const asked = (fields: Partial<CompanionView> = {}): CompanionView =>
  brakkaView({
    sheet: nimble(),
    rollsToTable: ['ability', 'save', 'attack', 'damage'],
    rollFeatures: ['prompts', 'companionPrompts'],
    prompts: [
      {
        id: 'msg1-wolfBrakka',
        type: 'save',
        abilities: ['dex'],
        dc: 13,
        label: 'Burning Hands',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
    ],
    ...fields,
  })

describe('CompanionPane, the saves the game asks of it, from module 0.41.0 (round 0.41.0 §3.7)', () => {
  it('asks on its own banner, with its own save modifier, and answers through its own routes', async () => {
    const user = userEvent.setup()
    const routed = routes([asked()])
    render(pane())

    const banner = await screen.findByRole('region', {
      name: 'Your Gamemaster asks',
    })
    expect(banner).toHaveTextContent('Dexterity saving throw')
    expect(banner).toHaveTextContent('DC 13 · Burning Hands')
    // Its heading's id its pane's own, as the character's pane has one too.
    expect(within(banner).getByRole('heading')).toHaveAttribute(
      'id',
      'creature-wolfBrakka-prompts-heading',
    )
    await user.click(
      within(banner).getByRole('button', {
        name: 'Roll Dexterity saving throw, +4',
      }),
    )

    expect(posts(routed)).toEqual([
      expect.objectContaining({
        url: `${API}/rolls`,
        body: expect.objectContaining({
          kind: 'save',
          key: 'dex',
          prompt: 'msg1-wolfBrakka',
        }),
      }),
    ])
  })

  it('has no banner without prompts, nor once it’s no longer its character’s', async () => {
    routes([asked({ prompts: [] })])
    const { unmount } = render(pane())
    await screen.findByRole('button', { name: 'Strength check, +4' })
    expect(
      screen.queryByRole('region', { name: 'Your Gamemaster asks' }),
    ).toBeNull()
    unmount()

    routes([asked()])
    render(pane({ gone: true }))
    await screen.findByRole('tablist', { name: 'Character sheet' })
    expect(
      screen.queryByRole('region', { name: 'Your Gamemaster asks' }),
    ).toBeNull()
  })

  it('says the game is the Gamemaster’s own at their seat', async () => {
    routes([asked()])
    render(
      pane({
        seat: {
          role: 'gm',
          api: '/api/characters/char-1',
          key: 'gm:c1:char-1',
        },
      }),
    )

    expect(
      await screen.findByRole('region', { name: 'Your game asks' }),
    ).toBeInTheDocument()
  })
})
