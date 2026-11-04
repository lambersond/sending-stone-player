/**
 * @jest-environment node
 */
// C5, routes (round 0.43 §3.2): every route method the app serves, as the code answers it today,
// over the real db modules on a small fake database: who may ask (signed out, another's sheet, the
// player's seat, the Gamemaster's), what it answers (status, every header, the body as text) and
// what it asked the database, in order. And each page's title, its not-found and where it sends
// someone signed out. Frozen from the commit that adds it (gate 10): never updated, only its
// imports follow a move.
import { randomUUID } from 'node:crypto'
import * as bridgeCommands from '@/app/api/bridge/commands/route'
import * as gmCompanionRoll from '@/app/api/campaigns/[id]/characters/[actor]/companions/[companion]/rolls/[roll]/route'
import * as gmCompanionRolls from '@/app/api/campaigns/[id]/characters/[actor]/companions/[companion]/rolls/route'
import * as gmCompanionTable from '@/app/api/campaigns/[id]/characters/[actor]/companions/[companion]/table/route'
import * as gmCompanionText from '@/app/api/campaigns/[id]/characters/[actor]/companions/[companion]/texts/[hash]/route'
import * as gmNote from '@/app/api/campaigns/[id]/characters/[actor]/notes/[note]/route'
import * as gmNotesOrder from '@/app/api/campaigns/[id]/characters/[actor]/notes/order/route'
import * as gmNotesPreview from '@/app/api/campaigns/[id]/characters/[actor]/notes/preview/route'
import * as gmNotes from '@/app/api/campaigns/[id]/characters/[actor]/notes/route'
import * as gmRoll from '@/app/api/campaigns/[id]/characters/[actor]/rolls/[roll]/route'
import * as gmRolls from '@/app/api/campaigns/[id]/characters/[actor]/rolls/route'
import * as gmTable from '@/app/api/campaigns/[id]/characters/[actor]/table/route'
import * as gmText from '@/app/api/campaigns/[id]/characters/[actor]/texts/[hash]/route'
import * as gmPartyNote from '@/app/api/campaigns/[id]/party/[group]/notes/[note]/route'
import * as gmPartyNotesOrder from '@/app/api/campaigns/[id]/party/[group]/notes/order/route'
import * as gmPartyNotesPreview from '@/app/api/campaigns/[id]/party/[group]/notes/preview/route'
import * as gmPartyNotes from '@/app/api/campaigns/[id]/party/[group]/notes/route'
import * as gmParty from '@/app/api/campaigns/[id]/party/[group]/route'
import * as gmPartyText from '@/app/api/campaigns/[id]/party/[group]/texts/[hash]/route'
import * as companionRoll from '@/app/api/characters/[id]/companions/[companion]/rolls/[roll]/route'
import * as companionRolls from '@/app/api/characters/[id]/companions/[companion]/rolls/route'
import * as companionTable from '@/app/api/characters/[id]/companions/[companion]/table/route'
import * as companionText from '@/app/api/characters/[id]/companions/[companion]/texts/[hash]/route'
import * as cookbook from '@/app/api/characters/[id]/cookbook/route'
import * as note from '@/app/api/characters/[id]/notes/[note]/route'
import * as notesOrder from '@/app/api/characters/[id]/notes/order/route'
import * as notesPreview from '@/app/api/characters/[id]/notes/preview/route'
import * as notes from '@/app/api/characters/[id]/notes/route'
import * as partyNote from '@/app/api/characters/[id]/party/[group]/notes/[note]/route'
import * as partyNotesOrder from '@/app/api/characters/[id]/party/[group]/notes/order/route'
import * as partyNotesPreview from '@/app/api/characters/[id]/party/[group]/notes/preview/route'
import * as partyNotes from '@/app/api/characters/[id]/party/[group]/notes/route'
import * as party from '@/app/api/characters/[id]/party/[group]/route'
import * as partyText from '@/app/api/characters/[id]/party/[group]/texts/[hash]/route'
import * as roll from '@/app/api/characters/[id]/rolls/[roll]/route'
import * as rolls from '@/app/api/characters/[id]/rolls/route'
import * as table from '@/app/api/characters/[id]/table/route'
import * as text from '@/app/api/characters/[id]/texts/[hash]/route'
import * as dishes from '@/app/api/cookbook/dishes/route'
import * as events from '@/app/api/events/route'
import * as gmCharacterPage from '@/app/campaigns/[id]/characters/[actor]/page'
import * as gmPartyPage from '@/app/campaigns/[id]/party/[group]/page'
import * as campaignsPage from '@/app/campaigns/page'
import * as characterPage from '@/app/characters/[id]/page'
import * as partyPage from '@/app/characters/[id]/party/[group]/page'
import * as charactersPage from '@/app/characters/page'
import * as joinPage from '@/app/join/[code]/page'
import * as rootLayout from '@/app/layout'
import * as loginPage from '@/app/login/page'
import { claimDishes } from '@/db/cookbook'
import { notePlayersSeen, noteTableOpen } from '@/db/roll-requests'
import { hashSecret } from '@/lib/campaign-secret'
import { hashCookbookCode } from '@/lib/cookbook-code'
import { getCurrentUser, requireUser } from '@/lib/session'
import { fireberryBoon } from '@/mocks/cookbook'
import {
  combat,
  fullerSheet,
  GROUP_TEXTS,
  groupEntry,
  groupSheet,
  mockCompanionEntry,
  mockCompanionSheet,
  NOTE_IDS,
  PARTY,
  TEXTS,
} from '@/mocks/sending-stone'
import { atFixedTime, ordered } from '@/utils/test-utils'
import { prismaFake, resetPrisma, routeCall } from '@/utils/test-utils-node'

// The server's random ids, as a fixed sequence, so that what it writes is the same every run.
jest.mock('node:crypto', () => ({
  ...jest.requireActual('node:crypto'),
  randomUUID: jest.fn(),
}))

jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn(),
  requireUser: jest.fn(),
}))

// The browser's sign-in client, which the login page's buttons import: never called here.
jest.mock('@/clients/auth-client', () => ({ authClient: {} }))

// The pages' address, as Next.js reads it from the request.
jest.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ host: 'player.example', 'x-forwarded-proto': 'https' }),
}))

const NOW = '2026-10-04T19:30:00.000Z'
const GAME = 'https://my-game.forge-vtt.com'
const APP = 'https://player.example'
const SECRET = 'a-long-enough-secret'
const COOKBOOK_CODE = 'sscb_AAAAAAAAAAAAAAAAAAAAAbbbbbbbbbbbbbbbbbbbbbb'
const THORIN = {
  id: 'u-thorin',
  name: 'Thorin’s player',
  email: 'thorin@example.com',
}
const GM = { id: 'u-gm', name: 'The Gamemaster', email: 'gm@example.com' }
const STRANGER = {
  id: 'u-stranger',
  name: 'Someone else',
  email: 'x@example.com',
}

let secretHash = ''
beforeAll(async () => {
  secretHash = await hashSecret(SECRET)
})

