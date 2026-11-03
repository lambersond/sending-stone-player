import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CampaignsPage from '@/app/campaigns/page'
import CharactersPage from '@/app/characters/page'
import JoinPage from '@/app/join/[code]/page'
import LoginPage from '@/app/login/page'
import HomePage from '@/app/page'
import { FullscreenButton } from '@/components/fullscreen-button/fullscreen-button'
import { LiveStatus } from '@/components/live-status/live-status'
import { ROLL_KINDS } from '@/constants/sending-stone'
import { findInvite, listOwnedCampaigns } from '@/db/campaigns'
import { listCharacters } from '@/db/characters'
import { CharacterPane } from '@/features/sheet/components/character-pane/character-pane'
import { ChatLog } from '@/features/table/components/chat-log/chat-log'
import { CombatTracker } from '@/features/table/components/combat-tracker/combat-tracker'
import { GameTable } from '@/features/table/components/game-table/game-table'
import { TableApiContext } from '@/hooks/use-table-api'
import { getCurrentUser, requireUser } from '@/lib/session'
import { fakeFullscreen } from '@/mocks/fullscreen'
import { emptyBook, serveNotes } from '@/mocks/notes-server'
import {
  burningHandsAction,
  characterSheet,
  druidSheet,
  fullerSheet,
  mockCompanionSheet,
  mockCompanionView,
  mockNotesView,
  mockTableView,
  mockTurnCombat,
  movingPartyView,
  shapedSheet,
  sheetFavorites,
  sheetSpell,
  tableMoves,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import {
  advance,
  atFixedTime,
  markup,
  normalizeIds,
  normalizeTimes,
  respond,
} from '@/utils/test-utils'
import type { OwnedCampaign } from '@/types/campaign'
import type { Character, TableSeat } from '@/types/character'
import type { CharacterSheet } from '@/types/sending-stone'
import type { TableCombat, TableMessage, TableView } from '@/types/table'

// C1 (round.md §3.2): the markup of every area in its states, portals included, React's ids and
// the times normalized: what proves a move or a split changed nothing a browser or the e2e reads
// (ids, data attributes, classes in clsx order, child structure). Refactor-only: retired in
// commit 26 (decisions Q4). Frozen from the commit that adds it (gate 10); never updated.

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
  usePathname: () => '/characters/char-1',
  useSearchParams: () => new URLSearchParams(),
}))

// The pages, called as Next.js calls them: their session, database reads and actions stood in for
// at the modules every page suite mocks; everything else real.
// Every name the app imports from it (better-auth, behind it, is ESM jest can't load).
jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn(),
  requireUser: jest.fn(),
}))
jest.mock('@/db/campaigns', () => ({
  ...jest.requireActual('@/db/campaigns'),
  findInvite: jest.fn(),
  listOwnedCampaigns: jest.fn(),
}))
jest.mock('@/db/characters', () => ({
  ...jest.requireActual('@/db/characters'),
  listCharacters: jest.fn(),
}))
// The Server Actions the pages hand their forms: never called here (next/cache needs a server).
jest.mock('@/app/campaigns/actions', () => ({
  changeSecretAction: jest.fn(),
  removeCampaignAction: jest.fn(),
  removePlayerAction: jest.fn(),
  resetInviteAction: jest.fn(),
  revokeCookbookLinkAction: jest.fn(),
  setUpCampaignAction: jest.fn(),
}))
jest.mock('@/app/characters/actions', () => ({
  chooseActor: jest.fn(),
  deleteCharacterAndLeave: jest.fn(),
  joinAsCharacter: jest.fn(),
  makeCookbookCode: jest.fn(),
  markChatReadUpTo: jest.fn(),
  openInvite: jest.fn(),
  removeCharacter: jest.fn(),
  revokeCookbookCode: jest.fn(),
  setManualDice: jest.fn(),
}))
// better-auth's client is ESM jest can't load; the sign-in buttons only call it when pressed.
jest.mock('@/clients/auth-client', () => ({
  authClient: { signIn: { social: jest.fn() }, signOut: jest.fn() },
}))
jest.mock('@/lib/app-origin', () => ({
  ...jest.requireActual('@/lib/app-origin'),
  appOrigin: async () => 'https://stone.example',
}))
jest.mock('@/lib/campaign-secret', () => ({
  ...jest.requireActual('@/lib/campaign-secret'),
  generateSecret: () => 'suggested-secret-0001',
}))
jest.mock('@/auth-providers', () => ({
  ...jest.requireActual('@/auth-providers'),
  enabledSocialProviders: () => ['google', 'discord'],
}))

const NOW = '2026-10-04T19:30:00.000Z'
const GAME = 'https://my-game.forge-vtt.com'

const GM_SEAT: TableSeat = {
  role: 'gm',
  api: '/api/campaigns/c1/characters/actor-thorin',
  key: 'gm:c1:actor-thorin',
}

const thorin: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: GAME,
  campaignTitle: 'The Frost Road',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

const user = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

/** Math.random as a fixed LCG (seed 43, a = 1664525, c = 1013904223, m = 2^32, value / m). */
const seeded = () => {
  let state = 43
  return jest.spyOn(Math, 'random').mockImplementation(() => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0
    return state / 2 ** 32
  })
}

/** crypto.randomUUID, numbered in the order it is asked for, from 1 in each test. */
const numberedIds = () => {
  let count = 0
  return jest
    .spyOn(crypto, 'randomUUID')
    .mockImplementation(
      () =>
        `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}` as ReturnType<
          typeof crypto.randomUUID
        >,
    )
}

/** A wide screen: the sheet and the combat or chat side by side. */
const wideScreen = () =>
  jest.spyOn(globalThis, 'matchMedia').mockImplementation(
    query =>
      ({
        matches: query === '(min-width: 64rem)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
      }) as unknown as MediaQueryList,
  )

