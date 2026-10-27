/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { GameTable } from './game-table'
import { useTableView, type Connection } from '@/hooks/use-table-view'
import {
  mockCompanionView,
  mockTurnCombat,
  shapedSheet,
} from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableSheet } from '@/utils/table-view'
import type { Character, TableSeat } from '@/types/character'
import type { RollKind } from '@/types/roll'
import type { TableCombat, TableCompanion, TableView } from '@/types/table'

/*
 * End Turn on a character's page (module 0.36.0), as the user's End Turn prototype draws it: the
 * Combat tab held, from any tab and on every layout, its fill, toast and buzz; the turn panel's
 * button, its line and focus; and the toast with Undo. The page's view is what each test says;
 * End Turn's and Undo's ways come through `fetch`, which stands in for the routes. Time is faked.
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
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

const API = '/api/characters/char-1'

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
const view = (fields: Partial<TableView> = {}): TableView => ({
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

/** The same combat as the page shows it a poll later, on another current combatant or round. */
const turnOf = (currentId: string, fields: Partial<TableCombat> = {}) =>
  mockTurnCombat({ currentId, ...fields })

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
  jest.mocked(useTableView).mockImplementation(() => current)
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

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })

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

/** A press of the tab, let go after `ms`, and the browser's click after it. */
const press = async (target: Element, ms: number, init?: PointerInit) => {
  pointer(target, 'pointerdown', init)
  await advance(ms)
  pointer(target, 'pointerup', init)
  fireEvent.click(target, { detail: 1 })
}

/** The bottom bar's (and the rail's) tabs. */
const barTab = (name: RegExp | string) =>
  within(screen.getByRole('navigation', { name: 'Table' })).getByRole(
    'button',
    { name },
  )
const combatTab = () => barTab(/^Combat/)
/** The fill of a tab held to end the turn, while a turn may be ended. */
const fillOf = (tab: HTMLElement) =>
  tab.querySelector<HTMLElement>('span.origin-left')
/** The tab the page shows, in one pane. */
const onTab = (name: string) =>
  expect(barTab(name)).toHaveAttribute('aria-current', 'page')

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
/** The column's tabs, on a wide screen. */
const columnTab = (name: RegExp | string) =>
  within(screen.getByRole('tablist', { name: 'Combat or chat' })).getByRole(
    'tab',
    { name },
  )
/** The column the wide screen shows. */
const onColumn = (name: RegExp | string) =>
  expect(columnTab(name)).toHaveAttribute('aria-selected', 'true')

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

const THORINS = { combatId: 'cmbt1', round: 1, combatantId: 'c-thorin' }

/** Thorin's turn ended by the button, on Combat, once it's offered. */
const endByButton = async () => {
  fireEvent.click(combatTab())
  await advance(600)
  fireEvent.click(screen.getByRole('button', { name: 'End turn' }))
}
/** Undo pressed with focus on it, as a keyboard or a screen reader presses it. */
const undoByKeyboard = () => {
  const undo = screen.getByRole('button', { name: 'Undo' })
  act(() => undo.focus())
  fireEvent.click(undo)
}

