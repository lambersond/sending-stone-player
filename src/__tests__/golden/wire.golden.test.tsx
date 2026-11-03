/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
// C2, wire (round 0.43 §3.2): every request the app's pages send, whole, as the code sends it
// today: its URL, method, headers and raw body (key order and all), and the poll that follows a
// roll; and, as JSON strings, what the server makes of a held roll for the module and for the
// pages. Frozen from the commit that adds it (gate 10): never updated, only its imports follow a
// move.
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from '@/components/character-sheet/character-pane'
import { CompanionPane } from '@/components/companions/companion-pane'
import { GameTable } from '@/components/game-table/game-table'
import { ROLL_KINDS } from '@/constants/sending-stone'
import { useCompanionView } from '@/hooks/use-companion-view'
import { forgetCookbook, useCookbookView } from '@/hooks/use-cookbook-view'
import { useEndTurn } from '@/hooks/use-end-turn'
import { forgetNotes, useNotes } from '@/hooks/use-notes'
import { usePartySheet } from '@/hooks/use-party-sheet'
import { TableApiContext } from '@/hooks/use-table-api'
import {
  CHECK_EVERY,
  damageRollOf,
  useTableRolls,
} from '@/hooks/use-table-rolls'
import { POLL_INTERVAL, useTableView } from '@/hooks/use-table-view'
import { useTransfers } from '@/hooks/use-transfers'
import { useTurnUndo } from '@/hooks/use-turn-undo'
import {
  aloneSheet,
  chargingSheet,
  characterSheet,
  fullerSheet,
  ironCompany,
  mockCompanionSheet,
  mockCompanionView,
  mockNotesView,
  mockTurnCombat,
  NOTE_IDS,
  TEXTS,
} from '@/mocks/sending-stone'
import {
  toCommand,
  toGmRollView,
  toRollRequestView,
  type HeldRollRequest,
} from '@/utils/roll-requests'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import {
  advance,
  atFixedTime,
  respond,
  rollServer,
  sent,
} from '@/utils/test-utils'
import type { Character, TableSeat } from '@/types/character'
import type { PartyView } from '@/types/party'
import type { RollFeature, RollKind } from '@/types/roll'
import type { CharacterSheet } from '@/types/sending-stone'
import type {
  EndableTurn,
  TableCombat,
  TableMessage,
  TableView,
} from '@/types/table'

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock(
  '@lambersond/3d-dice-react',
  () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
)

const mockRefresh = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const GAME = 'https://my-game.forge-vtt.com'
const NOW = '2026-10-04T19:30:00.000Z'

/** Math.random as a fixed sequence: an LCG from seed 43 (a 1664525, c 1013904223, m 2^32). */
const lcg = () => {
  let seed = 43
  return () => {
    seed = (1_664_525 * seed + 1_013_904_223) % 2 ** 32
    return seed / 2 ** 32
  }
}

const PLAYER_API = '/api/characters/char-1'
const GM: TableSeat = {
  role: 'gm',
  api: '/api/campaigns/c1/characters/thorin',
  key: 'gm:c1:thorin',
}
const SEATS: [string, TableSeat | undefined][] = [
  ['player', undefined],
  ['gm', GM],
]

/** Every feature a game from module 0.42.1 says it has, but typed dice. */
const FEATURES: RollFeature[] = [
  'modifiers',
  'prompts',
  'areaAttacks',
  'activityChecks',
  'signedDice',
  'aloneChoices',
  'effectDice',
]

let user: ReturnType<typeof userEvent.setup>

beforeEach(() => {
  atFixedTime(NOW)
  jest.spyOn(Math, 'random').mockImplementation(lcg())
  globalThis.localStorage.clear()
  globalThis.sessionStorage.clear()
  globalThis.localStorage.setItem(TOASTS_KEY, 'off')
  forgetNotes()
  forgetCookbook()
  user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
})

afterEach(() => {
  jest.useRealTimers()
})

/** The requests sent, once a roll's first poll has gone out. */
const polled = async () => {
  await advance(CHECK_EVERY)
  return sent()
}

/** Inside the seat's context, where it has one: the Gamemaster's. */
const atSeat = (seat: TableSeat | undefined, children: React.ReactNode) =>
  seat ? <TableApiContext value={seat}>{children}</TableApiContext> : children

/** Thorin's pane, at a seat, taking every kind of roll. */
const renderPane = ({
  sheet = fullerSheet(),
  seat,
  combat,
  features = FEATURES,
  characterId = 'char-1',
}: {
  sheet?: CharacterSheet
  seat?: TableSeat
  combat?: TableCombat
  features?: RollFeature[]
  characterId?: string
} = {}) =>
  render(
    atSeat(
      seat,
      <CharacterPane
        characterId={characterId}
        name='Thorin Oakenshield'
        sheet={toTableSheet(sheet, GAME)}
        combat={combat}
        rollsToTable={[...ROLL_KINDS]}
        rollFeatures={features}
      />,
    ),
  )

/** What the game answers of an attack that hit, with the damage it says follows. */
const HIT = {
  status: 'done',
  visible: true,
  total: 19,
  attack: { critical: false, fumble: false, outcome: 'hit' },
  damage: {
    critical: false,
    plannable: true,
    rolls: [
      {
        formula: '1d8 + 4',
        type: 'bludgeoning',
        dice: [{ faces: 8, number: 1 }],
      },
    ],
  },
}

