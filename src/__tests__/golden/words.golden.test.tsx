import {
  act,
  cleanup,
  getRoles,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from '@/components/character-sheet/character-pane'
import { RollToasts } from '@/components/character-sheet/roll-toasts'
import {
  briefOf,
  reasons,
  RollTray,
} from '@/components/character-sheet/roll-tray'
import { ChatLog } from '@/components/game-table/chat-log'
import { GameTable } from '@/components/game-table/game-table'
import { ROLL_KINDS } from '@/constants/sending-stone'
import { TableApiContext } from '@/hooks/use-table-api'
import { emptyBook, noteEntry } from '@/mocks/notes-server'
import {
  characterSheet,
  fullerSheet,
  mockNotesView,
  mockTableView,
  mockTurnCombat,
} from '@/mocks/sending-stone'
import { turnRefusedLine, TURN_REFUSALS } from '@/utils/end-turn'
import {
  moveLabel,
  moveReasons,
  moveWords,
  namesWords,
  thingsWords,
} from '@/utils/move-words'
import { fullNoteTime, noteTime } from '@/utils/note-time'
import {
  choicesWords,
  journalCounts,
  journalTitle,
  noteChoiceRefusalWords,
  noteReasonWords,
  noteRefusalWords,
  notesBanner,
  noteStateWords,
  savedWords,
  whoSeesNotes,
  whoSeesShort,
} from '@/utils/note-words'
import {
  movedTo,
  movedWords,
  orderRefusalWords,
  orderSavedWords,
  orderStateWords,
  reorderLine,
} from '@/utils/order-words'
import { slotName, slotWords } from '@/utils/slot-words'
import { askTitle, toTableSheet } from '@/utils/table-view'
import {
  advance,
  atFixedTime,
  normalizeTimes,
  responding,
} from '@/utils/test-utils'
import type { LocalMove, LocalRoll } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { Character, TableSeat } from '@/types/character'
import type {
  NoteBookKind,
  NoteOrderState,
  NoteReason,
  NoteRefusal,
  NoteState,
} from '@/types/notes'
import type {
  EndableTurn,
  TableAsk,
  TableMessage,
  TableView,
} from '@/types/table'

// C4 (round.md §3.2): the words the app shows and the names it gives, per kind and state: toasts,
// the tray, chat lines, the turn toast, subtitles and tab names, and the word utilities' outputs.
// Every text and name passes normalizeTimes. Frozen from the commit that adds it (gate 10).

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
const ROLES = ['player', 'gm'] as const

const GM_SEAT: TableSeat = {
  role: 'gm',
  api: '/api/campaigns/c1/characters/actor-thorin',
  key: 'gm',
}

/** Roles that only group, which name nothing a player hears. */
const SILENT = new Set(['generic', 'presentation', 'none', 'paragraph'])

/** Roles a player acts on, whose name is read even where it's empty. */
const CONTROLS = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'menuitem',
  'menuitemradio',
  'radio',
  'switch',
  'tab',
  'textbox',
])

/**
 * Every role in the container and each one's accessible name, in document order within a role,
 * the roles by name: what a screen reader user is given to find things by.
 */
const named = (container: HTMLElement) => {
  const out: string[] = []
  for (const role of Object.keys(getRoles(container)).toSorted()) {
    if (SILENT.has(role)) continue
    within(container).queryAllByRole(role, {
      name: (name: string) => {
        if (name || CONTROLS.has(role)) {
          out.push(`${role}: ${normalizeTimes(name)}`)
        }
        return true
      },
    })
  }
  return out
}

/** What the container says, in its text, times normalized. */
const said = (element: Element | null | undefined) =>
  normalizeTimes(element?.textContent ?? '')

// ---- rolls, as the page keeps them, of each kind ----

const extra = (text: string, values: number[], value: number) => ({
  text,
  values,
  value,
})