/** A time this long before now. */
const ago = (ms: number) => new Date(Date.parse(NOW) - ms)

/** The goblin cave, Thorin's note in his book, as held. */
const caveNote = () => ({
  bookId: 'book-1',
  noteId: NOTE_IDS.cave,
  role: 'entry',
  chapterId: null,
  title: 'The goblin cave',
  format: 2,
  body: 'Loot',
  html: '<p>Loot</p>',
  cut: false,
  secret: false,
  authorActorId: PARTY.thorin,
  authorGm: false,
  authorName: 'Thorin',
  createdAt: ago(600_000),
  modifiedAt: ago(600_000),
  modifiedBy: 'Thorin',
  modifiedIn: 'app',
  revision: 'r1',
  place: 0,
})

/**
 * The Lonely Mountain as held: Thorin's player's Character in it, its Gamemaster, Thorin and Vex
 * on its roster, the Company, Thorin's wolf, the game polling for rolls a moment ago, a sheet, a
 * description, a roll on its way, a fight, a message, a journal with a note, and a cookbook link.
 */
const world = () => ({
  user: [THORIN, GM, STRANGER],
  character: [
    {
      id: 'char-1',
      userId: THORIN.id,
      name: 'Thorin',
      gameUrl: GAME,
      campaignTitle: 'The Lonely Mountain',
      campaignId: 'c1',
      actorId: PARTY.thorin,
      chatReadAt: ago(60_000),
      manualDice: false,
      campaign: { title: 'The Lonely Mountain', origin: GAME },
      createdAt: ago(86_400_000),
    },
  ],
  campaign: [
    {
      id: 'c1',
      origin: GAME,
      foundryId: 'camp-a',
      title: 'The Lonely Mountain',
      worldId: 'erebor',
      worldTitle: 'Erebor',
      ownerId: GM.id,
      secretHash,
      inviteCode: 'invite0123456789',
      characters: [
        { id: PARTY.thorin, name: 'Thorin', img: 'worlds/erebor/thorin.webp' },
        { id: PARTY.vex, name: 'Vex', img: 'worlds/erebor/vex.webp' },
      ],
      groups: [groupEntry()],
      companions: [mockCompanionEntry()],
      companionKinds: ['attack', 'damage'],
      companionInitiative: 'own',
      helloSession: 's1',
      version: 7,
      lastEventAt: ago(5000),
      lastSeenAt: ago(5000),
      rollsEnabled: true,
      rollKinds: ['skill', 'save', 'attack', 'damage', 'transfer', 'remove'],
      rollFeatures: ['modifiers', 'prompts', 'gmRolls'],
      transfersEnabled: true,
      transferFeatures: [],
      removalsEnabled: true,
      favoritesEnabled: true,
      notesEnabled: true,
      noteFeatures: ['orders'],
      dishesEnabled: true,
      dishVersions: [1],
      effectsEnabled: true,
      wildShapeEnabled: false,
      bridgePolledAt: ago(5000),
      playersSeenAt: ago(600_000),
      refusedAt: null,
      refusalReason: null,
      refusalStatus: null,
      refusalDetail: null,
      foundry: null,
      createdAt: ago(86_400_000),
      updatedAt: ago(5000),
    },
  ],
  actorSheet: [
    {
      id: 'sheet-1',
      campaignId: 'c1',
      actorId: PARTY.thorin,
      data: fullerSheet(),
      updatedAt: ago(60_000),
    },
  ],
  groupSheet: [
    {
      id: 'group-1',
      campaignId: 'c1',
      actorId: 'company',
      data: groupSheet(),
      updatedAt: ago(60_000),
    },
  ],
  companionSheet: [
    {
      id: 'companion-1',
      campaignId: 'c1',
      key: 'wolfBrakka',
      data: mockCompanionSheet(),
      updatedAt: ago(60_000),
    },
  ],
  sheetText: [
    {
      id: 'text-1',
      campaignId: 'c1',
      hash: TEXTS.fighter,
      html: '<p>A fighter.</p>',
      updatedAt: ago(60_000),
    },
    {
      id: 'text-2',
      campaignId: 'c1',
      hash: GROUP_TEXTS.description,
      html: '<p>The Company’s story.</p>',
      updatedAt: ago(60_000),
    },
  ],
  chatMessage: [
    {
      id: 'msg-row-1',
      campaignId: 'c1',
      messageId: 'm1',
      public: true,
      readers: [],
      byGm: true,
      sentAt: ago(120_000),
      data: {
        id: 'm1',
        type: 'base',
        timestamp: ago(120_000).getTime(),
        speaker: { alias: 'Gamemaster', actorId: null },
        author: { id: 'u-gm', name: 'Gamemaster' },
        character: null,
        title: null,
        flavor: '',
        text: 'Roll initiative!',
        audience: { public: true, characters: [] },
        rolls: [],
        dnd5e: null,
      },
    },
  ],
  combat: [
    {
      id: 'combat-row-1',
      campaignId: 'c1',
      combatId: 'cmbt1',
      updatedAt: ago(60_000),
      data: combat({
        combatants: combat().combatants.map(combatant =>
          combatant.character === 'actor-thorin'
            ? { ...combatant, character: PARTY.thorin }
            : combatant,
        ),
      }),
    },
  ],
  rollRequest: [
    {
      id: 'req-1',
      campaignId: 'c1',
      actorId: PARTY.thorin,
      ofActorId: null,
      characterId: 'char-1',
      userId: THORIN.id,
      role: 'player',
      kind: 'skill',
      label: null,
      payload: {
        kind: 'skill',
        key: 'prc',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [14] }],
      },
      useId: null,
      status: 'done',
      result: {
        id: 'req-1',
        status: 'done',
        reason: null,
        error: null,
        messageId: 'msg-2',
        visible: true,
        rolls: [{ formula: '1d20 + 4', total: 18, dice: [] }],
      },
      session: 's1',
      createdAt: ago(30_000),
      claimedAt: ago(25_000),
      doneAt: ago(20_000),
    },
  ],
  rollPrompt: [],
  journalBook: [
    {
      id: 'book-1',
      campaignId: 'c1',
      kind: 'personal',
      actorId: PARTY.thorin,
      journalId: 'thorinJournal01',
      journalName: "Thorin's notes (Erebor)",
      withheld: null,
      syncedAt: ago(60_000),
      version: 3,
      updatedAt: ago(60_000),
      changedAt: ago(60_000),
      changedBy: 'Thorin',
      changedIn: 'app',
      // Its notes, writes and orders, as the book's relations are read with it.
      notes: [caveNote()],
      writes: [],
      orders: [],
    },
  ],
  journalNote: [caveNote()],
  journalWrite: [],
  journalOrder: [],
  cookbookLink: [
    {
      id: 'link-1',
      campaignId: 'c1',
      characterId: 'char-1',
      actorId: PARTY.thorin,
      codeHash: hashCookbookCode(COOKBOOK_CODE),
      character: { campaignId: 'c1', actorId: PARTY.thorin },
      campaign: { dishesEnabled: true, dishVersions: [1] },
      createdAt: ago(86_400_000),
      revokedAt: null,
    },
  ],
  cookbookDish: [],
})