/** A description with a save, damage, a roll and a condition, as the module sends its HTML. */
const DESCRIBED =
  '<p>Make a <span class="ss-save roll" data-n="0" data-ability="str" data-dc="15">DC 15 Strength</span> saving throw or take <span class="ss-damage roll" data-n="1" data-formulas="2d6" data-types="fire">2d6 fire</span>, then roll <span class="ss-roll roll" data-n="2" data-formula="1d4">1d4</span> and fall <span class="ss-condition ref" data-condition="prone">Prone</span>.</p>'

/** The roll server, which also has each description's HTML. */
const describing = () => {
  rollServer()
  const rolls = globalThis.fetch
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) =>
    String(url).includes('/texts/')
      ? respond(200, { html: DESCRIBED })
      : rolls(url, init),
  ) as typeof fetch
}

describe('rolls from the pane', () => {
  it.each(SEATS)('a saving throw at the %s seat', async (name, seat) => {
    rollServer()
    renderPane({ sheet: characterSheet(), seat })
    await user.click(
      screen.getByRole('button', {
        name: 'Strength saving throw, +7, proficient',
      }),
    )
    expect(await polled()).toMatchSnapshot(`save ${name}`)
  })

  it('a skill check', async () => {
    rollServer()
    renderPane({ sheet: characterSheet() })
    await user.click(screen.getByRole('button', { name: /^Athletics check/ }))
    expect(await polled()).toMatchSnapshot('skill')
  })

  it('an ability check', async () => {
    rollServer()
    renderPane({ sheet: characterSheet() })
    await user.click(screen.getByRole('button', { name: /^Strength check/ }))
    expect(await polled()).toMatchSnapshot('ability')
  })

  it('a death saving throw', async () => {
    rollServer()
    renderPane({
      sheet: characterSheet({
        hp: { value: 0, max: 44, temp: 0 },
        deathSaves: { success: 1, failure: 2 },
      }),
    })
    await user.click(screen.getByRole('button', { name: 'Death saving throw' }))
    expect(await polled()).toMatchSnapshot('death')
  })

  it('initiative for the combat', async () => {
    rollServer()
    renderPane({
      sheet: characterSheet(),
      combat: mockTurnCombat({
        combatants: mockTurnCombat().combatants.map(combatant =>
          combatant.side === 'me'
            ? { ...combatant, initiative: null }
            : combatant,
        ),
      }),
    })
    await user.click(
      screen.getByRole('button', {
        name: 'Initiative, +1, to roll for the combat',
      }),
    )
    expect(await polled()).toMatchSnapshot('initiative')
  })

  it.each(SEATS)(
    'an attack at a target, then its damage, at the %s seat',
    async (name, seat) => {
      rollServer({ 'req-1': HIT })
      renderPane({ seat, combat: mockTurnCombat() })
      await user.click(screen.getByRole('tab', { name: 'Actions' }))
      await user.click(
        screen.getByRole('button', { name: 'Warhammer attack, +7' }),
      )
      const picker = screen.getByRole('dialog', { name: 'Warhammer attack' })
      await user.click(within(picker).getByRole('button', { name: 'Goblin' }))
      await advance(CHECK_EVERY)
      await user.click(screen.getByRole('button', { name: 'Roll damage' }))
      expect(await polled()).toMatchSnapshot(`attack and damage ${name}`)
    },
  )

  it('an attack with advantage at no one, out of combat, then its maximum damage', async () => {
    rollServer({ 'req-1': HIT })
    renderPane()
    await user.click(screen.getByRole('tab', { name: 'Actions' }))
    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'Warhammer attack, +7' }),
    )
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll with advantage' }),
    )
    await advance(CHECK_EVERY)
    fireEvent.contextMenu(screen.getByRole('button', { name: 'Roll damage' }))
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll maximum damage' }),
    )
    expect(await polled()).toMatchSnapshot('attack with advantage')
  })

  it('a use at those ticked in its area, at the slot chosen', async () => {
    rollServer()
    renderPane({ sheet: aloneSheet(), combat: mockTurnCombat() })
    await user.click(screen.getByRole('tab', { name: 'Actions' }))
    await user.click(
      screen.getByRole('button', {
        name: 'Burning Hands, DEX saving throw DC 13',
      }),
    )
    const picker = screen.getByRole('dialog', { name: 'Burning Hands' })
    await user.click(within(picker).getByRole('checkbox', { name: 'Goblin' }))
    await user.click(
      within(picker).getByRole('button', { name: 'Cast at 1 target' }),
    )
    expect(await polled()).toMatchSnapshot('use in an area')
  })

  it('charges spent', async () => {
    rollServer()
    renderPane({ sheet: chargingSheet() })
    await user.click(screen.getByRole('tab', { name: /^Features/ }))
    await user.click(
      screen.getByRole('button', {
        name: 'Spend Sorcery Points: 8 of 20 left',
      }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Spend Sorcery Points' }),
      ).getByRole('button', { name: 'Spend 1' }),
    )
    expect(await polled()).toMatchSnapshot('spend')
  })

  it('a concentration ended', async () => {
    rollServer()
    renderPane({ sheet: chargingSheet() })
    await user.click(screen.getByRole('tab', { name: /^Effects/ }))
    const row = screen.getByText('Concentrating: Bless').closest('li')!
    await user.click(within(row).getByText('Concentrating: Bless'))
    // The row's toggle event is a task of its own, which the fake clock holds until moved on.
    await advance(0)
    await user.click(
      within(row).getByRole('button', { name: 'End concentration on Bless' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'End concentration on Bless?' }),
      ).getByRole('button', { name: 'End' }),
    )
    expect(await polled()).toMatchSnapshot('endConcentration')
  })

  it('Heroic Inspiration gained', async () => {
    rollServer()
    renderPane({ sheet: chargingSheet() })
    await user.click(
      screen.getByRole('button', {
        name: 'Not inspired. Gain Heroic Inspiration',
      }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Gain Heroic Inspiration?' }),
      ).getByRole('button', { name: 'Gain' }),
    )
    expect(await polled()).toMatchSnapshot('inspiration')
  })

  it('a hit die', async () => {
    rollServer()
    renderPane()
    await user.click(
      screen.getByRole('button', { name: 'Use a d10 hit die, 3 of 5 left' }),
    )
    expect(await polled()).toMatchSnapshot('hitDie')
  })

  it("a description's save, ask, damage and roll, with the description read first", async () => {
    describing()
    renderPane({ characterId: 'char-described' })
    await user.click(screen.getByRole('tab', { name: /^Features/ }))
    await user.click(screen.getByText('Second Wind'))
    await user.click(
      await screen.findByRole('button', { name: 'DC 15 Strength' }),
    )
    await user.click(
      screen.getByRole('menuitem', { name: 'Roll my Strength save (+7)' }),
    )
    await user.click(screen.getByRole('button', { name: 'DC 15 Strength' }))
    await user.click(screen.getByRole('menuitem', { name: 'Ask the table' }))
    await user.click(screen.getByRole('button', { name: /^2d6 fire/ }))
    await user.click(screen.getByRole('button', { name: /^1d4/ }))
    expect(await polled()).toMatchSnapshot('described')
  })

  it('damage on its own, with its choices, from a chip, its switch on', async () => {
    rollServer()
    globalThis.localStorage.setItem('sending-stone:send-damage', 'on')
    renderPane({ sheet: aloneSheet() })
    await user.click(screen.getByRole('tab', { name: 'Actions' }))
    await user.click(
      screen.getByRole('button', {
        name: 'Battleaxe damage, 1d8 + 3, goes to the table on its own',
      }),
    )
    await user.click(screen.getByRole('radio', { name: 'Two-Handed' }))
    await user.click(screen.getByRole('button', { name: 'Roll damage' }))
    expect(await polled()).toMatchSnapshot('itemDamage')
  })

  it("a companion's own view, then its attack, at its own routes", async () => {
    rollServer()
    const rolls = globalThis.fetch
    globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) =>
      String(url).includes('/table')
        ? respond(
            200,
            mockCompanionView({
              sheet: toTableSheet(mockCompanionSheet(), GAME),
              combat: mockTurnCombat(),
            }),
          )
        : rolls(url, init),
    ) as typeof fetch
    render(
      <CompanionPane
        seat={{ role: 'player', api: PLAYER_API, key: 'char-1' }}
        companion={{ key: 'wolfBrakka', name: 'Brakka', kind: 'owned' }}
        name='Brakka'
        character='Thorin'
        shown
        gone={false}
      />,
    )
    await advance(0)
    await user.click(screen.getByRole('tab', { name: 'Actions' }))
    await user.click(screen.getByRole('button', { name: /^Bite attack/ }))
    const picker = screen.getByRole('dialog', { name: 'Bite attack' })
    await user.click(within(picker).getByRole('button', { name: 'Goblin' }))
    expect(await polled()).toMatchSnapshot('companion attack')
  })
})

