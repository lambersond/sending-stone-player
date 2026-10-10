/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from './character-pane'
import {
  characterSheet,
  fullerSheet,
  sheetAction,
  sheetFavorites,
  sheetItem,
  TEXTS,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { RolledDice, RollFeature, RollKind } from '@/types/roll'
import type { CharacterSheet, SheetUse } from '@/types/sending-stone'
import type { TableCombat } from '@/types/table'

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const GAME = 'https://my-game.forge-vtt.com'

type User = ReturnType<typeof userEvent.setup>

const renderPane = (sheet: CharacterSheet = fullerSheet()) =>
  render(
    <CharacterPane
      characterId='char-1'
      name='Thorin Oakenshield'
      sheet={toTableSheet(sheet, GAME)}
    />,
  )

/** Thorin's sheet, with his favorites. */
const favored = (favorites = sheetFavorites()) => fullerSheet({ favorites })

/** The sheet this many pixels wide, as a browser would lay it out. */
const wide = (width: number) =>
  jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width)

/** The button that opens an action's row, by its name. */
const toggleOf = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${name}`), expanded: false })

/** Shows a tab of the sheet. */
const show = (name: string) =>
  userEvent
    .setup()
    .click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }))

/** An activity the game uses, as the module describes it from 0.12.0. */
const activity = (
  id: string,
  type: SheetUse['type'],
  targets: Partial<SheetUse['targets']>,
): SheetUse => ({
  id,
  type,
  targets: {
    self: false,
    area: false,
    count: null,
    perLevel: null,
    affects: null,
    ...targets,
  },
})

/**
 * Thorin's sheet, with the activities of his actions: Fire Breath's saving throw at an area,
 * Second Wind's healing and Shield on himself; and with Cure Wounds, which he has 2nd-level
 * slots to cast at too, and a breath weapon whose kind of damage he chooses.
 */
const casting = (): CharacterSheet => {
  const sheet = fullerSheet()
  const activities: Record<string, SheetUse> = {
    breath: activity('breathSave', 'save', {
      area: true,
      affects: 'creature',
    }),
    'second-wind': activity('windHeal', 'heal', {
      self: true,
      affects: 'self',
    }),
    shield: activity('shieldCast', 'utility', {
      self: true,
      affects: 'self',
    }),
  }
  const added = [
    sheetAction({
      id: 'cure',
      name: 'Cure Wounds',
      type: 'spell',
      range: 'Touch',
      level: 1,
      damage: [{ formula: '2d8 + 3', type: 'Healing', healing: true }],
      activity: activity('cureHeal', 'heal', {
        count: 1,
        affects: 'creature',
      }),
    }),
    sheetAction({
      id: 'dragon-breath',
      name: 'Breath Weapon',
      range: '15 ft',
      target: '15 ft Cone',
      save: { ability: 'DEX', dc: 13 },
      damage: [{ formula: '1d10', type: 'Acid or Fire', healing: false }],
      activity: activity('dragonBreathSave', 'save', {
        area: true,
        affects: 'creature',
      }),
    }),
  ]
  return {
    ...sheet,
    spells: sheet.spells.map(section =>
      section.id === 'spell2'
        ? { ...section, slots: { value: 2, max: 3, level: 2 } }
        : section,
    ),
    actions: sheet.actions.map(section => ({
      ...section,
      actions: [
        ...section.actions.map(action => ({
          ...action,
          activity: activities[action.id] ?? null,
        })),
        ...(section.id === 'action' ? added : []),
      ],
    })),
  }
}

/**
 * The game, which makes each use as it answers it by the request's id, and the damage that
 * follows: everything posted, in order.
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
    const answer = answers[id] ?? { id, status: 'pending' }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id, ...answer }),
    } as Response
  }) as typeof fetch
  return posted
}

/** A use the game made, whose damage or healing is to follow. */
const used = (type: string, damage: unknown) => ({
  status: 'done',
  visible: true,
  rolls: [],
  use: { type },
  damage,
})

/** Healing, as a part of what something rolls. */
const healing = (formula: string) => [
  { formula, type: 'Healing', healing: true },
]

const SAVE =
  '<p>Make a <span class="ss-save roll" data-n="0" data-ability="str" data-dc="15">DC 15 Strength</span> saving throw or take <span class="ss-damage roll" data-n="1" data-formulas="2d6" data-types="fire">2d6 fire</span> and fall <span class="ss-condition ref" data-condition="prone">Prone</span>.</p>'

/**
 * The game, which has each description's HTML by its hash, and makes each roll as it answers
 * it by the request's id: everything posted, in order.
 */
const describing = (
  html: Record<string, string>,
  answers: Record<string, Record<string, unknown>> = {},
) => {
  const posted: Record<string, unknown>[] = []
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const hash = /\/texts\/(\w+)$/.exec(String(url))?.[1]
    if (hash) {
      return {
        ok: true,
        json: async () => ({ html: html[hash] ?? '<p>Nothing.</p>' }),
      } as Response
    }
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

/** Opens Second Wind on the Features tab, to its description. */
const openSecondWind = async () => {
  const user = userEvent.setup()
  await show('Features')
  await user.click(screen.getByText('Second Wind'))
  await screen.findByRole('button', { name: 'DC 15 Strength' })
  return user
}

describe('components/character-sheet/character-pane', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            html: '<p>Regain <span class="roll">1d10 + 5</span> hit points.</p>',
          }),
        }) as Response,
    )
  })

  it('rolls from the sheet into the tray', async () => {
    const user = userEvent.setup()
    renderPane(characterSheet())

    await user.click(
      screen.getByRole('button', {
        name: 'Strength saving throw, +7, proficient',
      }),
    )

    const status = await screen.findByText('Strength saving throw')
    const total = Number(status.parentElement?.previousSibling?.textContent)
    expect(total).toBeGreaterThanOrEqual(8)
    expect(total).toBeLessThanOrEqual(27)
    expect(screen.getByRole('status')).toHaveTextContent('+7')
  })

  it('asks the player on every tab for the saves the game asks of them, and answers from there', async () => {
    const user = userEvent.setup()
    globalThis.localStorage.clear()
    const posted = answering({
      'req-1': { status: 'done', visible: true, total: 18, outcome: 'success' },
    })
    const ask = {
      id: 'msg2-thorin',
      type: 'concentration' as const,
      abilities: ['con'],
      label: 'Bless',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }
    render(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(characterSheet(), GAME)}
        rollsToTable={['save']}
        rollFeatures={['prompts']}
        prompts={[ask]}
      />,
    )
    await show('Biography')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    const banner = screen.getByRole('region', { name: 'Your Gamemaster asks' })
    expect(banner).toHaveTextContent('Concentration checkBless')
    await user.click(
      within(banner).getByRole('button', {
        name: 'Roll Concentration check, +6',
      }),
    )

    expect(posted).toEqual([
      expect.objectContaining({ kind: 'save', key: 'con', prompt: ask.id }),
    ])
    // Its roll shows on this tab too, and how it went at the table.
    expect(screen.getByRole('status')).toHaveTextContent('Concentration check')
    expect(
      await screen.findByText('At the table:', {}, { timeout: 3000 }),
    ).toHaveTextContent('At the table: 18 · Saved')
  })

  it("asks nothing where the game doesn't take the player's saves now", () => {
    render(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(characterSheet(), GAME)}
        prompts={[
          {
            id: 'msg2-thorin',
            type: 'concentration',
            abilities: ['con'],
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        ]}
      />,
    )

    expect(
      screen.queryByRole('region', { name: 'Your Gamemaster asks' }),
    ).not.toBeInTheDocument()
  })

  it("sends a roll to the Gamemaster's game, when it takes the player's rolls, and shows its total there", async () => {
    const user = userEvent.setup()
    globalThis.localStorage.clear()
    const responses: Record<string, unknown> = {
      'POST /api/characters/char-1/rolls': { id: 'req-1' },
      'GET /api/characters/char-1/rolls/req-1': {
        id: 'req-1',
        status: 'done',
        visible: true,
        total: 31,
      },
    }
    globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      const answer = responses[`${init?.method ?? 'GET'} ${url}`]
      return {
        ok: answer !== undefined,
        status: init?.method === 'POST' ? 202 : 200,
        json: async () => answer,
      } as Response
    }) as typeof fetch
    render(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(characterSheet(), GAME)}
        rollsToTable={['save']}
      />,
    )

    expect(
      screen.getByRole('switch', { name: 'Send to the table' }),
    ).toBeChecked()
    await user.click(
      screen.getByRole('button', {
        name: 'Strength saving throw, +7, proficient',
      }),
    )

    expect(fetch).toHaveBeenCalledWith(
      '/api/characters/char-1/rolls',
      expect.objectContaining({ method: 'POST' }),
    )
    const sent = JSON.parse(
      String(jest.mocked(fetch).mock.calls[0][1]?.body),
    ) as { kind: string; key: string; dice: { results: number[] }[] }
    expect(sent).toMatchObject({ kind: 'save', key: 'str', mode: 0 })
    const natural = sent.dice[0].results[0]
    expect(screen.getByRole('status')).toHaveTextContent(`d20 ${natural} +7`)
    expect(
      await screen.findByText('At the table:', {}, { timeout: 3000 }),
    ).toHaveTextContent('At the table: 31')

    // A check the game doesn't take stays here.
    await user.click(screen.getByRole('button', { name: /^Athletics check/ }))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("spends a hit die in the Gamemaster's game, when it takes them, with the same die", async () => {
    const user = userEvent.setup()
    globalThis.localStorage.clear()
    const posted: Record<string, unknown>[] = []
    globalThis.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posted.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return {
          ok: true,
          status: 202,
          json: async () => ({ id: 'req-1' }),
        } as Response
      }
      const answer = {
        id: 'req-1',
        status: 'done',
        visible: true,
        total: 9,
        healed: 4,
      }
      return { ok: true, status: 200, json: async () => answer } as Response
    }) as typeof fetch
    render(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(fullerSheet(), GAME)}
        rollsToTable={['hitDie']}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Use a d10 hit die, 3 of 5 left' }),
    )

    expect(posted).toEqual([
      {
        kind: 'hitDie',
        denomination: 'd10',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 10, results: [expect.any(Number)] }],
      },
    ])
    const [die] = (posted[0].dice as { results: number[] }[])[0].results
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(
      `${Math.max(1, die + 3)}Hit die (d10)1d10 (${die}) +3`,
    )
    await waitFor(
      () => expect(status).toHaveTextContent('At the table: 9 · 4 HP regained'),
      { timeout: 3000 },
    )
  })

  it("spends hit dice used at once in the Gamemaster's game a request a die, one after another, and says what came of them all", async () => {
    const user = userEvent.setup()
    globalThis.localStorage.clear()
    const posted: Record<string, unknown>[] = []
    // Each made at the table once asked after, giving back 4 then 6.
    const healed = [4, 6]
    globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posted.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return {
          ok: true,
          status: 202,
          json: async () => ({ id: `req-${posted.length}` }),
        } as Response
      }
      const id = url.split('/').at(-1) ?? ''
      const answer = {
        id,
        status: 'done',
        visible: true,
        total: healed[Number(id.slice(4)) - 1],
        healed: healed[Number(id.slice(4)) - 1],
      }
      return { ok: true, status: 200, json: async () => answer } as Response
    }) as typeof fetch
    render(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(fullerSheet(), GAME)}
        rollsToTable={['hitDie']}
      />,
    )

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('button', {
        name: 'Use a d10 hit die, 3 of 5 left',
      }),
    })
    const popover = screen.getByRole('dialog', { name: 'Use d10 hit dice' })
    await user.click(
      within(popover).getByRole('button', { name: 'One die more' }),
    )
    expect(popover).toHaveTextContent('Heals 2d10 + 6')
    await user.click(
      within(popover).getByRole('button', { name: 'Use 2 d10 hit dice' }),
    )

    // One throw of both dice, in the tray as one roll; the first die sent alone.
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(
      /^\d+Hit dice \(2d10\)2d10 \(\d+, \d+\) \+6/,
    )
    expect(posted).toHaveLength(1)
    await waitFor(() => expect(posted).toHaveLength(2), { timeout: 3000 })
    const dice = posted.map(({ dice }) => dice as RolledDice[])
    expect(dice).toEqual([
      [{ faces: 10, results: [expect.any(Number)] }],
      [{ faces: 10, results: [expect.any(Number)] }],
    ])
    expect(status).toHaveTextContent(
      `2d10 (${dice[0][0].results[0]}, ${dice[1][0].results[0]})`,
    )
    expect(
      posted.every(
        ({ kind, denomination }) => kind === 'hitDie' && denomination === 'd10',
      ),
    ).toBe(true)
    await waitFor(
      () =>
        expect(status).toHaveTextContent('At the table: 10 · 10 HP regained'),
      { timeout: 3000 },
    )
  })

  it("uses hit dice from the Character tab and a class's favorite, whether or not the game spends them, but not from the Features tab", async () => {
    globalThis.localStorage.clear()
    const favoredFighter = favored([
      ...sheetFavorites(),
      {
        type: 'item',
        id: 'fighter',
        itemType: 'class',
        name: 'Fighter',
        img: null,
      },
    ])
    const { rerender } = render(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(favoredFighter, GAME)}
        rollsToTable={['skill']}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Use a d10 hit die, 3 of 5 left' }),
    ).toHaveTextContent(/^Use$/)
    await show('Features')
    expect(
      within(screen.getByRole('region', { name: 'Classes' })).queryByRole(
        'button',
      ),
    ).toBeNull()
    await show('Actions')
    const favorites = screen.getByRole('region', { name: /^Favorites/ })
    expect(
      within(favorites).getByRole('button', {
        name: 'Use a d10 hit die, 3 of 5 left',
      }),
    ).toHaveTextContent(/^Use$/)

    // The same once the game takes them.
    rerender(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(favoredFighter, GAME)}
        rollsToTable={['skill', 'hitDie']}
      />,
    )
    expect(
      within(favorites).getByRole('button', {
        name: 'Use a d10 hit die, 3 of 5 left',
      }),
    ).toHaveTextContent(/^Use$/)
    expect(
      screen.queryByRole('button', { name: /^(Spend|Roll) d10/ }),
    ).toBeNull()
  })

  it("has Tidy 5e's tabs, and shows one part of the sheet at a time", async () => {
    const user = userEvent.setup()
    renderPane()

    const tabs = within(
      screen.getByRole('tablist', { name: 'Character sheet' }),
    )
    expect(tabs.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Character',
      'Actions',
      'Inventory',
      'Spells',
      'Features',
      'Effects, 3 conditions',
      'Biography',
    ])
    expect(tabs.getByRole('tab', { name: 'Character' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Character')
    // The class line is by the character's name, in the page's header, not beside the tabs.
    const tabsRow = screen.getByRole('tablist', {
      name: 'Character sheet',
    }).parentElement
    expect(tabsRow?.children).toHaveLength(1)
    expect(tabsRow).not.toHaveTextContent('Fighter 5 · Champion')

    await user.click(tabs.getByRole('tab', { name: 'Features' }))

    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Features')
    expect(
      screen.getByRole('heading', { name: 'Fighter Features' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Abilities' })).toBeNull()
    // Rolls are made from the features, as from the Character tab, so the tray is there too.
    expect(
      screen.getByRole('region', { name: 'Your rolls' }),
    ).toBeInTheDocument()

    await user.click(tabs.getByRole('tab', { name: 'Biography' }))

    expect(screen.queryByRole('region', { name: 'Your rolls' })).toBeNull()
  })

  it.each([
    ['Actions', 'Bonus Actions'],
    ['Inventory', 'Weapons'],
    ['Spells', 'Spellcasting'],
    ['Effects', 'Conditions'],
    ['Biography', 'Details'],
  ])('shows %s', async (name, heading) => {
    const user = userEvent.setup()
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
    renderPane()

    await user.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }))

    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(
      new RegExp(`^${name}`),
    )
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('labels only the chosen tab where all the labels might not fit, naming each for screen readers', async () => {
    const user = userEvent.setup()
    renderPane()

    const label = (name: string) =>
      screen.getByRole('tab', { name: new RegExp(`^${name}`) })
        .firstElementChild?.nextElementSibling
    expect(label('Character')).not.toHaveClass('sr-only')
    expect(label('Inventory')).toHaveClass('sr-only', '@3xl:not-sr-only')
    expect(screen.getByRole('tab', { name: 'Inventory' })).toHaveAttribute(
      'title',
      'Inventory',
    )

    await user.click(screen.getByRole('tab', { name: 'Inventory' }))

    expect(label('Inventory')).not.toHaveClass('sr-only')
    expect(label('Character')).toHaveClass('sr-only')
  })

  it("has no Spells tab for a character who doesn't cast", () => {
    renderPane(characterSheet())

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Character',
      'Actions',
      'Inventory',
      'Features',
      'Effects',
      'Biography',
    ])
  })

  it('has a Spells tab for a character with spells but no spellcasting class', () => {
    const sheet = fullerSheet()
    renderPane({ ...sheet, spellcasting: null })

    expect(screen.getByRole('tab', { name: 'Spells' })).toBeInTheDocument()
  })

  it('shows the character when the tab shown is gone', async () => {
    const user = userEvent.setup()
    const sheet = fullerSheet()
    const { rerender } = renderPane(sheet)
    await user.click(screen.getByRole('tab', { name: 'Spells' }))

    rerender(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet({ ...sheet, spellcasting: null, spells: [] }, GAME)}
      />,
    )

    expect(screen.queryByRole('tab', { name: 'Spells' })).toBeNull()
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Character')
  })

  it('rolls attacks and damage from Actions into the tray, which shows there too', async () => {
    const user = userEvent.setup()
    renderPane()
    await user.click(screen.getByRole('tab', { name: 'Actions' }))

    await user.click(
      screen.getByRole('button', { name: 'Warhammer attack, +7' }),
    )
    const status = screen.getByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('Warhammer attack'))
    expect(status).toHaveTextContent(/d20 \d+ \+7/)

    await user.click(
      screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
    )
    await waitFor(() => expect(status).toHaveTextContent('Warhammer damage'))
    expect(status).toHaveTextContent(/1d8 \(\d\) \+4 Bludgeoning/)
  })

  describe('attacks at the table', () => {
    const fight: TableCombat = {
      id: 'cmbt1',
      name: null,
      started: true,
      round: 1,
      combatants: [
        {
          id: 'goblin1',
          name: 'Goblin',
          initiative: 15,
          defeated: false,
          side: 'other',
        },
        {
          id: 'thorin1',
          name: 'Thorin Oakenshield',
          initiative: 12,
          defeated: false,
          side: 'me',
        },
      ],
    }
    const preview = {
      critical: false,
      plannable: true,
      rolls: [
        {
          formula: '1d8 + 4',
          type: 'bludgeoning',
          dice: [{ faces: 8, number: 1 }],
        },
      ],
    }

    /** The game, which makes the attack, a hit, then its damage. */
    const game = () => {
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
        const answer =
          url === '/api/characters/char-1/rolls/req-1'
            ? {
                id: 'req-1',
                status: 'done',
                visible: true,
                total: 19,
                attack: { critical: false, fumble: false, outcome: 'hit' },
                damage: preview,
              }
            : { id: 'req-2', status: 'done', visible: true, total: 9 }
        return { ok: true, status: 200, json: async () => answer } as Response
      }) as typeof fetch
      return posted
    }

    const renderFight = (combat: TableCombat | null = fight) =>
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(fullerSheet(), GAME)}
          combat={combat ?? undefined}
          rollsToTable={['attack', 'damage']}
        />,
      )

    beforeEach(() => {
      globalThis.localStorage.clear()
    })

    it('makes an attack at the combatant picked, then rolls its damage there', async () => {
      const user = userEvent.setup()
      const posted = game()
      renderFight()
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', { name: 'Warhammer attack, +7' }),
      )
      const picker = screen.getByRole('dialog', { name: 'Warhammer attack' })
      // Nothing is rolled until a target is picked.
      expect(fetch).not.toHaveBeenCalled()
      expect(within(picker).queryByText('Thorin Oakenshield')).toBeNull()
      await user.click(within(picker).getByRole('button', { name: 'Goblin' }))

      expect(posted[0]).toMatchObject({
        kind: 'attack',
        item: 'warhammer',
        activity: 'warhammerAttack',
        target: { combatId: 'cmbt1', combatantId: 'goblin1' },
      })
      const status = screen.getByRole('status')
      await waitFor(
        () => expect(status).toHaveTextContent('At the table: 19 · Hit'),
        { timeout: 3000 },
      )

      await user.click(screen.getByRole('button', { name: 'Roll damage' }))
      expect(posted[1]).toMatchObject({
        kind: 'damage',
        use: 'req-1',
        dice: [{ faces: 8, results: [expect.any(Number)] }],
      })
      await waitFor(() => expect(status).toHaveTextContent('Warhammer damage'))
      const [die] = (posted[1].dice as { results: number[] }[])[0].results
      expect(status).toHaveTextContent(`1d8 (${die}) +4 bludgeoning`)
      await waitFor(() => expect(status).toHaveTextContent('At the table: 9'), {
        timeout: 3000,
      })
      // Its damage is rolled once.
      expect(screen.queryByRole('button', { name: 'Roll damage' })).toBeNull()
    })

    it('makes an area attack at those ticked, where the game makes it so, and says whom it hit', async () => {
      const user = userEvent.setup()
      const posted: Record<string, unknown>[] = []
      globalThis.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          posted.push(JSON.parse(String(init.body)) as Record<string, unknown>)
          return {
            ok: true,
            status: 202,
            json: async () => ({ id: 'req-1' }),
          } as Response
        }
        const answer = {
          id: 'req-1',
          status: 'done',
          visible: true,
          total: 17,
          attack: {
            critical: false,
            fumble: false,
            outcome: null,
            targets: [
              { combatId: 'cmbt1', combatantId: 'goblin1', outcome: 'hit' },
              { combatId: 'cmbt1', combatantId: 'boss1', outcome: 'miss' },
            ],
          },
          damage: null,
        }
        return { ok: true, status: 200, json: async () => answer } as Response
      }) as typeof fetch
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(
            characterSheet({
              actions: [
                {
                  id: 'action',
                  label: 'Actions',
                  actions: [
                    sheetAction({
                      id: 'breath',
                      name: 'Breath Weapon',
                      attackId: 'breathAttack',
                      toHit: 5,
                      attackArea: {
                        count: null,
                        perLevel: null,
                        affects: 'creature',
                      },
                    }),
                  ],
                },
              ],
            }),
            GAME,
          )}
          combat={{
            ...fight,
            combatants: [
              ...fight.combatants,
              {
                id: 'boss1',
                name: 'Goblin Boss',
                initiative: 8,
                defeated: false,
                side: 'other',
              },
            ],
          }}
          rollsToTable={['attack', 'damage']}
          rollFeatures={['areaAttacks']}
        />,
      )
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', { name: 'Breath Weapon attack, +5' }),
      )
      const picker = screen.getByRole('dialog', {
        name: 'Breath Weapon attack',
      })
      await user.click(
        within(picker).getByRole('checkbox', { name: /^Goblin$/ }),
      )
      await user.click(
        within(picker).getByRole('checkbox', { name: /^Goblin Boss/ }),
      )
      await user.click(
        within(picker).getByRole('button', { name: 'Attack 2 targets' }),
      )

      expect(posted[0]).toMatchObject({
        kind: 'attack',
        item: 'breath',
        activity: 'breathAttack',
        targets: [
          { combatId: 'cmbt1', combatantId: 'goblin1' },
          { combatId: 'cmbt1', combatantId: 'boss1' },
        ],
      })
      expect(posted[0]).not.toHaveProperty('target')
      const status = screen.getByRole('status')
      await waitFor(
        () => expect(status).toHaveTextContent('At the table: 17 · Hit 1 of 2'),
        { timeout: 3000 },
      )
      expect(
        within(within(status).getByRole('list', { name: 'Targets' }))
          .getAllByRole('listitem')
          .map(item => item.textContent),
      ).toEqual(['Goblin: Hit', 'Goblin Boss: Miss'])
    })

    it("rolls a waiting attack's damage from its damage chip, as the game said", async () => {
      const user = userEvent.setup()
      const posted = game()
      renderFight()
      await user.click(screen.getByRole('tab', { name: 'Actions' }))
      await user.click(
        screen.getByRole('button', { name: 'Warhammer attack, +7' }),
      )
      await user.click(screen.getByRole('button', { name: 'No target' }))
      expect(posted[0]).toMatchObject({ kind: 'attack', target: null })
      await screen.findByText(/· Hit/, {}, { timeout: 3000 })

      await user.click(
        screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
      )

      expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
    })

    it('makes an attack at once, at no one, out of combat', async () => {
      const user = userEvent.setup()
      const posted = game()
      renderFight(null)
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', { name: 'Warhammer attack, +7' }),
      )

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(posted[0]).toMatchObject({ kind: 'attack', target: null })
    })

    it("asks no target for an attack the game doesn't take", async () => {
      const user = userEvent.setup()
      game()
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(fullerSheet(), GAME)}
          combat={fight}
          rollsToTable={['skill', 'save']}
        />,
      )
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', { name: 'Warhammer attack, +7' }),
      )

      expect(screen.queryByRole('dialog')).toBeNull()
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Warhammer attack',
        ),
      )
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('spells and features at the table', () => {
    const fight: TableCombat = {
      id: 'cmbt1',
      name: null,
      started: true,
      round: 1,
      combatants: [
        {
          id: 'goblin1',
          name: 'Goblin',
          initiative: 15,
          defeated: false,
          side: 'other',
        },
        {
          id: 'goblin2',
          name: 'Goblin Archer',
          initiative: 14,
          defeated: false,
          side: 'other',
        },
        {
          id: 'thorin1',
          name: 'Thorin Oakenshield',
          initiative: 12,
          defeated: false,
          side: 'me',
        },
        {
          id: 'vex1',
          name: 'Vex',
          initiative: 9,
          defeated: false,
          side: 'party',
        },
      ],
    }

    const fire = {
      critical: false,
      plannable: true,
      rolls: [
        { formula: '2d6', type: 'fire', dice: [{ faces: 6, number: 2 }] },
      ],
    }

    const renderCasting = ({
      combat = fight,
      kinds = ['use', 'attack', 'damage'],
      features = [],
    }: {
      combat?: TableCombat | null
      kinds?: RollKind[]
      features?: RollFeature[]
    } = {}) =>
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(casting(), GAME)}
          combat={combat ?? undefined}
          rollsToTable={kinds}
          rollFeatures={features}
        />,
      )

    beforeEach(() => {
      globalThis.localStorage.clear()
    })

    it('uses a feature at those ticked in its area, then rolls its damage there at once, once', async () => {
      const user = userEvent.setup()
      const posted = answering({
        'req-1': used('save', fire),
        'req-2': { status: 'done', visible: true, total: 7 },
      })
      renderCasting()
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', {
          name: 'Fire Breath, DEX saving throw DC 13',
        }),
      )
      const picker = screen.getByRole('dialog', { name: 'Fire Breath' })
      // Nothing is used until its targets are picked: anyone in the area but its user.
      expect(fetch).not.toHaveBeenCalled()
      expect(
        within(picker).getByText('Tick who is caught in the area.'),
      ).toBeInTheDocument()
      expect(within(picker).queryByText('Thorin Oakenshield')).toBeNull()
      await user.click(within(picker).getByRole('checkbox', { name: 'Goblin' }))
      await user.click(
        within(picker).getByRole('checkbox', { name: 'Goblin Archer' }),
      )
      await user.click(
        within(picker).getByRole('button', { name: 'Use at 2 targets' }),
      )

      expect(posted[0]).toEqual({
        kind: 'use',
        item: 'breath',
        activity: 'breathSave',
        targets: [
          { combatId: 'cmbt1', combatantId: 'goblin1' },
          { combatId: 'cmbt1', combatantId: 'goblin2' },
        ],
        slot: null,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      })
      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Fire Breath')
      // Its damage is thrown here and sent as soon as the game has used it, with no tap.
      await waitFor(() => expect(posted).toHaveLength(2), { timeout: 3000 })
      expect(posted[1]).toMatchObject({
        kind: 'damage',
        use: 'req-1',
        dice: [{ faces: 6, results: [expect.any(Number), expect.any(Number)] }],
      })
      await waitFor(() =>
        expect(status).toHaveTextContent('Fire Breath damage'),
      )
      const [first, second] = (posted[1].dice as { results: number[] }[])[0]
        .results
      expect(status).toHaveTextContent(`2d6 (${first}, ${second}) fire`)
      await waitFor(() => expect(status).toHaveTextContent('At the table: 7'), {
        timeout: 3000,
      })
      expect(posted).toHaveLength(2)
      expect(screen.queryByRole('button', { name: /^Roll/ })).toBeNull()
      // The use stays among the rolls, made at the table.
      const tray = within(screen.getByRole('region', { name: 'Your rolls' }))
      await user.click(tray.getByText('Earlier rolls (1)'))
      expect(tray.getByRole('listitem')).toHaveTextContent(
        /^Fire Breath\s*used\s*· at the table$/,
      )
    })

    it("uses a feature with its damage changed, from its damage chip's menu, where the game takes it so", async () => {
      const user = userEvent.setup()
      const posted = answering({
        'req-1': used('save', fire),
        'req-2': { status: 'done', visible: true, total: 12 },
      })
      const { unmount } = renderCasting()
      await user.click(screen.getByRole('tab', { name: 'Actions' }))
      // Where the game doesn't take damage changed, its chip just uses it.
      fireEvent.contextMenu(
        screen.getByRole('button', { name: 'Fire Breath damage, 2d6' }),
      )
      expect(screen.queryByRole('menu')).toBeNull()
      unmount()

      renderCasting({ features: ['modifiers'] })
      await user.click(screen.getByRole('tab', { name: 'Actions' }))
      fireEvent.contextMenu(
        screen.getByRole('button', { name: 'Fire Breath damage, 2d6' }),
      )
      const menu = screen.getByRole('menu', { name: 'Fire Breath damage 2d6' })
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map(item => item.textContent),
      ).toEqual(['Use with maximum damage', 'Use with damage modified…'])
      await user.click(
        within(menu).getByRole('menuitem', { name: 'Use with maximum damage' }),
      )
      const picker = screen.getByRole('dialog', { name: 'Fire Breath' })
      await user.click(within(picker).getByRole('checkbox', { name: 'Goblin' }))
      await user.click(
        within(picker).getByRole('button', { name: 'Use at 1 target' }),
      )

      // The use asks nothing of its damage; its damage, which follows, is at its highest.
      expect(posted[0]).toMatchObject({ kind: 'use', item: 'breath' })
      expect(posted[0]).not.toHaveProperty('modifiers')
      await waitFor(() => expect(posted).toHaveLength(2), { timeout: 3000 })
      expect(posted[1]).toMatchObject({
        kind: 'damage',
        use: 'req-1',
        dice: [{ faces: 6, results: [6, 6] }],
        modifiers: { maximize: true },
      })
      const status = screen.getByRole('status')
      await waitFor(() =>
        expect(status).toHaveTextContent('2d6 (6, 6) fire · Maximum'),
      )
    })

    it('asks the kind of damage first, where the game offers a choice, then rolls it as that kind', async () => {
      const user = userEvent.setup()
      const posted = answering({
        'req-1': used('save', {
          critical: false,
          plannable: true,
          rolls: [
            {
              formula: '1d10',
              type: 'acid',
              types: [
                { key: 'acid', label: 'Acid' },
                { key: 'fire', label: 'Fire' },
              ],
              dice: [{ faces: 10, number: 1 }],
            },
          ],
        }),
        'req-2': { status: 'done', visible: true, total: 6 },
      })
      // Out of a fight, there's no one to pick: it's used at once.
      renderCasting({ combat: null })
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', { name: 'Breath Weapon damage, 1d10' }),
      )

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(posted[0]).toMatchObject({
        kind: 'use',
        item: 'dragon-breath',
        activity: 'dragonBreathSave',
        targets: [],
      })
      const status = screen.getByRole('status')
      await waitFor(
        () => expect(status).toHaveTextContent('Choose its kind of damage:'),
        { timeout: 3000 },
      )
      expect(status).toHaveTextContent('Used at the table')
      expect(posted).toHaveLength(1)

      await user.click(screen.getByRole('button', { name: 'Roll Fire damage' }))

      expect(posted[1]).toMatchObject({
        kind: 'damage',
        use: 'req-1',
        types: ['fire'],
        dice: [{ faces: 10, results: [expect.any(Number)] }],
      })
      await waitFor(() =>
        expect(status).toHaveTextContent('Breath Weapon damage'),
      )
      expect(status).toHaveTextContent(/1d10 \(\d+\) Fire/)
      await waitFor(() => expect(status).toHaveTextContent('At the table: 6'), {
        timeout: 3000,
      })
      expect(screen.queryByRole('button', { name: /^Roll/ })).toBeNull()
    })

    it('uses a feature on its user at once, with no one to pick, and heals them', async () => {
      const user = userEvent.setup()
      const posted = answering({
        'req-1': used('heal', {
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
        }),
        'req-2': { status: 'done', visible: true, total: 11 },
      })
      renderCasting()
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }),
      )

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(posted[0]).toMatchObject({
        kind: 'use',
        item: 'second-wind',
        activity: 'windHeal',
        targets: [],
        slot: null,
      })
      const status = screen.getByRole('status')
      await waitFor(() => expect(posted).toHaveLength(2), { timeout: 3000 })
      expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
      await waitFor(() =>
        expect(status).toHaveTextContent('Second Wind healing'),
      )
      expect(status).toHaveTextContent(/1d10 \(\d+\) \+5 healing/)
      await waitFor(
        () => expect(status).toHaveTextContent('At the table: 11'),
        { timeout: 3000 },
      )
    })

    it('casts a spell with the slot chosen, at the one tapped, its own side first', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      renderCasting()
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', { name: 'Cure Wounds healing, 2d8 + 3' }),
      )
      const picker = screen.getByRole('dialog', { name: 'Cure Wounds' })
      const slots = within(picker).getByRole('group', { name: 'Cast at' })
      // dnd5e casts it with its own level's slots, where any are left.
      expect(
        within(slots).getByRole('radio', { name: '1st Level, 1 slot left' }),
      ).toBeChecked()
      expect(
        within(picker)
          .getAllByRole('button', { name: /^(Thorin|Vex|Goblin)/ })
          .map(button => button.textContent),
      ).toEqual(['Thorin OakenshieldYou', 'VexAlly', 'Goblin', 'Goblin Archer'])
      await user.click(
        within(slots).getByRole('radio', { name: '2nd Level, 2 slots left' }),
      )
      await user.click(within(picker).getByRole('button', { name: /^Vex/ }))

      expect(posted[0]).toMatchObject({
        kind: 'use',
        item: 'cure',
        activity: 'cureHeal',
        targets: [{ combatId: 'cmbt1', combatantId: 'vex1' }],
        slot: 'spell2',
      })
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByRole('status')).toHaveTextContent('Cure Wounds')
    })

    it('asks only for the slot, for a spell cast on its caster, then casts it', async () => {
      const user = userEvent.setup()
      const posted = answering({ 'req-1': used('utility', null) })
      renderCasting()
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(screen.getByRole('button', { name: 'Cast Shield' }))
      const picker = screen.getByRole('dialog', { name: 'Shield' })
      expect(within(picker).queryByRole('checkbox')).toBeNull()
      await user.click(within(picker).getByRole('button', { name: 'Cast' }))

      expect(posted[0]).toMatchObject({
        kind: 'use',
        item: 'shield',
        activity: 'shieldCast',
        targets: [],
        slot: 'spell1',
      })
      const status = screen.getByRole('status')
      await waitFor(
        () => expect(status).toHaveTextContent('Cast at the table'),
        {
          timeout: 3000,
        },
      )
      // Nothing follows it.
      expect(status).not.toHaveTextContent('to follow')
      expect(posted).toHaveLength(1)
    })

    it('says why the game didn’t use it', async () => {
      const user = userEvent.setup()
      answering({ 'req-1': { status: 'failed', reason: 'consume' } })
      renderCasting()
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }),
      )

      await waitFor(
        () =>
          expect(screen.getByRole('status')).toHaveTextContent(
            'Not used at the table: there’s nothing left to use it with',
          ),
        { timeout: 3000 },
      )
    })

    it('casts, uses and attacks from the Spells and Inventory tabs as from Actions', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      const sheet = casting()
      sheet.spells = sheet.spells.map(section => ({
        ...section,
        spells: section.spells.map(spell =>
          spell.id === 'cure'
            ? {
                ...spell,
                activity: activity('cureHeal', 'heal', {
                  count: 1,
                  affects: 'creature',
                }),
                damage: healing('2d8 + 3'),
              }
            : spell,
        ),
      }))
      // Carried, but not among the actions: a bow that isn't equipped, and a potion.
      sheet.inventory.sections[0].items.push(
        sheetItem({
          id: 'bow',
          name: 'Longbow',
          type: 'weapon',
          equipped: false,
          toHit: 5,
          attackId: 'bowAttack',
          damage: [{ formula: '1d8 + 3', type: 'Piercing', healing: false }],
        }),
      )
      sheet.inventory.sections[1].items.push(
        sheetItem({
          id: 'potion',
          name: 'Potion of Healing',
          type: 'consumable',
          activity: activity('drink', 'heal', { self: true, affects: 'self' }),
          damage: healing('2d4 + 2'),
        }),
      )
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(sheet, GAME)}
          combat={fight}
          rollsToTable={['use', 'attack', 'damage']}
        />,
      )

      await user.click(screen.getByRole('tab', { name: 'Spells' }))
      await user.click(
        screen.getByRole('button', { name: 'Cure Wounds healing, 2d8 + 3' }),
      )
      const picker = screen.getByRole('dialog', { name: 'Cure Wounds' })
      await user.click(within(picker).getByRole('button', { name: /^Vex/ }))
      expect(posted[0]).toMatchObject({
        kind: 'use',
        item: 'cure',
        activity: 'cureHeal',
        targets: [{ combatId: 'cmbt1', combatantId: 'vex1' }],
        slot: 'spell1',
      })
      // The tray shows with the spells, as rolls are made from them.
      expect(screen.getByRole('status')).toHaveTextContent('Cure Wounds')

      await user.click(screen.getByRole('tab', { name: 'Inventory' }))
      await user.click(
        screen.getByRole('button', {
          name: 'Potion of Healing healing, 2d4 + 2',
        }),
      )
      expect(posted[1]).toMatchObject({
        kind: 'use',
        item: 'potion',
        activity: 'drink',
        targets: [],
      })
      await user.click(
        screen.getByRole('button', { name: 'Longbow attack, +5' }),
      )
      const at = screen.getByRole('dialog', { name: 'Longbow attack' })
      await user.click(
        within(at).getByRole('button', { name: 'Goblin Archer' }),
      )
      expect(posted[2]).toMatchObject({
        kind: 'attack',
        item: 'bow',
        activity: 'bowAttack',
        target: { combatId: 'cmbt1', combatantId: 'goblin2' },
      })
    })

    it("rolls a use's chips here while the game takes no spells or features", async () => {
      const user = userEvent.setup()
      answering({})
      renderCasting({ kinds: ['attack', 'damage'] })
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      expect(
        screen.queryByRole('button', {
          name: 'Fire Breath, DEX saving throw DC 13',
        }),
      ).toBeNull()
      expect(screen.queryByRole('button', { name: 'Cast Shield' })).toBeNull()
      await user.click(
        screen.getByRole('button', { name: 'Second Wind healing, 1d10 + 5' }),
      )

      expect(screen.queryByRole('dialog')).toBeNull()
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          'Second Wind healing',
        ),
      )
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  it('keeps rolls while another part of the sheet is shown', async () => {
    const user = userEvent.setup()
    renderPane()
    await user.click(screen.getByRole('button', { name: 'Strength check, +4' }))
    await screen.findByText('Strength check', { selector: 'p' })

    await user.click(screen.getByRole('tab', { name: 'Features' }))
    await user.click(screen.getByRole('tab', { name: 'Character' }))

    expect(screen.getByRole('status')).toHaveTextContent('Strength check')
  })

  it("shows the character's conditions, each opening the panel at its rules, or Effects where the app has none", async () => {
    const user = userEvent.setup()
    const scrolled = jest.fn()
    Element.prototype.scrollIntoView = scrolled
    renderPane()

    const conditions = within(screen.getByRole('list', { name: 'Conditions' }))
    expect(conditions.getAllByRole('button').map(b => b.textContent)).toEqual([
      'ConcentratingBless',
      'ExhaustionLevel 2',
      'Poisoned',
    ])
    await user.click(conditions.getByRole('button', { name: 'Poisoned' }))

    // The panel, over the sheet, at the condition's rules, once it's shown.
    const panel = screen.getByRole('dialog', { name: 'Conditions' })
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/^Character/)
    await waitFor(() => expect(scrolled).toHaveBeenCalled())
    expect(scrolled.mock.contexts.at(-1)).toBe(
      within(panel).getByRole('region', { name: 'Poisoned' }),
    )
    await user.click(within(panel).getByRole('button', { name: 'Close' }))

    // Concentrating has no rules here: its chip shows it among the effects.
    await user.click(conditions.getByRole('button', { name: /^Concentrating/ }))
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName(/^Effects/)
    expect(
      screen.getByRole('heading', { name: 'Conditions' }),
    ).toBeInTheDocument()
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
  })

  it('has no conditions to show for a character without any', () => {
    renderPane(characterSheet())

    expect(screen.queryByRole('list', { name: 'Conditions' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Effects' })).toBeInTheDocument()
  })

  it('opens a feature to its description, loading it once', async () => {
    const user = userEvent.setup()
    renderPane()
    await user.click(screen.getByRole('tab', { name: 'Features' }))

    const feature = screen
      .getByText('Second Wind')
      .closest('details') as HTMLElement
    expect(feature).not.toHaveAttribute('open')
    expect(fetch).not.toHaveBeenCalled()
    await user.click(within(feature).getByText('Second Wind'))

    // A roll the module didn't mark as one the app acts on is only text.
    const formula = await within(feature).findByText('1d10 + 5')
    expect(formula).not.toHaveClass('roll')
    expect(formula.closest('p')).toHaveTextContent(
      'Regain 1d10 + 5 hit points.',
    )
    expect(within(feature).queryByRole('button', { name: /1d10/ })).toBeNull()
    expect(
      within(feature).getByText('Class Feature · Fighter 1'),
    ).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(
      `/api/characters/char-1/texts/${TEXTS.secondWind}`,
      { signal: expect.any(AbortSignal) },
    )
  })

  describe('descriptions that roll', () => {
    // Each test's character is a new one, as descriptions loaded are kept by character.
    let characters = 0
    const renderTaking = (kinds: RollKind[], sheet = fullerSheet()) =>
      render(
        <CharacterPane
          characterId={`described-${++characters}`}
          name='Thorin Oakenshield'
          sheet={toTableSheet(sheet, GAME)}
          rollsToTable={kinds}
        />,
      )

    beforeEach(() => globalThis.localStorage.clear())

    it("rolls the player's own save a description calls for, against its DC, in the game too, saying the table can't be asked from there", async () => {
      const posted = describing(
        { [TEXTS.secondWind]: SAVE },
        { 'req-1': { status: 'done', visible: true, total: 21 } },
      )
      renderTaking(['save'])
      const user = await openSecondWind()

      await user.click(screen.getByRole('button', { name: 'DC 15 Strength' }))
      const menu = screen.getByRole('menu', {
        name: 'DC 15 Strength saving throw',
      })
      expect(
        within(menu).getByRole('menuitem', { name: 'Ask the table' }),
      ).toHaveAccessibleDescription(
        'Your Gamemaster’s game can’t be asked from Sending Stone yet.',
      )
      await user.click(
        within(menu).getByRole('menuitem', {
          name: 'Roll my Strength save (+7)',
        }),
      )

      expect(posted).toEqual([
        expect.objectContaining({
          kind: 'save',
          key: 'str',
          text: TEXTS.secondWind,
          link: 0,
        }),
      ])
      expect(screen.getByRole('status')).toHaveTextContent(
        /^\d+Strength saving throwd20 \d+ \+7( · Natural (20|1))? · DC 15/,
      )
      expect(
        await screen.findByText('At the table:', {}, { timeout: 3000 }),
      ).toHaveTextContent('At the table: 21 · Saved')
    })

    it('asks the table, where the game takes it, and says it was posted', async () => {
      const posted = describing(
        { [TEXTS.secondWind]: SAVE },
        { 'req-1': { status: 'done', visible: true, rolls: [] } },
      )
      renderTaking(['save', 'ask'])
      const user = await openSecondWind()

      await user.click(screen.getByRole('button', { name: 'DC 15 Strength' }))
      await user.click(screen.getByRole('menuitem', { name: 'Ask the table' }))

      expect(posted).toEqual([
        {
          kind: 'ask',
          text: TEXTS.secondWind,
          link: 0,
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
      ])
      expect(screen.getByRole('status')).toHaveTextContent(
        'DC 15 Strength saving throw',
      )
      expect(
        await screen.findByText(
          'Posted to the table’s chat',
          {},
          { timeout: 3000 },
        ),
      ).toBeInTheDocument()
    })

    it("can't ask the table from a device that doesn't send rolls, but can send them from there, where the tray's switch isn't shown", async () => {
      const posted = describing({ [TEXTS.biography]: SAVE })
      globalThis.localStorage.setItem('sending-stone:send-rolls', 'off')
      renderTaking(['save', 'ask'])
      const user = userEvent.setup()
      await show('Biography')
      expect(screen.queryByRole('switch')).toBeNull()

      await user.click(
        await screen.findByRole('button', { name: 'DC 15 Strength' }),
      )
      expect(
        screen.getByRole('menuitem', { name: 'Ask the table' }),
      ).toHaveAccessibleDescription(
        'This device doesn’t send your rolls to the table.',
      )
      await user.click(
        screen.getByRole('menuitem', { name: 'Send my rolls to the table' }),
      )
      expect(globalThis.localStorage.getItem('sending-stone:send-rolls')).toBe(
        'on',
      )
      expect(posted).toEqual([])

      await user.click(screen.getByRole('button', { name: 'DC 15 Strength' }))
      expect(
        screen.queryByRole('menuitem', { name: 'Send my rolls to the table' }),
      ).toBeNull()
      await user.click(screen.getByRole('menuitem', { name: 'Ask the table' }))
      expect(posted).toEqual([expect.objectContaining({ kind: 'ask' })])
    })

    it("says the game can't be asked, and offers no switch, where it takes no asks, whether this device sends rolls or not", async () => {
      describing({ [TEXTS.secondWind]: SAVE })
      globalThis.localStorage.setItem('sending-stone:send-rolls', 'off')
      renderTaking(['save'])
      const user = await openSecondWind()

      await user.click(screen.getByRole('button', { name: 'DC 15 Strength' }))

      expect(
        screen.getByRole('menuitem', { name: 'Ask the table' }),
      ).toHaveAccessibleDescription(
        'Your Gamemaster’s game can’t be asked from Sending Stone yet.',
      )
      expect(
        screen.queryByRole('menuitem', { name: 'Send my rolls to the table' }),
      ).toBeNull()
    })

    it("rolls the player's own check a description calls for with the sheet's tool, against its DC, in the game too, and asks the table for it", async () => {
      const CHECK =
        '<p>Pick it with a <span class="ss-check roll" data-n="2" data-checks="tool:dex:thief" data-dc="15">DC 15 Dexterity (Thieves’ Tools)</span> check.</p>'
      const posted = describing(
        { [TEXTS.secondWind]: SAVE + CHECK },
        {
          'req-1': { status: 'done', visible: true, total: 13 },
          'req-2': { status: 'done', visible: true, rolls: [] },
        },
      )
      renderTaking(
        ['tool', 'ask'],
        fullerSheet({ favorites: sheetFavorites() }),
      )
      const user = await openSecondWind()
      const link = screen.getByRole('button', {
        name: 'DC 15 Dexterity (Thieves’ Tools)',
      })

      await user.click(link)
      await user.click(
        within(
          screen.getByRole('menu', {
            name: "DC 15 Dexterity (Thieves' Tools) check",
          }),
        ).getByRole('menuitem', {
          name: "Roll my Dexterity (Thieves' Tools) check (+5)",
        }),
      )
      expect(posted).toEqual([
        expect.objectContaining({
          kind: 'tool',
          key: 'thief',
          text: TEXTS.secondWind,
          link: 2,
        }),
      ])
      expect(screen.getByRole('status')).toHaveTextContent(
        /^\d+Dexterity \(Thieves' Tools\) checkd20 \d+ \+5( · Natural (20|1))? · DC 15/,
      )
      expect(
        await screen.findByText('At the table:', {}, { timeout: 3000 }),
      ).toHaveTextContent('At the table: 13 · Failed')

      await user.click(link)
      await user.click(screen.getByRole('menuitem', { name: 'Ask the table' }))
      expect(posted).toHaveLength(2)
      expect(posted[1]).toEqual({
        kind: 'ask',
        text: TEXTS.secondWind,
        link: 2,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      })
      expect(screen.getByRole('status')).toHaveTextContent(
        "DC 15 Dexterity (Thieves' Tools) check",
      )
    })

    it("rolls the player's own skill check a description calls for with the sheet's skills and proficiency, against its DC, in the game too", async () => {
      const CHECKS =
        '<p>Climb with a <span class="ss-check roll" data-n="2" data-checks="skill:str:ath" data-dc="15">DC 15 Strength (Athletics)</span> check,' +
        ' then a <span class="ss-check roll" data-n="3" data-checks="skill:dex:ste" data-using-tool="thief">Dexterity (Stealth)</span> check using Thieves’ Tools.</p>'
      const posted = describing(
        { [TEXTS.secondWind]: SAVE + CHECKS },
        { 'req-1': { status: 'done', visible: true, total: 19 } },
      )
      renderTaking(
        ['skill', 'ask'],
        fullerSheet({ favorites: sheetFavorites() }),
      )
      const user = await openSecondWind()

      await user.click(
        screen.getByRole('button', { name: 'DC 15 Strength (Athletics)' }),
      )
      await user.click(
        within(
          screen.getByRole('menu', {
            name: 'DC 15 Strength (Athletics) check',
          }),
        ).getByRole('menuitem', {
          name: 'Roll my Strength (Athletics) check (+7)',
        }),
      )
      expect(posted).toEqual([
        expect.objectContaining({
          kind: 'skill',
          key: 'ath',
          text: TEXTS.secondWind,
          link: 2,
        }),
      ])
      expect(screen.getByRole('status')).toHaveTextContent(
        /^\d+Strength \(Athletics\) checkd20 \d+ \+7( · Natural (20|1))? · DC 15/,
      )

      // Not proficient in Stealth, but with the Thieves' Tools its favorites name: Dexterity's +1
      // and the sheet's proficiency, +3; proficient in only one, no advantage.
      await user.click(
        screen.getByRole('button', { name: 'Dexterity (Stealth)' }),
      )
      expect(
        within(
          screen.getByRole('menu', {
            name: "Dexterity (Stealth) check using Thieves' Tools",
          }),
        ).getByRole('menuitem', {
          name: 'Roll my Dexterity (Stealth) check (+4, disadvantage)',
        }),
      ).toBeInTheDocument()
    })

    it("rolls a description's damage, named for where it's from, in the game too where it takes it", async () => {
      const posted = describing({ [TEXTS.secondWind]: SAVE })
      renderTaking(['textDamage'])
      const user = await openSecondWind()

      await user.click(
        screen.getByRole('button', { name: '2d6 fire, roll damage' }),
      )

      expect(posted).toEqual([
        expect.objectContaining({
          kind: 'textDamage',
          text: TEXTS.secondWind,
          link: 1,
          dice: [{ faces: 6, results: expect.any(Array) }],
        }),
      ])
      expect(screen.getByRole('status')).toHaveTextContent(
        /^\d+Second Wind damage2d6 \(\d, \d\) fire/,
      )
    })

    it('shows the tray on Biography once its description rolls, named for the character as the game names it, saying only the player sees a roll the game doesn’t take', async () => {
      const user = userEvent.setup()
      describing({
        [TEXTS.biography]:
          '<p>Lucky: <span class="ss-roll roll" data-n="0" data-formula="1d4">1d4</span></p>',
      })
      renderTaking(['save'])
      await show('Biography')
      expect(screen.queryByRole('status')).toBeNull()

      await user.click(
        await screen.findByRole('button', { name: '1d4, roll it' }),
      )

      expect(screen.getByRole('status')).toHaveTextContent(
        /^\dThorin Oakenshield roll1d4 \(\d\)Only you see this roll$/,
      )
      expect(fetch).not.toHaveBeenCalledWith(
        expect.stringMatching(/\/rolls$/),
        expect.anything(),
      )
    })

    it.each<[string, string, (user: User) => Promise<unknown>, CharacterSheet]>(
      [
        [
          'Features',
          TEXTS.secondWind,
          async user => {
            await show('Features')
            await user.click(screen.getByText('Second Wind'))
          },
          fullerSheet(),
        ],
        [
          'Actions',
          TEXTS.warhammer,
          async user => {
            await show('Actions')
            await user.click(toggleOf('Warhammer'))
          },
          fullerSheet(),
        ],
        [
          'Inventory',
          TEXTS.warhammer,
          async user => {
            await show('Inventory')
            await user.click(screen.getByText('Warhammer'))
          },
          fullerSheet(),
        ],
        [
          'Spells',
          TEXTS.shield,
          async user => {
            await show('Spells')
            await user.click(screen.getByText('Shield'))
          },
          fullerSheet(),
        ],
        ['Biography', TEXTS.biography, () => show('Biography'), fullerSheet()],
        [
          'a favorite',
          TEXTS.warhammer,
          async user => {
            await show('Effects')
            const strip = screen.getByRole('region', { name: 'Favorites' })
            await user.click(within(strip).getByText('Warhammer'))
          },
          favored(),
        ],
      ],
    )(
      'opens the conditions panel at a condition a description names, from %s',
      async (_, hash, open, sheet) => {
        const scrolled = jest.fn()
        Element.prototype.scrollIntoView = scrolled
        describing({ [hash]: SAVE })
        renderTaking([], sheet)
        const user = userEvent.setup()

        await open(user)
        await user.click(await screen.findByRole('button', { name: 'Prone' }))

        const panel = screen.getByRole('dialog', { name: 'Conditions' })
        await waitFor(() =>
          expect(scrolled.mock.contexts.at(-1)).toBe(
            within(panel).getByRole('region', { name: 'Prone' }),
          ),
        )
        Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
      },
    )

    it("opens the conditions panel at the Effects tab's own condition, and from its button, at the top", async () => {
      const scrolled = jest.fn()
      Element.prototype.scrollIntoView = scrolled
      describing({
        [TEXTS.poisoned]:
          '<p>While <span class="ss-condition ref" data-condition="poisoned">Poisoned</span>, you have Disadvantage.</p>',
      })
      renderTaking([])
      const user = userEvent.setup()

      await show('Effects')
      const effects = screen.getByRole('region', { name: 'Conditions' })
      await user.click(within(effects).getByText('Poisoned'))
      await user.click(
        await within(effects).findByRole('button', { name: 'Poisoned' }),
      )
      let panel = screen.getByRole('dialog', { name: 'Conditions' })
      await waitFor(() =>
        expect(scrolled.mock.contexts.at(-1)).toBe(
          within(panel).getByRole('region', { name: 'Poisoned' }),
        ),
      )
      expect(
        within(panel).getByRole('region', { name: 'Poisoned' }),
      ).toHaveTextContent('You have it')
      await user.click(within(panel).getByRole('button', { name: 'Close' }))
      scrolled.mockClear()

      await user.click(
        screen.getByRole('button', { name: 'Every condition and its rules' }),
      )
      panel = screen.getByRole('dialog', { name: 'Conditions' })
      expect(
        screen.getAllByRole('dialog', { name: 'Conditions' }),
      ).toHaveLength(1)
      // A frame later, when it would have scrolled to one.
      await act(
        () => new Promise(resolve => requestAnimationFrame(() => resolve(0))),
      )
      expect(scrolled).not.toHaveBeenCalled()
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    })

    /**
     * Thorin's sheet with Bardic Flame, whose Glow is folded beneath it, its description this;
     * and the dialog about Glow, opened on the Actions tab.
     */
    const openGlow = async (html: string, kinds: RollKind[] = []) => {
      const sheet = fullerSheet()
      const flame = sheetAction({
        id: 'flame',
        name: 'Bardic Flame',
        type: 'weapon',
        text: TEXTS.warhammer,
        activities: [
          {
            id: 'strike',
            name: 'Attack',
            type: 'attack',
            activation: 'Action',
            range: null,
            target: null,
            toHit: null,
            save: null,
            damage: [],
            uses: null,
          },
          {
            id: 'glow',
            name: 'Glow',
            type: 'utility',
            activation: 'Action',
            range: null,
            target: null,
            toHit: null,
            save: null,
            damage: [],
            uses: null,
          },
        ],
      })
      const posted = describing({ [TEXTS.warhammer]: html })
      renderTaking(kinds, {
        ...sheet,
        actions: sheet.actions.map(section =>
          section.id === 'action'
            ? { ...section, actions: [...section.actions, flame] }
            : section,
        ),
      })
      const user = userEvent.setup()
      await show('Actions')
      await user.click(toggleOf('Bardic Flame'))
      const about = screen.getByRole('button', {
        name: 'About Bardic Flame (Glow)',
      })
      const reopen = async () => {
        await user.click(about)
        return screen.getByRole('dialog', { name: 'Glow' })
      }
      return { user, posted, reopen, dialog: await reopen() }
    }

    it("acts in the dialog about one of an item's activities: its menus inside it, which Escape closes alone, and it once the dice are thrown", async () => {
      const pressed: KeyboardEvent[] = []
      const keep = (event: KeyboardEvent) => pressed.push(event)
      globalThis.addEventListener('keydown', keep, true)
      const { user, dialog } = await openGlow(SAVE)

      await user.click(
        await within(dialog).findByRole('button', { name: 'DC 15 Strength' }),
      )
      expect(dialog).toContainElement(screen.getByRole('menu'))
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).toBeNull()
      // The browser would take Escape as a request to close the dialog too, unless cancelled.
      expect(pressed.at(-1)).toMatchObject({
        key: 'Escape',
        defaultPrevented: true,
      })
      globalThis.removeEventListener('keydown', keep, true)

      await user.click(
        within(dialog).getByRole('button', { name: '2d6 fire, roll damage' }),
      )
      expect(screen.queryByRole('dialog', { name: 'Glow' })).toBeNull()
      expect(screen.getByRole('status')).toHaveTextContent(
        /Bardic Flame damage2d6 \(\d, \d\) fire/,
      )
    })

    it.each<
      [string, (user: User, dialog: HTMLElement) => Promise<void>, RegExp]
    >([
      [
        'the player rolls their own save',
        async (user, dialog) => {
          await user.click(
            await within(dialog).findByRole('button', {
              name: 'DC 15 Strength',
            }),
          )
          await user.click(
            screen.getByRole('menuitem', {
              name: 'Roll my Strength save (+7)',
            }),
          )
        },
        /^\d+Strength saving throwd20 \d+ \+7/,
      ],
      [
        'its own roll is rolled',
        async (user, dialog) => {
          await user.click(
            await within(dialog).findByRole('button', { name: '1d4, roll it' }),
          )
        },
        /^\dBardic Flame roll1d4 \(\d\)/,
      ],
      [
        'the table is asked',
        async (user, dialog) => {
          await user.click(
            await within(dialog).findByRole('button', {
              name: 'DC 15 Strength',
            }),
          )
          await user.click(
            screen.getByRole('menuitem', { name: 'Ask the table' }),
          )
        },
        /^DC 15 Strength saving throw/,
      ],
    ])(
      "closes the dialog about one of an item's activities once %s, for the tray behind it to be seen",
      async (_, step, status) => {
        const { user, dialog } = await openGlow(
          `${SAVE}<p>Lucky: <span class="ss-roll roll" data-n="2" data-formula="1d4">1d4</span></p>`,
          ['save', 'ask'],
        )

        await step(user, dialog)

        expect(screen.queryByRole('dialog', { name: 'Glow' })).toBeNull()
        expect(screen.getByRole('status')).toHaveTextContent(status)
      },
    )

    it("opens the conditions panel from the dialog about one of an item's activities", async () => {
      const scrolled = jest.fn()
      Element.prototype.scrollIntoView = scrolled
      const { user, dialog } = await openGlow(SAVE)

      await user.click(
        await within(dialog).findByRole('button', { name: 'Prone' }),
      )

      const panel = screen.getByRole('dialog', { name: 'Conditions' })
      await waitFor(() =>
        expect(scrolled.mock.contexts.at(-1)).toBe(
          within(panel).getByRole('region', { name: 'Prone' }),
        ),
      )
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    })
  })

  describe('favorites', () => {
    afterEach(() => {
      jest.restoreAllMocks()
      localStorage.clear()
    })

    it.each(['Actions', 'Inventory', 'Spells', 'Effects'])(
      'shows them at the top of %s on a phone or tablet',
      async name => {
        renderPane(favored())
        await show(name)

        const panel = screen.getByRole('tabpanel')
        const strip = within(panel).getByRole('region', { name: 'Favorites' })
        expect(panel.querySelector('section')).toBe(strip)
        expect(within(strip).getAllByRole('listitem')).toHaveLength(7)
        expect(screen.queryByRole('complementary')).toBeNull()
      },
    )

    it.each(['Character', 'Features', 'Biography'])(
      'leaves them out of %s',
      async name => {
        globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
        renderPane(favored())
        await show(name)

        expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull()
        expect(screen.queryByRole('complementary')).toBeNull()
      },
    )

    it('shows them in a column beside those tabs where the sheet is wide enough for both', async () => {
      wide(936)
      renderPane(favored())
      await show('Actions')

      const column = screen.getByRole('complementary', { name: 'Favorites' })
      expect(within(column).getAllByRole('listitem')).toHaveLength(7)
      const panel = screen.getByRole('tabpanel')
      expect(panel).not.toContainElement(column)
      expect(
        within(panel).queryByRole('region', { name: 'Favorites' }),
      ).toBeNull()

      await show('Features')
      expect(screen.queryByRole('complementary')).toBeNull()
    })

    it('shows them at the top of the tab where the sheet is narrower', async () => {
      wide(935)
      renderPane(favored())
      await show('Spells')

      expect(screen.queryByRole('complementary')).toBeNull()
      expect(
        screen.getByRole('region', { name: 'Favorites' }),
      ).toBeInTheDocument()
    })

    it('has none to show for a sheet without any, as from a module before 0.9.0', async () => {
      wide(1200)
      renderPane()
      await show('Actions')

      expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull()
      expect(screen.queryByRole('complementary')).toBeNull()
    })

    it('rolls from them into the tray, which shows with them', async () => {
      const user = userEvent.setup()
      renderPane(favored())
      await show('Inventory')

      await user.click(
        screen.getByRole('button', {
          name: 'Perception check, +4 (proficient, passive 14)',
        }),
      )
      const status = screen.getByRole('status')
      await waitFor(() => expect(status).toHaveTextContent('Perception check'))
      expect(
        screen.getByRole('region', { name: 'Your rolls' }),
      ).toBeInTheDocument()
    })

    it("has no tray beside favorites that don't roll", async () => {
      renderPane(
        favored(
          sheetFavorites().filter(
            ({ type }) => type === 'effect' || type === 'slots',
          ),
        ),
      )
      await show('Effects')

      expect(
        screen.getByRole('region', { name: 'Favorites' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'Your rolls' })).toBeNull()
    })

    it('stars each one wherever the sheet lists it', async () => {
      renderPane(favored())

      expect(
        screen.getByRole('button', {
          name: 'Perception check, +4 (proficient, passive 14), favorite',
        }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', {
          name: 'Athletics check, +7 (proficient, passive 17)',
        }),
      ).toBeInTheDocument()

      await show('Actions')
      const actions = screen.getByRole('region', { name: 'Actions' })
      expect(
        within(actions).getByRole('button', {
          name: /^Warhammer\s*, favorite/,
        }),
      ).toBeInTheDocument()
      expect(
        within(actions).getByRole('button', { name: /^Handaxe Action/ }),
      ).toBeInTheDocument()

      await show('Inventory')
      const weapons = screen.getByRole('region', { name: 'Weapons' })
      expect(
        within(weapons)
          .getAllByText(', favorite')
          .map(star => star.closest('li')?.textContent?.split(',', 1)[0]),
      ).toEqual(['Warhammer'])

      await show('Effects')
      const effects = screen.getByRole('region', { name: 'Temporary Effects' })
      expect(within(effects).getByText(', favorite')).toBeInTheDocument()
    })
  })
})
