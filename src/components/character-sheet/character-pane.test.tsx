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
  castingSheet,
  characterSheet,
  checkingSheet,
  fullerSheet,
  sheetAction,
  sheetFavorites,
  sheetItem,
  sheetSpell,
  TEXTS,
  WAND_LEVELS,
} from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type {
  GmRollView,
  RolledDice,
  RollFeature,
  RollKind,
} from '@/types/roll'
import type { CharacterSheet, SheetUse } from '@/types/sending-stone'
import type { TableCombat, TablePrompt } from '@/types/table'

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const GAME = 'https://my-game.forge-vtt.com'

type User = ReturnType<typeof userEvent.setup>

/**
 * This page's storage emptied, but for the roll toasts, which these tests leave off: they test
 * the tray, whose words a toast would say again.
 */
const clearStorage = () => {
  globalThis.localStorage.clear()
  globalThis.localStorage.setItem(TOASTS_KEY, 'off')
}

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

/** The names of the rows starred in a part of the sheet. */
const starred = (name: string) =>
  within(screen.getByRole('region', { name }))
    .getAllByText(', favorite')
    .map(star => star.closest('li')?.textContent?.split(',', 1)[0])

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

/** Opens the check Rook's Thieves' Tools ask for, on the Actions tab. */
const openLock = async (user: User) => {
  await user.click(screen.getByRole('tab', { name: 'Actions' }))
  await user.click(
    screen.getByRole('button', { name: /^Thieves' Tools, DC 15/ }),
  )
}

/** Opens Second Wind on the Features tab, to its description. */
const openSecondWind = async () => {
  const user = userEvent.setup()
  await show('Features')
  await user.click(screen.getByText('Second Wind'))
  await screen.findByRole('button', { name: 'DC 15 Strength' })
  return user
}

/** The rolls' toasts, at the top of the screen. */
const toasts = () => screen.getByRole('log', { name: 'Roll results' })

/** Opens the sheet's settings, from the cog after its tabs. */
const openSettings = async (user: User) => {
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  return screen.getByRole('dialog', { name: 'Settings' })
}

/** The attack's toast, once the game says it hit. */
const hitToast = async () => {
  const label = await within(toasts()).findByText('Warhammer attack')
  const toast = label.closest('[data-roll-toast]') as HTMLElement
  await waitFor(() => expect(toast).toHaveAttribute('data-waits'), {
    timeout: 3000,
  })
  return toast
}

/** The attack's toast, once the game says it missed. */
const missToast = async () => {
  const label = await within(toasts()).findByText('Warhammer attack')
  const toast = label.closest('[data-roll-toast]') as HTMLElement
  await waitFor(
    () => expect(toast).toHaveTextContent('At the table: 19 · Miss'),
    { timeout: 3000 },
  )
  return toast
}

/** Attacks with the warhammer, at no one. */
const strike = async (user: User) => {
  await user.click(screen.getByRole('tab', { name: 'Actions' }))
  await user.click(screen.getByRole('button', { name: 'Warhammer attack, +7' }))
  await user.click(screen.getByRole('button', { name: 'No target' }))
}

/** The button beside the cog that opens the rolls, where they pop up as toasts. */
const rollsButton = () => screen.queryByRole('button', { name: /^Your rolls/ })

/** Where an element is stacked, by its class, on the page's own body, as the toasts are. */
const layer = (element: Element) =>
  Number(/(?:^|\s)z-\[?(\d+)\]?(?=\s|$)/.exec(element.className)?.[1])

/** The setting, among the sheet's settings. */
const results = async (user: User) =>
  within(await openSettings(user)).getByRole('radiogroup', {
    name: 'Roll results',
  })

/**
 * Thorin with a potion of healing, its range Self, at any creatures, as a module before 0.22.0
 * sends it, saying nothing of its range but the action's; and Wild Shape, a utility at a
 * creature, its range Self, as the module says from 0.22.0.
 */
const selfish = (): CharacterSheet => {
  const sheet = fullerSheet()
  const added = [
    sheetAction({
      id: 'potion',
      name: 'Potion of Healing',
      type: 'consumable',
      range: 'Self',
      damage: healing('2d4 + 2'),
      activity: activity('drink', 'heal', { affects: 'creature' }),
    }),
    sheetAction({
      id: 'wild',
      name: 'Wild Shape',
      range: 'Self',
      activity: activity('shape', 'utility', {
        count: 1,
        affects: 'creature',
        fromSelf: true,
      }),
    }),
  ]
  return {
    ...sheet,
    actions: sheet.actions.map(section =>
      section.id === 'action'
        ? { ...section, actions: [...section.actions, ...added] }
        : section,
    ),
  }
}

/** Drinks the potion, by its healing's chip. */
const drink = () =>
  userEvent.setup().click(
    screen.getByRole('button', {
      name: 'Potion of Healing healing, 2d4 + 2',
    }),
  )

describe('components/character-sheet/character-pane', () => {
  beforeEach(() => {
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
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
    clearStorage()
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
    clearStorage()
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

    // This device sends them, as the switch in the sheet's settings says.
    expect(
      within(await openSettings(user)).getByRole('switch', {
        name: 'Send to the table',
      }),
    ).toBeChecked()
    await user.keyboard('{Escape}')
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
    clearStorage()
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

  it("spends hit dice used at once in the Gamemaster's game as one request, from module 0.20.0, and says what came of them all", async () => {
    const user = userEvent.setup()
    clearStorage()
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
        total: 10,
        healed: 10,
        spent: { count: 2, made: 2 },
      }
      return { ok: true, status: 200, json: async () => answer } as Response
    }) as typeof fetch
    render(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(fullerSheet(), GAME)}
        rollsToTable={['hitDie', 'hitDice']}
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
    await user.click(
      within(popover).getByRole('button', { name: 'Use 2 d10 hit dice' }),
    )

    // One throw of both dice, sent as one.
    expect(posted).toEqual([
      {
        kind: 'hitDice',
        hitDice: [{ denomination: 'd10', count: 2 }],
        mode: 0,
        explicit: false,
        extras: [],
        dice: [
          { faces: 10, results: [expect.any(Number), expect.any(Number)] },
        ],
      },
    ])
    const [a, b] = (posted[0].dice as RolledDice[])[0].results
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(`Hit dice (2d10)2d10 (${a}, ${b}) +6`)
    expect(status).not.toHaveTextContent('Keep this page open')
    await waitFor(
      () =>
        expect(status).toHaveTextContent('At the table: 10 · 10 HP regained'),
      { timeout: 3000 },
    )
    expect(posted).toHaveLength(1)
  })

  it("says hit dice used at once the Gamemaster's game refused for want of dice want fewer, not none of a size", async () => {
    const user = userEvent.setup()
    clearStorage()
    // As when one was spent elsewhere since this sheet was sent: 3 of 5 left here, 1 in the game.
    globalThis.fetch = jest.fn(
      async () =>
        ({
          ok: false,
          status: 422,
          json: async () => ({ reason: 'no-hit-dice' }),
        }) as Response,
    ) as typeof fetch
    render(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(fullerSheet(), GAME)}
        rollsToTable={['hitDie', 'hitDice']}
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
    await user.click(
      within(popover).getByRole('button', { name: 'Use 2 d10 hit dice' }),
    )

    const status = screen.getByRole('status')
    await waitFor(() =>
      expect(status).toHaveTextContent(
        /Not made at the table: you haven’t that many hit dice left$/,
      ),
    )
    expect(status).not.toHaveTextContent('of that size')
  })

  it('spends hit dice used at once in a game before module 0.20.0 a request a die, one after another, and says what came of them all', async () => {
    const user = userEvent.setup()
    clearStorage()
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
    clearStorage()
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
    // The class line is by the character's name, in the page's header, not beside the tabs; the
    // settings' cog is after them, and not one of them.
    const tablist = screen.getByRole('tablist', { name: 'Character sheet' })
    const tabsRow = tablist.parentElement
    expect(tabsRow?.children).toHaveLength(2)
    expect(tabsRow).not.toHaveTextContent('Fighter 5 · Champion')
    const cog = screen.getByRole('button', { name: 'Settings' })
    expect(tablist).not.toContainElement(cog)
    expect(tablist.nextElementSibling).toContainElement(cog)

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

  it("leaves no gap before the settings' cog, so that a caster with a condition has room for the tabs", () => {
    renderPane()

    // At 360 pixels the row has 336 inside its padding, and the cog 32 of them. A caster's seven
    // tabs, with Character chosen and the dot on Effects, take 301: a gap of 4 before the cog
    // would leave them 300, and they would scroll.
    const tablist = screen.getByRole('tablist', { name: 'Character sheet' })
    expect(within(tablist).getAllByRole('tab')).toHaveLength(7)
    expect(
      within(tablist).getByRole('tab', { name: /^Effects/ }),
    ).toHaveTextContent('3 conditions')
    const row = tablist.parentElement as HTMLElement
    expect(row).toHaveClass('px-3')
    expect([...row.classList].filter(name => /(^|:)gap-/.test(name))).toEqual(
      [],
    )
    // The cog is kept apart, at the end of the row, by its margin.
    expect(tablist.nextElementSibling).toHaveClass('ml-auto', 'shrink-0')
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

    /** The game, which makes the attack, a hit or a miss, then its damage. */
    const game = (outcome: 'hit' | 'miss' = 'hit') => {
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
                attack: { critical: false, fumble: false, outcome },
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
      clearStorage()
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

    it("keeps the attack's damage in the banner once one of the Gamemaster's rolls as the character comes after it (#156)", async () => {
      const user = userEvent.setup()
      const posted = game()
      const thorin = (gmRolls?: GmRollView[]) => (
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(fullerSheet(), GAME)}
          combat={fight}
          rollsToTable={['attack', 'damage']}
          gmRolls={gmRolls}
        />
      )
      const { rerender } = render(thorin())
      await user.click(screen.getByRole('tab', { name: 'Actions' }))
      await user.click(
        screen.getByRole('button', { name: 'Warhammer attack, +7' }),
      )
      await user.click(
        within(
          screen.getByRole('dialog', { name: 'Warhammer attack' }),
        ).getByRole('button', { name: 'Goblin' }),
      )
      const banner = screen.getByRole('region', { name: 'Your rolls' })
      await waitFor(
        () =>
          expect(within(banner).getByRole('status')).toHaveTextContent(
            'At the table: 19 · Hit',
          ),
        { timeout: 3000 },
      )

      // The Gamemaster's check, sent since, which the next look at the table brings.
      rerender(
        thorin([
          {
            id: 'req-gm',
            kind: 'skill',
            label: 'Perception check',
            at: new Date().toISOString(),
            status: 'done',
            visible: true,
            total: 14,
          },
        ]),
      )

      // The latest, with the attack's damage still offered beneath it.
      expect(within(banner).getByRole('status')).toHaveTextContent(
        'Perception checkGM',
      )
      const due = within(banner).getByRole('group', {
        name: 'Warhammer attack',
      })
      await user.click(within(due).getByRole('button', { name: 'Roll damage' }))
      expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
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

    it('offers the damage of an attack that missed in the banner, for what deals damage on one, rolling it there', async () => {
      const user = userEvent.setup()
      const posted = game('miss')
      renderFight()
      await strike(user)
      const status = screen.getByRole('status')
      await waitFor(
        () => expect(status).toHaveTextContent('At the table: 19 · Miss'),
        { timeout: 3000 },
      )

      await user.click(
        within(screen.getByRole('region', { name: 'Your rolls' })).getByRole(
          'button',
          { name: 'Roll damage' },
        ),
      )

      expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
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

    describe('with toasts', () => {
      beforeEach(() => globalThis.localStorage.removeItem(TOASTS_KEY))

      it("T1 keeps a hit's toast, with its damage to roll, which rolls it at the table, then goes, the damage's own toast popping up", async () => {
        const user = userEvent.setup()
        const posted = game()
        renderFight()
        await strike(user)

        const toast = await hitToast()
        expect(toast).toHaveTextContent('At the table: 19 · Hit')
        expect(rollsButton()?.textContent).toBe('Your rolls, damage to roll')
        await user.click(
          within(toast).getByRole('button', { name: 'Roll damage' }),
        )

        expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
        await within(toasts()).findByText('Warhammer damage')
        await waitFor(() => expect(toast).not.toBeInTheDocument())
        expect(rollsButton()?.textContent).toBe('Your rolls')
      })

      it('T2 closes by its ×, for good, the damage still rolled from the row, as the dot says', async () => {
        const user = userEvent.setup()
        const posted = game()
        renderFight()
        await strike(user)
        const toast = await hitToast()

        await user.click(within(toast).getByRole('button', { name: 'Dismiss' }))

        expect(toast).not.toBeInTheDocument()
        expect(rollsButton()?.textContent).toBe('Your rolls, damage to roll')
        // The game is asked again, and says the same: it doesn't pop up again.
        await new Promise(resolve => setTimeout(resolve, 1500))
        expect(within(toasts()).queryByText('Warhammer attack')).toBeNull()

        await user.click(
          screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
        )
        expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
      })

      it("T3 rolls the damage from the rolls' button, once its toast is closed", async () => {
        const user = userEvent.setup()
        const posted = game()
        renderFight()
        await strike(user)
        const toast = await hitToast()
        await user.click(within(toast).getByRole('button', { name: 'Dismiss' }))

        await user.click(rollsButton() as HTMLElement)
        const rolls = screen.getByRole('dialog', { name: 'Your rolls' })
        expect(within(rolls).getByRole('status')).toHaveTextContent(
          'At the table: 19 · Hit',
        )
        await user.click(
          within(rolls).getByRole('button', { name: 'Roll damage' }),
        )

        expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
        await waitFor(() =>
          expect(
            within(
              screen.getByRole('dialog', { name: 'Your rolls' }),
            ).getByRole('status'),
          ).toHaveTextContent('Warhammer damage'),
        )
        expect(within(rolls).getByText('Earlier rolls (1)')).toBeInTheDocument()
        expect(rollsButton()?.textContent).toBe('Your rolls')
      })

      it("T5 rolls the damage from the rolls' button, its toast closed, once another roll follows", async () => {
        const user = userEvent.setup()
        const posted = game()
        renderFight()
        await strike(user)
        const toast = await hitToast()
        await user.click(within(toast).getByRole('button', { name: 'Dismiss' }))
        await user.click(screen.getByRole('tab', { name: 'Character' }))
        await user.click(
          screen.getByRole('button', { name: 'Strength check, +4' }),
        )
        await within(toasts()).findByText('Strength check')

        expect(rollsButton()?.textContent).toBe('Your rolls, damage to roll')
        await user.click(rollsButton() as HTMLElement)
        const rolls = screen.getByRole('dialog', { name: 'Your rolls' })
        expect(within(rolls).getByRole('status')).toHaveTextContent(
          'Strength check',
        )
        await user.click(
          within(
            within(rolls).getByRole('group', { name: 'Warhammer attack' }),
          ).getByRole('button', { name: 'Roll damage' }),
        )

        expect(posted).toHaveLength(2)
        expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
        await waitFor(() =>
          expect(rollsButton()?.textContent).toBe('Your rolls'),
        )
        expect(
          within(rolls).queryByRole('group', { name: 'Warhammer attack' }),
        ).toBeNull()
      })

      it("T7 lets a miss's toast go as any other, with no dot, its damage rolled from the rolls' button while it's the latest", async () => {
        const user = userEvent.setup()
        const posted = game('miss')
        renderFight()
        await strike(user)

        const toast = await missToast()
        expect(toast).not.toHaveAttribute('data-waits')
        expect(within(toast).queryByRole('button')).toBeNull()
        expect(rollsButton()?.textContent).toBe('Your rolls')
        await user.click(rollsButton() as HTMLElement)
        const rolls = screen.getByRole('dialog', { name: 'Your rolls' })
        expect(
          within(rolls).queryByRole('group', { name: 'Warhammer attack' }),
        ).toBeNull()
        await user.click(
          within(within(rolls).getByRole('status')).getByRole('button', {
            name: 'Roll damage',
          }),
        )

        expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
      })

      it("T8 rolls a miss's damage from its row, its toast tapped away", async () => {
        const user = userEvent.setup()
        const posted = game('miss')
        renderFight()
        await strike(user)
        await user.click(await missToast())

        await user.click(
          screen.getByRole('button', { name: 'Warhammer damage, 1d8 + 4' }),
        )

        expect(posted[1]).toMatchObject({ kind: 'damage', use: 'req-1' })
      })

      it("T6 opens the damage menu in a hit's toast, where the game takes damage changed", async () => {
        const user = userEvent.setup()
        const posted = game()
        render(
          <CharacterPane
            characterId='char-1'
            name='Thorin Oakenshield'
            sheet={toTableSheet(fullerSheet(), GAME)}
            combat={fight}
            rollsToTable={['attack', 'damage']}
            rollFeatures={['modifiers']}
          />,
        )
        await strike(user)
        const toast = await hitToast()

        fireEvent.contextMenu(
          within(toast).getByRole('button', { name: 'Roll damage' }),
        )
        const menu = screen.getByRole('menu', {
          name: 'Warhammer damage 1d8 + 4',
        })
        expect(toast).toContainElement(menu)
        await user.click(
          within(menu).getByRole('menuitem', { name: 'Roll maximum damage' }),
        )

        expect(posted[1]).toMatchObject({
          kind: 'damage',
          use: 'req-1',
          modifiers: { maximize: true },
        })
      })
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

  describe('damage whose dice Foundry rerolls, such as Great Weapon Fighting’s', () => {
    const FORMULA = '2d6r<=2 + 7 + 1d8'

    /**
     * Thorin's sheet, with his favorites, his warhammer dealing Great Weapon Fighting's damage with
     * a d8 more, and a second activity, a smite, dealing it too.
     */
    const greatWeapon = (favorites = true): CharacterSheet => {
      const sheet = favorites ? favored() : fullerSheet()
      const damage = [{ formula: FORMULA, type: 'Slashing', healing: false }]
      const smite = {
        id: 'warhammerSmite',
        name: 'Thunder Smite',
        type: 'damage',
        activation: '1 Bonus Action',
        range: 'reach 5 ft',
        target: null,
        toHit: null,
        attackId: null,
        activity: activity('warhammerSmite', 'damage', {
          count: 1,
          affects: 'creature',
        }),
        save: null,
        damage,
        uses: null,
      }
      return {
        ...sheet,
        actions: sheet.actions.map(section => ({
          ...section,
          actions: section.actions.map(action =>
            action.id === 'warhammer'
              ? {
                  ...action,
                  damage,
                  activities: [
                    {
                      id: 'warhammerAttack',
                      name: 'Attack',
                      type: 'attack',
                      activation: action.activation,
                      range: action.range,
                      target: action.target,
                      toHit: 7,
                      attackId: 'warhammerAttack',
                      save: null,
                      damage,
                      uses: null,
                    },
                    smite,
                  ],
                }
              : action,
          ),
        })),
      }
    }

    /** The chips that roll its damage, as many as the tab shows. */
    const chips = () =>
      screen.getAllByRole('button', { name: `Warhammer damage, ${FORMULA}` })

    afterEach(() => {
      jest.restoreAllMocks()
      localStorage.clear()
    })

    it('rolls it from its row, its favorite, its activity and its inventory row, its dice rerolled', async () => {
      const user = userEvent.setup()
      renderPane(greatWeapon())
      await show('Actions')

      // Its row's chip and its favorite's.
      expect(chips()).toHaveLength(2)
      for (const chip of chips()) expect(chip).toBeEnabled()
      expect(
        within(screen.getByRole('region', { name: 'Favorites' })).getByRole(
          'button',
          { name: `Warhammer damage, ${FORMULA}` },
        ),
      ).toBeEnabled()
      await user.click(chips()[0])
      const status = screen.getByRole('status')
      await waitFor(() => expect(status).toHaveTextContent('Warhammer damage'))
      expect(status).toHaveTextContent(
        /2d6r<=2 \([\d, ]+\) \+7 \+1d8 \(\d\) Slashing/,
      )

      // Its smite, beneath it.
      await user.click(
        within(screen.getByRole('region', { name: 'Actions' })).getByRole(
          'button',
          { name: /^Warhammer/, expanded: false },
        ),
      )
      const smite = within(
        screen.getByRole('list', { name: 'Warhammer: its other activities' }),
      ).getByRole('button', {
        name: new RegExp(`damage, ${FORMULA.replaceAll('+', String.raw`\+`)}$`),
      })
      expect(smite).toBeEnabled()

      await show('Inventory')
      expect(chips().length).toBeGreaterThan(0)
      for (const chip of chips()) expect(chip).toBeEnabled()
    })

    it('rolls it at the table after an attack, the first throw sent, and shows the game’s total once a die was rerolled', async () => {
      const user = userEvent.setup()
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
                damage: {
                  critical: false,
                  plannable: true,
                  rolls: [
                    {
                      formula: FORMULA,
                      type: 'slashing',
                      dice: [
                        { faces: 6, number: 2 },
                        { faces: 8, number: 1 },
                      ],
                    },
                  ],
                },
              }
            : { id: 'req-2', status: 'done', visible: true, total: 23 }
        return { ok: true, status: 200, json: async () => answer } as Response
      }) as typeof fetch
      // Its d6s land 1 and 5, the 1 rerolled to a 4; its d8 lands 3.
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0.5)
        .mockReturnValueOnce(0.05)
        .mockReturnValueOnce(0.75)
        .mockReturnValueOnce(0.3)
        .mockReturnValueOnce(0.6)
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(greatWeapon(false), GAME)}
          rollsToTable={['attack', 'damage']}
        />,
      )
      await show('Actions')

      await user.click(
        screen.getByRole('button', { name: 'Warhammer attack, +7' }),
      )
      const status = screen.getByRole('status')
      await waitFor(
        () => expect(status).toHaveTextContent('At the table: 19 · Hit'),
        { timeout: 3000 },
      )
      await user.click(screen.getByRole('button', { name: 'Roll damage' }))

      expect(posted[1]).toMatchObject({
        kind: 'damage',
        use: 'req-1',
        dice: [
          { faces: 6, results: [1, 5] },
          { faces: 8, results: [3] },
        ],
      })
      await waitFor(() => expect(status).toHaveTextContent('Warhammer damage'))
      // The first throw, which the game was sent, not the 4 this phone threw for the 1: the game
      // throws that again with its own dice.
      expect(status).toHaveTextContent(
        '2d6r<=2 (1, 5) +7 +1d8 (3) slashing · Rerolls thrown in your Gamemaster’s game',
      )
      // The game's total, once it says, as Foundry rerolled the 1 itself.
      await waitFor(() => expect(status).toHaveTextContent(/^23/), {
        timeout: 3000,
      })
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
      clearStorage()
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

    it("T4 keeps a use's toast while its kind of damage is to be chosen, choosing it there, with toasts", async () => {
      globalThis.localStorage.removeItem(TOASTS_KEY)
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
      renderCasting({ combat: null })
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      await user.click(
        screen.getByRole('button', { name: 'Breath Weapon damage, 1d10' }),
      )
      const label = await within(toasts()).findByText('Breath Weapon')
      const toast = label.closest('[data-roll-toast]') as HTMLElement
      await waitFor(
        () => expect(toast).toHaveTextContent('Choose its kind of damage:'),
        { timeout: 3000 },
      )
      expect(toast).toHaveAttribute('data-waits', 'true')
      await user.click(
        within(toast).getByRole('button', { name: 'Roll Fire damage' }),
      )

      expect(posted[1]).toMatchObject({
        kind: 'damage',
        use: 'req-1',
        types: ['fire'],
      })
      await within(toasts()).findByText('Breath Weapon damage')
      await waitFor(() => expect(toast).not.toBeInTheDocument())
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
          .getAllByRole('button', { name: /^(Self|Vex|Goblin)/ })
          .map(button => button.textContent),
      ).toEqual(['SelfYou', 'VexAlly', 'Goblin', 'Goblin Archer'])
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

    it("casts a spell an item casts higher at the level chosen, and its later activity as the spell's copy's, from module 0.20.0", async () => {
      const user = userEvent.setup()
      const posted = answering({})
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(castingSheet(), GAME)}
          rollsToTable={['use', 'attack', 'damage']}
        />,
      )
      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      // Out of combat, it asks the level, preset to its own.
      await user.click(
        screen.getByRole('button', {
          name: 'Wand of Magic Missiles damage, 1d4 + 1',
        }),
      )
      const picker = screen.getByRole('dialog', {
        name: 'Wand of Magic Missiles',
      })
      expect(
        within(picker).getByRole('radio', { name: '1st Level, 1 charge' }),
      ).toHaveAttribute('aria-checked', 'true')
      await user.click(
        within(picker).getByRole('radio', { name: '2nd Level, 2 charges' }),
      )
      await user.click(within(picker).getByRole('button', { name: 'Cast' }))
      expect(posted[0]).toMatchObject({
        kind: 'use',
        item: 'mm-wand',
        activity: 'cast-mm',
        targets: [],
        slot: 'spell2',
      })

      // Hex, cast at its level alone, asks nothing, and its Bonus Hex Damage is the copy's.
      await user.click(
        screen.getByRole('button', { name: /^Bardic Flame/, expanded: false }),
      )
      await user.click(
        screen.getByRole('button', {
          name: 'Hex (Bonus Hex Damage) damage, 1d6',
        }),
      )
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(posted[1]).toMatchObject({
        kind: 'use',
        item: 'hex',
        activity: 'hex-dmg',
        targets: [],
        slot: null,
      })
    })

    it('asks the level of a spell an item casts from its copy on the Spells tab, and says where the item can’t cast it there now', async () => {
      const user = userEvent.setup()
      // The wand's charges ran low in the game before it was cast.
      const posted = answering({
        'req-1': { status: 'failed', reason: 'slot' },
      })
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(castingSheet(), GAME)}
          rollsToTable={['use', 'attack', 'damage']}
        />,
      )
      await user.click(screen.getByRole('tab', { name: 'Spells' }))

      // Out of combat, the copy asks the level its wand casts it at, as the wand's row does.
      await user.click(
        screen.getByRole('button', { name: 'Magic Missile damage, 1d4 + 1' }),
      )
      const picker = screen.getByRole('dialog', { name: 'Magic Missile' })
      expect(
        within(picker).getByRole('radio', { name: '1st Level, 1 charge' }),
      ).toHaveAttribute('aria-checked', 'true')
      await user.click(
        within(picker).getByRole('radio', { name: '2nd Level, 2 charges' }),
      )
      await user.click(within(picker).getByRole('button', { name: 'Cast' }))

      expect(posted[0]).toMatchObject({
        kind: 'use',
        item: 'mm',
        activity: 'mm-darts',
        targets: [],
        slot: 'spell2',
      })
      await waitFor(
        () =>
          expect(screen.getByRole('status')).toHaveTextContent(
            'Not cast at the table: the item can’t cast it at that level now',
          ),
        { timeout: 3000 },
      )
    })

    it('asks the level of an attack a spell an item casts makes, from its copy, and says where the item can’t cast it there now', async () => {
      const user = userEvent.setup()
      const posted = answering({
        'req-1': { status: 'failed', reason: 'slot' },
      })
      // A staff that casts Guiding Bolt, from 1st to 3rd for a charge a level.
      const staff = { id: 'bolt-staff', name: 'Staff of Guiding' }
      const radiant = [{ formula: '4d6', type: 'Radiant', healing: false }]
      const sheet = castingSheet()
      sheet.actions[0].actions.push(
        sheetAction({
          ...staff,
          type: 'weapon',
          range: '120 ft',
          toHit: 5,
          attackId: 'cast-guide',
          damage: radiant,
          cast: {
            level: 1,
            concentration: false,
            charges: 1,
            short: false,
            levels: WAND_LEVELS,
          },
          spellId: 'guide',
          uses: { value: 10, max: 10, recovery: 'Dawn' },
        }),
      )
      sheet.spells[0].spells.push(
        sheetSpell({
          id: 'guide',
          name: 'Guiding Bolt',
          school: 'Evocation',
          range: '120 ft',
          castFrom: staff,
          toHit: 5,
          attackId: 'guide-bolt',
          activity: null,
          save: null,
          damage: radiant,
        }),
      )
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(sheet, GAME)}
          rollsToTable={['use', 'attack', 'damage']}
        />,
      )
      await user.click(screen.getByRole('tab', { name: 'Spells' }))

      await user.click(
        screen.getByRole('button', { name: 'Guiding Bolt attack, +5' }),
      )
      const picker = screen.getByRole('dialog', {
        name: 'Guiding Bolt attack',
      })
      expect(
        within(picker).getByRole('radio', { name: '1st Level, 1 charge' }),
      ).toHaveAttribute('aria-checked', 'true')
      await user.click(
        within(picker).getByRole('radio', { name: '3rd Level, 3 charges' }),
      )
      await user.click(within(picker).getByRole('button', { name: 'Attack' }))

      await waitFor(() => expect(posted).toHaveLength(1))
      expect(posted[0]).toMatchObject({
        kind: 'attack',
        item: 'guide',
        activity: 'guide-bolt',
        target: null,
        slot: 'spell3',
      })
      await waitFor(
        () =>
          expect(screen.getByRole('status')).toHaveTextContent(
            'Not made at the table: the item can’t cast it at that level now',
          ),
        { timeout: 3000 },
      )
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

  describe('Self, from module 0.22.0', () => {
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
        {
          id: 'vex1',
          name: 'Vex',
          initiative: 9,
          defeated: false,
          side: 'party',
        },
      ],
    }
    /** A fight Thorin isn't in. */
    const watching: TableCombat = {
      ...fight,
      combatants: fight.combatants.filter(({ side }) => side !== 'me'),
    }

    const renderSelf = ({
      combat = fight,
      features = [],
    }: {
      combat?: TableCombat | null
      features?: RollFeature[]
    } = {}) =>
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(selfish(), GAME)}
          combat={combat ?? undefined}
          rollsToTable={['use', 'damage']}
          rollFeatures={features}
        />,
      )

    beforeEach(() => {
      clearStorage()
    })

    it('drinks a potion at its user’s own combatant, ticked already, its range read from the action', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      renderSelf()
      await show('Actions')

      await drink()
      const picker = screen.getByRole('dialog', { name: 'Potion of Healing' })
      expect(
        within(picker).getByRole('checkbox', { name: /^Self/ }),
      ).toBeChecked()
      await user.click(
        within(picker).getByRole('button', { name: 'Use at 1 target' }),
      )
      expect(posted[0]).toMatchObject({
        kind: 'use',
        item: 'potion',
        targets: [{ combatId: 'cmbt1', combatantId: 'thorin1' }],
      })
      expect(posted[0]).not.toHaveProperty('self')
    })

    it('drinks a potion at once out of a fight, at its user where the game makes it so, else at no one', async () => {
      const posted = answering({})
      const { unmount } = renderSelf({
        combat: null,
        features: ['selfTargets'],
      })
      await show('Actions')

      await drink()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(posted[0]).toMatchObject({
        kind: 'use',
        item: 'potion',
        targets: [],
        self: true,
      })

      // Before module 0.22.0, at no one, as before.
      unmount()
      renderSelf({ combat: null })
      await show('Actions')
      await drink()
      expect(posted[1]).toMatchObject({ kind: 'use', targets: [] })
      expect(posted[1]).not.toHaveProperty('self')
    })

    it('uses Wild Shape at Self, first and the default, or at its user where it is not in the fight', async () => {
      const user = userEvent.setup()
      const posted = answering({})
      let view = renderSelf()
      await show('Actions')

      await user.click(screen.getByRole('button', { name: 'Use Wild Shape' }))
      let picker = screen.getByRole('dialog', { name: 'Wild Shape' })
      const [first] = within(picker)
        .getAllByRole('button')
        .slice(1)
        .map(button => button.textContent)
      expect(first).toBe('SelfYouDefault')
      await user.click(within(picker).getByRole('button', { name: /^Self/ }))
      expect(posted[0]).toMatchObject({
        targets: [{ combatId: 'cmbt1', combatantId: 'thorin1' }],
      })

      view.unmount()
      view = renderSelf({ combat: watching, features: ['selfTargets'] })
      await show('Actions')
      await user.click(screen.getByRole('button', { name: 'Use Wild Shape' }))
      picker = screen.getByRole('dialog', { name: 'Wild Shape' })
      await user.click(within(picker).getByRole('button', { name: /^Self/ }))
      expect(posted[1]).toMatchObject({ targets: [], self: true })

      // Nor where the game can't make it at its user.
      view.unmount()
      renderSelf({ combat: watching })
      await show('Actions')
      await user.click(screen.getByRole('button', { name: 'Use Wild Shape' }))
      picker = screen.getByRole('dialog', { name: 'Wild Shape' })
      expect(within(picker).queryByRole('button', { name: /^Self/ })).toBeNull()
    })
  })

  describe('descriptions that roll', () => {
    // Each test's character is a new one, as descriptions loaded are kept by character.
    let characters = 0
    const renderTaking = (
      kinds: RollKind[],
      sheet: CharacterSheet = fullerSheet(),
      features: RollFeature[] = [],
    ) =>
      render(
        <CharacterPane
          characterId={`described-${++characters}`}
          name='Thorin Oakenshield'
          sheet={toTableSheet(sheet, GAME)}
          rollsToTable={kinds}
          rollFeatures={features}
        />,
      )

    beforeEach(() => clearStorage())

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

    it("can't ask the table from a device that doesn't send rolls, but can send them from there, where the switch isn't shown", async () => {
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

    it("rolls a description's damage as a critical hit's, as the sheet says the world makes one, changed as the player chose, in the game too, the tray saying so", async () => {
      const posted = describing(
        { [TEXTS.secondWind]: SAVE },
        { 'req-1': { status: 'done', visible: true, total: 30 } },
      )
      renderTaking(
        ['textDamage'],
        fullerSheet({
          critical: {
            perDie: 2,
            multiplyNumeric: false,
            powerfulCritical: false,
            altered: false,
          },
        }),
        ['modifiers'],
      )
      const user = await openSecondWind()

      fireEvent.contextMenu(
        screen.getByRole('button', { name: '2d6 fire, roll damage' }),
      )
      await user.click(screen.getByRole('menuitem', { name: 'Modify damage…' }))
      const dialog = screen.getByRole('dialog', { name: 'Modify damage' })
      await user.click(
        within(dialog).getByRole('button', { name: 'One die more' }),
      )
      await user.click(
        within(dialog).getByRole('switch', { name: /^Critical hit/ }),
      )
      await user.click(
        within(dialog).getByRole('switch', { name: /^Maximum damage/ }),
      )
      await user.click(within(dialog).getByRole('button', { name: 'Roll' }))

      // Its three d6s, each thrown twice, at their highest.
      expect(posted).toEqual([
        {
          kind: 'textDamage',
          text: TEXTS.secondWind,
          link: 1,
          mode: 0,
          explicit: false,
          extras: [],
          dice: [{ faces: 6, results: [6, 6, 6, 6, 6, 6] }],
          critical: true,
          modifiers: { extra: 1, maximize: true },
        },
      ])
      expect(screen.getByRole('status')).toHaveTextContent(
        /^36Second Wind damage6d6 \(6, 6, 6, 6, 6, 6\) fire · Critical hit · Maximum/,
      )
      // Its status is asked for a second after it's sent, as the page asks it.
      expect(
        await screen.findByText(/At the table:/, {}, { timeout: 3000 }),
      ).toHaveTextContent('At the table: 30')
    })

    it("rolls a description's critical hit with what one adds, as the game reads its activity: its extra die with its first, then its critical damage, in the game too", async () => {
      // A greataxe's 1d12 + 4, with Savage Attacks' die and its 1d6, as module 0.20.0 marks it.
      const posted = describing({
        [TEXTS.secondWind]:
          '<p>Make a <span class="ss-save roll" data-n="0" data-ability="str" data-dc="15">DC 15 Strength</span> saving throw or take <span class="ss-damage roll" data-n="1" data-formulas="1d12 + 4" data-types="slashing" data-critical="false" data-critical-dice="1" data-critical-damage="1d6">1d12 + 4 slashing</span>.</p>',
      })
      renderTaking(
        ['textDamage'],
        fullerSheet({
          critical: {
            perDie: 2,
            multiplyNumeric: false,
            powerfulCritical: false,
            altered: false,
            bonusDice: 'rolled',
          },
        }),
        ['modifiers'],
      )
      const user = await openSecondWind()

      fireEvent.contextMenu(
        screen.getByRole('button', { name: '1d12 + 4 slashing, roll damage' }),
      )
      await user.click(
        screen.getByRole('menuitem', { name: 'Roll critical damage' }),
      )

      // Three d12s, its own twice and the extra one, then the weapon's d6.
      expect(posted).toEqual([
        expect.objectContaining({
          kind: 'textDamage',
          link: 1,
          critical: true,
          dice: [
            {
              faces: 12,
              results: [
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
              ],
            },
            { faces: 6, results: [expect.any(Number)] },
          ],
        }),
      ])
      expect(screen.getByRole('status')).toHaveTextContent(
        /^\d+Second Wind damage3d12 \(\d+, \d+, \d+\) \+4 \+1d6 \(\d\) slashing · Critical hit/,
      )
    })

    it("offers a description's damage as a critical hit's, but not changed, where the game says how it makes one but not that it takes damage changed", async () => {
      describing({ [TEXTS.secondWind]: SAVE })
      renderTaking(
        ['textDamage'],
        fullerSheet({
          critical: {
            perDie: 2,
            multiplyNumeric: false,
            powerfulCritical: false,
            altered: false,
          },
        }),
        [],
      )
      await openSecondWind()

      fireEvent.contextMenu(
        screen.getByRole('button', { name: '2d6 fire, roll damage' }),
      )
      expect(within(screen.getByRole('menu')).getAllByRole('menuitem')).toEqual(
        [screen.getByRole('menuitem', { name: 'Roll critical damage' })],
      )
    })

    it("offers a description's damage only as the game takes it: no critical hit, nor changed, from a game before module 0.19.0", async () => {
      describing({ [TEXTS.secondWind]: SAVE })
      renderTaking(['textDamage'], fullerSheet(), ['modifiers'])
      const user = await openSecondWind()

      const link = screen.getByRole('button', { name: '2d6 fire, roll damage' })
      // Nothing more to offer: the browser's own menu.
      expect(link).not.toHaveAttribute('aria-haspopup')
      expect(fireEvent.contextMenu(link)).toBe(true)
      expect(screen.queryByRole('menu')).toBeNull()
      await user.click(link)
      expect(screen.getByRole('status')).toHaveTextContent(
        /^\d+Second Wind damage2d6 \(\d, \d\) fire/,
      )
    })

    it.each<[string, RollFeature[], string[]]>([
      [
        'not from a game before module 0.21.0, which would change the die it takes away',
        ['modifiers'],
        ['Roll critical damage'],
      ],
      [
        'from a game that changes only a die it adds',
        ['modifiers', 'signedDice'],
        ['Roll critical damage', 'Modify damage…'],
      ],
    ])(
      "offers a description's damage that takes a die away with its dice changed %s",
      async (_, features, offered) => {
        describing({
          [TEXTS.secondWind]:
            '<p>It deals <span class="ss-damage roll" data-n="0" data-formulas="3 - 1d4 + 2d6" data-types="necrotic">3 - 1d4 + 2d6</span> damage, or a <span class="ss-save roll" data-n="1" data-ability="str" data-dc="15">DC 15 Strength</span> saving throw.</p>',
        })
        renderTaking(
          ['textDamage'],
          fullerSheet({
            critical: {
              perDie: 2,
              multiplyNumeric: false,
              powerfulCritical: false,
              altered: false,
            },
          }),
          features,
        )
        await openSecondWind()

        fireEvent.contextMenu(
          screen.getByRole('button', { name: '3 - 1d4 + 2d6, roll damage' }),
        )
        expect(
          within(screen.getByRole('menu'))
            .getAllByRole('menuitem')
            .map(item => item.textContent),
        ).toEqual(offered)
      },
    )

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

  describe('checks activities ask for, from module 0.21.0', () => {
    let rooks = 0
    const renderRook = (kinds: RollKind[], features: RollFeature[] = []) =>
      render(
        <CharacterPane
          characterId={`rook-${++rooks}`}
          name='Rook'
          sheet={toTableSheet(checkingSheet(), GAME)}
          rollsToTable={kinds}
          rollFeatures={features}
        />,
      )

    beforeEach(() => clearStorage())

    it("rolls the player's own against the activity's DC, in the game too, which says whether it passed", async () => {
      const user = userEvent.setup()
      const posted = answering({
        'req-1': {
          status: 'done',
          visible: true,
          total: 14,
          outcome: 'failure',
        },
      })
      renderRook(['tool', 'use'], ['activityChecks'])

      await openLock(user)
      await user.click(
        screen.getByRole('menuitem', {
          name: "Roll my Thieves' Tools check (+6)",
        }),
      )
      expect(posted).toEqual([
        expect.objectContaining({
          kind: 'tool',
          key: 'thief',
          item: 'tools',
          activity: 'pick',
          mode: 0,
          explicit: false,
        }),
      ])
      expect(posted[0]).not.toHaveProperty('text')
      expect(screen.getByRole('status')).toHaveTextContent(
        /^\d+Thieves' Tools checkd20 \d+ \+6( · Natural (20|1))? · DC 15/,
      )
      expect(
        await screen.findByText('At the table:', {}, { timeout: 3000 }),
      ).toHaveTextContent('At the table: 14 · Failed')
    })

    it('asks the table by using the activity in the game, which posts its card', async () => {
      const user = userEvent.setup()
      const posted = answering({
        'req-1': {
          status: 'done',
          visible: true,
          rolls: [],
          use: { type: 'check' },
          damage: null,
        },
      })
      renderRook(['tool', 'use'], ['activityChecks'])

      await openLock(user)
      await user.click(screen.getByRole('menuitem', { name: 'Ask the table' }))
      expect(posted).toEqual([
        {
          kind: 'use',
          item: 'tools',
          activity: 'pick',
          targets: [],
          slot: null,
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        },
      ])
      expect(screen.getByRole('status')).toHaveTextContent("Thieves' Tools")
    })

    it("keeps the player's own roll theirs where the game doesn't make it against the activity, and says why the table can't be asked", async () => {
      const user = userEvent.setup()
      const posted = answering({})
      renderRook(['tool'])

      await openLock(user)
      expect(
        screen.getByRole('menuitem', { name: 'Ask the table' }),
      ).toHaveAccessibleDescription(
        'Your Gamemaster’s game isn’t taking spells and features.',
      )
      await user.click(
        screen.getByRole('menuitem', {
          name: "Roll my Thieves' Tools check (+6)",
        }),
      )
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(
          "Thieves' Tools check",
        ),
      )
      expect(posted).toEqual([])
      expect(screen.getByRole('status')).toHaveTextContent(/(Passed|Failed)/)
    })
  })

  describe("the sheet's settings", () => {
    afterEach(() => {
      jest.restoreAllMocks()
      localStorage.clear()
    })

    it('hold the theme, and no switch to send rolls while the game takes none', async () => {
      const user = userEvent.setup()
      renderPane()
      expect(screen.queryByRole('switch')).toBeNull()

      const settings = await openSettings(user)

      expect(
        within(settings).getByRole('radiogroup', { name: 'Theme' }),
      ).toBeInTheDocument()
      expect(
        within(settings).queryByRole('switch', { name: 'Send to the table' }),
      ).toBeNull()
      expect(
        screen.getByRole('region', { name: 'Your rolls' }),
      ).toHaveTextContent(
        "Only you see these rolls for now. They aren't sent to your Gamemaster's game.",
      )
    })

    it("switch this device's rolls to the table, while the game takes them, the tray saying where", async () => {
      const user = userEvent.setup()
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(characterSheet(), GAME)}
          rollsToTable={['save']}
        />,
      )
      const tray = screen.getByRole('region', { name: 'Your rolls' })
      expect(tray).toHaveTextContent(
        'Checks and saves you roll here are made in your Gamemaster’s game too, with the same dice.',
      )
      // The tray has no switch of its own.
      expect(screen.queryByRole('switch')).toBeNull()

      const settings = await openSettings(user)
      const toggle = within(settings).getByRole('switch', {
        name: 'Send to the table',
      })
      expect(toggle).toBeChecked()
      await user.click(toggle)

      expect(toggle).not.toBeChecked()
      expect(localStorage.getItem('sending-stone:send-rolls')).toBe('off')
      expect(tray).toHaveTextContent(
        'Only you see these rolls: Send to the table is off in Settings.',
      )
    })

    it.each<[string, number, CharacterSheet, string[]]>([
      ['a phone', 390, fullerSheet(), []],
      ['a tablet', 800, fullerSheet(), ['List', 'Columns', 'Table']],
      [
        'a wide sheet, beside the favorites',
        1000,
        favored(),
        ['List', 'Table'],
      ],
      ['a wide sheet', 1000, fullerSheet(), ['List', 'Columns', 'Table']],
    ])(
      'offer on %s the layouts the Actions tab has room for, from any tab',
      async (_, width, sheet, offered) => {
        const user = userEvent.setup()
        wide(width)
        renderPane(sheet)

        const settings = await openSettings(user)
        const picker = within(settings).queryByRole('group', {
          name: 'Actions layout',
        })

        expect(
          picker
            ? within(picker)
                .getAllByRole('button')
                .map(button => button.textContent)
            : [],
        ).toEqual(offered)
      },
    )

    it('offer no layouts for a sheet without actions', async () => {
      const user = userEvent.setup()
      wide(800)
      renderPane(characterSheet({ actions: [] }))

      const settings = await openSettings(user)

      expect(within(settings).queryByRole('group')).toBeNull()
    })

    it('lay the Actions tab out as chosen there', async () => {
      const user = userEvent.setup()
      wide(800)
      renderPane()

      const settings = await openSettings(user)
      await user.click(within(settings).getByRole('button', { name: 'Table' }))
      expect(localStorage.getItem('sending-stone:actions-layout')).toBe('table')
      await user.keyboard('{Escape}')
      await show('Actions')

      expect(screen.getByRole('table', { name: 'Actions' })).toBeInTheDocument()
    })

    it('list the actions on a phone whatever was chosen, keeping the choice', async () => {
      localStorage.setItem('sending-stone:actions-layout', 'table')
      wide(390)
      renderPane()
      await show('Actions')

      expect(screen.queryByRole('table')).toBeNull()
      expect(
        within(screen.getByRole('region', { name: 'Actions' })).getAllByRole(
          'listitem',
        ),
      ).toHaveLength(4)
      expect(localStorage.getItem('sending-stone:actions-layout')).toBe('table')
    })
  })

  describe('roll results: toasts or the banner', () => {
    // As a player who never chose has them: toasts.
    beforeEach(() => globalThis.localStorage.clear())
    afterEach(() => globalThis.localStorage.clear())

    it('P1 pops each roll up as a toast by default, with no banner on any tab, the rolls a button away', async () => {
      const user = userEvent.setup()
      renderPane(castingSheet())

      await user.click(
        screen.getByRole('button', { name: 'Strength check, +4' }),
      )

      const toast = await within(toasts()).findByText('Strength check')
      expect(toast.closest('[data-roll-toast]')).toHaveTextContent(
        /^\d+Strength checkd20 \d+ \+4/,
      )
      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(7)
      for (const tab of tabs) {
        await user.click(tab)
        expect(screen.queryByRole('region', { name: 'Your rolls' })).toBeNull()
        expect(rollsButton()).toBeInTheDocument()
      }
      expect(screen.queryByRole('status')).toBeNull()
      // Just before the cog, at the end of the row of tabs.
      expect(rollsButton()?.nextElementSibling).toBe(
        screen.getByRole('button', { name: 'Settings' }),
      )

      await user.click(rollsButton() as HTMLElement)
      const rolls = screen.getByRole('dialog', { name: 'Your rolls' })
      expect(within(rolls).getByRole('status')).toHaveTextContent(
        'Strength check',
      )
      expect(within(rolls).getByRole('status')).toHaveAttribute(
        'aria-live',
        'off',
      )
    })

    it("P2 says in a roll's toast where it is at the table, as it goes, as its rolls do", async () => {
      const user = userEvent.setup()
      answering({ 'req-1': { status: 'done', visible: true, total: 31 } })
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(characterSheet(), GAME)}
          rollsToTable={['save']}
        />,
      )

      await user.click(
        screen.getByRole('button', {
          name: 'Strength saving throw, +7, proficient',
        }),
      )

      const label = await within(toasts()).findByText('Strength saving throw')
      const toast = label.closest('[data-roll-toast]') as HTMLElement
      expect(toast).toHaveTextContent('Sending to your Gamemaster’s game…')
      await waitFor(() => expect(toast).toHaveTextContent('At the table: 31'), {
        timeout: 3000,
      })
      expect(toasts().querySelector('[data-roll-toast]')).toBe(toast)
      await user.click(rollsButton() as HTMLElement)
      expect(
        within(screen.getByRole('dialog', { name: 'Your rolls' })).getByRole(
          'status',
        ),
      ).toHaveTextContent('At the table: 31')
    })

    it('P3 shows the banner instead, as chosen in the settings, on this device, for good, and no toasts', async () => {
      const user = userEvent.setup()
      const { unmount } = renderPane()
      await user.click(
        screen.getByRole('button', { name: 'Strength check, +4' }),
      )
      await within(toasts()).findByText('Strength check')

      const choice = await results(user)
      expect(
        within(choice).getByRole('radio', { name: 'Toasts' }),
      ).toHaveAttribute('aria-checked', 'true')
      await user.click(within(choice).getByRole('radio', { name: 'Banner' }))
      expect(globalThis.localStorage.getItem(TOASTS_KEY)).toBe('off')
      expect(
        within(choice).getByRole('radio', { name: 'Banner' }),
      ).toHaveAttribute('aria-checked', 'true')
      // The toast showing is gone, and the rolls' button with it.
      expect(screen.queryByRole('log')).toBeNull()
      expect(document.querySelector('[data-roll-toast]')).toBeNull()
      expect(rollsButton()).toBeNull()
      await user.keyboard('{Escape}')

      const banner = screen.getByRole('region', { name: 'Your rolls' })
      expect(within(banner).getByRole('status')).toHaveTextContent(
        'Strength check',
      )
      await user.click(
        screen.getByRole('button', { name: 'Strength check, +4' }),
      )
      await waitFor(() =>
        expect(
          within(banner).getByText('Earlier rolls (1)'),
        ).toBeInTheDocument(),
      )
      expect(within(banner).getByRole('status')).toHaveAttribute(
        'aria-live',
        'polite',
      )
      expect(screen.queryByRole('log')).toBeNull()

      unmount()
      renderPane()
      expect(
        within(await results(user)).getByRole('radio', { name: 'Banner' }),
      ).toHaveAttribute('aria-checked', 'true')
      await user.keyboard('{Escape}')
      expect(
        screen.getByRole('region', { name: 'Your rolls' }),
      ).toBeInTheDocument()
      expect(rollsButton()).toBeNull()
    })

    it('P4 reads a player’s toasts turned off before as the banner, and turns back to toasts, popping nothing rolled meanwhile', async () => {
      const user = userEvent.setup()
      globalThis.localStorage.setItem(TOASTS_KEY, 'off')
      renderPane()

      const choice = await results(user)
      expect(
        within(choice).getByRole('radio', { name: 'Banner' }),
      ).toHaveAttribute('aria-checked', 'true')
      await user.keyboard('{Escape}')
      expect(
        screen.getByRole('region', { name: 'Your rolls' }),
      ).toBeInTheDocument()
      await user.click(
        screen.getByRole('button', { name: 'Strength check, +4' }),
      )
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent('Strength check'),
      )

      await user.click(
        within(await results(user)).getByRole('radio', { name: 'Toasts' }),
      )
      expect(globalThis.localStorage.getItem(TOASTS_KEY)).toBe('on')
      await user.keyboard('{Escape}')

      expect(screen.queryByRole('region', { name: 'Your rolls' })).toBeNull()
      expect(rollsButton()).toBeInTheDocument()
      expect(toasts()).toBeEmptyDOMElement()
    })

    it('P5 keeps a toast showing on a tab with nothing to roll, outside the sheet', async () => {
      const user = userEvent.setup()
      renderPane()
      await user.click(
        screen.getByRole('button', { name: 'Strength check, +4' }),
      )
      await within(toasts()).findByText('Strength check')

      await show('Biography')

      expect(within(toasts()).getByText('Strength check')).toBeInTheDocument()
      expect(screen.getByRole('tabpanel')).not.toContainElement(toasts())
      expect(toasts().parentElement?.parentElement).toBe(document.body)
    })

    it("P7 starts the toasts 8 pixels below the row of tabs, with the rolls' button and the cog", async () => {
      const user = userEvent.setup()
      renderPane()
      const row = screen.getByRole('tablist').parentElement as HTMLElement
      expect(row).toContainElement(rollsButton())
      expect(row).toContainElement(
        screen.getByRole('button', { name: 'Settings' }),
      )
      // The row, as a browser lays it out under a header 64 pixels tall, as the window's resized.
      row.getBoundingClientRect = () =>
        ({ top: 64, bottom: 108, width: 390, height: 44 }) as DOMRect
      act(() => {
        globalThis.dispatchEvent(new Event('resize'))
      })

      await user.click(
        screen.getByRole('button', { name: 'Strength check, +4' }),
      )
      await within(toasts()).findByText('Strength check')

      expect(toasts().parentElement).toHaveStyle({ top: '116px' })
    })

    it("P8 starts the toasts below the game's prompts beneath the row while it asks any, so as not to cover their only buttons, and below the row once they go", async () => {
      const user = userEvent.setup()
      const ask: TablePrompt = {
        id: 'msg2-thorin',
        type: 'concentration',
        abilities: ['con'],
        label: 'Bless',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      }
      const pane = (prompts: TablePrompt[]) => (
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(fullerSheet(), GAME)}
          rollsToTable={['save']}
          rollFeatures={['prompts']}
          prompts={prompts}
        />
      )
      const { rerender } = render(pane([ask]))
      const row = screen.getByRole('tablist').parentElement as HTMLElement
      const prompts = screen.getByRole('region', {
        name: 'Your Gamemaster asks',
      })
      // As a browser lays them out under a header 64 pixels tall, the prompts beneath the row.
      row.getBoundingClientRect = () =>
        ({ top: 64, bottom: 108, width: 390, height: 44 }) as DOMRect
      prompts.getBoundingClientRect = () =>
        ({ top: 108, bottom: 231, width: 390, height: 123 }) as DOMRect
      act(() => {
        globalThis.dispatchEvent(new Event('resize'))
      })

      await user.click(
        screen.getByRole('button', { name: 'Strength check, +4' }),
      )
      await within(toasts()).findByText('Strength check')
      expect(toasts().parentElement).toHaveStyle({ top: '239px' })

      // The game asks nothing more.
      rerender(pane([]))
      expect(
        screen.queryByRole('region', { name: 'Your Gamemaster asks' }),
      ).toBeNull()
      expect(toasts().parentElement).toHaveStyle({ top: '116px' })
    })

    it("P9 opens the cog's settings and the rolls' popover over the toasts, which start just below them", async () => {
      const user = userEvent.setup()
      renderPane()
      await user.click(
        screen.getByRole('button', { name: 'Strength check, +4' }),
      )
      await within(toasts()).findByText('Strength check')
      const region = toasts().parentElement as HTMLElement
      expect(layer(region)).toBe(100_001)

      const settings = await openSettings(user)
      expect(layer(settings)).toBeGreaterThan(layer(region))
      await user.keyboard('{Escape}')
      await user.click(rollsButton() as HTMLElement)
      expect(
        layer(screen.getByRole('dialog', { name: 'Your rolls' })),
      ).toBeGreaterThan(layer(region))
    })

    it("P6 tightens the row of tabs on a phone narrower than 390 pixels, for a caster's to fit beside the rolls' button and the cog", () => {
      renderPane(castingSheet())

      // The row's width inside its padding, 366 pixels on a 390-pixel screen, as measured in a
      // browser: the tabs take 277 pixels of the 280 left on a 360-pixel one.
      const row = screen.getByRole('tablist').parentElement as HTMLElement
      expect(row).toHaveClass('@container', 'px-3')
      const tabs = screen.getAllByRole('tab')
      expect(tabs).toHaveLength(7)
      for (const tab of tabs.filter(
        tab => tab.getAttribute('aria-selected') === 'false',
      )) {
        expect(tab).toHaveClass('px-1.5', '@max-[366px]:px-1')
      }
      expect(tabs[0]).toHaveClass('px-2')
      expect(tabs[0]).not.toHaveClass('@max-[366px]:px-1')
      for (const button of [
        rollsButton() as HTMLElement,
        screen.getByRole('button', { name: 'Settings' }),
      ]) {
        expect(button).toHaveClass('p-2', '@max-[366px]:p-1.5')
      }
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

    it('stars the feature a resource stands for, on Features and Actions', async () => {
      renderPane(
        favored([
          {
            type: 'resource',
            id: 'secondary',
            name: 'Second Wind',
            uses: { value: 0, max: 1, recovery: 'Short Rest' },
            itemId: 'second-wind',
          },
        ]),
      )
      await show('Features')
      expect(starred('Fighter Features')).toEqual(['Second Wind'])

      await show('Actions')
      expect(starred('Bonus Actions')).toEqual(['Second Wind'])
    })
  })
})