/** A use as the page logs it, to send. */
const logged = (fields: object = {}) => ({
  kind: 'use' as const,
  id: 'u1',
  label: 'Thing',
  spell: false,
  at: Date.parse(NOW),
  ...fields,
})

/** A check as the roller throws it, d20s and extras as given. */
const check = (fields: object = {}) => ({
  kind: 'check' as const,
  id: 'r1',
  label: 'Perception check',
  total: 28,
  modifier: 4,
  advantage: 'adv' as const,
  d20s: [17, 3],
  natural: 17,
  extras: [
    { text: '+1d4', values: [2], value: 2 },
    { text: '−1', values: [], value: -1 },
  ],
  at: Date.parse(NOW),
  ...fields,
})

/** Damage as the roller throws it: 1d8 + 4 slashing, then 1d6 fire. */
const thrown = (fields: object = {}) => ({
  kind: 'damage' as const,
  id: 'r2',
  label: 'Longsword damage',
  total: 15,
  critical: false,
  healing: false,
  parts: [
    {
      type: 'slashing',
      total: 9,
      terms: [
        { text: '1d8', values: [5], value: 5 },
        { text: '+4', values: [], value: 4 },
      ],
    },
    { type: 'fire', total: 6, terms: [{ text: '1d6', values: [6], value: 6 }] },
  ],
  at: Date.parse(NOW),
  ...fields,
})

