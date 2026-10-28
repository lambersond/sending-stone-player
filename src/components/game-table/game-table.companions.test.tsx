/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameTable } from './game-table'
import { useTableView, type Connection } from '@/hooks/use-table-view'
import {
  biteAction,
  characterSheet,
  mockCompanionSheet,
  mockCompanionView,
  sheetAction,
} from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { Character } from '@/types/character'
import type {
  CompanionView,
  TableCombat,
  TableCompanion,
  TableView,
} from '@/types/table'

/*
 * A character's page with its companions (module 0.36.0): the row of tabs above the sheet, the
 * panes, kept and dropped, and the combat seen as the character's. The page's view is what each
 * test says; each companion's own, and every roll, come through `fetch`, which stands in for the
 * routes. The 3D dice need WebGL: a stand-in renderer, counted as it's made, that's never ready.
 */
jest.mock('@/hooks/use-table-view', () => ({
  POLL_INTERVAL: 3000,
  useTableView: jest.fn(),
}))
jest.mock('@/hooks/use-notes', () => ({
  hasDraft: () => false,
  journalOpen: () => false,
  useNotes: () => ({
    view: {
      version: 1,
      kind: 'personal',
      journal: null,
      live: true,
      enabled: true,
      connected: true,
      canAdd: true,
      canReorder: true,
      orders: true,
      chapters: [],
      groups: [],
      entries: [],
    },
    state: 'ready',
    create: jest.fn(),
    change: jest.fn(),
    remove: jest.fn(),
    resolve: jest.fn(),
    reorder: jest.fn(),
    resolveOrder: jest.fn(),
    preview: jest.fn(),
    setDraft: jest.fn(),
    setOpen: jest.fn(),
  }),
}))
const mockRenderers = jest.fn()
jest.mock('@lambersond/3d-dice-core', () => ({
  ...jest.requireActual('@lambersond/3d-dice-core'),
  DiceRenderer: jest.fn().mockImplementation(() => {
    mockRenderers()
    return {
      isReady: false,
      subscribe: () => () => {},
      ensure: () => {},
      dispose: () => {},
      roll: jest.fn(),
    }
  }),
}))

const GAME = 'https://my-game.forge-vtt.com'

const character: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: GAME,
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

/** A hit, its damage to follow. */
const HIT = {
  status: 'done',
  visible: true,
  total: 17,
  attack: { outcome: 'hit' },
  damage: {
    critical: false,
    plannable: true,
    rolls: [
      { formula: '1d8 + 3', type: 'slashing', dice: [{ faces: 8, number: 1 }] },
    ],
  },
}

/** Thorin's sheet, with a warhammer whose attacks the game makes. */
const thorinSheet = toTableSheet(
  characterSheet({
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [
          biteAction({
            id: 'hammer',
            name: 'Warhammer',
            attackId: 'hammerAttack',
            tableDamage: undefined,
          }),
        ],
      },
    ],
  }),
  GAME,
)

const owned = (key: string, name: string): TableCompanion => ({
  key,
  name,
  kind: 'owned',
})
const summoned = (key: string, name = 'Bat'): TableCompanion => ({
  key,
  name,
  kind: 'summoned',
  from: 'Find Familiar',
})
const BRAKKA = owned('wolfBrakka', 'Brakka')

const view = (fields: Partial<TableView> = {}): TableView => ({
  version: 3,
  live: true,
  campaign: { title: 'The Lonely Mountain' },
  connected: true,
  messages: [],
  sheet: thorinSheet,
  rollsToTable: ['ability', 'attack', 'damage'],
  rollFeatures: [],
  ...fields,
})

/** A companion's own view, as its route answers it, with its sheet. */
const companionView = (
  companion: TableCompanion,
  fields: Partial<CompanionView> = {},
): CompanionView =>
  mockCompanionView({
    companion,
    sheet: toTableSheet(mockCompanionSheet(), GAME),
    rollsToTable: ['ability', 'attack', 'damage'],
    rollFeatures: [],
    ...fields,
  })

let current: { view: TableView; connection: Connection }
const showing = (next: TableView) => {
  current = { ...current, view: next }
}

/**
 * The routes: each companion's view by its key (404 for none), its rolls and the character's,
 * answered by id as `answers` says at the time. Everything asked, in order.
 */
