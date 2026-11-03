import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from '@/components/character-sheet/character-pane'
import { GameTable } from '@/components/game-table/game-table'
import { ROLL_KINDS } from '@/constants/sending-stone'
import { applyCampaignEvent } from '@/db/campaign-events'
import { createRollRequest } from '@/db/roll-requests'
import { getGmSeat, playerSeat } from '@/db/seats'
import { TableApiContext } from '@/hooks/use-table-api'
import {
  BLESS_DIE,
  burningHandsAction,
  characterSheet,
  combat,
  EFFECT_DICE_FEATURES,
  FAVORITING,
  foundrySnapshot,
  REMOVING,
  SENDING_TRANSFERS,
  TAKING_DISHES,
  TAKING_EFFECTS,
  TAKING_WILD_SHAPE,
  druidSheet,
  FORM_IDS,
  fullerSheet,
  ironCompany,
  mockCompanionEntry,
  mockTableView,
  partyStash,
  removalInventory,
  sheetFavorites,
  sheetSpell,
  shapedSheet,
  typingRosterEntry,
  wildShapeBlock,
} from '@/mocks/sending-stone'
import { parseGameEvent } from '@/schemas/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import { advance, atFixedTime, ordered, respond } from '@/utils/test-utils'
import { prismaFake, resetPrisma } from '@/utils/test-utils-node'
import type { Character, SheetSeat, TableSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { GameEvent, CharacterSheet } from '@/types/sending-stone'
import type { TableView } from '@/types/table'

// C7 (round.md §3.2), browser storage: every localStorage and sessionStorage key and its value, as
// the raw strings stored, after each gesture that stores one. Frozen from the commit that adds it
// (gate 10); never updated.

jest.mock(
  '@lambersond/3d-dice-react',
  () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
)
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useRouter: () => ({
    refresh: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  }),
}))

const NOW = '2026-10-04T19:30:00.000Z'
const GAME = 'https://my-game.forge-vtt.com'

const GM_SEAT: TableSeat = {
  role: 'gm',
  api: '/api/campaigns/c1/characters/actor-thorin',
  key: 'gm:c1:actor-thorin',
}

/** A storage's keys and their raw strings, the keys in code-unit order. */
const held = (storage: Storage) =>
  Object.fromEntries(
    Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => key !== null)
      .toSorted((a, b) => (a < b ? -1 : 1))
      .map(key => [key, storage.getItem(key)]),
  )

/** Everything both storages hold, as stored. */
const stored = () =>
  ordered({ local: held(localStorage), session: held(sessionStorage) })

/** What a write asked of the database: each create, update, upsert and delete, in order. */
const writes = (fake: ReturnType<typeof prismaFake>) =>
  fake.calls.filter(({ method }) =>
    /^(create|update|upsert|delete)/.test(method),
  )

const user = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

/** The game, which takes every command and answers each as `answers` says, else pending. */
const game = (answers: Record<string, Record<string, unknown>> = {}) => {
  let posts = 0
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posts += 1
      return respond(202, { id: `req-${posts}` })
    }
    if (!url.includes('/rolls/')) return new Promise<Response>(() => {})
    const id = url.split('/').at(-1) ?? ''
    return respond(200, { id, ...(answers[id] ?? { status: 'pending' }) })
  }) as typeof fetch
}

const pane = (
  sheet: CharacterSheet,
  fields: Partial<Parameters<typeof CharacterPane>[0]> = {},
) => (
  <CharacterPane
    characterId='char-1'
    name='Thorin Oakenshield'
    sheet={toTableSheet(sheet, GAME)}
    rollsToTable={[...ROLL_KINDS]}
    {...fields}
  />
)

/** The sheet's settings, opened from its cog. */
const settings = async () => {
  await user().click(screen.getByRole('button', { name: 'Settings' }))
  return screen.getByRole('dialog', { name: 'Settings' })
}