/** The damage the game said the longsword throws: 1d8 + 4, then 1d6 fire. */
const preview = {
  critical: false,
  plannable: true,
  rolls: [
    { formula: '1d8 + 4', type: 'slashing', dice: [{ faces: 8, number: 1 }] },
    { formula: '1d6', type: 'fire', dice: [{ faces: 6, number: 1 }] },
  ],
}

/** A formula as the roller throws it. */
const formula = (fields: object = {}) => ({
  kind: 'formula' as const,
  id: 'f1',
  label: 'Lantern: Light radius',
  total: 1,
  healing: false,
  terms: [
    { text: '2', values: [], value: 2 },
    { text: '+1d4', values: [3], value: 3 },
    { text: '−1d6', values: [4], value: -4 },
  ],
  at: Date.parse(NOW),
  ...fields,
})

/** Each send in turn, its answer read before the next is made, so that each has its own id. */
const inTurn = async (...sends: (() => unknown)[]) => {
  for (const send of sends) {
    act(() => {
      send()
    })
    await advance(0)
  }
}

/** useTableRolls at a seat, taking these kinds and features. */
const renderRolls = (
  seat?: TableSeat,
  kinds: readonly RollKind[] = ROLL_KINDS,
  features = FEATURES,
) =>
  renderHook(() => useTableRolls('char-1', kinds, features), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      atSeat(seat, children),
  })