const signedIn = (user?: object) => {
  jest.mocked(getCurrentUser).mockResolvedValue(user as never)
  jest.mocked(requireUser).mockImplementation(async (returnTo?: string) => {
    if (!user) throw new Error(`To sign in, then back to ${returnTo ?? '/'}`)
    return user as never
  })
}

let fake: ReturnType<typeof prismaFake>

/** The server's randomness as fixed sequences: its UUIDs, and the bytes new notes' ids are of. */
const fixedRandomness = () => {
  let uuids = 0
  jest.mocked(randomUUID).mockImplementation(() => {
    uuids += 1
    return `00000000-0000-4000-8000-${String(uuids).padStart(12, '0')}`
  })
  let bytes = 0
  jest
    .spyOn(globalThis.crypto, 'getRandomValues')
    .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
      const view = array as unknown as Uint8Array
      for (let index = 0; index < view.length; index += 1) {
        view[index] = (bytes * 7 + 3) % 248
        bytes += 1
      }
      return array
    })
}

beforeEach(async () => {
  atFixedTime(NOW)
  fixedRandomness()
  resetPrisma()
  fake = prismaFake(world())
  // The server's own throttles, noted once at this time, so that no test's calls hang on which
  // ran before it: each test then finds the campaign's players, Thorin's table and its dishes'
  // pruning noted a moment ago, as a server running for a while would.
  await notePlayersSeen('c1')
  await noteTableOpen('char-1')
  await claimDishes('c1', 's1')
  jest.clearAllMocks()
  signedIn(THORIN)
})

afterEach(() => {
  jest.useRealTimers()
})

/** A route's answer and what it asked the database, as the snapshot holds it. */
const answered = async (
  call: Promise<Awaited<ReturnType<typeof routeCall>>>,
) => {
  const { status, headers, body } = await call
  return { status, headers, body, calls: ordered(fake.calls) }
}

const json = { 'content-type': 'application/json' }
const PLAYER = `${APP}/api/characters/char-1`
const AT_GM = `${APP}/api/campaigns/c1/characters/${PARTY.thorin}`
const p = { id: 'char-1' }
const g = { id: 'c1', actor: PARTY.thorin }
const perception = {
  kind: 'skill',
  key: 'prc',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [11] }],
}
const rope = { op: 'add', type: 'item', id: 'rope' }

type Rows = ReturnType<typeof world>
type Case = [
  name: string,
  call: () => ReturnType<typeof routeCall>,
  who?: object,
  edit?: (rows: Rows) => void,
]

/** The routes of a character's sheet, at the player's seat and at the Gamemaster's. */
const SEAT_ROUTES: Case[] = [
  [
    'table GET, player',
    () => routeCall(table.GET, { url: `${PLAYER}/table`, params: p }),
  ],
  [
    'table GET, player, unchanged',
    () =>
      routeCall(table.GET, {
        url: `${PLAYER}/table?version=7&live=1&rolls=skill,save,attack,damage,transfer,remove;modifiers,prompts&moves=1&removes=1&favorites=1&effects=1`,
        params: p,
      }),
  ],
  [
    'table GET, player, its sheet known',
    () =>
      routeCall(table.GET, {
        url: `${PLAYER}/table?version=6&sheet=${ago(60_000).toISOString()}`,
        params: p,
      }),
  ],
  [
    'table GET, signed out',
    () => routeCall(table.GET, { url: `${PLAYER}/table`, params: p }),
    {},
  ],
  [
    'table GET, another’s',
    () => routeCall(table.GET, { url: `${PLAYER}/table`, params: p }),
    STRANGER,
  ],
  [
    'table GET, gm',
    () => routeCall(gmTable.GET, { url: `${AT_GM}/table`, params: g }),
    GM,
  ],
  [
    'table GET, gm, unchanged',
    () =>
      routeCall(gmTable.GET, {
        url: `${AT_GM}/table?version=7&live=1&gm=update`,
        params: g,
      }),
    GM,
  ],
  [
    'table GET, gm, not theirs',
    () => routeCall(gmTable.GET, { url: `${AT_GM}/table`, params: g }),
  ],
  [
    'table GET, gm, not in the roster',
    () =>
      routeCall(gmTable.GET, {
        url: `${APP}/api/campaigns/c1/characters/balin/table`,
        params: { id: 'c1', actor: 'balin' },
      }),
    GM,
  ],
  [
    'rolls POST, player',
    () =>
      routeCall(rolls.POST, {
        method: 'POST',
        url: `${PLAYER}/rolls`,
        headers: json,
        body: JSON.stringify(perception),
        params: p,
      }),
  ],
  [
    'rolls POST, player, a favorite',
    () =>
      routeCall(rolls.POST, {
        method: 'POST',
        url: `${PLAYER}/rolls`,
        headers: json,
        body: JSON.stringify({
          ...perception,
          kind: 'favorite',
          key: undefined,
          dice: [],
          favorite: rope,
        }),
        params: p,
      }),
  ],
  [
    'rolls POST, player, a kind the game doesn’t take',
    () =>
      routeCall(rolls.POST, {
        method: 'POST',
        url: `${PLAYER}/rolls`,
        headers: json,
        body: JSON.stringify({ ...perception, kind: 'tool', key: 'thief' }),
        params: p,
      }),
  ],
  [
    'rolls POST, signed out',
    () =>
      routeCall(rolls.POST, {
        method: 'POST',
        url: `${PLAYER}/rolls`,
        headers: json,
        body: '{}',
        params: p,
      }),
    {},
  ],
  [
    'rolls POST, another’s',
    () =>
      routeCall(rolls.POST, {
        method: 'POST',
        url: `${PLAYER}/rolls`,
        headers: json,
        body: '{}',
        params: p,
      }),
    STRANGER,
  ],
  [
    'rolls POST, gm, labelled',
    () =>
      routeCall(gmRolls.POST, {
        method: 'POST',
        url: `${AT_GM}/rolls`,
        headers: json,
        body: JSON.stringify({ ...perception, label: 'Perception check' }),
        params: g,
      }),
    GM,
  ],
  [
    'rolls POST, gm, not theirs',
    () =>
      routeCall(gmRolls.POST, {
        method: 'POST',
        url: `${AT_GM}/rolls`,
        headers: json,
        body: '{}',
        params: g,
      }),
  ],
  [
    'roll GET, player',
    () =>
      routeCall(roll.GET, {
        url: `${PLAYER}/rolls/req-1`,
        params: { ...p, roll: 'req-1' },
      }),
  ],
  [
    'roll GET, player, unknown',
    () =>
      routeCall(roll.GET, {
        url: `${PLAYER}/rolls/req-9`,
        params: { ...p, roll: 'req-9' },
      }),
  ],
  [
    'roll GET, signed out',
    () =>
      routeCall(roll.GET, {
        url: `${PLAYER}/rolls/req-1`,
        params: { ...p, roll: 'req-1' },
      }),
    {},
  ],
  [
    'roll GET, another’s',
    () =>
      routeCall(roll.GET, {
        url: `${PLAYER}/rolls/req-1`,
        params: { ...p, roll: 'req-1' },
      }),
    STRANGER,
  ],
  [
    'roll GET, gm, the player’s',
    () =>
      routeCall(gmRoll.GET, {
        url: `${AT_GM}/rolls/req-1`,
        params: { ...g, roll: 'req-1' },
      }),
    GM,
  ],
  [
    'roll GET, gm, not theirs',
    () =>
      routeCall(gmRoll.GET, {
        url: `${AT_GM}/rolls/req-1`,
        params: { ...g, roll: 'req-1' },
      }),
  ],
  [
    'text GET, player',
    () =>
      routeCall(text.GET, {
        url: `${PLAYER}/texts/${TEXTS.fighter}`,
        params: { ...p, hash: TEXTS.fighter },
      }),
  ],
  [
    'text GET, player, not held',
    () =>
      routeCall(text.GET, {
        url: `${PLAYER}/texts/${TEXTS.rope}`,
        params: { ...p, hash: TEXTS.rope },
      }),
  ],
  [
    'text GET, bad hash',
    () =>
      routeCall(text.GET, {
        url: `${PLAYER}/texts/nothex`,
        params: { ...p, hash: 'nothex' },
      }),
  ],
  [
    'text GET, signed out',
    () =>
      routeCall(text.GET, {
        url: `${PLAYER}/texts/${TEXTS.fighter}`,
        params: { ...p, hash: TEXTS.fighter },
      }),
    {},
  ],
  [
    'text GET, another’s',
    () =>
      routeCall(text.GET, {
        url: `${PLAYER}/texts/${TEXTS.fighter}`,
        params: { ...p, hash: TEXTS.fighter },
      }),
    STRANGER,
  ],
  [
    'text GET, gm',
    () =>
      routeCall(gmText.GET, {
        url: `${AT_GM}/texts/${TEXTS.fighter}`,
        params: { ...g, hash: TEXTS.fighter },
      }),
    GM,
  ],
  [
    'text GET, gm, bad hash',
    () =>
      routeCall(gmText.GET, {
        url: `${AT_GM}/texts/x`,
        params: { ...g, hash: 'x' },
      }),
    GM,
  ],
  [
    'text GET, gm, not theirs',
    () =>
      routeCall(gmText.GET, {
        url: `${AT_GM}/texts/${TEXTS.fighter}`,
        params: { ...g, hash: TEXTS.fighter },
      }),
  ],
]