const ROLLS: Record<string, LocalRoll> = {
  save: {
    kind: 'check',
    id: 'save',
    label: 'Strength saving throw',
    total: 17,
    modifier: 7,
    d20s: [10],
    natural: 10,
    extras: [],
    at: 0,
  },
  'check against a DC': {
    kind: 'check',
    id: 'dc',
    label: "Thieves' Tools check",
    total: 12,
    modifier: 5,
    d20s: [7],
    natural: 7,
    extras: [extra('+1d4', [2], 2)],
    dc: 15,
    verdict: 'check',
    at: 0,
  },
  'attack, a natural 20 with advantage': {
    kind: 'check',
    id: 'crit',
    label: 'Warhammer attack',
    total: 27,
    modifier: 7,
    advantage: 'adv',
    d20s: [20, 4],
    natural: 20,
    extras: [],
    at: 0,
  },
  'attack, a natural 1': {
    kind: 'check',
    id: 'fumble',
    label: 'Handaxe attack',
    total: 8,
    modifier: 7,
    d20s: [1],
    natural: 1,
    extras: [],
    at: 0,
  },
  damage: {
    kind: 'damage',
    id: 'damage',
    label: 'Warhammer damage',
    total: 9,
    critical: false,
    healing: false,
    parts: [
      {
        type: 'Bludgeoning',
        total: 9,
        terms: [extra('1d8', [5], 5), extra('+4', [], 4)],
      },
    ],
    at: 0,
  },
  'critical damage, maximized': {
    kind: 'damage',
    id: 'critical',
    label: 'Warhammer damage',
    total: 20,
    critical: true,
    healing: false,
    maximized: true,
    parts: [
      {
        type: 'Bludgeoning',
        total: 20,
        terms: [extra('2d8', [8, 8], 16), extra('+4', [], 4)],
      },
    ],
    at: 0,
  },
  healing: {
    kind: 'damage',
    id: 'healing',
    label: 'Second Wind healing',
    total: 11,
    critical: false,
    healing: true,
    parts: [
      {
        type: 'Healing',
        total: 11,
        terms: [extra('1d10', [6], 6), extra('+5', [], 5)],
      },
    ],
    at: 0,
  },
  'hit die': {
    kind: 'formula',
    id: 'hitDie',
    label: 'Hit die (d10)',
    total: 7,
    healing: true,
    terms: [extra('1d10', [4], 4), extra('+3', [], 3)],
    minimum: 1,
    at: 0,
  },
  recharge: {
    kind: 'formula',
    id: 'recharge',
    label: 'Fire Breath recharge',
    total: 5,
    healing: false,
    terms: [extra('1d6', [5], 5)],
    recharge: { name: 'Fire Breath' },
    at: 0,
  },
  'spell cast': {
    kind: 'use',
    id: 'spell',
    label: 'Bless',
    spell: true,
    at: 0,
  },
  'feature used': {
    kind: 'use',
    id: 'feature',
    label: 'Action Surge',
    spell: false,
    at: 0,
  },
  'charges spent': {
    kind: 'use',
    id: 'spent',
    label: 'Wand of Magic Missiles',
    spell: false,
    spent: 2,
    at: 0,
  },
  'Heroic Inspiration used': {
    kind: 'use',
    id: 'inspiration',
    label: 'Heroic Inspiration',
    spell: false,
    inspiration: 'use',
    at: 0,
  },
  'spell slot spent': {
    kind: 'use',
    id: 'slot',
    label: '1st-level spell slot',
    spell: false,
    slot: 'spend',
    at: 0,
  },
  'favorite added': {
    kind: 'use',
    id: 'favorite',
    label: 'Warhammer',
    spell: false,
    favorite: 'add',
    at: 0,
  },
  'spell prepared': {
    kind: 'use',
    id: 'prepare',
    label: 'Shield',
    spell: true,
    prepare: 'prepare',
    at: 0,
  },
  'effect turned off': {
    kind: 'use',
    id: 'effect',
    label: 'Blessed',
    spell: false,
    effect: 'disable',
    at: 0,
  },
  'Wild Shape taken': {
    kind: 'use',
    id: 'wildShape',
    label: 'Wild Shape',
    spell: false,
    wildShape: { op: 'transform', form: 'Wolf', character: 'Elowen' },
    at: 0,
  },
  'enchantment ended': {
    kind: 'use',
    id: 'ending',
    label: 'Magic Weapon',
    spell: true,
    ending: true,
    at: 0,
  },
  'items given': {
    kind: 'use',
    id: 'give',
    label: 'Give 2 Potion of Healing to Vex',
    spell: false,
    move: { verb: 'give', things: '2 Potion of Healing', other: 'Vex' },
    at: 0,
  },
  'the table asked': {
    kind: 'ask',
    id: 'ask',
    label: 'DC 15 Dexterity saving throw',
    at: 0,
  },
  'the Gamemaster’s check': {
    kind: 'gm',
    id: 'gm:check',
    label: 'Perception check',
    rolled: 'skill',
    at: 0,
  },
  'the Gamemaster’s damage': {
    kind: 'gm',
    id: 'gm:damage',
    label: 'Warhammer damage',
    rolled: 'damage',
    at: 0,
  },
  'the Gamemaster’s healing': {
    kind: 'gm',
    id: 'gm:healing',
    label: 'Cure Wounds healing',
    rolled: 'damage',
    healing: true,
    at: 0,
  },
  'the Gamemaster’s slot': {
    kind: 'gm',
    id: 'gm:slot',
    label: '1st-level spell slot',
    rolled: 'spellSlot',
    slotOp: 'restore',
    at: 0,
  },
}