describe('what useTableRolls sends', () => {
  it.each(SEATS)('checks and attacks at the %s seat', async (name, seat) => {
    rollServer()
    const { result } = renderRolls(seat)
    await inTurn(
      () =>
        result.current.send(
          {
            label: 'Perception check',
            modifier: 4,
            advantage: 'adv',
            extras: [
              { sign: 1, count: 1, sides: 4 },
              { sign: -1, flat: 1 },
            ],
            source: { kind: 'skill', key: 'prc' },
            explicit: true,
          },
          check(),
        ),
      () =>
        result.current.send(
          {
            label: 'Dexterity saving throw',
            modifier: 2,
            source: { kind: 'save', key: 'dex', prompt: 'msg1-bat1' },
          },
          check({ id: 'r2', advantage: undefined, d20s: [9], extras: [] }),
        ),
      () =>
        result.current.send(
          {
            label: 'Fire Breath attack',
            modifier: 5,
            source: {
              kind: 'attack',
              item: 'breath',
              activity: 'breathAttack',
              targets: [
                { combatId: 'cmbt1', combatantId: 'c-goblin' },
                { combatId: 'cmbt1', combatantId: 'c-vex' },
              ],
              slot: 'spell2',
              attackMode: 'twoHanded',
              ammunition: 'arrows',
            },
            targetNames: { 'c-goblin': 'Goblin', 'c-vex': 'Vex' },
            itemCast: true,
          },
          check({ id: 'r3', advantage: 'dis', d20s: [11, 4], extras: [] }),
        ),
    )
    expect(await polled()).toMatchSnapshot(`checks ${name}`)
  })

  it.each(SEATS)('damage of each kind at the %s seat', async (name, seat) => {
    rollServer()
    globalThis.localStorage.setItem('sending-stone:send-damage', 'on')
    globalThis.localStorage.setItem('sending-stone:send-damage:gm', 'on')
    const { result } = renderRolls(seat)
    await inTurn(
      () =>
        result.current.sendDamage(
          {
            ...damageRollOf('Longsword', { use: 'req-1', damage: preview }),
            types: ['slashing', null],
            modifiers: { extra: 1, faces: 10 },
          },
          thrown(),
        ),
      () =>
        result.current.sendDamage(
          damageRollOf('Longsword', { use: 'req-2', damage: preview }),
          thrown({ id: 'r3', typed: true, rerolls: 'kept' }),
        ),
      () =>
        result.current.sendDamage(
          {
            ...damageRollOf('Fireball', { use: '', damage: preview }),
            use: undefined,
            text: { text: TEXTS.secondWind, link: 1 },
            critical: true,
            criticalRule: {
              perDie: 2,
              multiplyNumeric: false,
              powerfulCritical: false,
              altered: false,
              bonusDice: 'rolled',
            },
            criticalAdds: {} as never,
          },
          thrown({ id: 'r4', critical: true }),
        ),
      () =>
        result.current.sendDamage(
          {
            ...damageRollOf('Battleaxe', { use: '', damage: preview }),
            use: undefined,
            alone: {
              item: 'battleaxe',
              activity: 'axeAttack',
              slot: 'spell1',
              attackMode: 'twoHanded',
              ammunition: 'bolts',
              consume: true,
              critical: true,
            },
          } as never,
          thrown({ id: 'r5' }),
        ),
    )
    expect(await polled()).toMatchSnapshot(`damage ${name}`)
  })

  it('formulas, hit dice at once, and hit dice one by one where the game takes no hitDice', async () => {
    rollServer()
    const { result } = renderRolls()
    const hitDice = {
      label: 'Hit dice (2d10 + 1d8)',
      terms: [],
      sets: [
        {
          terms: [
            { sign: 1, count: 1, sides: 10 },
            { sign: 1, flat: 3 },
          ],
          times: 2,
        },
        {
          terms: [
            { sign: 1, count: 1, sides: 8 },
            { sign: 1, flat: 3 },
          ],
          times: 1,
        },
      ],
      healing: true,
      minimum: 1,
      source: {
        kind: 'hitDice',
        hitDice: [
          { denomination: 'd10', count: 2 },
          { denomination: 'd8', count: 1 },
        ],
      },
    }
    const spent = formula({
      id: 'f2',
      label: 'Hit dice (2d10 + 1d8)',
      total: 22,
      healing: true,
      terms: [
        { text: '2d10', values: [6, 2], value: 8 },
        { text: '+1d8', values: [5], value: 5 },
        { text: '+9', values: [], value: 9 },
      ],
      times: 3,
    })
    await inTurn(
      () =>
        result.current.sendFormula(
          {
            label: 'Lantern: Light radius',
            terms: [
              { sign: 1, flat: 2 },
              { sign: 1, count: 1, sides: 4 },
              { sign: -1, count: 1, sides: 6 },
            ],
            source: { kind: 'formula', item: 'lantern', activity: 'shine' },
          } as never,
          formula(),
        ),
      () => result.current.sendFormula(hitDice as never, spent),
    )
    await advance(CHECK_EVERY)
    const one = renderRolls(undefined, ['hitDie'])
    act(() => one.result.current.sendFormula(hitDice as never, spent))
    expect(await polled()).toMatchSnapshot('formulas')
  })

  it.each(SEATS)(
    'uses, asks and recharges at the %s seat',
    async (name, seat) => {
      rollServer()
      const { result } = renderRolls(seat)
      await inTurn(
        () =>
          result.current.sendUse(
            logged({ label: 'Cure Wounds', spell: true }),
            {
              kind: 'use',
              item: 'cure',
              activity: 'cureHeal',
              targets: [{ combatId: 'cmbt1', combatantId: 'c-vex' }],
              self: true,
              slot: 'spell2',
              enchant: { profile: 'plusOne', item: 'longsword' },
            } as never,
          ),
        () =>
          result.current.sendUse(logged({ id: 'u2', label: 'Second Wind' }), {
            kind: 'use',
            item: 'second-wind',
            activity: 'windHeal',
            targets: [],
          } as never),
        () =>
          result.current.sendAsk(
            {
              kind: 'ask',
              id: 'a1',
              label: 'DC 15 Strength saving throw',
              at: 0,
            },
            { text: TEXTS.secondWind, link: 0 },
          ),
        () =>
          result.current.sendRecharge(
            {
              label: 'Frost Breath recharge',
              counter: { item: 'frostBreath', activity: 'frostSave' },
            } as never,
            formula({
              id: 'f3',
              label: 'Frost Breath recharge',
              terms: [{ text: '1d6', values: [5], value: 5 }],
              typed: true,
              rerolls: 'kept',
            }),
          ),
      )
      expect(await polled()).toMatchSnapshot(`uses ${name}`)
    },
  )

  it.each(SEATS)('each command at the %s seat', async (name, seat) => {
    rollServer({
      'req-10': {
        status: 'done',
        visible: true,
        rolls: [],
        wildShape: { op: 'forms', forms: [], more: false },
      },
    })
    const { result } = renderRolls(seat)
    await inTurn(
      () =>
        result.current.sendEndConcentration(
          logged({ label: 'Concentration on Bless', ending: true }),
          'blessConc',
        ),
      () =>
        result.current.sendSpend(
          logged({ label: 'Sorcery Points', spent: 2 }),
          {
            counter: { item: 'sorcery', activity: 'flexible' },
            count: 2,
          },
        ),
      () =>
        result.current.sendInspiration(
          logged({ label: 'Heroic Inspiration', inspiration: 'gain' }),
          'gain',
        ),
      () =>
        result.current.sendSpellSlot(
          logged({ label: '1st Level', slot: 'restore' }),
          { op: 'restore', id: 'spell1', from: 2 },
        ),
      () =>
        result.current.sendEnd(
          logged({ label: 'Magic Weapon', ending: true }),
          { item: 'longsword', effect: 'magicWeapon' },
          { item: 'wand', activity: 'enchantWeapon' },
        ),
      () =>
        result.current.sendTransfer(
          logged({
            label: 'Give',
            move: {
              verb: 'give',
              things: '5 gp',
              other: 'Vex',
              mover: 'Thorin',
            },
          }),
          { from: 'thorin', to: 'vex', currency: { gp: 5 } },
        ),
      () =>
        result.current.sendRemove(
          logged({
            label: 'Remove',
            move: {
              verb: 'remove',
              things: '2 Rope',
              other: 'Thorin',
              item: 'rope',
            },
          }),
          { item: 'rope', quantity: 2, held: 3 },
        ),
      () =>
        result.current.sendFavorite(
          logged({ label: 'Rope', favorite: 'add' }),
          { op: 'add', type: 'activity', id: 'swing', item: 'longsword' },
        ),
      () =>
        result.current.sendEffect(
          logged({ label: 'Bless', effect: 'disable' }),
          { id: 'blessed', name: 'Bless' },
        ),
      () =>
        result.current.sendPrepare(
          logged({ label: 'Shield', prepare: 'prepare' }),
          { op: 'prepare', id: 'shield' },
        ),
    )
    await inTurn(
      () =>
        result.current.sendWildShape(
          logged({
            label: 'Wild Shape',
            wildShape: { op: 'transform', form: 'Wolf' },
          }),
          { op: 'transform', form: 'Wolf0000000000ab' },
        ),
      () =>
        result.current.sendWildShape(
          logged({ label: 'Wild Shape', wildShape: { op: 'learn' } }),
          {
            op: 'learn',
            uuid: 'Compendium.dnd5e.actors24.Actor.Wolf0000000000ab',
            replace: null,
          },
        ),
      () =>
        result.current.sendWildShape(
          logged({ label: 'Wild Shape', wildShape: { op: 'revert' } }),
          { op: 'revert' },
        ),
      () => void result.current.readWildShapeForms(),
    )
    expect(await polled()).toMatchSnapshot(`commands ${name}`)
  })

  it('sends a roll the game turned away as busy again, a while later', async () => {
    let posts = 0
    globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts += 1
        return posts === 1
          ? respond(429, { reason: 'busy' })
          : respond(202, { id: `req-${posts}` })
      }
      return respond(200, {
        id: String(url).split('/').at(-1),
        status: 'pending',
      })
    }) as typeof fetch
    const { result } = renderRolls(undefined, ['hitDie'])
    act(() =>
      result.current.sendFormula(
        {
          label: 'Hit dice (1d10 + 1d8)',
          terms: [],
          sets: [
            { terms: [{ sign: 1, count: 1, sides: 10 }], times: 1 },
            { terms: [{ sign: 1, count: 1, sides: 8 }], times: 1 },
          ],
          healing: true,
          source: {
            kind: 'hitDice',
            hitDice: [
              { denomination: 'd10', count: 1 },
              { denomination: 'd8', count: 1 },
            ],
          },
        } as never,
        formula({
          id: 'f4',
          terms: [
            { text: '1d10', values: [6], value: 6 },
            { text: '+1d8', values: [5], value: 5 },
          ],
          times: 2,
        }),
      ),
    )
    await advance(6000)
    expect(await polled()).toMatchSnapshot('busy retry')
  })
})