const COMPANION = `${PLAYER}/companions/wolfBrakka`
const GM_COMPANION = `${AT_GM}/companions/wolfBrakka`
const c = { ...p, companion: 'wolfBrakka' }
const gc = { ...g, companion: 'wolfBrakka' }
const bite = {
  kind: 'attack',
  item: 'wolfBite',
  activity: 'biteAttack',
  target: null,
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [12] }],
}

/** A companion's routes, at its character's player's seat and its Gamemaster's. */
const COMPANION_ROUTES: Case[] = [
  [
    'companion table GET, player',
    () =>
      routeCall(companionTable.GET, { url: `${COMPANION}/table`, params: c }),
  ],
  [
    'companion table GET, player, unchanged',
    () =>
      routeCall(companionTable.GET, {
        url: `${COMPANION}/table?version=7&live=1&rolls=attack,damage`,
        params: c,
      }),
  ],
  [
    'companion table GET, not theirs',
    () =>
      routeCall(companionTable.GET, {
        url: `${PLAYER}/companions/someoneElse/table`,
        params: { ...p, companion: 'someoneElse' },
      }),
  ],
  [
    'companion table GET, signed out',
    () =>
      routeCall(companionTable.GET, { url: `${COMPANION}/table`, params: c }),
    {},
  ],
  [
    'companion table GET, gm',
    () =>
      routeCall(gmCompanionTable.GET, {
        url: `${GM_COMPANION}/table`,
        params: gc,
      }),
    GM,
  ],
  [
    'companion table GET, gm, not theirs',
    () =>
      routeCall(gmCompanionTable.GET, {
        url: `${GM_COMPANION}/table`,
        params: gc,
      }),
  ],
  [
    'companion rolls POST, player',
    () =>
      routeCall(companionRolls.POST, {
        method: 'POST',
        url: `${COMPANION}/rolls`,
        headers: json,
        body: JSON.stringify(bite),
        params: c,
      }),
  ],
  [
    'companion rolls POST, signed out',
    () =>
      routeCall(companionRolls.POST, {
        method: 'POST',
        url: `${COMPANION}/rolls`,
        headers: json,
        body: '{}',
        params: c,
      }),
    {},
  ],
  [
    'companion rolls POST, gm',
    () =>
      routeCall(gmCompanionRolls.POST, {
        method: 'POST',
        url: `${GM_COMPANION}/rolls`,
        headers: json,
        body: JSON.stringify({ ...bite, label: 'Bite attack' }),
        params: gc,
      }),
    GM,
  ],
  [
    'companion rolls POST, gm, not theirs',
    () =>
      routeCall(gmCompanionRolls.POST, {
        method: 'POST',
        url: `${GM_COMPANION}/rolls`,
        headers: json,
        body: '{}',
        params: gc,
      }),
  ],
  [
    'companion roll GET, player',
    () =>
      routeCall(companionRoll.GET, {
        url: `${COMPANION}/rolls/req-1`,
        params: { ...c, roll: 'req-1' },
      }),
  ],
  [
    'companion roll GET, signed out',
    () =>
      routeCall(companionRoll.GET, {
        url: `${COMPANION}/rolls/req-1`,
        params: { ...c, roll: 'req-1' },
      }),
    {},
  ],
  [
    'companion roll GET, gm',
    () =>
      routeCall(gmCompanionRoll.GET, {
        url: `${GM_COMPANION}/rolls/req-1`,
        params: { ...gc, roll: 'req-1' },
      }),
    GM,
  ],
  [
    'companion roll GET, gm, not theirs',
    () =>
      routeCall(gmCompanionRoll.GET, {
        url: `${GM_COMPANION}/rolls/req-1`,
        params: { ...gc, roll: 'req-1' },
      }),
  ],
  [
    'companion text GET, player',
    () =>
      routeCall(companionText.GET, {
        url: `${COMPANION}/texts/${TEXTS.fighter}`,
        params: { ...c, hash: TEXTS.fighter },
      }),
  ],
  [
    'companion text GET, bad hash',
    () =>
      routeCall(companionText.GET, {
        url: `${COMPANION}/texts/x`,
        params: { ...c, hash: 'x' },
      }),
  ],
  [
    'companion text GET, signed out',
    () =>
      routeCall(companionText.GET, {
        url: `${COMPANION}/texts/${TEXTS.fighter}`,
        params: { ...c, hash: TEXTS.fighter },
      }),
    {},
  ],
  [
    'companion text GET, gm',
    () =>
      routeCall(gmCompanionText.GET, {
        url: `${GM_COMPANION}/texts/${TEXTS.fighter}`,
        params: { ...gc, hash: TEXTS.fighter },
      }),
    GM,
  ],
  [
    'companion text GET, gm, not theirs',
    () =>
      routeCall(gmCompanionText.GET, {
        url: `${GM_COMPANION}/texts/${TEXTS.fighter}`,
        params: { ...gc, hash: TEXTS.fighter },
      }),
  ],
]