/** Each way to the game a roll may be on, or have come to. */
const STATES: Record<string, TableRollState | undefined> = {
  'never sent': undefined,
  sending: { status: 'sending' },
  rolling: { status: 'rolling' },
  'made, seen': { status: 'done', visible: true, total: 18 },
  'made, blind': { status: 'done', visible: false },
  'made, saved': {
    status: 'done',
    visible: true,
    total: 18,
    outcome: 'success',
  },
  'made, a hit': {
    status: 'done',
    visible: true,
    total: 19,
    attack: { critical: false, fumble: false, outcome: 'hit' },
  },
  'made, a miss with damage on one': {
    status: 'done',
    visible: true,
    total: 9,
    attack: { critical: false, fumble: false, outcome: 'miss' },
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
  'not made: off': { status: 'failed', reason: 'off' },
  'not made: reaction': { status: 'failed', reason: 'reaction' },
  'not made: a reason it has no words for': {
    status: 'failed',
    reason: 'not-a-reason',
  },
  'not made, in part': {
    status: 'failed',
    reason: 'no-hit-dice',
    together: { count: 3, made: 1 },
  },
  expired: { status: 'expired' },
  lost: { status: 'lost' },
  refused: { status: 'refused', reason: 'network' },
}

const STATE_NAMES = Object.keys(STATES)

/** A roll's way, by its id, or none. */
const waysOf = (roll: LocalRoll, state?: TableRollState) =>
  new Map(state ? [[roll.id, state]] : [])

/** At the Gamemaster's seat, or the player's. */
const seated = (role: 'player' | 'gm', node: React.ReactNode) =>
  role === 'gm' ? (
    <TableApiContext.Provider value={GM_SEAT}>{node}</TableApiContext.Provider>
  ) : (
    node
  )

// ---- chat messages, as the server shows them ----

const message = (fields: Partial<TableMessage>): TableMessage => ({
  id: 'm1',
  sentAt: '2026-10-04T19:02:00.000Z',
  speaker: 'Gamemaster',
  side: 'other',
  whisper: false,
  kind: 'text',
  rolls: [],
  targets: [],
  ...fields,
})

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
  text: message({ text: 'Roll initiative!' }),
  'text with a label': message({
    label: 'Ominous rumbling',
    text: 'The cave shakes.',
  }),
  'a card': message({
    kind: 'card',
    label: 'Second Wind',
    text: 'Regain 1d10 + 5 hit points.',
  }),
  'a card with its action': message({
    kind: 'card',
    label: 'Fireball',
    action: 'spell',
    text: 'Each creature in a 20-foot radius…',
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
    speaker: 'Thorin',
    side: 'me',
    label: 'Warhammer damage',
    damage: [damage(1)],
  }),
  'damage of three rolls': message({
    kind: 'roll',
    speaker: 'Thorin',
    side: 'me',
    label: 'Scorching Ray damage',
    damage: [damage(3)],
  }),
  'an ask for a save': message({
    speaker: 'Thorin',
    side: 'me',
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
    text: 'Concentration check',
    ask: { type: 'concentration', abilities: ['con'], label: 'Bless' },
  }),
  'an ask for a check': message({
    label: 'Roll Request: Cloak of Climbing',
    text: 'Strength (Athletics) check',
    ask: {
      type: 'check',
      checks: [{ type: 'skill', ability: 'str', skill: 'ath' }],
      dc: 12,
      label: 'Cloak of Climbing',
    },
  }),
  'a whisper': message({ whisper: true, text: 'You hear a click.' }),
  'one of mine': message({
    speaker: 'Thorin',
    side: 'me',
    text: 'I check the door.',
  }),
  'by the Gamemaster as a character': message({
    kind: 'roll',
    speaker: 'Thorin',
    side: 'me',
    label: 'Perception check',
    rolls: [d20],
    byGm: true,
  }),
  'damage on its own': message({
    kind: 'roll',
    speaker: 'Thorin',
    side: 'me',
    label: 'Warhammer damage',
    damage: [damage(1)],
    alone: true,
  }),
  'a party member’s': message({
    speaker: 'Vex',
    side: 'party',
    text: 'Behind you!',
  }),
}

// ---- a character's table, as GameTable shows it ----

const thorin: Character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: GAME,
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