describe('End Turn and Undo', () => {
  const thorins: EndableTurn = {
    combatId: 'cmbt1',
    round: 1,
    combatantId: 'c-thorin',
  }

  it.each([
    ['player', PLAYER_API, false],
    ['gm', GM.api, true],
  ])('at the %s seat', async (name, api, gm) => {
    rollServer({ 'req-1': { status: 'done', visible: true, rolls: [] } })
    const kinds: RollKind[] = ['endTurn', 'undoEndTurn']
    const ended = renderHook(() =>
      useEndTurn({ api, gm, combat: mockTurnCombat(), kinds }),
    )
    await advance(2000)
    await act(async () => {
      ended.result.current.end(thorins)
      await Promise.resolve()
    })
    await advance(CHECK_EVERY)
    const undone = renderHook(() =>
      useTurnUndo({
        api,
        gm,
        combat: mockTurnCombat({ currentId: 'c-brakka' }),
        kinds,
        sent: {
          turn: thorins,
          way: { status: 'done', requestId: 'req-1', visible: true, rolls: [] },
        },
      }),
    )
    await act(async () => {
      undone.result.current.undo()
      await Promise.resolve()
    })
    expect(await polled()).toMatchSnapshot(`end turn ${name}`)
  })
})

describe("the take from a party's page", () => {
  it.each([
    ['player', 'player' as const],
    ['gm', 'gm' as const],
  ])('at the %s seat', async (name, role) => {
    rollServer()
    const { result } = renderHook(() => useTransfers({ role }))
    act(() =>
      result.current.take(
        '/api/characters/char-1',
        {
          verb: 'take',
          things: '2 Rope',
          other: 'The Iron Company',
          mover: 'Thorin',
          item: 'rope',
        },
        { from: 'company', to: 'thorin', items: [{ id: 'rope', quantity: 2 }] },
      ),
    )
    expect(await polled()).toMatchSnapshot(`take ${name}`)
  })
})

describe('the table poll', () => {
  const none: TableView = {
    version: 3,
    live: false,
    connected: true,
    messages: [],
  }
  const every: TableView = {
    version: 4,
    live: true,
    connected: true,
    messages: [],
    rollsToTable: ['skill', 'save', 'attack'],
    rollFeatures: ['modifiers', 'prompts'],
    gm: { rolls: 'made' },
    gmRollsKey: 'req-1:done',
    moves: { parties: [], characters: [] } as never,
    manualDice: { offered: true, on: true } as never,
    removes: true,
    favorites: true,
    effects: true,
    wildShape: true,
    sheetVersion: '2026-10-04T19:00:00.000Z',
  }

  it.each([
    ['none, at the player seat', PLAYER_API, none],
    ['every flag, at the player seat', PLAYER_API, every],
    ['none, at the gm seat', GM.api, none],
  ])('asks with %s', async (name, api, initial) => {
    globalThis.fetch = jest.fn(async () => respond(204)) as typeof fetch
    renderHook(() => useTableView(api, initial))
    await advance(POLL_INTERVAL * 2)
    expect(sent()).toMatchSnapshot(`table ${name}`)
  })

  it('backs off while the server fails, then stops and refreshes once signed out', async () => {
    const times: number[] = []
    let calls = 0
    globalThis.fetch = jest.fn(async () => {
      times.push(Date.now() - Date.parse(NOW))
      calls += 1
      return respond(calls < 6 ? 500 : 401)
    }) as typeof fetch
    renderHook(() => useTableView(PLAYER_API, none))
    await advance(200_000)
    expect({ times, refreshed: mockRefresh.mock.calls.length }).toMatchSnapshot(
      'table backoff',
    )
  })
})