/**
 * The app's routes: rolls taken as `req-<n>` and each answered by id as `answers` says, else
 * pending; anything else never answers unless `other` does.
 */
const routes = (
  answers: Record<string, Record<string, unknown>> = {},
  other?: (url: string, init?: RequestInit) => Response | undefined,
) => {
  let posts = 0
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const answered = other?.(url, init)
    if (answered) return answered
    if (init?.method === 'POST' && url.endsWith('/rolls')) {
      posts += 1
      return respond(202, { id: `req-${posts}` })
    }
    if (url.includes('/rolls/')) {
      const id = url.split('/').at(-1) ?? ''
      return respond(200, { id, ...(answers[id] ?? { status: 'pending' }) })
    }
    return new Promise<Response>(() => {})
  }) as typeof fetch
}

const message = (fields: Partial<TableMessage> = {}): TableMessage => ({
  id: 'm1',
  sentAt: '2026-10-04T19:02:00.000Z',
  speaker: 'Gamemaster',
  side: 'other',
  whisper: false,
  kind: 'text',
  text: 'Roll initiative!',
  rolls: [],
  targets: [],
  ...fields,
})

const combat = (fields: Partial<TableCombat> = {}) => mockTurnCombat(fields)

/** Thorin's table, his sheet in it, a message and a combat. */
const tableView = (fields: Partial<TableView> = {}): TableView =>
  mockTableView({
    sheet: toTableSheet(characterSheet(), GAME),
    sheetVersion: 'v1',
    messages: [message()],
    combat: combat({ currentId: 'c-goblin' }),
    rollsToTable: [...ROLL_KINDS],
    rollFeatures: [],
    ...fields,
  })

/**
 * The character's id for this test, from its name: the journal's and the cookbook's stores are
 * the module's own, kept by the character's API across tests, so each test has its own, whatever
 * runs before it.
 */
const ownId = () => {
  let hash = 5381
  for (const char of expect.getState().currentTestName ?? '') {
    hash = (Math.imul(hash, 33) + (char.codePointAt(0) ?? 0)) >>> 0
  }
  return `char-${hash.toString(36)}`
}

const table = (
  view: TableView,
  seat?: TableSeat,
  extra: Partial<Parameters<typeof GameTable>[0]> = {},
) => (
  <GameTable
    character={{ ...thorin, id: ownId() }}
    initialView={view}
    seat={seat}
    chooseActor={async () => ({})}
    deleteCharacter={async () => {}}
    markChatRead={async () => {}}
    {...extra}
  />
)

