import { fireEvent, render, screen, within } from '@testing-library/react'
import { GameTable } from '../components/game-table/game-table'
import { TOASTS_KEY } from '@/features/rolling/utils/roll-toasts'
import { useTableView } from '@/features/table/hooks/use-table-view'
import {
  mockCompanionView,
  mockTurnCombat,
  withCombats,
} from '@/mocks/sending-stone'
import { advance } from '@/utils/test-utils'
import type { Character, TableSeat } from '@/types/character'
import type { RollKind } from '@/types/roll'
import type { TableCompanion, TableView, Connection } from '@/types/table'

/*
 * Two encounters under way at once on a character's page (item 36): a tab for each on the Combat
 * tab, the header following the one shown, the Combat tab's dot and hold reaching the seat's turn
 * in either, and End Turn's toast for one not shown. The page's view is what each test says; End
 * Turn's way comes through `fetch`, which stands in for the routes. Time is faked.
 */

jest.mock('@/features/table/hooks/use-table-view', () => ({
  useTableView: jest.fn(),
}))
jest.mock('@/features/notes/hooks/use-notes', () => ({
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
jest.mock(
  '@lambersond/3d-dice-react',
  () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
)

const character: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

const KINDS: RollKind[] = ['ability', 'endTurn', 'undoEndTurn']

const BRAKKA: TableCompanion = {
  key: 'wolfBrakka',
  name: 'Brakka',
  kind: 'owned',
}

/** Thorin's turn, round 1: Brakka acts next, then the goblin. */
const view = (fields: Partial<TableView> = {}): TableView =>
  withCombats({
    version: 3,
    live: true,
    campaign: { title: 'The Lonely Mountain' },
    connected: true,
    messages: [],
    combat: mockTurnCombat(),
    rollsToTable: KINDS,
    rollFeatures: [],
    ...fields,
  })

let current: { view: TableView; connection: Connection }

/**
 * The routes: each roll posted is taken (202) as `req-<n>`, unless `refuse` says the app turns it
 * away; each is answered by id as `answers` says at the time, else still being sent. A companion's
 * view is Brakka's.
 */
let answers: Record<string, Record<string, unknown>>
let refuse: { status: number; reason: string } | undefined
let posted: { url: string; body: Record<string, unknown> }[]
const route = () => {
  posted = []
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const path = String(url)
    if (path.includes('/companions/')) {
      return {
        ok: true,
        status: 200,
        json: async () => mockCompanionView({ companion: BRAKKA }),
      } as Response
    }
    if (init?.method === 'POST') {
      posted.push({ url: path, body: JSON.parse(String(init.body)) })
      if (refuse) {
        const { status, reason } = refuse
        return { ok: false, status, json: async () => ({ reason }) } as Response
      }
      return {
        ok: true,
        status: 202,
        json: async () => ({ id: `req-${posted.length}` }),
      } as Response
    }
    const id = path.split('/').at(-1) ?? ''
    return {
      ok: true,
      status: 200,
      json: async () => ({ id, status: 'sending', ...answers[id] }),
    } as Response
  }) as typeof fetch
}

const page = (seat?: TableSeat) => (
  <GameTable character={character} initialView={current.view} seat={seat} />
)

const renderTable = (initial: TableView = view(), seat?: TableSeat) => {
  current = { view: initial, connection: 'live' }
  jest
    .mocked(useTableView)
    .mockImplementation(() => ({ ...current, readAgain: () => {} }))
  const rendered = render(page(seat))
  return {
    ...rendered,
    /** Shows a new view of the page, as a poll does. */
    poll: (fields: Partial<TableView>) => {
      current = { ...current, view: view(fields) }
      rendered.rerender(page(seat))
    },
  }
}

type PointerInit = {
  pointerId?: number
  button?: number
  clientX?: number
  clientY?: number
  pointerType?: string
}

/** A pointer's event, with its pointer's id and whether that's the primary: jsdom has neither. */
const pointer = (target: Element, type: string, init: PointerInit = {}) => {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: init.button ?? 0,
    clientX: init.clientX ?? 20,
    clientY: init.clientY ?? 20,
    pointerType: init.pointerType ?? 'touch',
  })
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 })
  Object.defineProperty(event, 'isPrimary', { value: true })
  return fireEvent(target, event)
}

/** The bottom bar's (and the rail's) tabs. */
const barTab = (name: RegExp | string) =>
  within(screen.getByRole('navigation', { name: 'Table' })).getByRole(
    'button',
    { name },
  )
const combatTab = () => barTab(/^Combat/)

const toast = () =>
  document.body.querySelector<HTMLElement>('[data-turn-toast]')