/** A message the Gamemaster sent, as the table shows it. */
const said = (id: string, sentAt: string): TableMessage => ({
  id,
  sentAt,
  speaker: 'Gamemaster',
  side: 'other',
  whisper: false,
  kind: 'text',
  text: `message ${id}`,
  rolls: [],
  targets: [],
})

describe("the table's page", () => {
  const thorin: Character = {
    id: 'char-1',
    name: 'Thorin',
    gameUrl: GAME,
    campaignTitle: 'The Lonely Mountain',
    campaignId: 'c1',
    actorId: 'thorin',
  }

  it.each([
    ['an empty chat', []],
    [
      'a chat read up to its first',
      [
        said('m1', '2026-10-04T19:00:00.000Z'),
        said('m2', '2026-10-04T19:02:00.000Z'),
      ],
    ],
  ])('marks %s read, and polls its view', async (name, messages) => {
    globalThis.fetch = jest.fn(async () => respond(204)) as typeof fetch
    const markChatRead = jest.fn<Promise<void>, [string]>(async () => {})
    render(
      <GameTable
        character={thorin}
        initialView={{
          version: 3,
          live: true,
          campaign: { title: 'The Lonely Mountain' },
          connected: true,
          messages,
          ...(messages.length > 0 && {
            chatReadAt: '2026-10-04T19:00:00.000Z',
          }),
          sheet: toTableSheet(characterSheet(), GAME),
          sheetVersion: '2026-10-04T19:00:00.000Z',
          rollsToTable: ['skill'],
        }}
        chooseActor={jest.fn()}
        deleteCharacter={jest.fn()}
        markChatRead={markChatRead}
      />,
    )
    await user.click(screen.getByRole('button', { name: /^Chat/ }))
    await advance(POLL_INTERVAL)
    expect({ read: markChatRead.mock.calls, sent: sent() }).toMatchSnapshot(
      `table page ${name}`,
    )
  })
})

describe('the journal', () => {
  const api = `${PLAYER_API}`

  it('reads, writes each kind and previews, as the server answers each', async () => {
    const answers = [
      respond(200, mockNotesView()),
      respond(201, { id: 'newNote00000001', stamp: 'w:1' }),
      respond(200, mockNotesView({ version: 4 })),
      respond(200, { stamp: 'n:2' }),
      respond(204),
      respond(404, { reason: 'changed' }),
      respond(204),
      respond(401),
      respond(500),
      respond(200, { stamp: 'o:1' }),
      respond(204),
      respond(200, { stamp: 'o:2' }),
      respond(204),
      respond(200, { html: '<h1>Road</h1>', headings: [1] }),
    ]
    globalThis.fetch = jest.fn(
      async () => answers.shift() ?? respond(204),
    ) as typeof fetch
    const { result } = renderHook(() => useNotes(api, { active: true }))
    await advance(0)
    const said: unknown[] = []
    await act(async () => {
      said.push(
        await result.current.create({
          role: 'entry',
          title: 'Road',
          body: 'On.',
          chapterId: NOTE_IDS.session,
        }),
        await result.current.change(NOTE_IDS.cave, {
          title: 'The goblin cave',
          body: 'Loot',
          chapterId: null,
          stamp: 'n:1',
        }),
        await result.current.remove(NOTE_IDS.cave, 'n:1'),
        await result.current.resolve(NOTE_IDS.cave, {
          resolve: 'mine',
          stamp: 'n:1',
        }),
        await result.current.reorder({
          chapterId: NOTE_IDS.session,
          ids: [NOTE_IDS.cave],
          stamp: 'o:0',
        }),
        await result.current.resolveOrder({
          chapterId: null,
          resolve: 'theirs',
          stamp: 'o:0',
        }),
        await result.current.preview('# Road'),
      )
    })
    expect({ sent: sent(), said }).toMatchSnapshot('journal')
  })

  it('backs off while reads fail, and stops once the book is gone', async () => {
    const times: number[] = []
    let calls = 0
    globalThis.fetch = jest.fn(async () => {
      times.push(Date.now() - Date.parse(NOW))
      calls += 1
      if (calls === 1) return respond(200, mockNotesView())
      return respond(calls < 6 ? 500 : 404)
    }) as typeof fetch
    renderHook(() => useNotes(`${api}/party/company`, { active: true }))
    await advance(200_000)
    expect({ times, sent: sent() }).toMatchSnapshot('journal backoff')
  })
})