const PARTY_API = `${PLAYER}/party/company`
const GM_PARTY = `${APP}/api/campaigns/c1/party/company`
const pp = { ...p, group: 'company' }
const gp = { id: 'c1', group: 'company' }

/** A party's routes, at its member's player's seat and its Gamemaster's. */
const PARTY_ROUTES: Case[] = [
  [
    'party GET, player',
    () => routeCall(party.GET, { url: PARTY_API, params: pp }),
  ],
  [
    'party GET, player, unchanged',
    () =>
      routeCall(party.GET, {
        url: `${PARTY_API}?version=7&live=1&moves=1`,
        params: pp,
      }),
  ],
  [
    'party GET, player, a group not theirs',
    () =>
      routeCall(party.GET, {
        url: `${PLAYER}/party/hidden`,
        params: { ...p, group: 'hidden' },
      }),
  ],
  [
    'party GET, signed out',
    () => routeCall(party.GET, { url: PARTY_API, params: pp }),
    {},
  ],
  [
    'party GET, another’s',
    () => routeCall(party.GET, { url: PARTY_API, params: pp }),
    STRANGER,
  ],
  [
    'party GET, gm',
    () => routeCall(gmParty.GET, { url: GM_PARTY, params: gp }),
    GM,
  ],
  [
    'party GET, gm, not theirs',
    () => routeCall(gmParty.GET, { url: GM_PARTY, params: gp }),
  ],
  [
    'party text GET, player',
    () =>
      routeCall(partyText.GET, {
        url: `${PARTY_API}/texts/${GROUP_TEXTS.description}`,
        params: { ...pp, hash: GROUP_TEXTS.description },
      }),
  ],
  [
    'party text GET, bad hash',
    () =>
      routeCall(partyText.GET, {
        url: `${PARTY_API}/texts/x`,
        params: { ...pp, hash: 'x' },
      }),
  ],
  [
    'party text GET, signed out',
    () =>
      routeCall(partyText.GET, {
        url: `${PARTY_API}/texts/${GROUP_TEXTS.description}`,
        params: { ...pp, hash: GROUP_TEXTS.description },
      }),
    {},
  ],
  [
    'party text GET, gm',
    () =>
      routeCall(gmPartyText.GET, {
        url: `${GM_PARTY}/texts/${GROUP_TEXTS.description}`,
        params: { ...gp, hash: GROUP_TEXTS.description },
      }),
    GM,
  ],
  [
    'party text GET, gm, not theirs',
    () =>
      routeCall(gmPartyText.GET, {
        url: `${GM_PARTY}/texts/${GROUP_TEXTS.description}`,
        params: { ...gp, hash: GROUP_TEXTS.description },
      }),
  ],
]

const entry = { role: 'entry', title: 'Road to Erebor', body: 'On we go.' }
const change = { title: 'The goblin cave', body: 'Loot: 30 gp', stamp: 'n:r1' }