/** The toast's words and the line under them. */
const toasted = () => {
  const shown = toast()
  if (!shown) return
  const small = shown.querySelector('small')
  const words = shown.querySelector('p')?.firstChild?.textContent
  return small ? [words, small.textContent] : [words]
}
const turnHeading = () => document.querySelector<HTMLElement>('#turn-heading')
const endTurns = () =>
  posted.filter(({ body }) => body.kind === 'endTurn').map(({ body }) => body)

/** Brakka, Thorin's wolf, as the page shows her, and the den's own wolf. */
const [THORIN, BRAKKA_FIGHTS, GOBLIN, VEX] = mockTurnCombat().combatants
/** The arena: Thorin, the goblin and Vex, the goblin's turn unless said. */
const arena = (currentId = 'c-goblin') =>
  mockTurnCombat({ id: 'arena', currentId, combatants: [THORIN, GOBLIN, VEX] })
/** The den: Brakka fighting without Thorin, her turn unless said. */
const den = (currentId = 'c-brakka') =>
  mockTurnCombat({
    id: 'den',
    currentId,
    combatants: [
      BRAKKA_FIGHTS,
      {
        id: 'c-den-wolf',
        name: 'Wolf',
        initiative: 9,
        defeated: false,
        side: 'other',
      },
    ],
  })
/** Both under way, Thorin's own the arena. */
const both = (fields: Partial<TableView> = {}) =>
  view({ combat: arena(), combats: [arena(), den()], ...fields })
/** Thorin's second fight of his own, his turn: a cave on another scene, a bat against him. */
const cave = () =>
  mockTurnCombat({
    id: 'cave',
    currentId: 'c-thorin',
    combatants: [
      THORIN,
      {
        id: 'c-bat',
        name: 'Bat',
        initiative: 3,
        defeated: false,
        side: 'other',
      },
    ],
  })
const encounterTab = (name: RegExp) => screen.getByRole('tab', { name })
const header = () => screen.getByRole('banner')
/** The tabs above the sheet. */
const creatureTab = (name: RegExp) =>
  within(
    screen.getByRole('tablist', { name: 'Character and companions' }),
  ).getByRole('tab', { name })