describe('the party sheet, companion view and cookbook polls', () => {
  const party: PartyView = {
    version: 5,
    live: true,
    campaign: { title: 'The Lonely Mountain' },
    group: ironCompany() as never,
    sheetVersion: '2026-10-04T19:00:00.000Z',
    moves: { into: [] } as never,
  }

  it.each([
    [
      'first read',
      undefined,
      [respond(200, party), respond(204), respond(401)],
    ],
    ['from its page', party, [respond(204), respond(404)]],
  ])('the party sheet, %s', async (name, initial, answers) => {
    globalThis.fetch = jest.fn(
      async () => answers.shift() ?? respond(204),
    ) as typeof fetch
    const { result } = renderHook(() =>
      usePartySheet(`${PLAYER_API}/party/company`, initial as never),
    )
    await advance(POLL_INTERVAL * 3)
    expect({
      sent: sent(),
      state: result.current.state,
      refreshed: mockRefresh.mock.calls.length,
    }).toMatchSnapshot(`party ${name}`)
  })

  it('the companion view, read, unchanged, then gone', async () => {
    const answers = [
      respond(
        200,
        mockCompanionView({ sheetVersion: '2026-10-04T19:00:00.000Z' }),
      ),
      respond(204),
      respond(404),
    ]
    globalThis.fetch = jest.fn(
      async () => answers.shift() ?? respond(204),
    ) as typeof fetch
    const { result } = renderHook(() =>
      useCompanionView(`${PLAYER_API}/companions/wolfBrakka`, { active: true }),
    )
    await advance(POLL_INTERVAL * 3)
    expect({ sent: sent(), gone: result.current.gone }).toMatchSnapshot(
      'companion view',
    )
  })

  it('the cookbook, read, unchanged, then failing', async () => {
    const answers = [
      respond(200, { version: 'v1', code: null, dishes: [] }),
      respond(204),
      respond(500),
    ]
    globalThis.fetch = jest.fn(
      async () => answers.shift() ?? respond(204),
    ) as typeof fetch
    const { result } = renderHook(() =>
      useCookbookView('char 1', { active: true }),
    )
    await advance(0)
    await act(() => result.current.reload())
    await act(() => result.current.reload())
    expect(sent()).toMatchSnapshot('cookbook')
  })
})

describe('what the server makes of a held roll', () => {
  const created = new Date('2026-10-04T19:29:00.000Z')
  const held = (fields: Partial<HeldRollRequest> = {}): HeldRollRequest => ({
    id: 'req-1',
    actorId: 'thorin',
    role: 'player',
    kind: 'attack',
    payload: {
      kind: 'attack',
      item: 'warhammer',
      activity: 'warhammerAttack',
      target: { combatId: 'cmbt1', combatantId: 'c-goblin' },
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 20, results: [14] }],
    },
    status: 'pending',
    result: null,
    createdAt: created,
    claimedAt: null,
    ...fields,
  })
  const made = {
    id: 'req-1',
    status: 'done',
    reason: null,
    error: null,
    messageId: 'msg-1',
    visible: true,
    rolls: [
      {
        formula: '1d20 + 7',
        total: 21,
        dice: [{ faces: 20, results: [14] }],
        critical: false,
        fumble: false,
      },
    ],
    attack: { critical: false, fumble: false, outcome: 'hit' },
    damage: preview,
  }

  it.each([
    ['a player’s', held()],
    ['the Gamemaster’s', held({ role: 'gm' })],
    ['a companion’s', held({ actorId: 'wolfBrakka', ofActorId: 'thorin' })],
  ])('the command sent for %s', (name, request) => {
    expect(JSON.stringify(toCommand(request))).toMatchSnapshot(
      `command ${name}`,
    )
  })

  const now = Date.parse(NOW)
  it.each([
    ['sending', held({ createdAt: new Date(Date.parse(NOW) - 10_000) })],
    ['expired', held({ createdAt: new Date(now - 3_600_000) })],
    ['rolling', held({ status: 'claimed', claimedAt: created })],
    ['lost', held({ status: 'claimed', claimedAt: new Date(now - 3_600_000) })],
    ['done', held({ status: 'done', result: made })],
    [
      'done unseen',
      held({ status: 'done', result: { ...made, visible: false } }),
    ],
    [
      'failed',
      held({
        status: 'failed',
        result: { ...made, status: 'failed', reason: 'noTarget' },
      }),
    ],
    [
      'failed part way',
      held({
        kind: 'hitDice',
        status: 'failed',
        result: {
          ...made,
          status: 'failed',
          reason: 'noDice',
          spent: { made: 1, asked: 2 },
          healed: 7,
          rolls: [{ formula: '1d10 + 3', total: 9, dice: [] }],
        },
      }),
    ],
    [
      'damage done',
      held({
        kind: 'damage',
        status: 'done',
        result: {
          ...made,
          rolls: [
            { formula: '1d8 + 4', total: 9, dice: [], damageType: 'slashing' },
            { formula: '1d6', total: 6, dice: [], damageType: 'fire' },
          ],
        },
      }),
    ],
  ])('the roll its page is shown, %s', (name, request) => {
    expect(JSON.stringify(toRollRequestView(request, now))).toMatchSnapshot(
      `view ${name}`,
    )
    expect(
      JSON.stringify(
        toGmRollView(
          { ...request, label: null },
          now,
          request.kind === 'damage',
        ),
      ),
    ).toMatchSnapshot(`gm view ${name}`)
  })
})
