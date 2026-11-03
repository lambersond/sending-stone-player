// C3, composition (round 0.43 §3.2): which of the app's area-root components renders which, and
// the props each is handed, read from React's fiber tree as the code composes them today. It reads
// React internals and pins props, not behaviour, so it is retired once the refactor is done
// (commit 26), with C1. Frozen from the commit that adds it (gate 10): never updated, only its
// imports follow a move.
import { isValidElement } from 'react'
import { act, render } from '@testing-library/react'
import { CharacterPane } from '@/components/character-sheet/character-pane'
import { CompanionPane } from '@/components/companions/companion-pane'
import { GameTable } from '@/components/game-table/game-table'
import { JournalCard } from '@/components/notes/journal-card'
import { PartySheet } from '@/components/party-sheet/party-sheet'
import { forgetCookbook } from '@/hooks/use-cookbook-view'
import { forgetNotes } from '@/hooks/use-notes'
import {
  characterSheet,
  chatMessage,
  fullerSheet,
  ironCompany,
  mockCompanionSheet,
  mockCompanionView,
  mockNotesView,
  mockTurnCombat,
} from '@/mocks/sending-stone'
import { TOASTS_KEY } from '@/utils/roll-toasts'
import { toTableMessages, toTableSheet } from '@/utils/table-view'
import { advance, atFixedTime, ordered, respond } from '@/utils/test-utils'
import type { Character, TableSeat } from '@/types/character'
import type { PartyView } from '@/types/party'
import type { TableView } from '@/types/table'

jest.mock(
  '@lambersond/3d-dice-react',
  () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
)

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}))

const GAME = 'https://my-game.forge-vtt.com'
const NOW = '2026-10-04T19:30:00.000Z'

/** The components each area of the app is rooted in: frozen in v0.43. */
const AREA_ROOTS = new Set([
  'GameTable',
  'CharacterPane',
  'CharacterSheet',
  'RollTray',
  'ChatLog',
  'CombatTracker',
  'TurnToast',
  'JournalCard',
  'PartySheet',
  'CompanionPane',
  'CookbookPanel',
  'PageToasts',
])

/** A fiber's few fields read here, cast at each read: React's own type for it is internal. */
const fiberOf = (value: unknown) =>
  value as {
    type?: unknown
    memoizedProps?: Record<string, unknown>
    child?: unknown
    sibling?: unknown
    stateNode?: { current?: unknown } | null
  }

/** A component's name, as React holds its type. */
const nameOf = (fiber: unknown): string | undefined => {
  const { type } = fiberOf(fiber)
  if (typeof type === 'function') return type.name
  return undefined
}

/**
 * A prop as the snapshot holds it: functions as `fn`, elements as `el`, DOM nodes by their tag,
 * `undefined` named so that its key stays, and objects and lists only as deep as `depth`, past
 * which only their keys or size are kept, so that whole sheets don't swamp what crosses between
 * areas.
 */
const shape = (value: unknown, depth = 2): unknown => {
  if (typeof value === 'function') return 'fn'
  if (value === undefined) return 'undefined'
  if (isValidElement(value)) return 'el'
  // A DOM node handed down, such as the table's header: by its tag, never its React internals.
  if (value instanceof Node) return `node:${value.nodeName.toLowerCase()}`
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Set || value instanceof Map) {
    return { [value.constructor.name]: shape([...value], depth) }
  }
  if (Array.isArray(value)) {
    if (depth === 0) return `[${value.length}]`
    return value.map(each => shape(each, depth - 1))
  }
  if (typeof value === 'object' && value !== null) {
    if (depth === 0) return `{${Object.keys(value).join(', ')}}`
    return Object.fromEntries(
      Object.entries(value).map(([key, each]) => [key, shape(each, depth - 1)]),
    )
  }
  return value
}

/**
 * The area roots React has rendered into a container, as a tree, read from its fiber tree as it
 * stands now (the root's `current`), portals included: each root's props, and the roots it
 * renders, in render order.
 */
const composition = (container: Element) => {
  const key = Object.keys(container).find(each =>
    each.startsWith('__reactContainer$'),
  )
  const root = fiberOf(
    (container as unknown as Record<string, unknown>)[key ?? ''],
  )
  const top: { name: string; props: unknown; children: unknown[] }[] = []
  const walk = (fiber: unknown, into: unknown[]) => {
    for (let each = fiber; each; each = fiberOf(each).sibling) {
      const name = nameOf(each)
      if (name && AREA_ROOTS.has(name)) {
        const children: unknown[] = []
        into.push({
          name,
          props: shape(fiberOf(each).memoizedProps ?? {}),
          children,
        })
        walk(fiberOf(each).child, children)
      } else {
        walk(fiberOf(each).child, into)
      }
    }
  }
  walk(fiberOf(root.stateNode?.current).child, top)
  return ordered(top)
}