describe("components/character-sheet/character-pane, the Gamemaster's rolls as the character (#156)", () => {
  const gmRolls: GmRollView[] = [
    {
      id: 'req-gm',
      kind: 'attack',
      label: 'Warhammer attack',
      at: '2026-10-14T12:00:00.000Z',
      status: 'done',
      visible: true,
      total: 19,
      attack: { critical: false, fumble: false, outcome: 'hit' },
    },
  ]
  const pane = (rolls: GmRollView[]) => (
    <CharacterPane
      characterId='char-1'
      name='Thorin Oakenshield'
      sheet={toTableSheet(fullerSheet(), GAME)}
      gmRolls={rolls}
    />
  )
  const renderWith = (rolls: GmRollView[] = gmRolls) => render(pane(rolls))

  beforeEach(clearStorage)

  it('shows them in the banner, where the player has it, as their latest roll, with nothing to roll', () => {
    renderWith()

    const banner = screen.getByRole('region', { name: 'Your rolls' })
    expect(within(banner).getByRole('status')).toHaveTextContent(
      '19Warhammer attackGM, rolled by your GamemasterRolled by your GamemasterAt the table: 19 · Hit',
    )
    expect(within(banner).queryByRole('button')).toBeNull()
  })

  it('shows them behind the rolls’ button where the player has toasts, with no dot for damage', async () => {
    globalThis.localStorage.removeItem(TOASTS_KEY)
    const user = userEvent.setup()
    renderWith()

    const button = screen.getByRole('button', { name: 'Your rolls' })
    expect(button.textContent).toBe('Your rolls')
    await user.click(button)
    expect(
      within(screen.getByRole('dialog', { name: 'Your rolls' })).getByText(
        'Warhammer attack',
      ),
    ).toBeInTheDocument()
    // Made before the page opened: it never pops up.
    expect(document.querySelector('[data-roll-toast]')).toBeNull()
  })

  it('pops one up as a toast once the game has made it, where the player has toasts, marked GM, with nothing to tap', () => {
    globalThis.localStorage.removeItem(TOASTS_KEY)
    const [{ id, kind, label, at }] = gmRolls
    const { rerender } = renderWith([
      { id, kind, label, at, status: 'rolling' },
    ])
    // On its way as the page opens: it waits for the game.
    expect(document.querySelector('[data-roll-toast]')).toBeNull()

    rerender(pane(gmRolls))

    const toast = document.querySelector<HTMLElement>(
      '[data-roll-toast="gm:req-gm"][data-gm="true"]',
    )
    expect(toast).toHaveTextContent(
      '19Warhammer attackGM, rolled by your GamemasterRolled by your GamemasterAt the table: 19 · Hit',
    )
    expect(within(toast as HTMLElement).queryByRole('button')).toBeNull()
  })
})