/** The routes of a book of notes, at each of its four seats. */
const NOTE_ROUTES: Case[] = [
  [
    'notes GET, player',
    () => routeCall(notes.GET, { url: `${PLAYER}/notes`, params: p }),
  ],
  [
    'notes GET, player, unchanged',
    () =>
      routeCall(notes.GET, {
        url: `${PLAYER}/notes?version=3&live=1`,
        params: p,
      }),
  ],
  [
    'notes GET, signed out',
    () => routeCall(notes.GET, { url: `${PLAYER}/notes`, params: p }),
    {},
  ],
  [
    'notes GET, another’s',
    () => routeCall(notes.GET, { url: `${PLAYER}/notes`, params: p }),
    STRANGER,
  ],
  [
    'notes POST, player',
    () =>
      routeCall(notes.POST, {
        method: 'POST',
        url: `${PLAYER}/notes`,
        headers: json,
        body: JSON.stringify(entry),
        params: p,
      }),
  ],
  [
    'notes POST, another’s',
    () =>
      routeCall(notes.POST, {
        method: 'POST',
        url: `${PLAYER}/notes`,
        headers: json,
        body: JSON.stringify(entry),
        params: p,
      }),
    STRANGER,
  ],
  [
    'note PATCH, player',
    () =>
      routeCall(note.PATCH, {
        method: 'PATCH',
        url: `${PLAYER}/notes/${NOTE_IDS.cave}`,
        headers: json,
        body: JSON.stringify(change),
        params: { ...p, note: NOTE_IDS.cave },
      }),
  ],
  [
    'note PATCH, player, a resolve',
    () =>
      routeCall(note.PATCH, {
        method: 'PATCH',
        url: `${PLAYER}/notes/${NOTE_IDS.cave}`,
        headers: json,
        body: JSON.stringify({ resolve: 'mine', stamp: 'n:r1' }),
        params: { ...p, note: NOTE_IDS.cave },
      }),
  ],
  [
    'note DELETE, player',
    () =>
      routeCall(note.DELETE, {
        method: 'DELETE',
        url: `${PLAYER}/notes/${NOTE_IDS.cave}?stamp=n:r1`,
        params: { ...p, note: NOTE_IDS.cave },
      }),
  ],
  [
    'note DELETE, signed out',
    () =>
      routeCall(note.DELETE, {
        method: 'DELETE',
        url: `${PLAYER}/notes/${NOTE_IDS.cave}?stamp=n:r1`,
        params: { ...p, note: NOTE_IDS.cave },
      }),
    {},
  ],
  [
    'notes order PUT, player',
    () =>
      routeCall(notesOrder.PUT, {
        method: 'PUT',
        url: `${PLAYER}/notes/order`,
        headers: json,
        body: JSON.stringify({
          chapterId: null,
          ids: [NOTE_IDS.cave],
          stamp: 'o:0',
        }),
        params: p,
      }),
  ],
  [
    'notes order PATCH, player',
    () =>
      routeCall(notesOrder.PATCH, {
        method: 'PATCH',
        url: `${PLAYER}/notes/order`,
        headers: json,
        body: JSON.stringify({
          chapterId: null,
          resolve: 'theirs',
          stamp: 'o:0',
        }),
        params: p,
      }),
  ],
  [
    'notes preview POST, player',
    () =>
      routeCall(notesPreview.POST, {
        method: 'POST',
        url: `${PLAYER}/notes/preview`,
        headers: json,
        body: JSON.stringify({ body: '# Road\n\nOn **we** go.' }),
        params: p,
      }),
  ],
  [
    'notes GET, gm',
    () => routeCall(gmNotes.GET, { url: `${AT_GM}/notes`, params: g }),
    GM,
  ],
  [
    'notes GET, gm, not theirs',
    () => routeCall(gmNotes.GET, { url: `${AT_GM}/notes`, params: g }),
  ],
  [
    'notes POST, gm',
    () =>
      routeCall(gmNotes.POST, {
        method: 'POST',
        url: `${AT_GM}/notes`,
        headers: json,
        body: JSON.stringify(entry),
        params: g,
      }),
    GM,
  ],
  [
    'note PATCH, gm',
    () =>
      routeCall(gmNote.PATCH, {
        method: 'PATCH',
        url: `${AT_GM}/notes/${NOTE_IDS.cave}`,
        headers: json,
        body: JSON.stringify(change),
        params: { ...g, note: NOTE_IDS.cave },
      }),
    GM,
  ],
  [
    'note DELETE, gm',
    () =>
      routeCall(gmNote.DELETE, {
        method: 'DELETE',
        url: `${AT_GM}/notes/${NOTE_IDS.cave}?stamp=n:r1`,
        params: { ...g, note: NOTE_IDS.cave },
      }),
    GM,
  ],
  [
    'notes order PUT, gm',
    () =>
      routeCall(gmNotesOrder.PUT, {
        method: 'PUT',
        url: `${AT_GM}/notes/order`,
        headers: json,
        body: JSON.stringify({
          chapterId: null,
          ids: [NOTE_IDS.cave],
          stamp: 'o:0',
        }),
        params: g,
      }),
    GM,
  ],
  [
    'notes order PATCH, gm',
    () =>
      routeCall(gmNotesOrder.PATCH, {
        method: 'PATCH',
        url: `${AT_GM}/notes/order`,
        headers: json,
        body: JSON.stringify({
          chapterId: null,
          resolve: 'mine',
          stamp: 'o:0',
        }),
        params: g,
      }),
    GM,
  ],
  [
    'notes preview POST, gm',
    () =>
      routeCall(gmNotesPreview.POST, {
        method: 'POST',
        url: `${AT_GM}/notes/preview`,
        headers: json,
        body: JSON.stringify({ body: 'Hi' }),
        params: g,
      }),
    GM,
  ],
  [
    'party notes GET, player',
    () => routeCall(partyNotes.GET, { url: `${PARTY_API}/notes`, params: pp }),
  ],
  [
    'party notes GET, a group not theirs',
    () =>
      routeCall(partyNotes.GET, {
        url: `${PLAYER}/party/hidden/notes`,
        params: { ...p, group: 'hidden' },
      }),
  ],
  [
    'party notes POST, player',
    () =>
      routeCall(partyNotes.POST, {
        method: 'POST',
        url: `${PARTY_API}/notes`,
        headers: json,
        body: JSON.stringify(entry),
        params: pp,
      }),
  ],
  [
    'party note PATCH, player',
    () =>
      routeCall(partyNote.PATCH, {
        method: 'PATCH',
        url: `${PARTY_API}/notes/${NOTE_IDS.cave}`,
        headers: json,
        body: JSON.stringify(change),
        params: { ...pp, note: NOTE_IDS.cave },
      }),
  ],
  [
    'party note DELETE, player',
    () =>
      routeCall(partyNote.DELETE, {
        method: 'DELETE',
        url: `${PARTY_API}/notes/${NOTE_IDS.cave}?stamp=n:r1`,
        params: { ...pp, note: NOTE_IDS.cave },
      }),
  ],
  [
    'party notes order PUT, player',
    () =>
      routeCall(partyNotesOrder.PUT, {
        method: 'PUT',
        url: `${PARTY_API}/notes/order`,
        headers: json,
        body: JSON.stringify({
          chapterId: null,
          ids: [NOTE_IDS.cave],
          stamp: 'o:0',
        }),
        params: pp,
      }),
  ],
  [
    'party notes order PATCH, player',
    () =>
      routeCall(partyNotesOrder.PATCH, {
        method: 'PATCH',
        url: `${PARTY_API}/notes/order`,
        headers: json,
        body: JSON.stringify({
          chapterId: null,
          resolve: 'mine',
          stamp: 'o:0',
        }),
        params: pp,
      }),
  ],
  [
    'party notes preview POST, player',
    () =>
      routeCall(partyNotesPreview.POST, {
        method: 'POST',
        url: `${PARTY_API}/notes/preview`,
        headers: json,
        body: JSON.stringify({ body: 'Hi' }),
        params: pp,
      }),
  ],
  [
    'party notes GET, gm',
    () => routeCall(gmPartyNotes.GET, { url: `${GM_PARTY}/notes`, params: gp }),
    GM,
  ],
  [
    'party notes GET, gm, not theirs',
    () => routeCall(gmPartyNotes.GET, { url: `${GM_PARTY}/notes`, params: gp }),
  ],
  [
    'party notes POST, gm',
    () =>
      routeCall(gmPartyNotes.POST, {
        method: 'POST',
        url: `${GM_PARTY}/notes`,
        headers: json,
        body: JSON.stringify(entry),
        params: gp,
      }),
    GM,
  ],
  [
    'party note PATCH, gm',
    () =>
      routeCall(gmPartyNote.PATCH, {
        method: 'PATCH',
        url: `${GM_PARTY}/notes/${NOTE_IDS.cave}`,
        headers: json,
        body: JSON.stringify(change),
        params: { ...gp, note: NOTE_IDS.cave },
      }),
    GM,
  ],
  [
    'party note DELETE, gm',
    () =>
      routeCall(gmPartyNote.DELETE, {
        method: 'DELETE',
        url: `${GM_PARTY}/notes/${NOTE_IDS.cave}?stamp=n:r1`,
        params: { ...gp, note: NOTE_IDS.cave },
      }),
    GM,
  ],
  [
    'party notes order PUT, gm',
    () =>
      routeCall(gmPartyNotesOrder.PUT, {
        method: 'PUT',
        url: `${GM_PARTY}/notes/order`,
        headers: json,
        body: JSON.stringify({
          chapterId: null,
          ids: [NOTE_IDS.cave],
          stamp: 'o:0',
        }),
        params: gp,
      }),
    GM,
  ],
  [
    'party notes order PATCH, gm',
    () =>
      routeCall(gmPartyNotesOrder.PATCH, {
        method: 'PATCH',
        url: `${GM_PARTY}/notes/order`,
        headers: json,
        body: JSON.stringify({
          chapterId: null,
          resolve: 'theirs',
          stamp: 'o:0',
        }),
        params: gp,
      }),
    GM,
  ],
  [
    'party notes preview POST, gm',
    () =>
      routeCall(gmPartyNotesPreview.POST, {
        method: 'POST',
        url: `${GM_PARTY}/notes/preview`,
        headers: json,
        body: JSON.stringify({ body: 'Hi' }),
        params: gp,
      }),
    GM,
  ],
]

/** The module's own routes: an event's post, and the fetch of commands. */
const forge = (body: unknown, fields: Record<string, string> = {}) => ({
  method: 'POST',
  url: `${APP}/api/events`,
  headers: {
    authorization: `Bearer ${SECRET}`,
    origin: GAME,
    'content-type': 'application/json',
    ...fields,
  },
  body: typeof body === 'string' ? body : JSON.stringify(body),
})
const envelope = (type: string, data: object = {}, fields: object = {}) => ({
  protocol: 2,
  id: 'env-1',
  type,
  world: { id: 'erebor', title: 'Erebor' },
  campaign: { id: 'camp-a', title: 'The Lonely Mountain' },
  session: 's1',
  sequence: 4,
  time: NOW,
  data,
  ...fields,
})
const poll = {
  protocol: 2,
  session: 's1',
  campaign: { id: 'camp-a', title: 'The Lonely Mountain' },
}