beforeEach(() => {
  atFixedTime(NOW)
  globalThis.localStorage.clear()
  globalThis.sessionStorage.clear()
  globalThis.localStorage.setItem(TOASTS_KEY, 'off')
  forgetNotes()
  forgetCookbook()
  globalThis.fetch = jest.fn(async () => respond(204)) as typeof fetch
})

afterEach(() => {
  jest.useRealTimers()
})

const thorin: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: GAME,
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'thorin',
}

/** Thorin's view, in a fight, with a message, a party and his wolf. */
const view = (fields: Partial<TableView> = {}): TableView => ({
  version: 7,
  live: true,
  campaign: { title: 'The Lonely Mountain', worldTitle: 'Erebor' },
  connected: true,
  messages: toTableMessages(
    [chatMessage()],
    {
      actorId: 'thorin',
      party: new Set(['thorin']),
      portraits: new Map(),
      companions: new Map(),
    } as never,
    new Set(),
  ),
  combat: mockTurnCombat(),
  sheet: toTableSheet(characterSheet(), GAME),
  sheetVersion: '2026-10-04T19:00:00.000Z',
  rollsToTable: ['skill', 'save', 'attack', 'damage', 'endTurn'],
  rollFeatures: ['modifiers'],
  groups: [{ ...ironCompany(), portrait: undefined } as never],
  companions: [{ key: 'wolfBrakka', name: 'Brakka', kind: 'owned' }],
  ...fields,
})

describe('GameTable', () => {
  it.each([
    ['player', undefined, view()],
    [
      'gm',
      {
        role: 'gm',
        api: '/api/campaigns/c1/characters/thorin',
        key: 'gm:c1:thorin',
      } satisfies TableSeat,
      view({ gm: { rolls: 'made' }, companions: undefined }),
    ],
  ])('at the %s seat', async (name, seat, initial) => {
    const { container } = render(
      <GameTable
        character={thorin}
        seat={seat}
        initialView={initial}
        chooseActor={jest.fn()}
        deleteCharacter={jest.fn()}
        markChatRead={jest.fn(async () => {})}
      />,
    )
    await advance(0)
    expect(composition(container)).toMatchSnapshot(`table ${name}`)
  })

  it("at the player seat, its companion's tab shown", async () => {
    globalThis.fetch = jest.fn(async () =>
      respond(
        200,
        mockCompanionView({ sheet: toTableSheet(mockCompanionSheet(), GAME) }),
      ),
    ) as typeof fetch
    const { container, getByRole } = render(
      <GameTable
        character={thorin}
        initialView={view()}
        chooseActor={jest.fn()}
        deleteCharacter={jest.fn()}
        markChatRead={jest.fn(async () => {})}
      />,
    )
    await advance(0)
    act(() => getByRole('tab', { name: /^Brakka/ }).click())
    await advance(0)
    expect(composition(container)).toMatchSnapshot('table companion')
  })
})

describe('the panes and cards', () => {
  it('CharacterPane', async () => {
    const { container } = render(
      <CharacterPane
        characterId='char-1'
        name='Thorin Oakenshield'
        sheet={toTableSheet(fullerSheet(), GAME)}
        combat={mockTurnCombat()}
        rollsToTable={['skill', 'attack', 'damage']}
        rollFeatures={['modifiers']}
      />,
    )
    await advance(0)
    expect(composition(container)).toMatchSnapshot('character pane')
  })

  it('CompanionPane', async () => {
    globalThis.fetch = jest.fn(async () =>
      respond(
        200,
        mockCompanionView({ sheet: toTableSheet(mockCompanionSheet(), GAME) }),
      ),
    ) as typeof fetch
    const { container } = render(
      <CompanionPane
        seat={{ role: 'player', api: '/api/characters/char-1', key: 'char-1' }}
        companion={{ key: 'wolfBrakka', name: 'Brakka', kind: 'owned' }}
        name='Brakka'
        character='Thorin'
        shown
        gone={false}
      />,
    )
    await advance(0)
    expect(composition(container)).toMatchSnapshot('companion pane')
  })

  it('PartySheet', async () => {
    const party: PartyView = {
      version: 5,
      live: true,
      campaign: { title: 'The Lonely Mountain' },
      group: { ...ironCompany(), portrait: undefined } as never,
    }
    const { container } = render(
      <PartySheet
        api='/api/characters/char-1/party/company'
        role='player'
        view={party}
        ownSheetHref='/characters/char-1'
      />,
    )
    await advance(0)
    expect(composition(container)).toMatchSnapshot('party sheet')
  })

  it('JournalCard', async () => {
    globalThis.fetch = jest.fn(async () =>
      respond(200, mockNotesView()),
    ) as typeof fetch
    const { container } = render(
      <JournalCard
        api='/api/characters/char-1'
        role='player'
        kind='personal'
        name='Thorin'
        active
        look='sheet'
      />,
    )
    await advance(0)
    expect(composition(container)).toMatchSnapshot('journal card')
  })
})