const pane = (
  sheet: CharacterSheet = fullerSheet(),
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

/**
 * The roller's own counters (`use-<ms>-<n>`, `ask-<ms>-<n>`, kept across a file's tests) numbered
 * by first appearance, so a test reads the same alone as in its file.
 */
const counted = (html: string) => {
  const seen = new Map<string, string>()
  return html.replaceAll(/\b(use|ask)-\d+-\d+\b/g, (token, kind: string) => {
    if (!seen.has(token)) seen.set(token, `${kind}-${seen.size + 1}`)
    return seen.get(token) as string
  })
}

/** The page's markup, as the kit's `markup()` gives it, its counters numbered. */
const page = () => counted(markup())

/**
 * A row's `<details>`, opened as its summary is clicked, its toggle told at once: jsdom tells it on
 * a timer of its own, outside the fake clock, which would leave when the row opens to chance.
 */
const opened = async (summary: HTMLElement) => {
  await user().click(summary)
  act(() => {
    summary.closest('details')?.dispatchEvent(new Event('toggle'))
  })
}

const settle = () => act(async () => {})

/** A time so many minutes before the tests' now, as an ISO string. */
const minutesBefore = (minutes: number) =>
  new Date(Date.parse(NOW) - minutes * 60_000).toISOString()

/** Thorin's pane with everything a player may do from it offered. */
const offered = (
  sheet: CharacterSheet = fullerSheet({ favorites: sheetFavorites() }),
) =>
  pane(sheet, {
    moves: tableMoves(),
    removes: true,
    favorites: true,
    effects: true,
    actorId: 'actorThorin1',
  })

/** An item's, feature's or spell's row, as its menu opens from it, by its name. */
const rowOf = (name: string) => {
  const item = within(screen.getByRole('tabpanel'))
    .getAllByText(name)[0]
    .closest('li') as HTMLElement
  return (item.querySelector(':scope > details > summary') ??
    item.firstElementChild) as HTMLElement
}

/** The control's markup, its ids and times normalized. */
const fragment = (element: HTMLElement | null) =>
  element ? counted(normalizeTimes(normalizeIds(element.outerHTML))) : 'none'

describe('golden C1: markup', () => {
  // React's async act takes one Math.random the first time it runs in a file: taken here.
  beforeAll(async () => {
    await act(async () => {})
  })

  beforeEach(() => {
    atFixedTime(NOW)
    seeded()
    numberedIds()
    localStorage.clear()
    sessionStorage.clear()
    routes()
  })

  afterEach(() => {
    cleanup()
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  describe('the table (GameTable)', () => {
    it.each(['Character', 'Combat', 'Chat'])(
      'a player’s seat, narrow, on %s',
      async tab => {
        render(table(tableView()))
        await user().click(
          screen.getByRole('button', { name: new RegExp(`^${tab}`) }),
        )
        expect(page()).toMatchSnapshot(tab)
      },
    )

    it('a player’s seat, wide', async () => {
      wideScreen()
      render(table(tableView()))
      await settle()
      expect(page()).toMatchSnapshot('wide')
    })

    it('the Gamemaster’s seat', async () => {
      render(table(tableView({ gm: { rolls: 'made' } }), GM_SEAT))
      await settle()
      expect(page()).toMatchSnapshot('gm seat')
    })

    it('a player’s seat with the Gamemaster’s rolls as the character, toasts on', async () => {
      localStorage.setItem('sending-stone:roll-toasts', 'on')
      const { rerender } = render(table(tableView()))
      rerender(
        table(
          tableView({
            gmRolls: [
              {
                id: 'gm-1',
                kind: 'skill',
                label: 'Perception check',
                at: NOW,
                status: 'done',
                visible: true,
                total: 14,
              },
            ],
            gmRollsKey: 'gm-1:done',
          }),
        ),
      )
      await settle()
      expect(page()).toMatchSnapshot('gm roll toasts')
    })

    it('a player’s seat as the Gamemaster’s roll as the character comes, toasts on', async () => {
      localStorage.setItem('sending-stone:roll-toasts', 'on')
      const start = tableView()
      routes({}, url =>
        url.includes('/table?')
          ? respond(200, {
              ...start,
              version: 8,
              gmRolls: [
                {
                  id: 'gm-1',
                  kind: 'skill',
                  label: 'Perception check',
                  at: NOW,
                  status: 'done',
                  visible: true,
                  total: 14,
                },
              ],
              gmRollsKey: 'gm-1:done',
            })
          : undefined,
      )
      render(table(start))
      await advance(3000)
      expect(page()).toMatchSnapshot('gm roll toast')
    })

    it('a player’s seat as the Gamemaster’s roll as the character comes, in the banner', async () => {
      const start = tableView()
      routes({}, url =>
        url.includes('/table?')
          ? respond(200, {
              ...start,
              version: 8,
              gmRolls: [
                {
                  id: 'gm-2',
                  kind: 'save',
                  label: 'Dexterity saving throw',
                  at: NOW,
                  status: 'done',
                  visible: true,
                  total: 12,
                  outcome: 'failure',
                },
              ],
              gmRollsKey: 'gm-2:done',
            })
          : undefined,
      )
      localStorage.setItem('sending-stone:roll-toasts', 'off')
      render(table(start))
      await advance(3000)
      expect(page()).toMatchSnapshot('gm roll banner')
    })

    const STATES: Record<string, () => TableView> = {
      'no campaign': () => tableView({ campaign: undefined, connected: false }),
      'no sheet yet': () =>
        tableView({ sheet: undefined, sheetVersion: undefined }),
      'its sheet held back as too large, with a party and the journal': () =>
        tableView({
          sheet: undefined,
          sheetVersion: undefined,
          sheetWithheld: {
            reason: 'tooLarge',
            bytes: 5_000_000,
            limit: 4_000_000,
          },
          groups: [{ id: 'company', name: 'The Iron Company', primary: true }],
        }),
      'its turn, 3 unread': () =>
        tableView({
          combat: combat(),
          messages: [
            message({ id: 'm1', sentAt: '2026-10-04T19:00:00.000Z' }),
            message({ id: 'm2', sentAt: '2026-10-04T19:01:00.000Z' }),
            message({ id: 'm3', sentAt: '2026-10-04T19:02:00.000Z' }),
            message({ id: 'm4', sentAt: '2026-10-04T19:03:00.000Z' }),
          ],
          chatReadAt: '2026-10-04T19:00:00.000Z',
        }),
      'not connected': () => tableView({ connected: false }),
      offline: () => tableView({ live: false }),
      'companions, one gone, one asked': () =>
        tableView({
          companions: [
            { key: 'wolfBrakka', name: 'Brakka', kind: 'owned' },
            {
              key: 'scene1-batToken',
              name: 'Bat',
              kind: 'summoned',
              from: 'Find Familiar',
            },
          ],
          companionPrompts: [
            {
              key: 'wolfBrakka',
              label: 'Dexterity saving throw',
              expiresAt: '2026-10-04T19:40:00.000Z',
            },
          ],
        }),
    }

    it.each(Object.keys(STATES))('%s', async name => {
      render(table(STATES[name]()))
      await settle()
      expect(page()).toMatchSnapshot(name)
    })

    it('a character yet to choose who it is', async () => {
      render(
        table(tableView({ sheet: undefined }), undefined, {
          character: { ...thorin, id: ownId(), actorId: '' },
          choice: {
            id: 'c1',
            title: 'The Frost Road',
            gameUrl: GAME,
            characters: [
              { id: 'actor-thorin', name: 'Thorin Oakenshield' },
              { id: 'actor-vex', name: 'Vex', claimedBy: 'someone' },
            ],
          },
        }),
      )
      await settle()
      expect(page()).toMatchSnapshot('choose actor')
    })

    it('a companion’s seat, its tab chosen', async () => {
      routes({}, url =>
        url.includes('/companions/')
          ? respond(
              200,
              mockCompanionView({
                sheet: toTableSheet(mockCompanionSheet(), GAME),
              }),
            )
          : undefined,
      )
      render(
        table(
          tableView({
            companions: [{ key: 'wolfBrakka', name: 'Brakka', kind: 'owned' }],
          }),
        ),
      )
      const switcher = screen.getByRole('tablist', {
        name: 'Character and companions',
      })
      await user().click(within(switcher).getAllByRole('tab')[1])
      // Its view read, and its sheet drawn.
      await advance(100)
      expect(page()).toMatchSnapshot('companion seat')
    })
  })
  describe('the sheet (CharacterPane)', () => {
    it.each([
      'Character',
      'Actions',
      'Inventory',
      'Spells',
      'Features',
      'Effects',
      'Biography',
    ])('fullerSheet, on %s', async tab => {
      render(offered())
      await user().click(
        screen.getByRole('tab', { name: new RegExp(`^${tab}`) }),
      )
      expect(page()).toMatchSnapshot(tab)
    })

    it('a druid’s Wild Shape row, and the ribbon of her form, its Return open', async () => {
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
      expect(page()).toMatchSnapshot('druid')
      rerender(elowen(shapedSheet()))
      await settle()
      expect(page()).toMatchSnapshot('shaped')
      const ribbon = screen.getByRole('region', { name: 'Wild Shape' })
      await user().click(
        within(ribbon).getByRole('button', { name: /^Return/ }),
      )
      expect(page()).toMatchSnapshot('return popover')
    })

    it.each([
      ['an item’s menu, with moves', 'Inventory', () => rowOf('Plain Ring')],
      ['a feature’s menu', 'Features', () => rowOf('Darkvision')],
      ['a spell’s menu', 'Spells', () => rowOf('Alarm')],
      [
        'an attack’s roll menu',
        'Actions',
        () =>
          screen.getAllByRole('button', { name: 'Warhammer attack, +7' })[0],
      ],
      [
        'a damage’s roll menu',
        'Actions',
        () =>
          screen.getAllByRole('button', {
            name: 'Warhammer damage, 1d8 + 4',
          })[0],
      ],
      [
        'a save’s press menu',
        'Character',
        () =>
          screen.getByRole('button', {
            name: 'Strength saving throw, +7, proficient',
          }),
      ],
    ] as const)('%s, open', async (name, tab, target) => {
      render(offered())
      await user().click(
        screen.getByRole('tab', { name: new RegExp(`^${tab}`) }),
      )
      fireEvent.contextMenu(target(), { button: 2 })
      await settle()
      expect(page()).toMatchSnapshot(name)
    })

    it('the settings', async () => {
      render(offered())
      await user().click(screen.getByRole('button', { name: 'Settings' }))
      expect(page()).toMatchSnapshot('settings')
    })

    it('the dice entry, typing in their own dice', async () => {
      render(
        pane(characterSheet(), {
          rollFeatures: ['manualDice'],
          manualDice: { on: true, onChange: () => {} },
        }),
      )
      await user().click(
        screen.getByRole('button', {
          name: 'Strength saving throw, +7, proficient',
        }),
      )
      expect(page()).toMatchSnapshot('dice entry')
    })

    it('the settings on a wide sheet, its layouts offered', async () => {
      jest
        .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
        .mockReturnValue(1000)
      render(offered())
      await user().click(screen.getByRole('button', { name: 'Settings' }))
      expect(page()).toMatchSnapshot('settings wide')
    })

    it('the dice entry, a die typed that it hasn’t', async () => {
      render(
        pane(characterSheet(), {
          rollFeatures: ['manualDice'],
          manualDice: { on: true, onChange: () => {} },
        }),
      )
      await user().click(
        screen.getByRole('button', {
          name: 'Strength saving throw, +7, proficient',
        }),
      )
      const dialog = screen.getByRole('dialog', {
        name: 'Strength saving throw',
      })
      await user().type(within(dialog).getAllByRole('textbox')[0], '25')
      expect(page()).toMatchSnapshot('dice entry out of range')
    })

    it('Modify damage', async () => {
      render(pane(fullerSheet(), { rollFeatures: ['modifiers'] }))
      await user().click(screen.getByRole('tab', { name: 'Actions' }))
      fireEvent.contextMenu(
        screen.getAllByRole('button', { name: 'Warhammer damage, 1d8 + 4' })[0],
        { button: 2 },
      )
      await user().click(
        screen.getByRole('menuitem', { name: 'Modify damage…' }),
      )
      expect(page()).toMatchSnapshot('modify damage')
    })

    it('an attack’s target picker, in a fight', async () => {
      render(
        pane(fullerSheet(), {
          combat: combat(),
        }),
      )
      await user().click(screen.getByRole('tab', { name: 'Actions' }))
      await user().click(
        screen.getAllByRole('button', { name: 'Warhammer attack, +7' })[0],
      )
      expect(page()).toMatchSnapshot('target picker')
    })

    it('Your rolls, after a roll, toasts on', async () => {
      localStorage.setItem('sending-stone:roll-toasts', 'on')
      render(pane(characterSheet()))
      await user().click(
        screen.getByRole('button', {
          name: 'Strength saving throw, +7, proficient',
        }),
      )
      await settle()
      await user().click(screen.getByRole('button', { name: 'Your rolls' }))
      expect(page()).toMatchSnapshot('your rolls')
    })

    it.each([
      ['Send to…', 'Send to'],
      ['Remove…', 'Remove…'],
    ])('the item dialog: %s', async (name, item) => {
      render(offered())
      await user().click(screen.getByRole('tab', { name: 'Inventory' }))
      if (item === 'Send to') {
        await user().click(
          screen.getAllByRole('button', { name: 'Send to' })[0],
        )
      } else {
        fireEvent.contextMenu(rowOf('Plain Ring'), { button: 2 })
        await user().click(screen.getByRole('menuitem', { name: item }))
      }
      await settle()
      expect(page()).toMatchSnapshot(name)
    })

    it('a roll toast waiting for its damage, then leaving', async () => {
      localStorage.setItem('sending-stone:roll-toasts', 'on')
      routes({
        'req-1': {
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
        },
      })
      render(pane(fullerSheet()))
      await user().click(screen.getByRole('tab', { name: 'Actions' }))
      await user().click(
        screen.getAllByRole('button', { name: 'Warhammer attack, +7' })[0],
      )
      await advance(1000)
      const shown = [page()]
      // Its time up, it fades.
      await advance(4000)
      shown.push(page())
      expect(shown).toMatchSnapshot('waits, then leaves')
    })

    it('a roll toast fading as its time ends', async () => {
      localStorage.setItem('sending-stone:roll-toasts', 'on')
      render(pane(characterSheet()))
      await user().click(
        screen.getByRole('button', {
          name: 'Strength saving throw, +7, proficient',
        }),
      )
      const shown: string[] = []
      for (const ms of [3900, 1000]) {
        await advance(ms)
        shown.push(page())
      }
      expect(shown).toMatchSnapshot('leaving')
    })

    it('roll toasts: on its way, made, and not made', async () => {
      localStorage.setItem('sending-stone:roll-toasts', 'on')
      routes({
        'req-1': {
          status: 'done',
          visible: true,
          total: 18,
          outcome: 'success',
        },
        'req-2': { status: 'failed', reason: 'reaction' },
      })
      render(pane(characterSheet()))
      for (const name of [
        'Strength saving throw, +7, proficient',
        'Dexterity saving throw, +1',
        'Constitution saving throw, +6, proficient',
      ]) {
        await user().click(screen.getByRole('button', { name }))
      }
      await advance(1000)
      expect(page()).toMatchSnapshot('toasts')
    })
  })

  describe('the settle matrix (U1 G-U1b): each command’s control at its settle', () => {
    const SETTLE = 10_000
    /** A description, as a row opened reads it. */
    const DESCRIBED = '<p>Bless.</p>'

    /** Each command: its sheet and tab, how it's sent, and the control that waits on it. */
    const CLIENTS: Record<
      string,
      {
        sheet: () => CharacterSheet
        tab: string
        send: () => Promise<void>
        control: () => HTMLElement
      }
    > = {
      favorite: {
        sheet: () => fullerSheet({ favorites: sheetFavorites() }),
        tab: 'Features',
        send: async () => {
          const item = within(screen.getByRole('tabpanel'))
            .getByText('Darkvision')
            .closest('li') as HTMLElement
          fireEvent.contextMenu(
            (item.querySelector(':scope > details > summary') ??
              item.firstElementChild) as HTMLElement,
            { button: 2 },
          )
          await user().click(
            screen.getByRole('menuitem', { name: 'Add to favorites' }),
          )
        },
        control: () =>
          within(screen.getByRole('tabpanel'))
            .getByText('Darkvision')
            .closest('li') as HTMLElement,
      },
      prepare: {
        sheet: () => fullerSheet(),
        tab: 'Spells',
        send: async () => {
          const item = within(screen.getByRole('region', { name: '1st Level' }))
            .getByText('Alarm')
            .closest('li') as HTMLElement
          fireEvent.contextMenu(
            (item.querySelector(':scope > details > summary') ??
              item.firstElementChild) as HTMLElement,
            { button: 2 },
          )
          await user().click(screen.getByRole('menuitem', { name: 'Prepare' }))
        },
        control: () =>
          within(screen.getByRole('region', { name: '1st Level' }))
            .getByText('Alarm')
            .closest('li') as HTMLElement,
      },
      effect: {
        sheet: () => fullerSheet(),
        tab: 'Effects',
        // Its buttons are inside its opened row, once its description has come.
        send: async () => {
          const region = screen.getByRole('region', {
            name: 'Temporary Effects',
          })
          await opened(
            within(region).getByText('Bless').closest('summary') as HTMLElement,
          )
          await advance(100)
          await user().click(
            within(region).getByRole('button', { name: 'Turn off Bless' }),
          )
        },
        control: () =>
          within(screen.getByRole('region', { name: 'Temporary Effects' }))
            .getByText('Bless')
            .closest('summary')
            ?.closest('li') as HTMLElement,
      },
      slot: {
        sheet: () => fullerSheet(),
        tab: 'Spells',
        send: () =>
          user().click(
            screen.getByRole('button', { name: /^Spend a .*spell slot/ }),
          ),
        control: () =>
          screen.getAllByRole('button', { name: /spell slot/ })[0]
            .parentElement as HTMLElement,
      },
      'Wild Shape': {
        sheet: () => druidSheet(),
        tab: 'Actions',
        send: async () => {
          await user().click(screen.getByRole('button', { name: 'Change' }))
          await user().click(
            within(
              screen.getByRole('dialog', { name: 'Wild Shape' }),
            ).getByRole('button', { name: 'Become a Wolf' }),
          )
        },
        control: () => screen.getByRole('dialog', { name: 'Wild Shape' }),
      },
    }

    it.each(
      Object.keys(CLIENTS).flatMap(name => [
        [name, 'made, the sheet not agreeing'] as const,
        [name, 'its state missing'] as const,
      ]),
    )('%s, %s', async (name, how) => {
      const client = CLIENTS[name]
      if (how === 'its state missing') {
        // Taken, and never heard of again.
        globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
          if (init?.method === 'POST') return respond(202, { id: 'req-1' })
          if (url.includes('/texts/')) return respond(200, { html: DESCRIBED })
          return new Promise<Response>(() => {})
        }) as typeof fetch
      } else {
        routes(
          { 'req-1': { status: 'done', visible: true, rolls: [] } },
          url =>
            url.includes('/texts/')
              ? respond(200, { html: DESCRIBED })
              : undefined,
        )
      }
      render(
        name === 'Wild Shape' ? (
          <CharacterPane
            characterId='char-1'
            name='Elowen'
            sheet={toTableSheet(client.sheet(), GAME)}
            wildShape
          />
        ) : (
          pane(client.sheet(), {
            favorites: true,
            effects: true,
            actorId: 'actorThorin1',
          })
        ),
      )
      await user().click(
        screen.getByRole('tab', { name: new RegExp(`^${client.tab}`) }),
      )
      await client.send()
      await advance(SETTLE - 1)
      const before = fragment(client.control())
      await advance(1)
      const after = fragment(
        name === 'Wild Shape'
          ? screen.queryByRole('dialog', { name: 'Wild Shape' })
          : client.control(),
      )
      expect([before, after]).toMatchSnapshot(`${name} · ${how}`)
    })
  })
  describe('the table’s parts (V1)', () => {
    const d20 = {
      formula: '1d20 + 7',
      total: 24,
      dice: [{ faces: 20, value: 17, active: true }],
      advantage: false,
      disadvantage: false,
      critical: false,
      fumble: false,
    }
    const damage = (rolls: number) => ({
      section: 'main' as const,
      action: 'damage' as const,
      formula: '1d8 + 4',
      kinds: [
        {
          type: 'bludgeoning',
          label: 'Bludgeoning',
          total: 9,
          pool: 'harm' as const,
        },
      ],
      total: 9 * rolls,
      critical: false,
      rolls: Array.from({ length: rolls }, () => ({
        formula: '1d8 + 4',
        total: 9,
        dice: [{ faces: 8, value: 5, active: true }],
        label: 'Bludgeoning',
      })),
    })
    const MESSAGES: Record<string, TableMessage> = {
      'text and a label': message({
        label: 'Ominous rumbling',
        text: 'The cave shakes.',
      }),
      'a card': message({
        kind: 'card',
        label: 'Second Wind',
        text: 'Regain hit points.',
      }),
      'a card with its action': message({
        kind: 'card',
        label: 'Fireball',
        action: 'spell',
      }),
      'a roll': message({
        kind: 'roll',
        speaker: 'Thorin',
        side: 'me',
        label: 'Warhammer attack',
        rolls: [d20],
        attackRoll: { index: 0, action: 'attack' },
      }),
      'damage of one roll': message({
        kind: 'roll',
        label: 'Warhammer damage',
        damage: [damage(1)],
      }),
      'damage of three rolls': message({
        kind: 'roll',
        label: 'Scorching Ray damage',
        damage: [damage(3)],
      }),
      'an ask for a save': message({
        label: 'Roll Request: Worn Bardic Eternal Flame',
        text: 'Dexterity saving throw',
        ask: {
          type: 'save',
          abilities: ['dex'],
          dc: 15,
          label: 'Worn Bardic Eternal Flame',
        },
      }),
      'an ask for concentration': message({
        label: 'Roll Request: Bless',
        ask: { type: 'concentration', abilities: ['con'], label: 'Bless' },
      }),
      'an ask for a check': message({
        label: 'Roll Request: Cloak of Climbing',
        ask: {
          type: 'check',
          checks: [{ type: 'skill', ability: 'str', skill: 'ath' }],
          dc: 12,
        },
      }),
      'a whisper': message({ whisper: true, text: 'You hear a click.' }),
      'one of mine': message({
        speaker: 'Thorin',
        side: 'me',
        text: 'I check the door.',
      }),
      'by the Gamemaster': message({
        kind: 'roll',
        speaker: 'Thorin',
        side: 'me',
        label: 'Perception check',
        rolls: [d20],
        byGm: true,
      }),
      'damage on its own': message({
        kind: 'roll',
        label: 'Warhammer damage',
        damage: [damage(1)],
        alone: true,
      }),
    }

    it.each(Object.keys(MESSAGES))(
      'a chat line: %s, at each seat',
      async name => {
        const shown: string[] = []
        for (const seat of [undefined, GM_SEAT]) {
          const { unmount } = render(
            <TableApiContext.Provider value={seat}>
              <ChatLog messages={[MESSAGES[name]]} />
            </TableApiContext.Provider>,
          )
          // Damage's rolls opened, where it has any.
          for (const summary of document.querySelectorAll('summary')) {
            await opened(summary)
          }
          await settle()
          shown.push(page())
          unmount()
        }
        expect(shown).toMatchSnapshot(name)
      },
    )

    const refusedTurn = { combatId: 'cmbt1', round: 1, combatantId: 'c-thorin' }
    it.each([
      ['no combat', undefined, {}],
      ['not started', combat({ started: false, round: 0 }), {}],
      ['its turn', combat(), {}],
      ['a companion’s turn', combat({ currentId: 'c-brakka' }), {}],
      ['another’s turn', combat({ currentId: 'c-goblin' }), {}],
      [
        'its turn, End Turn refused',
        combat(),
        { refused: { turn: refusedTurn, key: 'moved' } },
      ],
    ] as const)('the combat tracker: %s', async (name, shownCombat, ending) => {
      render(
        <CombatTracker
          combat={shownCombat}
          keys={new Set(['wolfBrakka'])}
          onOpen={() => {}}
          onEnd={() => {}}
          focusTurn={() => {}}
          {...ending}
        />,
      )
      await settle()
      expect(page()).toMatchSnapshot(name)
    })

    it.each(
      (['live', 'offline', 'reconnecting', 'waiting'] as const).flatMap(state =>
        [undefined, GM_SEAT].map(
          seat => [state, seat?.role ?? 'player', seat] as const,
        ),
      ),
    )('the live status: %s, at the %s’s seat', (state, _role, seat) => {
      render(
        <TableApiContext.Provider value={seat}>
          <LiveStatus state={state} />
        </TableApiContext.Provider>,
      )
      expect(page()).toMatchSnapshot(`${state} ${_role}`)
    })

    it.each([
      ['supported', true],
      ['unsupported', false],
    ] as const)(
      'the full-screen button: %s, and in full screen',
      async (name, enabled) => {
        const fake = fakeFullscreen({ enabled })
        render(<FullscreenButton />)
        await settle()
        const shown = [page()]
        // Where the browser can't fill the screen, nothing is offered to press.
        const button = screen.queryByRole('button')
        if (button) {
          await user().click(button)
          await settle()
          shown.push(page())
        }
        fake.restore()
        expect(shown).toMatchSnapshot(name)
      },
    )

    it.each([
      ['its turn ended, then taken back', false],
      ['a companion’s turn ended', true],
    ])('the turn toast: %s', async (name, companion) => {
      let posts = 0
      const answers: Record<string, unknown> = { status: 'done', visible: true }
      // The view the table's poll answers with, once the game has ended the turn.
      const server: { next?: TableView } = {}
      const start = tableView({
        combat: combat(companion ? { currentId: 'c-brakka' } : {}),
        ...(companion && {
          companions: [
            { key: 'wolfBrakka', name: 'Brakka', kind: 'owned' as const },
          ],
        }),
      })
      globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('/companions/'))
          return respond(200, mockCompanionView())
        if (init?.method === 'POST') {
          posts += 1
          return respond(202, { id: `req-${posts}` })
        }
        if (url.includes('/rolls/'))
          return respond(200, { id: url.split('/').at(-1), ...answers })
        if (url.includes('/table?') && server.next) {
          return respond(200, server.next)
        }
        return new Promise<Response>(() => {})
      }) as typeof fetch
      render(table(start))
      await user().click(screen.getByRole('button', { name: /^Combat/ }))
      await advance(600)
      await user().click(screen.getByRole('button', { name: 'End turn' }))
      await advance(1000)
      server.next = {
        ...start,
        version: 8,
        combat: combat({ currentId: companion ? 'c-goblin' : 'c-brakka' }),
      }
      await advance(3000)
      const shown = [page()]
      if (!companion) {
        await user().click(screen.getByRole('button', { name: 'Undo' }))
        shown.push(page())
      }
      expect(shown).toMatchSnapshot(name)
    })
  })

  describe('the sheet’s parts (U2)', () => {
    it.each([
      ['list', 1000],
      ['table', 1000],
      ['columns', 800],
    ] as const)(
      'the Actions tab laid out as a %s, every chip kind',
      async (layout, width) => {
        jest
          .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
          .mockReturnValue(width)
        localStorage.setItem('sending-stone:actions-layout', layout)
        render(
          pane(fullerSheet({ favorites: sheetFavorites() }), {
            rollFeatures: ['modifiers', 'aloneChoices'],
            favorites: true,
          }),
        )
        await user().click(screen.getByRole('tab', { name: 'Actions' }))
        expect(page()).toMatchSnapshot(layout)
      },
    )

    it('the use picker for damage on its own, per step', async () => {
      localStorage.setItem('sending-stone:send-damage', 'on')
      render(
        pane(
          characterSheet({
            actions: [
              {
                id: 'action',
                label: 'Actions',
                actions: [burningHandsAction()],
              },
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
          }),
          {
            rollsToTable: ['attack', 'damage', 'use', 'itemDamage'],
            rollFeatures: ['modifiers', 'aloneChoices'],
          },
        ),
      )
      await user().click(screen.getByRole('tab', { name: /^Actions/ }))
      await user().click(
        screen.getByRole('button', {
          name: 'Burning Hands damage, 3d6, goes to the table on its own',
        }),
      )
      const shown = [page()]
      const picker = screen.getByRole('dialog', { name: 'Burning Hands' })
      await user().click(
        within(picker).getByRole('radio', { name: /^2nd Level/ }),
      )
      shown.push(page())
      expect(shown).toMatchSnapshot('alone picker')
    })

    it('an area attack’s picker, in a fight', async () => {
      render(
        pane(fullerSheet(), {
          combat: combat(),
        }),
      )
      await user().click(screen.getByRole('tab', { name: 'Actions' }))
      await user().click(
        screen.getAllByRole('button', { name: 'Fire Breath damage, 2d6' })[0],
      )
      expect(page()).toMatchSnapshot('area picker')
    })

    it.each([
      ['a condition', 'Poisoned'],
      ['concentration', 'Concentrating Bless'],
      ['exhaustion', 'Exhaustion Level 2'],
      ['Heroic Inspiration', 'Not inspired. Gain Heroic Inspiration'],
    ])(
      'a popover open: %s, where it portals, then Escape',
      async (name, opener) => {
        render(pane(fullerSheet(), { effects: true, actorId: 'actorThorin1' }))
        await user().click(screen.getByRole('button', { name: opener }))
        const shown = [page()]
        await user().keyboard('{Escape}')
        shown.push(page())
        expect(shown).toMatchSnapshot(name)
      },
    )

    it('two open: Escape closes only the top one', async () => {
      localStorage.setItem('sending-stone:roll-toasts', 'on')
      render(pane(fullerSheet()))
      await user().click(
        screen.getByRole('button', {
          name: 'Strength saving throw, +7, proficient',
        }),
      )
      await settle()
      await user().click(screen.getByRole('button', { name: 'Your rolls' }))
      await user().click(screen.getByRole('button', { name: 'Settings' }))
      const shown = [page()]
      await user().keyboard('{Escape}')
      shown.push(page())
      await user().keyboard('{Escape}')
      shown.push(page())
      expect(shown).toMatchSnapshot('two open')
    })
  })

  describe('journal, party and campaigns (V2)', () => {
    it('the journal, empty', async () => {
      const id = ownId()
      const api = `/api/characters/${id}`
      serveNotes({ [api]: emptyBook() })
      const { unmount } = render(table(tableView()))
      await user().click(screen.getByRole('tab', { name: 'Biography' }))
      await advance(100)
      await user().click(
        screen.getByRole('button', { name: 'Open My Journal' }),
      )
      await advance(100)
      const shown = [page()]
      unmount()
      cleanup()
      expect(shown).toMatchSnapshot('journal empty')
    })

    it('the journal with chapters, a note open', async () => {
      const api = `/api/characters/${ownId()}`
      serveNotes({ [api]: mockNotesView() })
      render(table(tableView()))
      await user().click(screen.getByRole('tab', { name: 'Biography' }))
      await advance(100)
      await user().click(
        screen.getByRole('button', { name: 'Open My Journal' }),
      )
      await advance(100)
      const shown = [page()]
      const dialog = screen.getByRole('dialog')
      const contents = within(dialog).getByRole('navigation', {
        name: 'Contents',
      })
      const [chapter, ...notes] = within(contents).getAllByRole('button')
      await user().click(notes[0] ?? chapter)
      await advance(100)
      shown.push(page())
      await user().click(chapter)
      await advance(100)
      shown.push(page())
      expect(shown).toMatchSnapshot('journal with chapters')
    })

    it('the party, open from the Inventory tab', async () => {
      const company = { id: 'company', name: 'The Iron Company', primary: true }
      routes({}, url =>
        url.includes('/party/company')
          ? respond(200, movingPartyView({ group: company }))
          : undefined,
      )
      render(table(tableView({ groups: [company] })))
      await user().click(screen.getByRole('tab', { name: 'Inventory' }))
      await user().click(
        screen.getByRole('button', {
          name: /^The Iron Company (Primary party|Party sheet)$/,
        }),
      )
      await advance(100)
      expect(page()).toMatchSnapshot('party')
    })
  })
  describe('the campaigns and the pages', () => {
    beforeEach(() => {
      jest
        .mocked(requireUser)
        .mockResolvedValue({ id: 'user-1', name: 'Alice' } as never)
    })

    const owned = (
      id: string,
      fields: Partial<OwnedCampaign> = {},
    ): OwnedCampaign => ({
      id,
      title: id,
      gameUrl: 'https://mists.forge-vtt.com',
      inviteCode: `code-${id}`,
      connected: true,
      rosterReceived: true,
      live: false,
      rolls: {
        enabled: false,
        reaching: false,
        attacks: false,
        spells: false,
        prompts: false,
      },
      transfers: { enabled: false, reaching: false },
      characters: [],
      groups: [],
      ...fields,
    })

    /** A campaign in each state: refused, never connected, live, offline, or its roster to come. */
    const CAMPAIGNS: Record<string, OwnedCampaign> = {
      'refused: wrong secret': owned('toa', {
        title: 'Tomb of Annihilation',
        worldTitle: 'Chult',
        lastSeenAt: minutesBefore(600),
        refusal: {
          reason: 'wrongSecret',
          status: 401,
          at: minutesBefore(10),
          current: true,
        },
        characters: [
          { id: 'azaka', name: 'Azaka', player: 'Dev', characterId: 'char-a' },
        ],
      }),
      'never connected': owned('salt', {
        title: 'Ghosts of Saltmarsh',
        connected: false,
        rosterReceived: false,
      }),
      live: owned('strahd', {
        title: 'Curse of Strahd',
        worldTitle: 'Barovia',
        live: true,
        lastSeenAt: minutesBefore(0),
        rolls: {
          enabled: true,
          reaching: true,
          attacks: true,
          spells: true,
          prompts: true,
        },
        characters: [
          {
            id: 'thorin',
            name: 'Thorin Oakenshield',
            player: 'Alice',
            characterId: 'char-t',
          },
          { id: 'vex', name: 'Vex', player: 'Bob', characterId: 'char-v' },
          { id: 'kasimir', name: 'Kasimir' },
        ],
      }),
      offline: owned('lmop', {
        title: 'Lost Mine of Phandelver',
        lastSeenAt: minutesBefore(90),
      }),
      'waiting for its roster': owned('wild', {
        title: 'The Wild Beyond the Witchlight',
        rosterReceived: false,
      }),
    }

    it.each(Object.keys(CAMPAIGNS))('a campaign: %s', async name => {
      jest.mocked(listOwnedCampaigns).mockResolvedValue([CAMPAIGNS[name]])
      render(
        await CampaignsPage({
          params: Promise.resolve({}),
          searchParams: Promise.resolve({}),
        }),
      )
      await settle()
      expect(page()).toMatchSnapshot(name)
    })

    it('a page toast: the invite link copied', async () => {
      jest.mocked(listOwnedCampaigns).mockResolvedValue([CAMPAIGNS.live])
      render(
        await CampaignsPage({
          params: Promise.resolve({}),
          searchParams: Promise.resolve({}),
        }),
      )
      await settle()
      await user().click(
        screen.getAllByRole('button', { name: 'Copy invite link' })[0],
      )
      // The clipboard has it, the button says so, and the toast is up.
      await advance(100)
      expect(page()).toMatchSnapshot('page toast')
    })

    it('every campaign, in the index', async () => {
      jest
        .mocked(listOwnedCampaigns)
        .mockResolvedValue(Object.values(CAMPAIGNS))
      render(
        await CampaignsPage({
          params: Promise.resolve({}),
          searchParams: Promise.resolve({}),
        }),
      )
      await settle()
      expect(page()).toMatchSnapshot('index')
    })

    it.each([
      ['signed out', false],
      ['signed in', true],
    ] as const)('the home page, %s', async (name, signedIn) => {
      jest.mocked(getCurrentUser).mockReset()
      if (signedIn) {
        jest
          .mocked(getCurrentUser)
          .mockResolvedValue({ id: 'user-1', name: 'Alice' } as never)
      }
      render(await HomePage())
      expect(page()).toMatchSnapshot(name)
    })

    it('the login page', async () => {
      // Signed out: no one.
      jest.mocked(getCurrentUser).mockReset()
      render(
        await LoginPage({
          params: Promise.resolve({}),
          searchParams: Promise.resolve({}),
        }),
      )
      expect(page()).toMatchSnapshot('login')
    })

    it.each([
      ['with a character', [thorin]],
      ['with none', []],
    ] as const)('the character list, %s', async (name, characters) => {
      jest.mocked(listCharacters).mockResolvedValue([...characters])
      render(await CharactersPage())
      expect(page()).toMatchSnapshot(name)
    })

    it('the join page', async () => {
      jest.mocked(findInvite).mockResolvedValue({
        id: 'c1',
        title: 'The Lonely Mountain',
        worldTitle: 'Return to Erebor',
        gameUrl: GAME,
        gamemaster: 'Gandalf',
        characters: [
          {
            id: 'actor-thorin',
            name: 'Thorin Oakenshield',
            claimedBy: 'you',
            characterId: 'char-1',
          },
          { id: 'actor-vex', name: 'Vex' },
        ],
      })
      render(
        await JoinPage({
          params: Promise.resolve({ code: 'code-1' }),
          searchParams: Promise.resolve({}),
        }),
      )
      expect(page()).toMatchSnapshot('join')
    })
  })
})