const realTimeout =
  jest.requireActual<typeof import('node:timers')>('node:timers').setTimeout

/**
 * A fetch the route holds open, answered as the clock moves on: a second at a time, each once the
 * route is waiting on its next check, so that every check comes at the same time each run (the
 * secret's check runs off the fake clock, on Node's own).
 */
const held = async <T>(running: Promise<T>): Promise<T> => {
  let done = false
  void running.then(
    () => (done = true),
    () => (done = true),
  )
  for (let turn = 0; !done && turn < 2000; turn += 1) {
    await (jest.getTimerCount() === 0
      ? new Promise(resolve => realTimeout(resolve, 5))
      : jest.advanceTimersByTimeAsync(1000))
  }
  return running
}

const MODULE_ROUTES: Case[] = [
  [
    'events OPTIONS',
    () =>
      routeCall(events.OPTIONS as never, {
        method: 'OPTIONS',
        url: `${APP}/api/events`,
        headers: { origin: GAME },
      }),
  ],
  [
    'events OPTIONS, private network',
    () =>
      routeCall(events.OPTIONS as never, {
        method: 'OPTIONS',
        url: `${APP}/api/events`,
        headers: {
          origin: GAME,
          'access-control-request-private-network': 'true',
        },
      }),
  ],
  [
    'events POST, no secret',
    () =>
      routeCall(
        events.POST as never,
        forge(envelope('bridge.heartbeat'), { authorization: '' }),
      ),
  ],
  [
    'events POST, not Forge',
    () =>
      routeCall(
        events.POST as never,
        forge(envelope('bridge.heartbeat'), { origin: 'https://example.com' }),
      ),
  ],
  [
    'events POST, declared too large',
    () =>
      routeCall(
        events.POST as never,
        forge(envelope('bridge.heartbeat'), { 'content-length': '99999999' }),
      ),
  ],
  [
    'events POST, too large',
    () =>
      routeCall(
        events.POST as never,
        forge(envelope('bridge.heartbeat', { pad: 'x'.repeat(16_777_216) })),
      ),
  ],
  [
    'events POST, bad envelope',
    () => routeCall(events.POST as never, forge('{"protocol":2')),
  ],
  [
    'events POST, another protocol',
    () =>
      routeCall(
        events.POST as never,
        forge(envelope('bridge.heartbeat', {}, { protocol: 1 })),
      ),
  ],
  [
    'events POST, ping',
    () =>
      routeCall(
        events.POST as never,
        forge(envelope('bridge.ping', {}, { sequence: null })),
      ),
  ],
  [
    'events POST, ping of an unknown campaign',
    () =>
      routeCall(
        events.POST as never,
        forge(
          envelope(
            'bridge.ping',
            {},
            { sequence: null, campaign: { id: 'camp-z', title: 'Elsewhere' } },
          ),
        ),
      ),
  ],
  [
    'events POST, ping, wrong secret',
    () =>
      routeCall(
        events.POST as never,
        forge(envelope('bridge.ping', {}, { sequence: null }), {
          authorization: 'Bearer not-the-secret-at-all',
        }),
      ),
  ],
  [
    'events POST, no campaign',
    () =>
      routeCall(
        events.POST as never,
        forge(envelope('bridge.heartbeat', {}, { campaign: null })),
      ),
  ],
  [
    'events POST, wrong secret',
    () =>
      routeCall(
        events.POST as never,
        forge(envelope('bridge.heartbeat'), {
          authorization: 'Bearer not-the-secret-at-all',
        }),
      ),
  ],
  [
    'events POST, malformed',
    () =>
      routeCall(
        events.POST as never,
        forge(envelope('chat.message.deleted', { id: 1 })),
      ),
  ],
  [
    'events POST, heartbeat',
    () => routeCall(events.POST as never, forge(envelope('bridge.heartbeat'))),
  ],
  [
    'events POST, heartbeat of another session',
    () =>
      routeCall(
        events.POST as never,
        forge(envelope('bridge.heartbeat', {}, { session: 's2' })),
      ),
  ],
  [
    'events POST, texts',
    () =>
      routeCall(
        events.POST as never,
        forge(
          envelope('character.texts', {
            texts: { [TEXTS.rope]: '<p>Rope.</p>' },
          }),
        ),
      ),
  ],
  [
    'events POST, a message',
    () =>
      routeCall(
        events.POST as never,
        forge(envelope('chat.message.deleted', { id: 'm1' })),
      ),
  ],
  [
    'events POST, a result',
    () =>
      routeCall(
        events.POST as never,
        forge(
          envelope('command.result', {
            id: 'req-1',
            status: 'done',
            visible: true,
            rolls: [],
          }),
        ),
      ),
  ],
  [
    'commands OPTIONS',
    () =>
      routeCall(bridgeCommands.OPTIONS as never, {
        method: 'OPTIONS',
        url: `${APP}/api/bridge/commands`,
        headers: { origin: GAME },
      }),
  ],
  [
    'commands POST, no secret',
    () =>
      routeCall(bridgeCommands.POST as never, {
        ...forge(poll, { authorization: '' }),
        url: `${APP}/api/bridge/commands`,
      }),
  ],
  [
    'commands POST, not Forge',
    () =>
      routeCall(bridgeCommands.POST as never, {
        ...forge(poll, { origin: 'https://example.com' }),
        url: `${APP}/api/bridge/commands`,
      }),
  ],
  [
    'commands POST, too large',
    () =>
      routeCall(bridgeCommands.POST as never, {
        ...forge({ ...poll, pad: 'x'.repeat(5000) }),
        url: `${APP}/api/bridge/commands`,
      }),
  ],
  [
    'commands POST, bad poll',
    () =>
      routeCall(bridgeCommands.POST as never, {
        ...forge({ protocol: 2 }),
        url: `${APP}/api/bridge/commands`,
      }),
  ],
  [
    'commands POST, unknown campaign',
    () =>
      routeCall(bridgeCommands.POST as never, {
        ...forge({ ...poll, campaign: { id: 'camp-z', title: 'Elsewhere' } }),
        url: `${APP}/api/bridge/commands`,
      }),
  ],
  [
    'commands POST, wrong secret',
    () =>
      routeCall(bridgeCommands.POST as never, {
        ...forge(poll, { authorization: 'Bearer not-the-secret-at-all' }),
        url: `${APP}/api/bridge/commands`,
      }),
  ],
  [
    'commands POST, cold',
    () =>
      routeCall(bridgeCommands.POST as never, {
        ...forge(poll),
        url: `${APP}/api/bridge/commands`,
      }),
  ],
  [
    'commands POST, off',
    () =>
      routeCall(bridgeCommands.POST as never, {
        ...forge(poll),
        url: `${APP}/api/bridge/commands`,
      }),
    undefined,
    rows => {
      Object.assign(rows.campaign[0], {
        rollsEnabled: false,
        transfersEnabled: false,
        removalsEnabled: false,
        notesEnabled: false,
        favoritesEnabled: false,
        dishesEnabled: false,
        effectsEnabled: false,
        wildShapeEnabled: false,
      })
    },
  ],
  [
    'commands POST, held, a roll waiting',
    () =>
      routeCall(bridgeCommands.POST as never, {
        ...forge(poll),
        url: `${APP}/api/bridge/commands`,
      }),
    undefined,
    rows => {
      rows.campaign[0].playersSeenAt = ago(5000)
      Object.assign(rows.rollRequest[0], {
        createdAt: ago(5000),
        status: 'pending',
        result: null,
        claimedAt: null,
        session: null,
      })
    },
  ],
  [
    'commands POST, held, nothing comes',
    () =>
      held(
        routeCall(bridgeCommands.POST as never, {
          ...forge(poll),
          url: `${APP}/api/bridge/commands`,
        }),
      ),
    undefined,
    rows => {
      rows.campaign[0].playersSeenAt = ago(5000)
    },
  ],
]