/** A wide screen, where combat or the chat sits in a column beside the sheet. */
const wideScreen = () =>
  jest.spyOn(globalThis, 'matchMedia').mockImplementation(
    query =>
      ({
        matches: query === '(min-width: 64rem)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
/** The column's tabs, on a wide screen, and the line beside them that says what's happening. */
const columnTabs = () => screen.getByRole('tablist', { name: 'Combat or chat' })
const columnTab = (name: RegExp) =>
  within(columnTabs()).getByRole('tab', { name })
const columnLine = () => columnTabs().nextElementSibling

describe('components/game-table/game-table, two encounters at once (item 36)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.sessionStorage.clear()
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
    answers = {}
    refuse = undefined
    route()
    Object.defineProperty(navigator, 'vibrate', {
      value: jest.fn(),
      configurable: true,
    })
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('draws a tab for each, Thorin’s shown; choosing Brakka’s shows hers, the header’s line with it', () => {
    renderTable(both())
    fireEvent.click(combatTab())

    // The tabs' names are the tab row's own (its tests): here only which is which, and which shown.
    const tabs = within(
      screen.getByRole('tablist', { name: 'Encounters' }),
    ).getAllByRole('tab')
    expect(tabs.map(({ id }) => id)).toEqual([
      'encounter-tab-arena',
      'encounter-tab-den',
    ])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'encounter-tab-arena',
    )
    expect(turnHeading()).toHaveTextContent('Goblin is acting')
    expect(header()).toHaveTextContent('Round 1 · Goblin’s turn')

    fireEvent.click(encounterTab(/^Brakka/))
    expect(turnHeading()).toHaveTextContent('Brakka’s turn')
    expect(header()).toHaveTextContent('Round 1 · Brakka’s turn')
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'encounter-tab-den',
    )
  })

  it('marks the Combat tab for Brakka’s turn in the den while the arena is shown, and the hold ends hers there, Undo taking it back there', async () => {
    const { poll } = renderTable(both())
    await advance(600)
    expect(combatTab()).toHaveAccessibleName(/, your turn/)
    expect(combatTab()).toHaveAccessibleDescription(
      'Press and hold to end Brakka’s turn',
    )

    pointer(combatTab(), 'pointerdown')
    await advance(500)
    expect(toasted()?.[0]).toBe('Ending Brakka’s turn…')
    await advance(500)
    expect(endTurns().map(({ turn }) => turn)).toEqual([
      { combatId: 'den', round: 1, combatantId: 'c-brakka' },
    ])
    pointer(combatTab(), 'pointerup')

    // The game ends it and the den moves on to its wolf, the arena still the goblin's: the toast
    // and Undo follow the den, the encounter the End Turn was for, not the arena shown.
    answers['req-1'] = { status: 'done' }
    await advance(1000)
    poll({ combat: arena(), combats: [arena(), den('c-den-wolf')] })
    expect(toasted()).toEqual(['Brakka’s turn has ended.', 'Wolf is acting.'])
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(posted.at(-1)?.body).toEqual(
      expect.objectContaining({
        kind: 'undoEndTurn',
        undo: 'req-1',
        turn: { combatId: 'den', round: 1, combatantId: 'c-den-wolf' },
      }),
    )
  })

  it('holds to end the turn in the encounter shown, the den’s once its tab is chosen, though Thorin’s turn is the arena’s too', async () => {
    renderTable(
      both({ combat: arena('c-thorin'), combats: [arena('c-thorin'), den()] }),
    )
    fireEvent.click(combatTab())
    fireEvent.click(encounterTab(/^Brakka/))
    await advance(600)

    pointer(combatTab(), 'pointerdown')
    await advance(500)
    expect(toasted()?.[0]).toBe('Ending Brakka’s turn…')
    await advance(500)
    expect(endTurns().map(({ turn }) => turn)).toEqual([
      { combatId: 'den', round: 1, combatantId: 'c-brakka' },
    ])
    pointer(combatTab(), 'pointerup')
  })

  it('ends Thorin’s own in the encounter shown where it’s his turn there too, the den’s untouched', async () => {
    renderTable(
      both({ combat: arena('c-thorin'), combats: [arena('c-thorin'), den()] }),
    )
    await advance(600)

    pointer(combatTab(), 'pointerdown')
    await advance(500)
    expect(toasted()?.[0]).toBe('Ending your turn…')
    await advance(500)
    expect(endTurns().map(({ turn }) => turn)).toEqual([
      { combatId: 'arena', round: 1, combatantId: 'c-thorin' },
    ])
    pointer(combatTab(), 'pointerup')
  })

  it('says in the toast why End Turn pressed in the den wasn’t made, once the arena’s tab is shown', async () => {
    refuse = { status: 422, reason: 'moved' }
    renderTable(both())
    fireEvent.click(combatTab())
    fireEvent.click(encounterTab(/^Brakka/))
    await advance(600)
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }))
    fireEvent.click(encounterTab(/^Thorin/))
    await advance(1000)

    expect(toasted()?.[0]).toMatch(/^Brakka’s turn wasn’t ended/)
  })

  it('names each creature’s turn on its tab above the sheet wherever it is: Brakka’s in the den while the arena is shown, Thorin’s in a second fight of his own', () => {
    const { poll } = renderTable(both({ companions: [BRAKKA] }))
    expect(creatureTab(/^Brakka/)).toHaveAccessibleName('Brakka, its turn')

    // Thorin's tab says its news while Brakka's is the one shown.
    fireEvent.click(creatureTab(/^Brakka/))
    poll({ companions: [BRAKKA], combat: arena(), combats: [arena(), cave()] })
    expect(creatureTab(/^Thorin/)).toHaveAccessibleName('Thorin, your turn')
  })

  it('opens the arena’s tab where the view names it the seat’s own, though another of Thorin’s sorts first', () => {
    renderTable(view({ combat: arena(), combats: [cave(), arena()] }))
    fireEvent.click(combatTab())

    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'encounter-tab-arena',
    )
    expect(turnHeading()).toHaveTextContent('Goblin is acting')
  })

  describe('on a wide screen', () => {
    beforeEach(wideScreen)

    it('puts the column’s line with the encounter shown, the den’s once its tab is chosen', () => {
      renderTable(both())
      expect(columnLine()).toHaveTextContent('Round 1 · Goblin’s turn')

      fireEvent.click(encounterTab(/^Brakka/))
      expect(columnLine()).toHaveTextContent('Round 1 · Brakka’s turn')
    })

    it('opens the column on Combat for Brakka’s fight in the den, Thorin’s own not under way', () => {
      renderTable(
        view({
          // The arena set up and not yet begun: Thorin's own, as the view names it.
          combat: {
            ...arena(),
            underWay: false,
            round: 0,
            currentId: undefined,
          },
          combats: [den()],
        }),
      )

      expect(columnTab(/^Combat/)).toHaveAttribute('aria-selected', 'true')
      expect(turnHeading()).toHaveTextContent('Brakka’s turn')
    })
  })

  it('shows the arena alone once the den goes from the view, as with one encounter', () => {
    const { poll } = renderTable(both())
    fireEvent.click(combatTab())
    fireEvent.click(encounterTab(/^Brakka/))

    poll({ combat: arena(), combats: [arena()] })
    expect(screen.queryByRole('tablist', { name: 'Encounters' })).toBeNull()
    expect(screen.queryByRole('tabpanel')).toBeNull()
    expect(turnHeading()).toHaveTextContent('Goblin is acting')
  })
})