let companionViews: Map<string, CompanionView | 404>
let answers: Record<string, Record<string, unknown>>
let asked: { url: string; method: string }[]
const route = () => {
  asked = []
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const path = String(url)
    const method = init?.method ?? 'GET'
    asked.push({ url: path, method })
    const table = /\/companions\/([^/]+)\/table/.exec(path)
    if (table) {
      const found = companionViews.get(table[1])
      if (!found || found === 404) {
        return { ok: false, status: 404, json: async () => ({}) } as Response
      }
      return { ok: true, status: 200, json: async () => found } as Response
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
}

const page = (who: Character = character) => (
  <GameTable character={who} initialView={current.view} />
)

const renderTable = (initial: TableView, who: Character = character) => {
  current = { view: initial, connection: 'live' }
  jest.mocked(useTableView).mockImplementation(() => current)
  return render(page(who))
}

/** Shows a new view of the page, as a poll does. */
const poll = (
  next: TableView,
  rerender: (ui: React.ReactElement) => void,
  who: Character = character,
) => {
  showing(next)
  rerender(page(who))
}

const switcher = () =>
  screen.getByRole('tablist', { name: 'Character and companions' })
const creatureTab = (name: string | RegExp) =>
  within(switcher()).getByRole('tab', { name })
/** How many times a companion's view was asked for. */
const tableAsks = (key: string) =>
  asked.filter(({ url }) => url.includes(`/companions/${key}/table`)).length
/** What the character's own pane sent, not a companion's. */
const characterPosts = () =>
  asked.filter(
    ({ method, url }) => method === 'POST' && !url.includes('/companions/'),
  )
/** How many times a roll's answer was asked for. */
const follows = (id: string) =>
  asked.filter(({ url }) => url.endsWith(`/rolls/${id}`)).length
/** Whether a toast in view says this. */
const toasted = (words: string) =>
  screen
    .queryAllByRole('log', { name: 'Roll results' })
    .some(log => log.textContent?.includes(words))

const panelOf = (key: string) =>
  document.querySelector<HTMLElement>(`#creature-panel-${key}`)

/** Waits for a companion's pane to show its sheet. */
const sheetOf = async (key: string) => {
  await waitFor(() =>
    expect(
      panelOf(key)?.querySelector('[aria-label="Character sheet"]'),
    ).not.toBeNull(),
  )
  return within(panelOf(key) as HTMLElement)
}

beforeEach(() => {
  globalThis.localStorage.clear()
  globalThis.sessionStorage.clear()
  globalThis.localStorage.setItem(TOASTS_KEY, 'off')
  mockRenderers.mockClear()
  companionViews = new Map()
  answers = {}
  route()
})

type User = ReturnType<typeof userEvent.setup>

/** Chooses each of these in turn, its sheet shown before the next. */
const visit = async (user: User, names: string[]) => {
  for (const name of names) {
    await user.click(creatureTab(name))
    await sheetOf(name.toLowerCase())
  }
}

const fight = (fields: Partial<TableCombat> = {}): TableCombat => ({
  id: 'cmbt1',
  name: null,
  started: true,
  round: 2,
  currentId: 'c-brakka',
  combatants: [
    {
      id: 'c-brakka',
      name: 'Brakka',
      initiative: 18,
      defeated: false,
      side: 'party',
      yours: true,
      companion: 'wolfBrakka',
      hp: { value: 11, max: 11, temp: 0 },
    },
    {
      id: 'c-thorin',
      name: 'Thorin',
      initiative: 17,
      defeated: false,
      side: 'me',
    },
    {
      id: 'c-goblin',
      name: 'Goblin',
      initiative: 12,
      defeated: false,
      side: 'other',
    },
  ],
  ...fields,
})

describe('components/game-table/game-table, with companions', () => {
  it('throws every pane’s dice on one renderer', async () => {
    const user = userEvent.setup()
    const three = [BRAKKA, summoned('bat1'), owned('drake', 'Drake')]
    for (const each of three) companionViews.set(each.key, companionView(each))
    renderTable(view({ companions: three }))
    for (const name of ['Brakka', 'Bat', 'Drake']) {
      await user.click(creatureTab(name))
    }
    await sheetOf('drake')
    expect(panelOf('wolfBrakka')).not.toBeNull()
    expect(panelOf('bat1')).not.toBeNull()
    expect(mockRenderers).toHaveBeenCalledTimes(1)
  })

  it('keeps the character’s pane as a companion appears, its damage still to roll', async () => {
    const user = userEvent.setup()
    answers['req-1'] = HIT
    const { rerender } = renderTable(view())
    expect(
      screen.queryByRole('tablist', { name: 'Character and companions' }),
    ).toBeNull()
    await user.click(screen.getByRole('tab', { name: 'Actions' }))
    await user.click(
      screen.getByRole('button', { name: 'Warhammer attack, +4' }),
    )
    expect(
      await screen.findByRole(
        'button',
        { name: 'Roll damage' },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
    companionViews.set(BRAKKA.key, companionView(BRAKKA))
    poll(view({ companions: [BRAKKA] }), rerender)
    expect(switcher()).toBeInTheDocument()
    // The same pane: still on Actions, its attack's damage still offered.
    expect(screen.getByRole('tab', { name: 'Actions' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'Roll damage' }),
    ).toBeInTheDocument()
    expect(mockRenderers).toHaveBeenCalledTimes(1)
  })

  describe('the character’s pane, while a companion’s is shown', () => {
    /** Thorin's Battle Cry, its foes' save, out of a fight at no one, its damage to follow. */
    const cryThorin = toTableSheet(
      characterSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'cry',
                name: 'Battle Cry',
                save: { ability: 'DEX', dc: 13 },
                damage: [{ formula: '1d6', type: 'Thunder', healing: false }],
                activity: {
                  id: 'crySave',
                  type: 'save',
                  targets: {
                    self: false,
                    area: false,
                    count: 1,
                    perLevel: null,
                    affects: 'creature',
                  },
                },
              }),
            ],
          },
        ],
      }),
      GAME,
    )
    it('offers the damage of its use that comes due meanwhile, rather than rolling it', async () => {
      const user = userEvent.setup()
      companionViews.set(BRAKKA.key, companionView(BRAKKA))
      renderTable(
        view({
          companions: [BRAKKA],
          sheet: cryThorin,
          rollsToTable: ['use', 'damage', 'ability'],
        }),
      )
      const thorin = within(panelOf('self') as HTMLElement)
      await user.click(thorin.getByRole('tab', { name: 'Actions' }))
      await user.click(
        thorin.getByRole('button', {
          name: 'Battle Cry, DEX saving throw DC 13',
        }),
      )
      expect(characterPosts()).toHaveLength(1)
      await user.click(creatureTab('Brakka'))
      await sheetOf('wolfBrakka')
      answers['req-1'] = {
        status: 'done',
        visible: true,
        rolls: [],
        use: { type: 'save' },
        damage: {
          critical: false,
          plannable: true,
          rolls: [
            {
              formula: '1d6',
              type: 'thunder',
              dice: [{ faces: 6, number: 1 }],
            },
          ],
        },
      }
      expect(
        await thorin.findByRole(
          'button',
          { name: 'Roll damage', hidden: true },
          { timeout: 3000 },
        ),
      ).toBeInTheDocument()
      expect(characterPosts()).toHaveLength(1)
    })

    it('pops no toast for a roll answered meanwhile, nor once it’s shown again', async () => {
      globalThis.localStorage.setItem(TOASTS_KEY, 'on')
      const user = userEvent.setup()
      companionViews.set(BRAKKA.key, companionView(BRAKKA))
      renderTable(view({ companions: [BRAKKA] }))
      await user.click(
        within(panelOf('self') as HTMLElement).getByRole('button', {
          name: 'Strength check, +4',
        }),
      )
      await user.click(creatureTab('Brakka'))
      await sheetOf('wolfBrakka')
      // Answered, and its answer followed, while hidden.
      const before = follows('req-1')
      answers['req-1'] = { status: 'done', visible: true, total: 12 }
      await waitFor(() => expect(follows('req-1')).toBeGreaterThan(before), {
        timeout: 3000,
      })
      await act(async () => {})
      expect(toasted('Strength check')).toBe(false)
      await user.click(creatureTab('Thorin'))
      expect(toasted('Strength check')).toBe(false)
    })
  })

  it('prefixes every id in a companion’s pane, so that none on the page is repeated', async () => {
    const user = userEvent.setup()
    companionViews.set(BRAKKA.key, companionView(BRAKKA))
    renderTable(view({ companions: [BRAKKA] }))
    await user.click(creatureTab('Brakka'))
    await sheetOf('wolfBrakka')
    expect(
      panelOf('wolfBrakka')?.querySelector(
        '#creature-wolfBrakka-sheet-tab-character',
      ),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      panelOf('self')?.querySelector('#sheet-tab-character'),
    ).toBeInTheDocument()
    const ids = [...document.querySelectorAll('[id]')].map(({ id }) => id)
    expect(ids.filter((id, at) => ids.indexOf(id) !== at)).toEqual([])
  })

  it('mounts a companion’s pane as it’s first chosen, and keeps it, hidden, as another is', async () => {
    const user = userEvent.setup()
    companionViews.set(BRAKKA.key, companionView(BRAKKA))
    renderTable(view({ companions: [BRAKKA] }))
    expect(panelOf('wolfBrakka')).toBeNull()
    expect(creatureTab('Brakka')).not.toHaveAttribute('aria-controls')
    // The character's own panel, labelled by its tab.
    expect(panelOf('self')).toHaveAttribute('role', 'tabpanel')
    expect(panelOf('self')).toHaveAttribute(
      'aria-labelledby',
      'creature-tab-self',
    )
    await user.click(creatureTab('Brakka'))
    const brakka = await sheetOf('wolfBrakka')
    expect(brakka.getByRole('heading', { name: 'Brakka' })).toBeInTheDocument()
    expect(panelOf('self')).toHaveAttribute('hidden')
    expect(creatureTab('Brakka')).toHaveAttribute(
      'aria-controls',
      'creature-panel-wolfBrakka',
    )
    await user.click(creatureTab('Thorin'))
    expect(panelOf('wolfBrakka')).toHaveAttribute('hidden')
    expect(panelOf('self')).not.toHaveAttribute('hidden')
  })

  describe('at most four panes', () => {
    const five = ['Ash', 'Birch', 'Cedar', 'Elm', 'Fir'].map(name =>
      owned(name.toLowerCase(), name),
    )

    beforeEach(() => {
      for (const each of five) companionViews.set(each.key, companionView(each))
    })

    it('unmounts the least recently shown as a fifth is chosen', async () => {
      const user = userEvent.setup()
      renderTable(view({ companions: five }))
      await visit(user, ['Ash', 'Birch', 'Cedar', 'Elm'])
      expect(panelOf('ash')).not.toBeNull()
      await visit(user, ['Fir'])
      expect(panelOf('ash')).toBeNull()
      expect(
        ['birch', 'cedar', 'elm', 'fir'].map(key => !!panelOf(key)),
      ).toEqual([true, true, true, true])
      // Shown again, its pane is new, and has nothing of its own yet.
      await visit(user, ['Ash'])
      expect(panelOf('birch')).toBeNull()
    })

    it('never one with damage to roll', async () => {
      const user = userEvent.setup()
      answers['req-1'] = HIT
      renderTable(view({ companions: five }))
      await visit(user, ['Ash'])
      const ash = within(panelOf('ash') as HTMLElement)
      await user.click(ash.getByRole('tab', { name: 'Actions' }))
      await user.click(ash.getByRole('button', { name: 'Bite attack, +4' }))
      await ash.findByRole('button', { name: 'Roll damage' }, { timeout: 3000 })
      await visit(user, ['Birch', 'Cedar', 'Elm'])
      // Its tab says so while another is shown.
      expect(creatureTab(/^Ash/)).toHaveAccessibleName('Ash, damage to roll')
      await visit(user, ['Fir'])
      expect(panelOf('ash')).not.toBeNull()
      expect(panelOf('birch')).toBeNull()
    })

    it('never one with a roll on its way', async () => {
      const user = userEvent.setup()
      renderTable(view({ companions: five }))
      await visit(user, ['Ash'])
      const ash = within(panelOf('ash') as HTMLElement)
      await user.click(ash.getByRole('tab', { name: 'Actions' }))
      await user.click(ash.getByRole('button', { name: 'Bite attack, +4' }))
      await waitFor(() =>
        expect(asked.some(({ method }) => method === 'POST')).toBe(true),
      )
      await visit(user, ['Birch', 'Cedar', 'Elm', 'Fir'])
      expect(panelOf('ash')).not.toBeNull()
      expect(panelOf('birch')).toBeNull()
    })
  })

  it('keeps a gone companion’s tab, marked, until it’s chosen and left, then drops it and its pane', async () => {
    const user = userEvent.setup()
    const bat = summoned('bat1')
    companionViews.set(BRAKKA.key, companionView(BRAKKA))
    companionViews.set(bat.key, 404)
    const { rerender } = renderTable(view({ companions: [BRAKKA, bat] }))
    poll(view({ companions: [BRAKKA] }), rerender)
    const gone = creatureTab('Bat')
    expect(gone).toHaveAttribute('data-kind', 'gone')
    expect(gone).toHaveAccessibleDescription(
      'No longer with Thorin in your Gamemaster’s game',
    )
    // Choosing another first leaves it be.
    await user.click(creatureTab('Brakka'))
    expect(creatureTab('Bat')).toBeInTheDocument()
    await user.click(creatureTab('Bat'))
    expect(
      await screen.findByText(
        'Bat is no longer with Thorin in your Gamemaster’s game.',
      ),
    ).toBeInTheDocument()
    expect(panelOf('bat1')).not.toBeNull()
    await user.click(creatureTab('Thorin'))
    expect(within(switcher()).queryByRole('tab', { name: 'Bat' })).toBeNull()
    expect(panelOf('bat1')).toBeNull()
  })

  describe('as the last gone tab is left for the character’s, the row going', () => {
    // A browser focuses nothing inside a hidden element; jsdom does, so here it's refused.
    beforeEach(() => {
      const focus = HTMLElement.prototype.focus
      /* eslint-disable unicorn/no-this-outside-of-class -- the element focused */
      jest.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
        this: HTMLElement,
        options,
      ) {
        if (!this.closest('[hidden]')) focus.call(this, options)
      })
      /* eslint-enable unicorn/no-this-outside-of-class */
    })
    afterEach(() => jest.restoreAllMocks())

    it.each([
      ['its tab clicked', (user: User) => user.click(creatureTab('Thorin'))],
      ['Home', (user: User) => user.keyboard('{Home}')],
      ['Left', (user: User) => user.keyboard('{ArrowLeft}')],
    ])(
      'hands focus to the character’s sheet as it’s shown, with %s',
      async (_, leave) => {
        const user = userEvent.setup()
        const bat = summoned('bat1')
        companionViews.set(bat.key, 404)
        const { rerender } = renderTable(view({ companions: [bat] }))
        poll(view({ companions: [] }), rerender)
        await user.click(creatureTab('Bat'))
        await screen.findByText(
          'Bat is no longer with Thorin in your Gamemaster’s game.',
        )
        expect(panelOf('self')).toHaveAttribute('hidden')
        await leave(user)
        expect(
          screen.queryByRole('tablist', { name: 'Character and companions' }),
        ).toBeNull()
        expect(panelOf('self')).not.toHaveAttribute('hidden')
        await waitFor(() =>
          expect(document.querySelector('#sheet-tab-character')).toHaveFocus(),
        )
      },
    )
  })

  it('mounts afresh a companion listed again after its route said it was gone', async () => {
    const user = userEvent.setup()
    companionViews.set(BRAKKA.key, 404)
    const { rerender } = renderTable(view({ companions: [BRAKKA] }))
    await user.click(creatureTab('Brakka'))
    expect(
      await screen.findByText(
        'Brakka is no longer with Thorin in your Gamemaster’s game.',
      ),
    ).toBeInTheDocument()
    poll(view({ companions: [] }), rerender)
    expect(creatureTab('Brakka')).toHaveAttribute('data-kind', 'gone')
    const before = tableAsks('wolfBrakka')
    companionViews.set(BRAKKA.key, companionView(BRAKKA))
    poll(view({ companions: [BRAKKA] }), rerender)
    expect(creatureTab('Brakka')).toHaveAttribute('data-kind', 'owned')
    const brakka = await sheetOf('wolfBrakka')
    expect(tableAsks('wolfBrakka')).toBeGreaterThan(before)
    expect(
      brakka.getByRole('button', { name: 'Strength check, +4' }),
    ).toBeEnabled()
    expect(brakka.queryByRole('note')).toBeNull()
  })

  // Gone and back between two of the page's polls: the row never saw it go, but its pane did.
  it.each([
    ['as it mounts', false],
    ['with its sheet shown', true],
  ])(
    'mounts afresh a companion its route said was gone %s, while the row listed it throughout',
    async (_, sheetFirst) => {
      const user = userEvent.setup()
      companionViews.set(BRAKKA.key, sheetFirst ? companionView(BRAKKA) : 404)
      const { rerender } = renderTable(view({ companions: [BRAKKA] }))
      await user.click(creatureTab('Brakka'))
      if (sheetFirst) {
        await sheetOf('wolfBrakka')
        // Shown again, its pane asks at once, and is told it's gone.
        companionViews.set(BRAKKA.key, 404)
        await user.click(creatureTab('Thorin'))
        await user.click(creatureTab('Brakka'))
      }
      const told = within(panelOf('wolfBrakka') as HTMLElement)
      expect(await told.findByRole('note')).toHaveTextContent(
        'Brakka is no longer with Thorin in your Gamemaster’s game.',
      )
      expect(creatureTab('Brakka')).toHaveAttribute('data-kind', 'owned')
      const lostPanel = panelOf('wolfBrakka')
      const before = tableAsks('wolfBrakka')
      // Back, and the page's next view, a later one, lists it still.
      companionViews.set(BRAKKA.key, companionView(BRAKKA))
      poll(view({ version: 4, companions: [{ ...BRAKKA }] }), rerender)
      await waitFor(() =>
        expect(tableAsks('wolfBrakka')).toBeGreaterThan(before),
      )
      expect(panelOf('wolfBrakka')).not.toBe(lostPanel)
      const brakka = await sheetOf('wolfBrakka')
      expect(brakka.queryByRole('note')).toBeNull()
      expect(
        brakka.getByRole('button', { name: 'Strength check, +4' }),
      ).toBeEnabled()
      // Once only: a later view leaves the pane as it is.
      const back = panelOf('wolfBrakka')
      poll(view({ version: 5, companions: [{ ...BRAKKA }] }), rerender)
      expect(panelOf('wolfBrakka')).toBe(back)
    },
  )

  it('numbers repeated names, each keeping its number, and drops it once one is left', async () => {
    const user = userEvent.setup()
    const bats = [summoned('b1'), summoned('b2'), summoned('b3')]
    const { rerender } = renderTable(view({ companions: bats.slice(0, 2) }))
    expect(creatureTab('Bat 1')).toBeInTheDocument()
    expect(creatureTab('Bat 2')).toBeInTheDocument()
    // Bat 1 leaves: its tab stays, still Bat 1, until it's been shown and left.
    poll(view({ companions: [bats[1]] }), rerender)
    expect(creatureTab('Bat 1')).toHaveAttribute('data-kind', 'gone')
    await user.click(creatureTab('Bat 1'))
    await user.click(creatureTab('Thorin'))
    expect(creatureTab('Bat')).toHaveAttribute('data-key', 'b2')
    // With three, Bat 1 leaving keeps Bat 2 and Bat 3.
    poll(view({ companions: bats }), rerender)
    expect(
      ['Bat 1', 'Bat 2', 'Bat 3'].map(name => creatureTab(name).dataset.key),
    ).toEqual(['b1', 'b2', 'b3'])
    poll(view({ companions: [bats[1], bats[2]] }), rerender)
    await user.click(creatureTab('Bat 1'))
    await user.click(creatureTab('Thorin'))
    expect(within(switcher()).queryByRole('tab', { name: 'Bat 1' })).toBeNull()
    expect(creatureTab('Bat 2')).toHaveAttribute('data-key', 'b2')
    expect(creatureTab('Bat 3')).toHaveAttribute('data-key', 'b3')
  })

  describe('in a fight', () => {
    it('shows the companion as Yours, its turn as the player’s, and opens its tab from there', async () => {
      const user = userEvent.setup()
      companionViews.set(BRAKKA.key, companionView(BRAKKA))
      renderTable(view({ companions: [BRAKKA], combat: fight() }))
      // Its tab and the Combat tab say it's its turn.
      expect(creatureTab(/^Brakka/)).toHaveAccessibleName('Brakka, its turn')
      await user.click(
        screen.getByRole('button', { name: 'Combat , your turn' }),
      )
      const combat = within(screen.getByRole('region', { name: 'Combat' }))
      expect(
        combat.getByRole('heading', { name: 'Brakka’s turn' }),
      ).toHaveClass('text-primary')
      expect(combat.getAllByRole('listitem')[0]).toHaveTextContent('Yours')
      await user.click(combat.getByRole('button', { name: 'its tab' }))
      expect(screen.getByRole('button', { name: 'Character' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(creatureTab('Brakka')).toHaveAttribute('aria-selected', 'true')
      await waitFor(() => expect(creatureTab('Brakka')).toHaveFocus())
    })

    it('marks Combat for a companion’s turn, but not a gone one’s', () => {
      const { rerender } = renderTable(
        view({ companions: [BRAKKA], combat: fight() }),
      )
      expect(
        screen.getByRole('button', { name: 'Combat , your turn' }),
      ).toBeInTheDocument()
      // No longer listed, the combat gives it no key.
      const unlisted = fight()
      poll(
        view({
          companions: [],
          combat: {
            ...unlisted,
            combatants: unlisted.combatants.map(combatant =>
              combatant.id === 'c-brakka'
                ? {
                    ...combatant,
                    yours: undefined,
                    companion: undefined,
                    side: 'other' as const,
                  }
                : combatant,
            ),
          },
        }),
        rerender,
      )
      expect(screen.getByRole('button', { name: 'Combat' })).toBeInTheDocument()
      expect(creatureTab('Brakka')).toHaveAccessibleName('Brakka')
    })
  })

  it('marks the character’s tab while its game asks it for a roll and a companion is chosen', async () => {
    const user = userEvent.setup()
    companionViews.set(BRAKKA.key, companionView(BRAKKA))
    renderTable(
      view({
        companions: [BRAKKA],
        prompts: [
          {
            id: 'msg2-thorin',
            type: 'concentration',
            abilities: ['con'],
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        ],
      }),
    )
    expect(creatureTab('Thorin')).toHaveAccessibleName('Thorin')
    await user.click(creatureTab('Brakka'))
    expect(creatureTab(/^Thorin/)).toHaveAccessibleName(
      'Thorin, your Gamemaster asks for a roll',
    )
  })

  describe('on a wide screen', () => {
    beforeEach(() => {
      jest.spyOn(globalThis, 'matchMedia').mockImplementation(
        query =>
          ({
            matches: query === '(min-width: 64rem)',
            addEventListener: () => {},
            removeEventListener: () => {},
          }) as unknown as MediaQueryList,
      )
    })
    afterEach(() => jest.restoreAllMocks())

    it('shows the Character pane for a character with companions and no sheet', () => {
      const choosing: Character = { ...character, actorId: null }
      current = {
        view: view({ sheet: undefined, companions: [BRAKKA] }),
        connection: 'live',
      }
      jest.mocked(useTableView).mockImplementation(() => current)
      render(
        <GameTable
          character={choosing}
          initialView={current.view}
          choice={{
            id: 'c1',
            title: 'The Lonely Mountain',
            gameUrl: GAME,
            characters: [],
          }}
        />,
      )
      expect(screen.getByRole('region', { name: 'Character' })).toHaveClass(
        'lg:flex',
      )
    })
  })

  it('has no row, roles or renderer without companions or a sheet', () => {
    renderTable(view({ sheet: undefined, companions: undefined }))
    expect(
      screen.queryByRole('tablist', { name: 'Character and companions' }),
    ).toBeNull()
    expect(panelOf('self')).not.toHaveAttribute('role')
    expect(mockRenderers).not.toHaveBeenCalled()
  })
})

/** When a prompt this far off stops waiting. */
const later = (ms = 600_000) => new Date(Date.now() + ms).toISOString()

/** The notice on the character's own banner of the companions asked, if any. */
const notice = () =>
  within(panelOf('self') as HTMLElement).queryByRole('list', {
    name: 'Companions asked',
  })

describe('components/game-table/game-table, companions’ saves, from module 0.41.0 (round 0.41.0 §3.7)', () => {
  const BAT1 = summoned('arena-bat1')
  const BAT2 = summoned('arena-bat2')

  /** Thorin's page, Bat 1 asked a save, Bat 2 not, as the view says. */
  const asking = (fields: Partial<TableView> = {}) =>
    view({
      companions: [BAT1, BAT2],
      companionPrompts: [
        {
          key: 'arena-bat1',
          label: 'Dexterity saving throw',
          expiresAt: later(),
        },
      ],
      ...fields,
    })

  it('marks an asked companion’s tab in the words the character’s own uses, and only its', () => {
    renderTable(asking())

    expect(creatureTab(/^Bat 1/)).toHaveAccessibleName(
      'Bat 1, your Gamemaster asks for a roll',
    )
    expect(creatureTab(/^Bat 2/)).toHaveAccessibleName('Bat 2')
    expect(creatureTab(/^Thorin/)).toHaveAccessibleName('Thorin')
  })

  it('says it in the Gamemaster’s words at their seat', () => {
    current = { view: asking(), connection: 'live' }
    jest.mocked(useTableView).mockImplementation(() => current)
    render(
      <GameTable
        character={character}
        initialView={current.view}
        seat={{
          role: 'gm',
          api: '/api/campaigns/c1/characters/actor-thorin',
          key: 'gm:c1:actor-thorin',
        }}
      />,
    )

    expect(creatureTab(/^Bat 1/)).toHaveAccessibleName(
      'Bat 1, your game asks for a roll',
    )
  })

  it('says on Thorin’s own banner which companion is asked, Show switching to its tab with nothing posted', async () => {
    const user = userEvent.setup()
    companionViews.set(BAT1.key, companionView(BAT1))
    renderTable(asking())

    const banner = within(panelOf('self') as HTMLElement).getByRole('region', {
      name: 'Your Gamemaster asks',
    })
    const rows = within(banner).getAllByRole('listitem')
    expect(rows.map(row => row.textContent)).toEqual([
      'Bat 1 is asked for a Dexterity saving throw' + 'Show',
    ])
    const show = within(banner).getByRole('button', { name: 'Show Bat 1' })
    await user.click(show)

    expect(creatureTab(/^Bat 1/)).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(creatureTab(/^Bat 1/)).toHaveFocus())
    expect(asked.filter(({ method }) => method === 'POST')).toEqual([])
  })

  it('shows the notice with the character’s own prompts, under the one heading', () => {
    renderTable(
      asking({
        rollsToTable: ['ability', 'save'],
        rollFeatures: ['prompts'],
        prompts: [
          {
            id: 'msg2-actor-thorin',
            type: 'save',
            abilities: ['dex'],
            dc: 13,
            expiresAt: later(),
          },
        ],
      }),
    )

    const self = within(panelOf('self') as HTMLElement)
    expect(
      self.getAllByRole('heading', { name: 'Your Gamemaster asks' }),
    ).toHaveLength(1)
    const banner = self.getByRole('region', { name: 'Your Gamemaster asks' })
    expect(banner).toHaveTextContent(
      'Bat 1 is asked for a Dexterity saving throw',
    )
    expect(banner).toHaveTextContent('Dexterity saving throw')
    expect(
      within(banner).getByRole('button', {
        name: /^Roll Dexterity saving throw/,
      }),
    ).toBeInTheDocument()
  })

  it('marks the phone’s Character tab for a companion’s prompt alone, with Combat shown', async () => {
    const user = userEvent.setup()
    renderTable(asking())

    await user.click(screen.getByRole('button', { name: 'Combat' }))
    const tab = screen.getByRole('button', { name: /^Character/ })
    expect(tab).toHaveTextContent('your Gamemaster asks for a roll')
  })

  it('marks nothing and says nothing once its time runs out, though the view still lists it', async () => {
    jest.useFakeTimers()
    try {
      renderTable(
        asking({
          companionPrompts: [
            {
              key: 'arena-bat1',
              label: 'Dexterity saving throw',
              expiresAt: later(5000),
            },
          ],
        }),
      )
      expect(notice()).not.toBeNull()

      await act(async () => {
        await jest.advanceTimersByTimeAsync(5200)
      })
      expect(creatureTab(/^Bat 1/)).toHaveAccessibleName('Bat 1')
      expect(notice()).toBeNull()
      expect(
        within(panelOf('self') as HTMLElement).queryByRole('region', {
          name: 'Your Gamemaster asks',
        }),
      ).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })

  it('marks nothing for a companion the row doesn’t list, or a character’s view without companionPrompts', () => {
    renderTable(
      asking({
        companions: [BAT2],
        companionPrompts: [
          {
            key: 'arena-bat1',
            label: 'Dexterity saving throw',
            expiresAt: later(),
          },
        ],
      }),
    )
    expect(notice()).toBeNull()
    expect(creatureTab(/^Bat/)).toHaveAccessibleName('Bat')
  })
})

void act