const dish = (body: unknown, fields: Record<string, string> = {}) => ({
  method: 'POST',
  url: `${APP}/api/cookbook/dishes`,
  headers: {
    authorization: `Bearer ${COOKBOOK_CODE}`,
    'content-type': 'application/json',
    ...fields,
  },
  body: typeof body === 'string' ? body : JSON.stringify(body),
})

const COOKBOOK_ROUTES: Case[] = [
  [
    'cookbook GET, player',
    () => routeCall(cookbook.GET, { url: `${PLAYER}/cookbook`, params: p }),
  ],
  [
    'cookbook GET, signed out',
    () => routeCall(cookbook.GET, { url: `${PLAYER}/cookbook`, params: p }),
    {},
  ],
  [
    'cookbook GET, another’s',
    () => routeCall(cookbook.GET, { url: `${PLAYER}/cookbook`, params: p }),
    STRANGER,
  ],
  [
    'dishes POST, a boon',
    () => routeCall(dishes.POST as never, dish(fireberryBoon)),
  ],
  [
    'dishes POST, no code',
    () =>
      routeCall(
        dishes.POST as never,
        dish(fireberryBoon, { authorization: '' }),
      ),
  ],
  [
    'dishes POST, an unknown code',
    () =>
      routeCall(
        dishes.POST as never,
        dish(fireberryBoon, {
          authorization:
            'Bearer sscb_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
        }),
      ),
  ],
  [
    'dishes POST, another version',
    () =>
      routeCall(dishes.POST as never, dish({ ...fireberryBoon, version: 2 })),
  ],
  [
    'dishes POST, malformed',
    () => routeCall(dishes.POST as never, dish('{"version":1')),
  ],
]

describe.each([
  ['a sheet', SEAT_ROUTES],
  ['a companion', COMPANION_ROUTES],
  ['a party', PARTY_ROUTES],
  ['a book of notes', NOTE_ROUTES],
  ['the module', MODULE_ROUTES],
  ['the cookbook', COOKBOOK_ROUTES],
])('the routes of %s', (_, cases) => {
  // A rest parameter, so that jest takes no row's missing field for a `done` callback.
  it.each(cases)('%s', async (...[name, call, who, edit]: Case) => {
    if (edit) {
      const rows = world()
      edit(rows)
      resetPrisma()
      fake = prismaFake(rows)
    }
    if (who) signedIn(Object.keys(who).length > 0 ? who : undefined)
    expect(await answered(call())).toMatchSnapshot(name)
  })
})

/** What a page's function did: what it gave back, or what it threw, by name and message. */
const outcome = async (run: () => unknown) => {
  try {
    const value = await run()
    return { returned: value === undefined ? 'nothing' : typeof value }
  } catch (error) {
    const { digest, message } = error as { digest?: string; message: string }
    return { threw: digest ?? message }
  }
}

/** A page's props, as Next.js hands them: its params, or its search params. */
const params = <T>(value: T) => ({ params: Promise.resolve(value) }) as never
const search = <T>(value: T) =>
  ({ searchParams: Promise.resolve(value) }) as never

describe('the pages', () => {
  it('give these titles and viewport', () => {
    expect({
      layout: rootLayout.metadata,
      viewport: rootLayout.viewport,
      characters: charactersPage.metadata,
      campaigns: campaignsPage.metadata,
      join: joinPage.metadata,
      login: loginPage.metadata,
    }).toMatchSnapshot('static metadata')
  })

  it.each([
    ['the player', THORIN],
    ['the Gamemaster', GM],
    ['someone else', STRANGER],
  ])(
    'name their sheets, and say which are not open here, for %s',
    async (name, who) => {
      signedIn(who)
      const titles = {
        character: await characterPage.generateMetadata(
          params({ id: 'char-1' }),
        ),
        gmCharacter: await gmCharacterPage.generateMetadata(
          params({ id: 'c1', actor: PARTY.thorin }),
        ),
        party: await partyPage.generateMetadata(
          params({ id: 'char-1', group: 'company' }),
        ),
        gmParty: await gmPartyPage.generateMetadata(
          params({ id: 'c1', group: 'company' }),
        ),
      }
      const pages = {
        character: await outcome(() =>
          characterPage.default(params({ id: 'char-1' })),
        ),
        gmCharacter: await outcome(() =>
          gmCharacterPage.default(params({ id: 'c1', actor: PARTY.thorin })),
        ),
        party: await outcome(() =>
          partyPage.default(params({ id: 'char-1', group: 'company' })),
        ),
        gmParty: await outcome(() =>
          gmPartyPage.default(params({ id: 'c1', group: 'company' })),
        ),
      }
      expect({ titles, pages, calls: ordered(fake.calls) }).toMatchSnapshot(
        `pages for ${name}`,
      )
    },
  )

  it('send someone signed out to sign in, and back to the page', async () => {
    signedIn()
    const pages = {
      character: await outcome(() =>
        characterPage.default(params({ id: 'char-1' })),
      ),
      gmCharacter: await outcome(() =>
        gmCharacterPage.default(params({ id: 'c 1', actor: PARTY.thorin })),
      ),
      party: await outcome(() =>
        partyPage.default(params({ id: 'char-1', group: 'the company' })),
      ),
      gmParty: await outcome(() =>
        gmPartyPage.default(params({ id: 'c1', group: 'company' })),
      ),
      characters: await outcome(() => charactersPage.default()),
      campaigns: await outcome(() => campaignsPage.default(search({}))),
      campaign: await outcome(() =>
        campaignsPage.default(search({ campaign: 'c1' })),
      ),
      join: await outcome(() =>
        joinPage.default(params({ code: 'invite0123456789' })),
      ),
    }
    expect({
      pages,
      asked: jest.mocked(requireUser).mock.calls,
    }).toMatchSnapshot('signed out')
  })
})