/** Thorin, two 1st-level slots and one 2nd-level, Burning Hands among them. */
const handsSheet = () =>
  characterSheet({
    actions: [
      { id: 'action', label: 'Actions', actions: [burningHandsAction()] },
    ],
    spells: [
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: 2, max: 2, level: 1 },
        spells: [sheetSpell({ id: 'hands', name: 'Burning Hands' })],
      },
      {
        id: 'spell2',
        label: '2nd Level',
        slots: { value: 1, max: 1, level: 2 },
        spells: [],
      },
    ],
  })

const thorin: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: GAME,
  campaignTitle: 'The Frost Road',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

describe('golden C7: storage', () => {
  beforeEach(() => {
    atFixedTime(NOW)
    localStorage.clear()
    sessionStorage.clear()
    game()
  })

  afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  describe('browser storage, after each gesture that stores something', () => {
    it.each([
      ['the player’s seat', undefined],
      ['the Gamemaster’s seat', GM_SEAT],
    ] as const)(
      'the settings at %s: Send to the table, damage on its own, roll results',
      async (_name, seat) => {
        const node = pane(fullerSheet(), { rollFeatures: ['aloneChoices'] })
        render(
          seat ? (
            <TableApiContext.Provider value={seat}>
              {node}
            </TableApiContext.Provider>
          ) : (
            node
          ),
        )
        const steps: [string, string][] = [['mounted', stored()]]
        let dialog = await settings()
        await user().click(
          within(dialog).getByRole('switch', { name: 'Damage on its own' }),
        )
        steps.push(['damage on its own switched', stored()])
        await user().click(
          within(dialog).getByRole('switch', { name: 'Send to the table' }),
        )
        steps.push(['send to the table off', stored()])
        await user().click(
          within(dialog).getByRole('switch', { name: 'Send to the table' }),
        )
        steps.push(['send to the table on', stored()])
        await user().click(
          within(dialog).getByRole('radio', { name: 'Banner' }),
        )
        steps.push(['banner chosen', stored()])
        dialog = screen.getByRole('dialog', { name: 'Settings' })
        await user().click(
          within(dialog).getByRole('radio', { name: 'Toasts' }),
        )
        steps.push(['toasts chosen', stored()])
        expect(steps).toMatchSnapshot('settings')
      },
    )

    it('the Actions tab: its layout, a group closed and opened again', async () => {
      jest
        .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
        .mockReturnValue(1000)
      render(pane(fullerSheet()))
      await user().click(screen.getByRole('tab', { name: 'Actions' }))
      const steps: [string, string][] = [['mounted', stored()]]
      const dialog = await settings()
      await user().click(within(dialog).getByRole('button', { name: 'Table' }))
      steps.push(['table chosen', stored()])
      await user().click(within(dialog).getByRole('button', { name: 'List' }))
      steps.push(['list chosen', stored()])
      await user().keyboard('{Escape}')
      await user().click(screen.getByRole('button', { name: /^Weapons/ }))
      steps.push(['weapons closed', stored()])
      await user().click(screen.getByRole('button', { name: /^Cantrips/ }))
      steps.push(['cantrips closed', stored()])
      await user().click(screen.getByRole('button', { name: /^Weapons/ }))
      steps.push(['weapons opened', stored()])
      expect(steps).toMatchSnapshot('actions')
    })

    it('the favorites strip, hidden and shown again, on a narrow sheet', async () => {
      jest
        .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
        .mockReturnValue(400)
      render(
        pane(fullerSheet({ favorites: sheetFavorites() }), { favorites: true }),
      )
      await user().click(screen.getByRole('tab', { name: 'Actions' }))
      const steps: [string, string][] = [['mounted', stored()]]
      await user().click(screen.getByRole('button', { name: /^Favorites/ }))
      steps.push(['hidden', stored()])
      await user().click(screen.getByRole('button', { name: /^Favorites/ }))
      steps.push(['shown', stored()])
      expect(steps).toMatchSnapshot('favorites')
    })

    it('the spend switch of damage on its own, at the player’s seat', async () => {
      localStorage.setItem('sending-stone:send-damage', 'on')
      render(
        pane(handsSheet(), {
          rollsToTable: ['attack', 'damage', 'use', 'itemDamage'],
          rollFeatures: ['modifiers', 'aloneChoices'],
        }),
      )
      await user().click(screen.getByRole('tab', { name: /^Actions/ }))
      const steps: [string, string][] = [['mounted', stored()]]
      await user().click(
        screen.getByRole('button', {
          name: 'Burning Hands damage, 3d6, goes to the table on its own',
        }),
      )
      const picker = screen.getByRole('dialog', { name: 'Burning Hands' })
      await user().click(within(picker).getByRole('switch'))
      steps.push(['spend off', stored()])
      await user().click(within(picker).getByRole('switch'))
      steps.push(['spend on', stored()])
      expect(steps).toMatchSnapshot('alone spend')
    })

    it('Wild Shape: the form taken kept as the last, from the pane', async () => {
      game({
        'req-1': {
          status: 'done',
          visible: true,
          rolls: [],
          wildShape: {
            op: 'transform',
            form: { id: 'formWolf00000001', name: 'Wolf', uuid: 'x' },
            temp: 5,
            hours: 2,
          },
        },
      })
      const elowen = (sheet: CharacterSheet) => (
        <CharacterPane
          characterId='char-1'
          name='Elowen'
          sheet={toTableSheet(sheet, GAME)}
          wildShape
        />
      )
      const { rerender } = render(elowen(druidSheet()))
      await user().click(screen.getByRole('tab', { name: 'Actions' }))
      const steps: [string, string][] = [['mounted', stored()]]
      await user().click(screen.getByRole('button', { name: 'Change' }))
      await user().click(
        within(screen.getByRole('dialog', { name: 'Wild Shape' })).getByRole(
          'button',
          { name: 'Become a Wolf' },
        ),
      )
      steps.push(['sent', stored()])
      await advance(1000)
      steps.push(['made', stored()])
      rerender(elowen(shapedSheet()))
      await act(async () => {})
      steps.push(['the sheet a form’s', stored()])
      expect(steps).toMatchSnapshot('wild shape form')
    })

    const table = (view: TableView) => (
      <GameTable
        character={thorin}
        initialView={view}
        chooseActor={async () => ({})}
        deleteCharacter={async () => {}}
        markChatRead={async () => {}}
      />
    )

    it('Wild Shape ended in the game: its banner dismissed, for the seat', async () => {
      const ended = druidSheet({
        wildShape: wildShapeBlock({
          ended: {
            form: 'Wolf',
            why: 'time',
            at: Date.parse(NOW) - 60 * 60 * 1000,
            formId: 'formWolf00000001',
          },
        }),
      })
      render(
        table(
          mockTableView({
            sheet: toTableSheet(ended, GAME),
            sheetVersion: 'v1',
            wildShape: true,
          }),
        ),
      )
      await act(async () => {})
      const steps: [string, string][] = [['mounted', stored()]]
      await user().click(screen.getByRole('button', { name: 'Dismiss' }))
      steps.push(['dismissed', stored()])
      expect(steps).toMatchSnapshot('wild shape ended')
    })

    it('the creature chosen at the table, for the tab’s session', async () => {
      render(
        table(
          mockTableView({
            sheet: toTableSheet(characterSheet(), GAME),
            sheetVersion: 'v1',
            companions: [
              { key: mockCompanionEntry().key, name: 'Brakka', kind: 'owned' },
            ],
          }),
        ),
      )
      const steps: [string, string][] = [['mounted', stored()]]
      const switcher = screen.getByRole('tablist', {
        name: 'Character and companions',
      })
      const tabs = within(switcher).getAllByRole('tab')
      await user().click(tabs[1])
      steps.push(['the companion chosen', stored()])
      await user().click(tabs[0])
      steps.push(['the character chosen again', stored()])
      expect(steps).toMatchSnapshot('creature')
    })
  })
  describe('rows written, per command kind, over a small database', () => {
    const THORIN = 'actorThorin1'
    const VEX = 'actorVex0001'
    const COMPANY = 'groupIronCo01'

    const thorinSeat = playerSeat(
      {
        id: 'char-1',
        name: 'Thorin',
        gameUrl: GAME,
        campaignTitle: 'The Frost Road',
        campaignId: 'c1',
        actorId: THORIN,
      },
      'user-1',
    )

    /** The campaign, taking every kind and feature, its game heard from a moment ago. */
    const campaign = (fields: Record<string, unknown> = {}) => ({
      id: 'c1',
      title: 'The Frost Road',
      origin: GAME,
      ownerId: 'gm-1',
      rollsEnabled: true,
      rollKinds: [...ROLL_KINDS],
      rollFeatures: [
        'gmRolls',
        'manualDice',
        'effectDice',
        'keptRerolls',
        'modifiers',
        'aloneChoices',
      ],
      bridgePolledAt: new Date(Date.parse(NOW) - 5000),
      characters: [typingRosterEntry(), { id: VEX, name: 'Vex' }],
      companions: [],
      companionKinds: [],
      companionInitiative: 'own',
      favoritesEnabled: true,
      effectsEnabled: true,
      wildShapeEnabled: true,
      transfersEnabled: true,
      transferFeatures: [],
      removalsEnabled: true,
      groups: [ironCompany()],
      ...fields,
    })

    /** The database: the campaign, each sheet as held, and no rolls yet. */
    const database = (
      sheet: CharacterSheet,
      fields: Record<string, unknown> = {},
    ) =>
      prismaFake({
        campaign: [campaign(fields)],
        actorSheet: [
          { campaignId: 'c1', actorId: THORIN, data: sheet },
          { campaignId: 'c1', actorId: VEX, data: characterSheet() },
        ],
        groupSheet: [
          {
            campaignId: 'c1',
            actorId: COMPANY,
            data: { members: [], inventory: partyStash() },
          },
        ],
        rollRequest: [],
        rollPrompt: [],
      })

    const roll = (fields: Partial<RollRequestInput>): RollRequestInput => ({
      kind: 'skill',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
      ...fields,
    })

    /** Each command: whose seat, the sheet held, the campaign's fields, and its input. */
    const CASES: Record<
      string,
      {
        gm?: true
        sheet?: CharacterSheet
        fields?: Record<string, unknown>
        input: RollRequestInput
      }
    > = {
      'a check typed, with an effect’s die, rerolls kept': {
        input: roll({
          key: 'prc',
          dice: [{ faces: 20, results: [14] }],
          typed: true,
          effectDice: [{ faces: 4, sign: 1, results: [3] }],
          rerolls: 'kept',
        }),
        sheet: fullerSheet({ effectDice: [BLESS_DIE] }),
      },
      'the Gamemaster’s check, labelled': {
        gm: true,
        input: roll({
          key: 'prc',
          dice: [{ faces: 20, results: [9] }],
          label: 'Perception check',
        }),
      },
      'a favorite added': {
        input: roll({
          kind: 'favorite',
          favorite: { op: 'add', type: 'item', id: 'rope' },
        }),
      },
      'an effect turned off': {
        input: roll({
          kind: 'effect',
          effect: { op: 'disable', id: 'blessed' },
        }),
      },
      'Wild Shape: a change': {
        sheet: druidSheet(),
        input: roll({
          kind: 'wildShape',
          wildShape: { op: 'transform', form: FORM_IDS.wolf },
          label: 'Wild Shape',
        }),
      },
      'Wild Shape: the forms asked for': {
        sheet: druidSheet(),
        input: roll({ kind: 'wildShape', wildShape: { op: 'forms' } }),
      },
      'a move, by the Gamemaster, labelled': {
        gm: true,
        input: roll({
          kind: 'transfer',
          transfer: {
            from: COMPANY,
            to: THORIN,
            items: [{ id: 'potionHeal01', quantity: 2 }],
          },
          label: 'Take 2 Potion of Healing from The Iron Company',
        }),
      },
      'a removal': {
        sheet: characterSheet({ inventory: removalInventory() }),
        input: roll({
          kind: 'remove',
          remove: { item: 'ropeThorin01', quantity: 1, held: 1 },
        }),
      },
      'the first refusal: rolls off': {
        fields: { rollsEnabled: false },
        input: roll({ key: 'prc', dice: [{ faces: 20, results: [14] }] }),
      },
      'the first refusal: favorites off': {
        fields: { favoritesEnabled: false },
        input: roll({
          kind: 'favorite',
          favorite: { op: 'add', type: 'item', id: 'rope' },
        }),
      },
      'the first refusal: moves off': {
        fields: { transfersEnabled: false },
        input: roll({
          kind: 'transfer',
          transfer: {
            from: COMPANY,
            to: THORIN,
            items: [{ id: 'potionHeal01', quantity: 2 }],
          },
        }),
      },
    }

    beforeEach(() => {
      resetPrisma()
    })

    it.each(Object.keys(CASES))('%s', async name => {
      const { gm, sheet = fullerSheet(), fields, input } = CASES[name]
      const fake = database(sheet, fields)
      // The Gamemaster's seat at Thorin's sheet, as the routes find it.
      const seat = gm ? await getGmSeat('gm-1', 'c1', THORIN) : thorinSeat
      const answer = await createRollRequest(seat as SheetSeat, input)
      expect(ordered({ answer, writes: writes(fake) })).toMatchSnapshot(name)
    })
  })
  describe('the campaign row a hello writes', () => {
    const { module, foundry, system, settings } = foundrySnapshot()

    const HELLOS: Record<string, Record<string, unknown>> = {
      'a full hello from module 0.42': {
        characters: [typingRosterEntry(), { id: 'actorVex0001', name: 'Vex' }],
        combats: [combat()],
        groups: [ironCompany()],
        module: { ...module, version: '0.42.1' },
        foundry,
        system,
        settings,
        features: {
          rolls: EFFECT_DICE_FEATURES,
          transfers: SENDING_TRANSFERS,
          removals: REMOVING,
          favorites: FAVORITING,
          dishes: TAKING_DISHES,
          effects: TAKING_EFFECTS,
          wildShape: TAKING_WILD_SHAPE,
          notes: { enabled: true, kinds: ['personal', 'party'], orders: true },
        },
      },
      'a hello from before module 0.10': {
        characters: [
          { id: 'actorThorin1', name: 'Thorin' },
          { id: 'actorVex0001', name: 'Vex' },
        ],
        combats: [],
      },
    }

    beforeEach(() => {
      resetPrisma()
    })

    it.each(Object.keys(HELLOS))('%s', async name => {
      const fake = prismaFake({
        campaign: [{ id: 'c1', title: 'The Frost Road', noteFeatures: [] }],
        actorSheet: [],
        groupSheet: [],
        companionSheet: [],
        combat: [],
        rollPrompt: [],
        rollRequest: [],
        journalBook: [],
      })
      const event = parseGameEvent('bridge.hello', HELLOS[name]) as GameEvent
      await applyCampaignEvent(
        'c1',
        { id: 'frost-road', title: 'The Frost Road' },
        { id: 'c1', title: 'The Frost Road' },
        event,
        'session-1',
        NOW,
      )
      const updates = fake.calls.filter(
        ({ model, method }) => model === 'campaign' && method === 'update',
      )
      expect(ordered(updates)).toMatchSnapshot(name)
    })
  })
})