const tableView = (fields: Partial<TableView> = {}): TableView =>
  mockTableView({
    sheet: toTableSheet(characterSheet(), GAME),
    sheetVersion: 'v1',
    messages: [
      message({ id: 'm1', sentAt: '2026-10-04T19:00:00.000Z' }),
      message({ id: 'm2', sentAt: '2026-10-04T19:01:00.000Z' }),
      message({ id: 'm3', sentAt: '2026-10-04T19:02:00.000Z' }),
    ],
    ...fields,
  })

const renderTable = (view: TableView, seat?: TableSeat) =>
  render(
    <GameTable
      character={thorin}
      initialView={view}
      seat={seat}
      chooseActor={async () => ({})}
      deleteCharacter={async () => {}}
      markChatRead={async () => {}}
    />,
  )

/** The page's heading line and the line under it, and the tabs' names. */
const tableWords = () => {
  const heading = screen.getByRole('heading', { level: 1 })
  return {
    heading: said(heading),
    subtitle: said(heading.parentElement?.nextElementSibling),
    tabs: named(document.body).filter(line =>
      /^button: (Character|Combat|Chat)/.test(line),
    ),
  }
}

const user = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

/** What the turn's toast and its panel say now, and what they name. */
const turnWords = () => {
  const toast = document.querySelector<HTMLElement>('[data-turn-toast]')
  const panel = document
    .querySelector('#turn-heading')
    ?.closest<HTMLElement>('section')
  return {
    toast: toast
      ? {
          card: toast.dataset.turnToast,
          text: said(toast),
          names: named(toast),
        }
      : 'none',
    panel: panel ? said(panel) : 'none',
  }
}