describe('components/game-table/game-table, End Turn', () => {
  let vibrate: jest.Mock
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.sessionStorage.clear()
    globalThis.localStorage.setItem(TOASTS_KEY, 'off')
    answers = {}
    refuse = undefined
    route()
    vibrate = jest.fn()
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrate,
      configurable: true,
    })
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'vibrate')
  })

  it('ends the turn from the Character tab by the bar’s Combat tab held: the fill, the toast at half a second, End Turn at a second, the page still on Character', async () => {
    renderTable()
    await advance(600)
    const tab = combatTab()
    const fill = fillOf(tab)
    expect(fill).toHaveStyle({ transform: 'scaleX(0)' })
    expect(tab).toHaveClass(
      'touch-manipulation',
      'select-none',
      'overflow-hidden',
      '[-webkit-touch-callout:none]',
    )

    pointer(tab, 'pointerdown')
    await advance(300)
    expect(fill?.style.transform).not.toBe('scaleX(0)')
    // The label and icon in the text's own colour while it's held.
    expect(tab).toHaveClass('text-text-primary')
    expect(toast()).toBeNull()
    await advance(200)
    expect(toasted()).toEqual([
      'Ending your turn…',
      'Keep holding to end it, or let go to keep it.',
    ])
    expect(endTurns()).toEqual([])
    await advance(500)
    expect(endTurns()).toEqual([
      {
        kind: 'endTurn',
        turn: THORINS,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      },
    ])
    expect(vibrate).toHaveBeenCalledWith(12)
    expect(toasted()).toEqual([
      'Ending your turn…',
      'Sending to your Gamemaster’s game…',
    ])
    // No turn to end while it's on its way, and no fill; the finger still down keeps the tab's
    // touch classes until it lifts.
    expect(fillOf(tab)).toBeNull()
    expect(tab).toHaveClass(
      'touch-manipulation',
      '[-webkit-touch-callout:none]',
    )
    pointer(tab, 'pointerup')
    expect(tab).not.toHaveClass('touch-manipulation')
    fireEvent.click(tab, { detail: 1 })
    onTab('Character')
  })

  it('keeps the toast over the sheet, clear of the column’s Combat tab, on a wide screen', async () => {
    wideScreen()
    renderTable()
    const region = [
      ...document.body.querySelectorAll<HTMLElement>(
        ':scope > [aria-live="polite"]',
      ),
    ].find(element => !element.hasAttribute('role'))
    expect(region).toHaveClass(
      'lg:pr-[calc(clamp(320px,40%,500px)_+_max(1rem,env(safe-area-inset-right)))]',
    )
    // The column it keeps clear of, as wide as that says.
    expect(
      screen.getByRole('tablist', { name: 'Combat or chat' }).parentElement
        ?.parentElement,
    ).toHaveClass('lg:w-[clamp(320px,40%,500px)]')
  })

  it('ends it by the column’s Combat tab held with a mouse, on a wide screen', async () => {
    jest.spyOn(globalThis, 'matchMedia').mockImplementation(
      query =>
        ({
          matches: query === '(min-width: 64rem)',
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    )
    renderTable()
    fireEvent.click(screen.getByRole('tab', { name: 'Chat' }))
    await advance(600)
    const tab = screen.getByRole('tab', { name: 'Combat , your turn' })
    expect(tab).toHaveClass('min-h-9')
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveClass('min-h-9')
    expect(tab).toHaveAccessibleDescription('Press and hold to end your turn')
    expect(fillOf(tab)).not.toBeNull()
    // The bar's, hidden on a wide screen, has none.
    expect(fillOf(combatTab())).toBeNull()

    pointer(tab, 'pointerdown', { pointerType: 'mouse' })
    await advance(1000)
    expect(endTurns()).toHaveLength(1)
    pointer(tab, 'pointerup', { pointerType: 'mouse' })
    fireEvent.click(tab, { detail: 1 })
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('describes the tab while a turn may be ended by it, its name as ever', async () => {
    const { poll } = renderTable()
    expect(combatTab()).not.toHaveAttribute('aria-describedby')
    await advance(600)
    const tab = screen.getByRole('button', { name: 'Combat , your turn' })
    expect(tab).toHaveAccessibleName('Combat , your turn')
    expect(tab).toHaveAccessibleDescription('Press and hold to end your turn')
    expect(tab).toHaveAttribute('aria-describedby', 'combat-hold-bar')
    const words = document.querySelector('#combat-hold-bar')
    expect(words).toHaveAttribute('hidden')
    expect(words).not.toHaveClass('sr-only')

    poll({ combat: turnOf('c-brakka') })
    await advance(600)
    expect(combatTab()).toHaveAccessibleDescription(
      'Press and hold to end Brakka’s turn',
    )
    poll({ combat: turnOf('c-goblin') })
    expect(combatTab()).not.toHaveAttribute('aria-describedby')
    expect(document.querySelector('#combat-hold-bar')).toBeNull()
    expect(combatTab()).toHaveAccessibleName('Combat')
  })

  it('draws the fill from the left by its transform alone, with no scale utility of its own', async () => {
    renderTable()
    await advance(600)
    const fill = fillOf(combatTab()) as HTMLElement
    expect(fill).toHaveAttribute('aria-hidden', 'true')
    expect(fill).toHaveClass(
      'pointer-events-none',
      'absolute',
      'inset-0',
      'origin-left',
      'rounded-[inherit]',
      'bg-primary/22',
    )
    expect(fill.className).not.toMatch(/scale-/)
    expect(combatTab().firstElementChild).toBe(fill)
  })

  it('ends nothing and shows nothing when let go at 700 ms, its toast gone', async () => {
    renderTable()
    await advance(600)
    const tab = combatTab()
    pointer(tab, 'pointerdown')
    await advance(600)
    expect(toast()).not.toBeNull()
    await advance(100)
    pointer(tab, 'pointerup')
    expect(toast()).toBeNull()
    fireEvent.click(tab, { detail: 1 })
    await advance(2000)
    expect(endTurns()).toEqual([])
    expect(fillOf(tab)).toHaveStyle({ transform: 'scaleX(0)' })
    onTab('Character')
  })

  it('shows Combat for a tap', async () => {
    renderTable()
    await advance(600)
    await press(combatTab(), 150)
    onTab('Combat')
    expect(endTurns()).toEqual([])
  })

  it('stays where it was when held 2 s and let go, the turn ended at 1 s', async () => {
    renderTable()
    await advance(600)
    await press(combatTab(), 2000)
    expect(endTurns()).toHaveLength(1)
    onTab('Character')
  })

  it('opens no tab for a moment once a hold has ended the turn', async () => {
    renderTable()
    await advance(600)
    await press(combatTab(), 1000)
    await advance(300)
    fireEvent.click(barTab('Chat'), { detail: 1 })
    onTab('Character')
    await advance(400)
    fireEvent.click(barTab('Chat'), { detail: 1 })
    onTab('Chat')
  })

  it('still lets the panel’s “its tab” choose a companion’s tab in that moment', async () => {
    const { poll } = renderTable(view({ companions: [BRAKKA] }))
    fireEvent.click(combatTab())
    await advance(600)
    await press(combatTab(), 1000)
    poll({ companions: [BRAKKA], combat: turnOf('c-brakka') })
    await advance(100)
    fireEvent.click(screen.getByRole('button', { name: 'its tab' }), {
      detail: 1,
    })
    expect(
      within(
        screen.getByRole('tablist', { name: 'Character and companions' }),
      ).getByRole('tab', { name: /^Brakka/ }),
    ).toHaveAttribute('aria-selected', 'true')
    // Shown, on the Character tab: only the tabs are quiet.
    onTab('Character')
  })

  it('stops the hold where the turn moves on under it, ending none', async () => {
    const { poll } = renderTable()
    await advance(600)
    const tab = combatTab()
    pointer(tab, 'pointerdown')
    await advance(600)
    expect(toast()).not.toBeNull()
    // The Gamemaster ended Thorin's turn: Brakka's, the seat's too, is shown.
    poll({ combat: turnOf('c-brakka') })
    expect(toast()).toBeNull()
    const fill = fillOf(tab)
    expect(fill === null || fill.style.transform === 'scaleX(0)').toBe(true)
    await advance(2000)
    pointer(tab, 'pointerup')
    expect(endTurns()).toEqual([])
  })

  it('ends no turn where the turn moves on under the hold, even one the seat may end by then', async () => {
    const { poll } = renderTable()
    await advance(600)
    const tab = combatTab()
    pointer(tab, 'pointerdown')
    await advance(300)
    // Brakka's turn, shown long enough to be offered before the hold would end.
    poll({ combat: turnOf('c-brakka') })
    await advance(650)
    expect(
      screen.getByRole('button', { name: 'Combat , your turn' }),
    ).toHaveAccessibleDescription('Press and hold to end Brakka’s turn')
    await advance(1000)
    expect(endTurns()).toEqual([])
    expect(toast()).toBeNull()
    pointer(tab, 'pointerup')
    fireEvent.click(tab, { detail: 1 })
    onTab('Character')
  })

  it('ends the turn of the form the character is in, its combatant the seat’s character, from module 0.40.0', async () => {
    const combat = mockTurnCombat()
    renderTable(
      view({
        sheet: toTableSheet(shapedSheet(), 'https://my-game.forge-vtt.com'),
        // The wolf's token's combatant, as the module says it is the character's.
        combat: {
          ...combat,
          combatants: combat.combatants.map(combatant =>
            combatant.id === 'c-thorin'
              ? { ...combatant, name: 'Thorin (Wolf)' }
              : combatant,
          ),
        },
      }),
    )
    await endByButton()

    expect(endTurns()).toEqual([expect.objectContaining({ turn: THORINS })])
  })

  it('offers no hold on a turn that isn’t the seat’s: no fill, no toast, no description', async () => {
    renderTable(view({ combat: turnOf('c-goblin') }))
    await advance(600)
    const tab = combatTab()
    expect(fillOf(tab)).toBeNull()
    expect(tab).not.toHaveAttribute('aria-describedby')
    expect(tab).not.toHaveClass('touch-manipulation')
    pointer(tab, 'pointerdown')
    await advance(2000)
    expect(toast()).toBeNull()
    expect(endTurns()).toEqual([])
    pointer(tab, 'pointerup')
    fireEvent.click(tab, { detail: 1 })
    onTab('Combat')
  })

  it('ends the turn from the button with no toast until the game has and the page shows it, then offers Undo, focus on the heading', async () => {
    const { poll } = renderTable()
    fireEvent.click(combatTab())
    await advance(600)
    const button = screen.getByRole('button', { name: 'End turn' })
    expect(
      screen.getByText('Or press and hold the Combat tab, from any tab.'),
    ).toBeInTheDocument()
    act(() => button.focus())
    fireEvent.click(button)
    expect(endTurns()).toEqual([expect.objectContaining({ turn: THORINS })])
    expect(
      screen.getByRole('button', { name: 'Ending your turn…' }),
    ).toHaveAttribute('aria-disabled', 'true')
    expect(toast()).toBeNull()
    answers['req-1'] = { status: 'done' }
    await advance(1000)
    expect(toast()).toBeNull()

    poll({ combat: turnOf('c-brakka') })
    expect(toasted()).toEqual(['Your turn has ended.', 'Brakka is acting.'])
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    expect(turnHeading()).toHaveFocus()
    expect(turnHeading()).toHaveTextContent('Brakka’s turn')
    // Brakka's turn is the seat's too: the button stays, focus not on it.
    expect(screen.getByRole('button', { name: 'End turn' })).not.toHaveFocus()
  })

  it('takes the turn back by Undo, saying so until the page shows it again', async () => {
    const { poll } = renderTable()
    fireEvent.click(combatTab())
    await advance(600)
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }))
    answers['req-1'] = { status: 'done' }
    await advance(1000)
    poll({ combat: turnOf('c-brakka') })

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(posted.at(-1)).toEqual({
      url: `${API}/rolls`,
      body: {
        kind: 'undoEndTurn',
        undo: 'req-1',
        turn: { combatId: 'cmbt1', round: 1, combatantId: 'c-brakka' },
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      },
    })
    expect(toasted()).toEqual(['Taking your turn back…'])
    answers['req-2'] = { status: 'done' }
    await advance(1000)
    expect(toasted()).toEqual(['Taking your turn back…'])
    poll({ combat: turnOf('c-thorin') })
    expect(toast()).toBeNull()
    expect(turnHeading()).toHaveTextContent('Your turn')
    await advance(600)
    expect(
      screen.getByRole('button', { name: 'End turn' }),
    ).not.toHaveAttribute('aria-disabled')
  })

  it('says why a hold’s End Turn wasn’t made, in the toast and the panel', async () => {
    renderTable()
    fireEvent.click(combatTab())
    await advance(600)
    answers['req-1'] = { status: 'failed', reason: 'moved' }
    await press(combatTab(), 1000)
    await advance(1000)
    expect(toasted()).toEqual([
      'Your turn wasn’t ended.',
      'The turn had already moved on.',
    ])
    expect(screen.getByRole('alert')).toHaveTextContent(
      /^Your turn wasn’t ended: the turn had already moved on\.$/,
    )
    onTab('Combat')
    await advance(5000)
    expect(toast()).toBeNull()
    // A tab of the bar chosen clears the line.
    fireEvent.click(barTab('Chat'), { detail: 0 })
    fireEvent.click(combatTab(), { detail: 0 })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says in the panel why the button’s End Turn was turned away by the app itself, too many at once', async () => {
    renderTable()
    fireEvent.click(combatTab())
    await advance(600)
    refuse = { status: 429, reason: 'busy' }
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }))
    await advance(0)
    expect(screen.getByRole('alert')).toHaveTextContent(
      /^Your turn wasn’t ended: too many rolls at once\. Try again in a moment\.$/,
    )
    expect(toast()).toBeNull()
    // Offered again, and sent again it clears the line.
    refuse = undefined
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps End turn, doing nothing, and focus on it, once the app says the turn had moved on', async () => {
    renderTable()
    fireEvent.click(combatTab())
    await advance(600)
    refuse = { status: 422, reason: 'moved' }
    const button = screen.getByRole('button', { name: 'End turn' })
    act(() => button.focus())
    fireEvent.click(button)
    await advance(0)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your turn wasn’t ended: the turn had already moved on.',
    )
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveFocus()
    expect(toast()).toBeNull()
  })

  it('offers no End Turn at the Gamemaster’s page: no button, no hint, no hold', async () => {
    renderTable(view({ rollsToTable: ['ability'] }), {
      role: 'gm',
      api: '/api/campaigns/c1/seats/s1',
      key: 's1',
    })
    fireEvent.click(combatTab())
    await advance(600)
    expect(turnHeading()).toHaveTextContent('Your turn')
    expect(screen.queryByRole('button', { name: /End turn/ })).toBeNull()
    expect(
      screen.queryByText('Or press and hold the Combat tab, from any tab.'),
    ).toBeNull()
    fireEvent.click(barTab('Character'))
    const tab = combatTab()
    expect(fillOf(tab)).toBeNull()
    expect(tab).not.toHaveAttribute('aria-describedby')
    pointer(tab, 'pointerdown')
    await advance(2000)
    expect(toast()).toBeNull()
    expect(posted).toEqual([])
  })

  it('leaves the page’s one status its live state while the toast shows', async () => {
    renderTable()
    await advance(600)
    pointer(combatTab(), 'pointerdown')
    await advance(600)
    expect(toast()).not.toBeNull()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('Live')
  })

  it('leaves a quick tap after a cancelled hold to the tab, with no click between them', async () => {
    renderTable()
    await advance(600)
    const tab = combatTab()
    pointer(tab, 'pointerdown')
    await advance(400)
    // Let go late: cancelled, and no click comes, as after a long touch.
    pointer(tab, 'pointerup')
    await press(tab, 150)
    onTab('Combat')
  })

  it('hands focus to the turn’s heading as Undo goes from under it, on Combat', async () => {
    const { poll } = renderTable()
    await endByButton()
    answers['req-1'] = { status: 'done' }
    await advance(1000)
    poll({ combat: turnOf('c-brakka') })
    undoByKeyboard()
    expect(toasted()).toEqual(['Taking your turn back…'])
    expect(turnHeading()).toHaveFocus()
  })

  it('hands focus to the bar’s Combat tab as Undo goes from under it, the page moved to Character meanwhile', async () => {
    const { poll } = renderTable()
    await endByButton()
    fireEvent.click(barTab('Character'))
    answers['req-1'] = { status: 'done' }
    await advance(1000)
    poll({ combat: turnOf('c-brakka') })
    undoByKeyboard()
    expect(combatTab()).toHaveFocus()
    onTab('Character')
  })

  it('hands focus to the column’s Combat tab as Undo goes from under it, the column moved to Chat meanwhile, on a wide screen', async () => {
    wideScreen()
    const { poll } = renderTable()
    await advance(600)
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }))
    fireEvent.click(columnTab('Chat'))
    answers['req-1'] = { status: 'done' }
    await advance(1000)
    poll({ combat: turnOf('c-brakka') })
    undoByKeyboard()
    expect(columnTab(/^Combat/)).toHaveFocus()
    onColumn('Chat')
  })

  it('says in the toast why the button’s End Turn wasn’t made where the page has moved to Character meanwhile', async () => {
    renderTable()
    await endByButton()
    fireEvent.click(barTab('Character'))
    answers['req-1'] = { status: 'expired' }
    await advance(1000)
    expect(toasted()).toEqual([
      'Your turn wasn’t ended.',
      'Your Gamemaster’s game didn’t pick it up.',
    ])
  })

  it('says in the toast why the button’s End Turn wasn’t made where the column has moved to Chat meanwhile, on a wide screen', async () => {
    wideScreen()
    renderTable()
    await advance(600)
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }))
    fireEvent.click(columnTab('Chat'))
    answers['req-1'] = { status: 'expired' }
    await advance(1000)
    expect(toasted()).toEqual([
      'Your turn wasn’t ended.',
      'Your Gamemaster’s game didn’t pick it up.',
    ])
  })

  it('hands focus to the bar’s Combat tab as the encounter ends with focus on End turn', async () => {
    const { poll } = renderTable()
    fireEvent.click(combatTab())
    await advance(600)
    const button = screen.getByRole('button', { name: 'End turn' })
    act(() => button.focus())
    poll({ combat: undefined })
    await advance(0)
    expect(turnHeading()).toBeNull()
    expect(combatTab()).toHaveFocus()
    await advance(5000)
    expect(combatTab()).toHaveFocus()
  })

  it('hands focus to the column’s Combat tab as the encounter ends with focus on End turn, on a wide screen', async () => {
    wideScreen()
    const { poll } = renderTable()
    await advance(600)
    act(() => screen.getByRole('button', { name: 'End turn' }).focus())
    poll({ combat: undefined })
    await advance(0)
    expect(columnTab(/^Combat/)).toHaveFocus()
  })

  it('keeps the last End Turn’s Undo through a hold of the next turn let go early', async () => {
    const { poll } = renderTable()
    await advance(600)
    await press(combatTab(), 1000)
    answers['req-1'] = { status: 'done' }
    await advance(1000)
    poll({ combat: turnOf('c-brakka') })
    expect(toasted()).toEqual(['Your turn has ended.', 'Brakka is acting.'])
    await advance(600)
    // Brakka's turn is the seat's too: held past the half second, then let go.
    const tab = combatTab()
    pointer(tab, 'pointerdown')
    await advance(600)
    expect(toasted()?.[0]).toBe('Ending Brakka’s turn…')
    await advance(100)
    pointer(tab, 'pointerup')
    fireEvent.click(tab, { detail: 1 })
    expect(toasted()).toEqual(['Your turn has ended.', 'Brakka is acting.'])
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(posted.at(-1)?.body).toEqual(
      expect.objectContaining({ kind: 'undoEndTurn', undo: 'req-1' }),
    )
    expect(endTurns()).toHaveLength(1)
  })

  it('opens no column for a moment once a hold of the column’s Combat tab has ended the turn, on a wide screen', async () => {
    wideScreen()
    renderTable()
    await advance(600)
    const tab = columnTab(/^Combat/)
    onColumn(/^Combat/)
    await press(tab, 1000, { pointerType: 'mouse' })
    expect(endTurns()).toHaveLength(1)
    await advance(300)
    fireEvent.click(columnTab('Chat'), { detail: 1 })
    onColumn(/^Combat/)
    await advance(400)
    fireEvent.click(columnTab('Chat'), { detail: 1 })
    onColumn('Chat')
  })

  it('keeps the column on Chat for a moment once a hold of its Combat tab has ended the turn, on a wide screen', async () => {
    wideScreen()
    renderTable()
    fireEvent.click(columnTab('Chat'))
    await advance(600)
    const tab = columnTab(/^Combat/)
    await press(tab, 1000, { pointerType: 'mouse' })
    expect(endTurns()).toHaveLength(1)
    onColumn('Chat')
    await advance(300)
    fireEvent.click(columnTab(/^Combat/), { detail: 1 })
    onColumn('Chat')
    await advance(400)
    fireEvent.click(columnTab(/^Combat/), { detail: 1 })
    onColumn(/^Combat/)
  })

  it('clears the panel’s line as the bar’s Combat tab is chosen', async () => {
    renderTable()
    await advance(600)
    answers['req-1'] = { status: 'failed', reason: 'moved' }
    await press(combatTab(), 1000)
    await advance(1000)
    onTab('Character')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your turn wasn’t ended: the turn had already moved on.',
    )
    fireEvent.click(combatTab(), { detail: 0 })
    onTab('Combat')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('clears the panel’s line as the bar’s Character tab is chosen', async () => {
    renderTable()
    fireEvent.click(combatTab())
    await advance(600)
    refuse = { status: 429, reason: 'busy' }
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }))
    await advance(0)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(barTab('Character'), { detail: 0 })
    onTab('Character')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