describe('golden C4: words', () => {
  beforeEach(() => {
    atFixedTime(NOW)
    localStorage.clear()
    sessionStorage.clear()
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
  })

  afterEach(() => {
    cleanup()
    jest.useRealTimers()
  })

  describe('why a roll was not made, per seat', () => {
    it.each(ROLES)('reasons(%s)', role => {
      expect(reasons(role)).toMatchSnapshot(`reasons ${role}`)
    })
  })

  describe('a roll in brief, per kind, state and seat (briefOf)', () => {
    it.each(Object.keys(ROLLS))('%s', name => {
      const roll = ROLLS[name]
      const briefs = Object.fromEntries(
        ROLES.flatMap(role =>
          STATE_NAMES.map(state => [
            `${role} · ${state}`,
            briefOf(roll, STATES[state], role),
          ]),
        ),
      )
      expect(briefs).toMatchSnapshot(name)
    })
  })

  describe('a roll’s toast and its tray row, per kind, state and seat', () => {
    it.each(Object.keys(ROLLS))('%s', name => {
      const roll = ROLLS[name]
      const shown: Record<string, unknown> = {}
      for (const role of ROLES) {
        for (const state of STATE_NAMES) {
          const ways = waysOf(roll, STATES[state])
          const toast = render(
            seated(role, <RollToasts rolls={[roll]} states={ways} on />),
          )
          const log = screen.queryByRole('log', { name: 'Roll results' })
          shown[`${role} · ${state} · toast`] = log
            ? { text: said(log), names: named(log) }
            : 'none'
          toast.unmount()
          const tray = render(
            seated(
              role,
              <RollTray
                rolls={[roll]}
                rolling={false}
                table={{ states: ways, available: true, sending: true }}
              />,
            ),
          )
          shown[`${role} · ${state} · tray`] = {
            text: said(tray.container),
            names: named(tray.container),
          }
          tray.unmount()
        }
      }
      expect(shown).toMatchSnapshot(name)
    })
  })

  describe('chat lines, per kind and variant, at each seat', () => {
    it.each(Object.keys(MESSAGES))('%s', name => {
      const lines: Record<string, unknown> = {}
      for (const role of ROLES) {
        const { container, unmount } = render(
          seated(role, <ChatLog messages={[MESSAGES[name]]} />),
        )
        lines[role] = { text: said(container), names: named(container) }
        unmount()
      }
      expect(lines).toMatchSnapshot(name)
    })

    it('an empty chat', () => {
      const { container } = render(<ChatLog messages={[]} />)
      expect({
        text: said(container),
        names: named(container),
      }).toMatchSnapshot('empty')
    })
  })

  describe('the table’s heading, subtitle and tab names', () => {
    const CASES: Record<string, Partial<TableView>> = {
      'no combat, 3 messages, none read yet': { combat: undefined },
      'my turn, 2 unread': {
        combat: mockTurnCombat(),
        chatReadAt: '2026-10-04T19:00:00.000Z',
      },
      'another’s turn, 1 unread': {
        combat: mockTurnCombat({ currentId: 'c-goblin' }),
        chatReadAt: '2026-10-04T19:01:00.000Z',
      },
      'a combat not started': {
        combat: mockTurnCombat({ started: false, round: 0 }),
      },
      'no messages': { messages: [], combat: undefined },
      'not connected': { connected: false, combat: undefined },
      offline: { live: false, combat: undefined },
    }

    it.each(Object.keys(CASES))('%s, on each tab', async name => {
      renderTable(tableView(CASES[name]))
      const words: Record<string, unknown> = { Character: tableWords() }
      for (const tab of ['Combat', 'Chat']) {
        await user().click(
          screen.getByRole('button', { name: new RegExp(`^${tab}`) }),
        )
        words[tab] = tableWords()
      }
      expect(words).toMatchSnapshot(name)
    })

    it('at the Gamemaster’s seat', () => {
      renderTable(tableView({ combat: mockTurnCombat() }), GM_SEAT)
      expect(tableWords()).toMatchSnapshot('gm')
    })
  })

  describe('the turn toast and the turn panel, per card and seat', () => {
    const BRAKKA = { key: 'wolfBrakka', name: 'Brakka', kind: 'owned' as const }

    /**
     * The routes for End Turn: each roll posted is taken as `req-<n>` and answered by id as
     * `answers` says at the time, else still on its way; the table's poll answers with `next`
     * once it's set, else never; a companion's view is Brakka's.
     */
    const routes = (answers: Record<string, Record<string, unknown>>) => {
      const state: { next?: TableView; posts: number } = { posts: 0 }
      globalThis.fetch = jest.fn((url: string, init?: RequestInit) => {
        if (url.includes('/companions/')) {
          return responding(200, {
            version: 7,
            live: true,
            connected: true,
            companion: BRAKKA,
            rollsToTable: [...ROLL_KINDS],
            rollFeatures: [],
            initiative: { mode: 'own' },
          })
        }
        if (init?.method === 'POST') {
          state.posts += 1
          return responding(202, { id: `req-${state.posts}` })
        }
        if (url.includes('/rolls/')) {
          const id = url.split('/').at(-1) ?? ''
          return responding(200, { id, status: 'sending', ...answers[id] })
        }
        if (url.includes('/table?') && state.next) {
          return responding(200, state.next)
        }
        return new Promise<Response>(() => {})
      }) as typeof fetch
      return state
    }

    /**
     * Each End Turn: the game's answers by id, the view and seat, the combat the poll shows after
     * it is made, and whether Undo is pressed then.
     */
    const SCENARIOS: Record<
      string,
      {
        answers: Record<string, Record<string, unknown>>
        view?: Partial<TableView>
        seat?: TableSeat
        after?: string
        undo?: boolean
      }
    > = {
      'my turn ended, then taken back': {
        answers: { 'req-1': { status: 'done' }, 'req-2': { status: 'done' } },
        after: 'c-brakka',
        undo: true,
      },
      'my turn ended, Undo refused': {
        answers: {
          'req-1': { status: 'done' },
          'req-2': { status: 'failed', reason: 'not-undoable' },
        },
        after: 'c-brakka',
        undo: true,
      },
      ...Object.fromEntries(
        Object.keys(TURN_REFUSALS).map(key => [
          `my turn not ended: ${key}`,
          { answers: { 'req-1': { status: 'failed', reason: key } } },
        ]),
      ),
      'my turn, no answer': { answers: { 'req-1': { status: 'lost' } } },
      'a companion’s turn ended': {
        answers: { 'req-1': { status: 'done' } },
        view: {
          companions: [BRAKKA],
          combat: mockTurnCombat({ currentId: 'c-brakka' }),
        },
        after: 'c-goblin',
      },
      'my turn ended, at the Gamemaster’s seat': {
        answers: { 'req-1': { status: 'done' } },
        seat: GM_SEAT,
        after: 'c-brakka',
      },
    }

    it.each(Object.keys(SCENARIOS))('%s', async name => {
      const { answers, view = {}, seat, after, undo } = SCENARIOS[name]
      const server = routes(answers)
      const start = tableView({
        combat: mockTurnCombat(),
        rollsToTable: [...ROLL_KINDS],
        rollFeatures: [],
        ...view,
      })
      renderTable(start, seat)
      const steps: [string, unknown][] = []
      await user().click(screen.getByRole('button', { name: /^Combat/ }))
      // End Turn is offered once the turn has been on the page a moment.
      await advance(600)
      steps.push(['offered', turnWords()])
      await user().click(screen.getByRole('button', { name: 'End turn' }))
      steps.push(['sent', turnWords()])
      await advance(1000)
      steps.push(['answered', turnWords()])
      if (after) {
        server.next = {
          ...start,
          version: 8,
          combat: mockTurnCombat({ currentId: after }),
        }
        await advance(3000)
        steps.push(['moved', turnWords()])
      }
      if (undo) {
        await user().click(screen.getByRole('button', { name: 'Undo' }))
        steps.push(['undoing', turnWords()])
        await advance(1000)
        steps.push(['undo answered', turnWords()])
        server.next = { ...start, version: 9 }
        await advance(3000)
        steps.push(['moved back', turnWords()])
      }
      await advance(8000)
      steps.push(['later', turnWords()])
      expect(steps).toMatchSnapshot(name)
    })
  })

  describe('word utilities', () => {
    const own: EndableTurn = {
      combatId: 'cmbt1',
      round: 1,
      combatantId: 'c-thorin',
    }
    const brakka: EndableTurn = {
      ...own,
      combatantId: 'c-brakka',
      companion: { key: 'wolfBrakka', name: 'Brakka' },
    }

    it('turnRefusedLine per refusal key, own and a companion’s, again or not', () => {
      const lines = Object.fromEntries(
        [...Object.keys(TURN_REFUSALS), 'none'].flatMap(key =>
          [own, brakka].flatMap(turn =>
            [false, true].map(again => [
              `${key} · ${turn.companion?.name ?? 'own'} · again ${again}`,
              turnRefusedLine(turn, TURN_REFUSALS[key], again),
            ]),
          ),
        ),
      )
      expect(lines).toMatchSnapshot('turnRefusedLine')
    })

    const MOVES: LocalMove[] = [
      { verb: 'give', things: '2 Potion of Healing', other: 'Vex' },
      { verb: 'take', things: '1 Rope and 50 gp', other: 'The Iron Company' },
      {
        verb: 'send',
        things: '1 Rope',
        other: 'Vex',
        source: 'The Iron Company',
        mover: 'Thorin',
      },
      {
        verb: 'distribute',
        things: '4 pp',
        other: 'The Iron Company',
        among: 'Bram, Lia, Thorin, and Vex',
        each: '1 pp',
      },
      { verb: 'remove', things: '1 Rope', other: '' },
    ]

    const MOVE_STATES: Record<
      string,
      Pick<TableRollState, 'status' | 'reason' | 'transfer' | 'removed'>
    > = {
      sending: { status: 'sending' },
      rolling: { status: 'rolling' },
      done: { status: 'done' },
      'failed short': { status: 'failed', reason: 'short' },
      'failed busy': { status: 'failed', reason: 'busy' },
      'failed shaped': { status: 'failed', reason: 'shaped' },
      'failed with a roll’s reason': { status: 'failed', reason: 'reaction' },
      'failed, nothing said': { status: 'failed' },
      'failed, partly': {
        status: 'failed',
        reason: 'gone',
        transfer: {
          from: 'groupIronCo01',
          to: 'actorThorin1',
          items: [],
          currency: { gp: 5 },
        },
        removed: { item: 'ropeThorin01', quantity: 1 },
      },
      expired: { status: 'expired' },
      lost: { status: 'lost' },
    }

    it.each(MOVES.map(move => [move.verb, move] as const))(
      'move words: %s',
      (verb, move) => {
        const words = {
          label: moveLabel(move),
          reasons: Object.fromEntries(
            ROLES.map(role => [role, moveReasons(role, verb)]),
          ),
          lines: Object.fromEntries(
            ROLES.flatMap(role =>
              Object.keys(MOVE_STATES).map(state => [
                `${role} · ${state}`,
                moveWords(move, MOVE_STATES[state], role, reasons(role)),
              ]),
            ),
          ),
        }
        expect(words).toMatchSnapshot(verb)
      },
    )

    it('what a move moves, and among whom', () => {
      expect({
        things: [
          thingsWords([{ quantity: 2, name: 'Potion of Healing' }]),
          thingsWords([
            { quantity: 1, name: 'Rope' },
            { coins: 50, abbreviation: 'gp' },
          ]),
          thingsWords([
            { quantity: 2, name: 'Potion of Healing' },
            { quantity: 1, name: 'Rope' },
            { coins: 1500, abbreviation: 'sp' },
          ]),
        ],
        names: [
          namesWords(['Vex']),
          namesWords(['Thorin', 'Vex']),
          namesWords(['Bram', 'Lia', 'Thorin', 'Vex']),
        ],
      }).toMatchSnapshot('move parts')
    })

    it('slot words', () => {
      const pools = [
        { id: 'spell1', level: 1 },
        { id: 'spell2', level: 2 },
        { id: 'spell3', level: 3 },
        { id: 'spell9', level: 9 },
        { id: 'pact', level: 3 },
      ]
      expect(
        pools.map(pool => [slotName(pool), slotWords(pool)]),
      ).toMatchSnapshot('slots')
    })

    it('what the table is asked for (askTitle)', () => {
      const asks: TableAsk[] = [
        { type: 'save', abilities: ['dex'], dc: 15 },
        { type: 'save', abilities: ['str', 'dex'] },
        { type: 'save', abilities: ['str', 'dex', 'con'], dc: 12 },
        { type: 'concentration', abilities: ['con'], dc: 10 },
        { type: 'concentration', abilities: ['wis'] },
        { type: 'concentration', abilities: [] },
        {
          type: 'check',
          checks: [{ type: 'skill', ability: 'str', skill: 'ath' }],
          dc: 15,
        },
        {
          type: 'check',
          checks: [
            { type: 'check', ability: 'int' },
            { type: 'check', ability: 'wis' },
          ],
        },
        {
          type: 'check',
          checks: [
            {
              type: 'tool',
              ability: 'dex',
              tool: 'thief',
              name: "Thieves' Tools",
            },
          ],
          dc: 15,
        },
      ]
      expect(asks.map(ask => askTitle(ask))).toMatchSnapshot('askTitle')
    })

    it('a note’s time, at a fixed now, mid-day', () => {
      const now = Date.parse(NOW)
      const times = [
        '2026-10-04T19:29:30.000Z',
        '2026-10-04T19:29:00.000Z',
        '2026-10-04T19:00:00.000Z',
        '2026-10-04T18:30:00.000Z',
        '2026-10-04T08:00:00.000Z',
        '2026-10-03T22:00:00.000Z',
        '2026-10-03T08:00:00.000Z',
        '2026-10-02T12:00:00.000Z',
        '2026-01-15T12:00:00.000Z',
        '2025-12-31T12:00:00.000Z',
        '2026-10-04T20:00:00.000Z',
        'not a time',
      ]
      expect(
        Object.fromEntries(
          times.map(iso => [
            iso,
            [noteTime(iso, now), normalizeTimes(fullNoteTime(iso))],
          ]),
        ),
      ).toMatchSnapshot('noteTime')
    })

    const NOTE_STATES: NoteState[] = [
      'synced',
      'waiting',
      'saving',
      'conflict',
      'gone',
      'failed',
      'deleting',
    ]
    const NOTE_REASONS: NoteReason[] = [
      'changed',
      'gone',
      'not-yours',
      'not-member',
      'private',
      'unknown',
      'headings',
      'full',
      'invalid',
      'foundry-only',
      'off',
      'error',
    ]
    const NOTE_REFUSALS: (NoteRefusal | 'network')[] = [
      'invalid',
      'not-yours',
      'changed',
      'saving',
      'conflict',
      'chapter',
      'foundry-only',
      'private',
      'unknown',
      'headings',
      'gone',
      'full',
      'busy',
      'network',
    ]
    const KINDS: NoteBookKind[] = ['personal', 'party']
    const ORDER_STATES: NoteOrderState[] = [
      'synced',
      'waiting',
      'saving',
      'conflict',
      'failed',
    ]

    it('note words', () => {
      const books = KINDS.flatMap(kind =>
        ROLES.flatMap(role =>
          ['Thorin', 'The Iron Company'].map(name => ({ kind, role, name })),
        ),
      )
      const waiting = mockNotesView({ orders: false })
      const banners = {
        'not connected': emptyBook({ connected: false }),
        'not enabled': emptyBook({ enabled: false }),
        'an order waiting, no orders taken': {
          ...waiting,
          groups: waiting.groups.map((group, at) =>
            at === 0 ? { ...group, state: 'waiting' as const } : group,
          ),
        },
        'too large, named': emptyBook({
          journal: 'Thorin’s Notes',
          withheld: { reason: 'tooLarge' },
        }),
        'too large, unnamed': emptyBook({ withheld: { reason: 'tooLarge' } }),
        private: emptyBook({ withheld: { reason: 'private' } }),
        none: emptyBook({}),
      }
      expect({
        states: NOTE_STATES.map(state => [state, noteStateWords(state)]),
        reasons: ROLES.map(role =>
          NOTE_REASONS.map(reason => [reason, noteReasonWords(reason, role)]),
        ),
        refusals: NOTE_REFUSALS.map(refusal => [
          refusal,
          noteRefusalWords(refusal, 'Thorin'),
          noteChoiceRefusalWords(refusal, 'Thorin'),
        ]),
        whoSees: books.map(({ kind, role, name }) => [
          kind,
          role,
          name,
          whoSeesNotes({ kind, role, name, journal: undefined }),
          whoSeesNotes({ kind, role, name, journal: 'Thorin’s Notes' }),
          whoSeesShort({ kind, role, name }),
          journalTitle({ kind, role, name }),
        ]),
        banners: Object.fromEntries(
          Object.entries(banners).flatMap(([name, view]) =>
            ROLES.map(role => [
              `${name} · ${role}`,
              notesBanner(view, { role, name: 'Thorin' }) ?? 'none',
            ]),
          ),
        ),
        saved: ROLES.flatMap(role => [
          savedWords(true, role),
          savedWords(false, role),
        ]),
        counts: [
          journalCounts(0, 0),
          journalCounts(1, 0),
          journalCounts(0, 1),
          journalCounts(2, 3),
        ],
        choices: [choicesWords(1), choicesWords(2)],
      }).toMatchSnapshot('note words')
    })

    it('order words', () => {
      expect({
        states: ORDER_STATES.map(state => [state, orderStateWords(state)]),
        saved: ROLES.flatMap(role =>
          [true, false].flatMap(live =>
            [true, false].map(orders => [
              `${role} · live ${live} · orders ${orders}`,
              orderSavedWords({ live, orders, role }),
            ]),
          ),
        ),
        refusals: NOTE_REFUSALS.map(refusal => [
          refusal,
          orderRefusalWords(refusal, 'Thorin'),
        ]),
        moved: [movedWords(noteEntry().chapterId), movedWords('Chapter One')],
        reorder: KINDS.map(kind => reorderLine(kind, 'The Iron Company')),
        movedTo: [movedTo('The Door', 2, 5)],
      }).toMatchSnapshot('order words')
    })
  })

  describe('saving throw titles where the sheet shows them', () => {
    const SAVES =
      '<p><span class="ss-save roll" data-n="0" data-ability="str" data-dc="15">DC 15 Strength</span>, <span class="ss-save roll" data-n="1" data-ability="str|dex">Strength or Dexterity</span>, <span class="ss-save roll" data-n="2" data-ability="str|dex|con" data-dc="12">any of three</span>, <span class="ss-save roll" data-n="3" data-ability="con" data-dc="10" data-type="concentration">Concentration</span>, <span class="ss-save roll" data-n="4" data-ability="wis" data-type="concentration">Wisdom concentration</span>.</p>'

    it('a description’s save links (saveTitle)', async () => {
      globalThis.fetch = jest.fn(() =>
        responding(200, { html: SAVES }),
      ) as typeof fetch
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(fullerSheet(), GAME)}
          rollsToTable={[...ROLL_KINDS]}
        />,
      )
      await user().click(screen.getByRole('tab', { name: 'Features' }))
      const row = screen.getByText('Second Wind')
      await user().click(row)
      // Its toggle told at once: jsdom tells it on a timer outside the fake clock.
      act(() => {
        row.closest('details')?.dispatchEvent(new Event('toggle'))
      })
      await advance(1000)
      // Each link opens its menu, which says what it calls for.
      const menus: Record<string, unknown> = {}
      for (const link of [
        'DC 15 Strength',
        'Strength or Dexterity',
        'any of three',
        'Concentration',
        'Wisdom concentration',
      ]) {
        await user().click(screen.getByRole('button', { name: link }))
        const menu = screen.getByRole('menu')
        menus[link] = { text: said(menu), names: named(menu) }
        await user().keyboard('{Escape}')
      }
      expect(menus).toMatchSnapshot('save links')
    })

    it.each([
      ['a save', { type: 'save', abilities: ['dex'] }],
      ['a save of either', { type: 'save', abilities: ['str', 'dex'] }],
      ['a save of none', { type: 'save', abilities: [] }],
      ['concentration', { type: 'concentration', abilities: ['con'] }],
      [
        'concentration on Wisdom',
        { type: 'concentration', abilities: ['wis'] },
      ],
    ] as const)('the banner’s ask for %s (titleOf)', (name, ask) => {
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(characterSheet(), GAME)}
          rollsToTable={['save']}
          rollFeatures={['prompts']}
          prompts={[
            {
              id: 'msg2-thorin',
              ...ask,
              abilities: [...ask.abilities],
              label: 'Bless',
              expiresAt: new Date(Date.now() + 600_000).toISOString(),
            },
          ]}
        />,
      )
      const banner = screen.getByRole('region', {
        name: 'Your Gamemaster asks',
      })
      expect({ text: said(banner), names: named(banner) }).toMatchSnapshot(name)
    })
  })
})
