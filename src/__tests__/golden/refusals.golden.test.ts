/**
 * @jest-environment node
 */
// C6, refusals (round 0.43 §3.2): what each checked body is refused with, as the code says it
// today: the issues of every schema a body or event passes (code, path, message, in order), the
// text an event's refusal carries, and per route the status and body of each refusal of a body.
// Frozen from the commit that adds it (gate 10): never updated, only its imports follow a move.
import { z } from 'zod'
import * as gmCompanionRolls from '@/app/api/campaigns/[id]/characters/[actor]/companions/[companion]/rolls/route'
import * as gmNotes from '@/app/api/campaigns/[id]/characters/[actor]/notes/route'
import * as gmRolls from '@/app/api/campaigns/[id]/characters/[actor]/rolls/route'
import * as gmPartyNotes from '@/app/api/campaigns/[id]/party/[group]/notes/route'
import * as companionRolls from '@/app/api/characters/[id]/companions/[companion]/rolls/route'
import * as note from '@/app/api/characters/[id]/notes/[note]/route'
import * as notesOrder from '@/app/api/characters/[id]/notes/order/route'
import * as notesPreview from '@/app/api/characters/[id]/notes/preview/route'
import * as notes from '@/app/api/characters/[id]/notes/route'
import * as partyNotes from '@/app/api/characters/[id]/party/[group]/notes/route'
import * as rolls from '@/app/api/characters/[id]/rolls/route'
import * as dishes from '@/app/api/cookbook/dishes/route'
import { MAX_DISH_BYTES } from '@/constants/cookbook'
import { MAX_NOTE_BYTES } from '@/constants/notes'
import { EVENTS } from '@/constants/sending-stone'
import { hashCookbookCode } from '@/lib/cookbook-code'
import { getCurrentUser } from '@/lib/session'
import { fireberryBoon } from '@/mocks/cookbook'
import { iceKnifeAsk } from '@/mocks/dice-asks'
import {
  characterSheet,
  chatMessage,
  combat,
  combatant,
  foundrySettings,
  groupEntry,
  groupSheet,
  mockCompanionEntry,
  mockCompanionPrompt,
  mockCompanionSheet,
  mockJournalTidy,
  mockJournalUpdated,
  NOTE_IDS,
  PARTY,
  roster,
  TEXTS,
} from '@/mocks/sending-stone'
import {
  campaignSetupSchema,
  campaignTitleSchema,
  forgeGameUrlSchema,
  secretSchema,
} from '@/schemas/campaign'
import { cookbookDishSchema } from '@/schemas/cookbook'
import { foundrySettingsSchema } from '@/schemas/foundry-settings'
import {
  noteChangeSchema,
  noteInputSchema,
  noteOrderResolveSchema,
  noteOrderSchema,
  notePreviewSchema,
  noteResolveSchema,
} from '@/schemas/notes'
import { commandsPollSchema, rollRequestSchema } from '@/schemas/roll-request'
import { envelopeSchema, parseGameEvent } from '@/schemas/sending-stone'
import { ordered } from '@/utils/test-utils'
import { prismaFake, resetPrisma, routeCall } from '@/utils/test-utils-node'

jest.mock('@/lib/session', () => ({
  getCurrentUser: jest.fn(),
  requireUser: jest.fn(),
}))

/** A schema's verdict: the parsed value, or each issue's code, path and message in order. */
function verdict(schema: z.ZodType, input: unknown): string {
  const parsed = schema.safeParse(input)
  if (parsed.success) return ordered({ success: true, data: parsed.data })
  return ordered({
    success: false,
    issues: parsed.error.issues.map(({ code, path, message }) => ({
      code,
      path,
      message,
    })),
  })
}

/** What the module's event becomes: the event read, or its refusal's text as the route words it. */
function eventVerdict(type: string, data: unknown): string {
  try {
    return ordered({ event: parseGameEvent(type, data) ?? 'not acted on' })
  } catch (error) {
    if (!(error instanceof z.ZodError)) throw error
    return ordered({ prettified: z.prettifyError(error) })
  }
}

const unrolled = { mode: 0, explicit: false, extras: [], dice: [] }
const d20 = [{ faces: 20, results: [14] }]
const TEXT = '0123456789abcd'
const target = { combatId: 'cmbt1', combatantId: 'goblin' }
const targets = [target, { combatId: 'cmbt1', combatantId: 'hobgoblin' }]
const turn = { combatId: 'cmbt1', round: 2, combatantId: 'cThorin' }

/**
 * Per kind a request it takes, the same with one field wrong, and the field changed: each of the
 * 30 kinds in ROLL_KINDS' order.
 */
const KINDS: [kind: string, valid: object, wrong: object][] = [
  [
    'skill',
    { kind: 'skill', key: 'prc', ...unrolled, dice: d20 },
    { key: 'p r c' },
  ],
  ['tool', { kind: 'tool', key: 'thief', ...unrolled, dice: d20 }, { mode: 2 }],
  [
    'ability',
    { kind: 'ability', key: 'str', ...unrolled, dice: d20 },
    { explicit: 'yes' },
  ],
  [
    'save',
    { kind: 'save', key: 'dex', ...unrolled, dice: d20 },
    { dice: [{ faces: 20, results: [21] }] },
  ],
  ['death', { kind: 'death', ...unrolled, dice: d20 }, { key: 'dex' }],
  [
    'initiative',
    { kind: 'initiative', combatId: 'cmbt1', ...unrolled, dice: d20 },
    { combatId: 'c-1' },
  ],
  [
    'attack',
    {
      kind: 'attack',
      item: 'longsword',
      activity: 'swing',
      target,
      ...unrolled,
      dice: d20,
    },
    { target: { combatId: 'cmbt1', combatantId: 'gob lin' } },
  ],
  [
    'use',
    {
      kind: 'use',
      item: 'fireball',
      activity: 'blast',
      targets,
      slot: 'spell4',
      ...unrolled,
    },
    { slot: 'spell0' },
  ],
  [
    'damage',
    {
      kind: 'damage',
      use: 'req-1',
      ...unrolled,
      dice: [{ faces: 8, results: [5] }],
    },
    { use: 'req 1' },
  ],
  [
    'hitDie',
    {
      kind: 'hitDie',
      denomination: 'd10',
      ...unrolled,
      dice: [{ faces: 10, results: [7] }],
    },
    { denomination: 'd7' },
  ],
  [
    'hitDice',
    {
      kind: 'hitDice',
      hitDice: [{ denomination: 'd10', count: 2 }],
      ...unrolled,
      dice: [{ faces: 10, results: [3, 7] }],
    },
    { hitDice: [{ denomination: 'd10', count: 0 }] },
  ],
  [
    'formula',
    {
      kind: 'formula',
      item: 'lantern',
      activity: 'glow',
      ...unrolled,
      dice: [{ faces: 6, results: [4] }],
    },
    { activity: undefined },
  ],
  ['ask', { kind: 'ask', text: TEXT, link: 3, ...unrolled }, { link: 99 }],
  [
    'textDamage',
    {
      kind: 'textDamage',
      text: TEXT,
      link: 0,
      ...unrolled,
      dice: [{ faces: 6, results: [4] }],
    },
    { text: 'xyz' },
  ],
  [
    'textRoll',
    {
      kind: 'textRoll',
      text: TEXT,
      link: 1,
      ...unrolled,
      dice: [{ faces: 4, results: [2] }],
    },
    { critical: true },
  ],
  [
    'itemDamage',
    {
      kind: 'itemDamage',
      item: 'longsword',
      activity: 'swing',
      ...unrolled,
      dice: [{ faces: 8, results: [5] }],
    },
    { consume: false },
  ],
  [
    'recharge',
    {
      kind: 'recharge',
      item: 'breath',
      ...unrolled,
      dice: [{ faces: 6, results: [5] }],
    },
    { dice: [{ faces: 8, results: [5] }] },
  ],
  [
    'endEnchantment',
    {
      kind: 'endEnchantment',
      enchantment: { item: 'sword', effect: 'magic' },
      ...unrolled,
    },
    { enchantment: { item: 'sword', effect: 'mag ic' } },
  ],
  [
    'endConcentration',
    {
      kind: 'endConcentration',
      concentration: { effect: 'conc1' },
      ...unrolled,
    },
    { concentration: {} },
  ],
  [
    'endTurn',
    { kind: 'endTurn', turn, ...unrolled },
    { turn: { ...turn, round: 0 } },
  ],
  [
    'undoEndTurn',
    { kind: 'undoEndTurn', undo: 'req-7', turn, ...unrolled },
    { undo: 'req 7' },
  ],
  [
    'spend',
    { kind: 'spend', counter: { item: 'wand' }, count: 1, ...unrolled },
    { count: 1000 },
  ],
  [
    'inspiration',
    { kind: 'inspiration', inspiration: 'use', ...unrolled },
    { inspiration: 'lose' },
  ],
  [
    'spellSlot',
    {
      kind: 'spellSlot',
      spellSlot: { op: 'spend', id: 'spell1', from: 2 },
      ...unrolled,
    },
    { spellSlot: { op: 'spend', id: 'spell1', from: 1000 } },
  ],
  [
    'transfer',
    {
      kind: 'transfer',
      transfer: {
        from: 'thorin',
        to: 'company',
        items: [{ id: 'rope', quantity: 1 }],
      },
      ...unrolled,
    },
    {
      transfer: {
        from: 'thorin',
        to: 'thorin',
        items: [{ id: 'rope', quantity: 1 }],
      },
    },
  ],
  [
    'remove',
    {
      kind: 'remove',
      remove: { item: 'rope', quantity: 1, held: 2 },
      ...unrolled,
    },
    { remove: { item: 'rope', quantity: 3, held: 2 } },
  ],
  [
    'favorite',
    {
      kind: 'favorite',
      favorite: { op: 'add', type: 'item', id: 'rope' },
      ...unrolled,
    },
    { favorite: { op: 'add', type: 'spell', id: 'rope' } },
  ],
  [
    'effect',
    { kind: 'effect', effect: { op: 'disable', id: 'bless1' }, ...unrolled },
    { effect: { op: 'toggle', id: 'bless1' } },
  ],
  [
    'wildShape',
    {
      kind: 'wildShape',
      wildShape: { op: 'transform', form: 'Wolf0000000000ab' },
      ...unrolled,
    },
    { wildShape: { op: 'transform', form: 'Wolf' } },
  ],
  [
    'prepare',
    { kind: 'prepare', prepare: { op: 'prepare', id: 'shield' }, ...unrolled },
    { prepare: { op: 'learn', id: 'shield' } },
  ],
]

describe('rollRequestSchema', () => {
  it.each(KINDS)('takes a %s', (kind, valid) => {
    expect(verdict(rollRequestSchema, valid)).toMatchSnapshot(`${kind} taken`)
  })

  it.each(KINDS)('refuses a %s with one field wrong', (kind, valid, wrong) => {
    expect(verdict(rollRequestSchema, { ...valid, ...wrong })).toMatchSnapshot(
      `${kind} wrong`,
    )
  })

  it.each(KINDS)('refuses a %s naming a key it has none of', (kind, valid) => {
    expect(
      verdict(rollRequestSchema, { ...valid, character: 'actor-vex' }),
    ).toMatchSnapshot(`${kind} unknown key`)
  })

  it('refuses dice the roll does not throw, and fields of another kind, in its order', () => {
    expect(
      verdict(rollRequestSchema, {
        kind: 'skill',
        key: 'prc',
        mode: 1,
        explicit: false,
        extras: [{ sign: 1, count: 1, sides: 4 }],
        dice: d20,
        target,
        slot: 'spell1',
        types: ['fire'],
        prompt: 'msg1-bat1',
        text: TEXT,
        effectDice: [{ faces: 4, sign: 1, results: [2] }],
        rerolls: 'kept',
      }),
    ).toMatchSnapshot('many wrong at once')
  })
})

describe('commandsPollSchema', () => {
  it.each([
    [
      'taken',
      {
        protocol: 2,
        session: 's1',
        campaign: { id: 'c1', title: 'The Lonely Mountain' },
      },
    ],
    [
      'of another protocol',
      { protocol: 1, session: 's1', campaign: { id: 'c1', title: 'T' } },
    ],
    ['without a session', { protocol: 2, campaign: { id: 'c1', title: 'T' } }],
    [
      'with a blank title',
      { protocol: 2, session: 's1', campaign: { id: 'c1', title: ' ' } },
    ],
  ])('a poll %s', (name, poll) => {
    expect(verdict(commandsPollSchema, poll)).toMatchSnapshot(`poll ${name}`)
  })
})

describe('envelopeSchema', () => {
  const envelope = {
    protocol: 2,
    id: 'env-1',
    type: 'bridge.heartbeat',
    world: { id: 'erebor', title: 'Erebor' },
    campaign: { id: 'camp-a', title: 'The Lonely Mountain' },
    session: 's1',
    sequence: 3,
    time: '2026-10-04T19:30:00.000Z',
    data: {},
  }
  it.each([
    ['taken', envelope],
    [
      'for no campaign',
      { ...envelope, type: 'bridge.ping', sequence: null, campaign: null },
    ],
    ['without a campaign', { ...envelope, campaign: undefined }],
    [
      'with a blank title',
      { ...envelope, campaign: { id: 'camp-a', title: ' ' } },
    ],
    ['without a type', { ...envelope, type: undefined }],
    ['not an object', 'hello'],
  ])('an envelope %s', (name, input) => {
    expect(verdict(envelopeSchema, input)).toMatchSnapshot(`envelope ${name}`)
  })
})

/** Per type in EVENTS, a payload the app reads and one it refuses. */
const GAME_EVENTS: [type: string, good: unknown, malformed: unknown][] = [
  [
    EVENTS.HELLO,
    {
      module: { id: 'sending-stone', version: '0.42.1' },
      characters: [{ ...roster[0], sheet: null, manualDice: true }],
      combats: [combat()],
      features: {
        rolls: { enabled: true, kinds: ['skill', 'save'], reason: null },
      },
      sheetsApart: true,
    },
    { characters: 'Thorin', combats: [] },
  ],
  [EVENTS.PING, {}, { campaign: 7 }],
  [EVENTS.HEARTBEAT, {}, 'junk'],
  [
    EVENTS.CHARACTER_UPDATED,
    { character: { ...roster[0], sheet: characterSheet() } },
    { character: { id: 'actor-thorin' } },
  ],
  [
    EVENTS.CHARACTER_TEXTS,
    {
      texts: {
        [TEXTS.fighter]: '<p>A fighter.</p>',
        'not-a-hash': '<p>Dropped.</p>',
      },
    },
    { texts: ['<p>A fighter.</p>'] },
  ],
  [EVENTS.CHAT_CREATED, { message: chatMessage() }, { message: { id: 'm1' } }],
  [
    EVENTS.CHAT_UPDATED,
    { message: chatMessage({ text: 'Roll again!' }) },
    { message: null },
  ],
  [EVENTS.CHAT_DELETED, { id: 'm1' }, { id: 1 }],
  [EVENTS.CHAT_CLEARED, {}, 'junk'],
  [
    EVENTS.COMBAT_CREATED,
    { combat: combat({ started: false, round: 0 }) },
    { combat: {} },
  ],
  [EVENTS.COMBAT_STARTED, { combat: combat() }, {}],
  [
    EVENTS.COMBAT_TURN,
    { combat: combat({ combatantId: 'c-thorin' }) },
    { combat: { id: 'cmbt1' } },
  ],
  [
    EVENTS.COMBAT_UPDATED,
    { combat: combat({ round: 2 }) },
    { combat: 'cmbt1' },
  ],
  [EVENTS.COMBAT_ENDED, { combat: combat({ active: false }) }, null],
  [
    EVENTS.COMBATANT_ADDED,
    { combatId: 'cmbt1', combatant: combatant({ id: 'c-wolf', name: 'Wolf' }) },
    { combatId: 'cmbt1' },
  ],
  [
    EVENTS.COMBATANT_UPDATED,
    {
      combatId: 'cmbt1',
      combatant: combatant({ id: 'c-wolf', defeated: true }),
    },
    { combatant: combatant({ id: 'c-wolf' }) },
  ],
  [
    EVENTS.COMBATANT_REMOVED,
    { combatId: 'cmbt1', combatantId: 'c-wolf' },
    { combatId: 'cmbt1' },
  ],
  [
    EVENTS.COMMAND_RESULT,
    {
      id: 'req-1',
      status: 'done',
      reason: null,
      error: null,
      messageId: 'msg-1',
      visible: true,
      rolls: [{ formula: '1d20 + 4', total: 18, dice: [] }],
    },
    { id: 'req-1', status: 'maybe' },
  ],
  [
    EVENTS.PROMPT_OPENED,
    { prompt: mockCompanionPrompt() },
    { prompt: { id: 'p' } },
  ],
  [
    EVENTS.PROMPT_CLOSED,
    { id: 'msg1-bat1', reason: 'answered' },
    { id: 'not a prompt' },
  ],
  [
    EVENTS.GROUP_UPDATED,
    { group: { ...groupEntry(), sheet: groupSheet() } },
    { group: { ...groupEntry(), id: 'not an id!' } },
  ],
  [EVENTS.GROUP_REMOVED, { id: 'company' }, { id: '' }],
  [EVENTS.JOURNAL_UPDATED, mockJournalUpdated('party'), { kind: 'party' }],
  [EVENTS.JOURNAL_TIDY, mockJournalTidy(), { actorId: 'thorin' }],
  [EVENTS.BRIDGE_SETTINGS, { settings: foundrySettings() }, 'junk'],
  [EVENTS.COMPANIONS_LISTED, { companions: [mockCompanionEntry()] }, 'junk'],
  [
    EVENTS.COMPANION_UPDATED,
    { companion: mockCompanionEntry(), sheet: mockCompanionSheet() },
    { companion: { key: 'wolfBrakka' } },
  ],
  [
    EVENTS.DISH_APPLIED,
    {
      dish: 'cmh9q2x7k0003ssdish0001',
      id: 'cmh2k8q0n0001ab12cd34ef56',
      card: 'Xy12ChatCardId00',
      outcome: 'boon',
      characters: [
        {
          actorId: 'actor-thorin',
          name: 'Thorin Oakenshield',
          effectId: 'eff1',
          replaced: null,
          healed: 7,
          exhaustion: 0,
          skipped: [],
        },
      ],
      rolled: [{ type: 'maxHitPoints', value: 7, formula: '3+1d6' }],
      by: { userId: 'u-gm', name: 'Gamemaster' },
      at: { time: '2026-10-04T19:30:00.000Z', worldTime: 86_400 },
    },
    { dish: 'not a dish id!' },
  ],
  [
    EVENTS.DISH_DISMISSED,
    {
      dish: 'cmh9q2x7k0003ssdish0001',
      id: 'cmh2k8q0n0001ab12cd34ef56',
      card: null,
      reason: 'deleted',
      by: null,
      at: null,
    },
    { id: 'cmh2k8q0n0001ab12cd34ef56' },
  ],
  // Added on purpose (item 11): the dice the game rolls later, from module 0.45.0.
  [EVENTS.DICE_ASKED, { ask: iceKnifeAsk() }, { ask: { id: 'ask1' } }],
  [EVENTS.DICE_CLOSED, { id: 'ask1', reason: 'answered' }, { id: 'ask-1' }],
]

describe('parseGameEvent', () => {
  it('has a case for every type in EVENTS', () => {
    expect(GAME_EVENTS.map(([type]) => type)).toEqual(Object.values(EVENTS))
  })

  it.each(GAME_EVENTS)('reads %s', (type, good) => {
    expect(eventVerdict(type, good)).toMatchSnapshot(`${type} read`)
  })

  it.each(GAME_EVENTS)('refuses a malformed %s', (type, _, malformed) => {
    expect(eventVerdict(type, malformed)).toMatchSnapshot(`${type} malformed`)
  })
})

describe('notes schemas', () => {
  const stamp = '2026-10-04T19:00:00.000Z'
  it.each([
    [
      'an entry',
      noteInputSchema,
      { role: 'entry', title: ' Road ', body: 'On.' },
    ],
    [
      'a chapter with a body',
      noteInputSchema,
      { role: 'chapter', title: 'Road', body: 'x', chapterId: null },
    ],
    [
      'a title of two lines',
      noteInputSchema,
      { role: 'entry', title: 'Road\nTo' },
    ],
    [
      'a note naming its id',
      noteInputSchema,
      { role: 'entry', title: 'Road', id: 'n1' },
    ],
    [
      'a change',
      noteChangeSchema,
      { title: 'Road', body: '', chapterId: null, stamp },
    ],
    ['a change without its stamp', noteChangeSchema, { title: '' }],
    ['a resolve', noteResolveSchema, { resolve: 'mine', stamp }],
    ['a resolve of neither', noteResolveSchema, { resolve: 'both', stamp: '' }],
    ['a preview', notePreviewSchema, { body: '# Road' }],
    ['a preview too long', notePreviewSchema, { body: 'x'.repeat(20_001) }],
    [
      'an order',
      noteOrderSchema,
      { chapterId: null, ids: ['aaaaaaaaaaaaaaaa'], stamp },
    ],
    [
      'an order naming one twice',
      noteOrderSchema,
      { chapterId: null, ids: ['aaaaaaaaaaaaaaaa', 'aaaaaaaaaaaaaaaa'], stamp },
    ],
    ['an order of none', noteOrderSchema, { ids: [], stamp }],
    [
      'an order resolve',
      noteOrderResolveSchema,
      { chapterId: null, resolve: 'theirs', stamp },
    ],
    [
      'an order resolve without its chapter',
      noteOrderResolveSchema,
      { resolve: 'theirs', stamp },
    ],
  ] as [string, z.ZodType, unknown][])('%s', (name, schema, input) => {
    expect(verdict(schema, input)).toMatchSnapshot(`notes ${name}`)
  })
})

describe('cookbookDishSchema', () => {
  it.each([
    ['a boon', fireberryBoon],
    ['of another version', { ...fireberryBoon, version: 2 }],
    ['without its dish', { ...fireberryBoon, dish: undefined }],
    ['a boon without its effect', { ...fireberryBoon, effect: null }],
    [
      'a standard dish with an effect',
      {
        ...fireberryBoon,
        dish: { ...fireberryBoon.dish, outcome: 'standard' },
      },
    ],
    [
      'a dish of a bad id',
      { ...fireberryBoon, dish: { ...fireberryBoon.dish, id: 'not an id!' } },
    ],
  ])('%s', (name, input) => {
    expect(verdict(cookbookDishSchema, input)).toMatchSnapshot(`dish ${name}`)
  })
})

describe('campaign schemas', () => {
  it.each([
    [
      'a setup',
      campaignSetupSchema,
      {
        title: ' Erebor ',
        gameUrl: 'my-game.forge-vtt.com',
        secret: 'a-long-enough-secret',
      },
    ],
    ['a setup of nothing', campaignSetupSchema, {}],
    [
      'a setup of blanks',
      campaignSetupSchema,
      { title: ' ', gameUrl: ' ', secret: ' ' },
    ],
    [
      'a setup off the Forge',
      campaignSetupSchema,
      { title: 'Erebor', gameUrl: 'https://example.com', secret: 'short' },
    ],
    ['a title too long', campaignTitleSchema, 'x'.repeat(500)],
    [
      'a Forge address with a port',
      forgeGameUrlSchema,
      'https://my-game.forge-vtt.com:8080',
    ],
    ['the Forge itself', forgeGameUrlSchema, 'www.forge-vtt.com'],
    ['a secret too long', secretSchema, 'x'.repeat(500)],
  ] as [string, z.ZodType, unknown][])('%s', (name, schema, input) => {
    expect(verdict(schema, input)).toMatchSnapshot(`campaign ${name}`)
  })
})

describe('foundrySettingsSchema', () => {
  it.each([
    ['the settings', foundrySettings()],
    ['of another format', { ...foundrySettings(), format: 2 }],
    [
      'with junk lists',
      {
        format: 1,
        modules: 'x',
        sections: [{ id: 1 }],
        results: [{ id: 'r', state: 'odd', text: '' }],
      },
    ],
    ['not an object', 'junk'],
  ])('%s', (name, input) => {
    expect(verdict(foundrySettingsSchema, input)).toMatchSnapshot(
      `settings ${name}`,
    )
  })
})

const APP = 'https://player.example'
const GAME = 'https://my-game.forge-vtt.com'
const COOKBOOK_CODE = 'sscb_AAAAAAAAAAAAAAAAAAAAAbbbbbbbbbbbbbbbbbbbbbb'
const THORIN = { id: 'u-thorin' }
const GM = { id: 'u-gm' }

/** Just what the seats are resolved from: Thorin's player's Character, and his campaign. */
const seats = () => ({
  character: [
    {
      id: 'char-1',
      userId: THORIN.id,
      name: 'Thorin',
      gameUrl: GAME,
      campaignTitle: 'The Lonely Mountain',
      campaignId: 'c1',
      actorId: PARTY.thorin,
      chatReadAt: null,
      manualDice: false,
      campaign: { title: 'The Lonely Mountain', origin: GAME },
    },
  ],
  campaign: [
    {
      id: 'c1',
      origin: GAME,
      title: 'The Lonely Mountain',
      ownerId: GM.id,
      version: 7,
      lastSeenAt: null,
      characters: [{ id: PARTY.thorin, name: 'Thorin' }],
      groups: [groupEntry()],
      companions: [mockCompanionEntry()],
      dishesEnabled: true,
      dishVersions: [1],
      bridgePolledAt: null,
    },
  ],
  cookbookLink: [
    {
      id: 'link-1',
      campaignId: 'c1',
      characterId: 'char-1',
      actorId: PARTY.thorin,
      codeHash: hashCookbookCode(COOKBOOK_CODE),
      character: { campaignId: 'c1', actorId: PARTY.thorin },
      campaign: { dishesEnabled: true, dishVersions: [1] },
      revokedAt: null,
    },
  ],
  cookbookDish: [],
})

type Body = { headers: Record<string, string>; body: string }
const JSON_TYPE = { 'content-type': 'application/json' }

/**
 * The bodies each route refuses: not JSON by its type, larger than it reads, not JSON, and not one
 * it takes.
 */
const bodies = (most: number, wrong: unknown): [string, Body][] => [
  ['as text', { headers: { 'content-type': 'text/plain' }, body: '{}' }],
  [
    'too large',
    { headers: JSON_TYPE, body: JSON.stringify({ pad: 'x'.repeat(most) }) },
  ],
  ['malformed', { headers: JSON_TYPE, body: '{"kind":' }],
  ['not one it takes', { headers: JSON_TYPE, body: JSON.stringify(wrong) }],
]

type Route = [
  name: string,
  handler: (...args: never[]) => unknown,
  method: string,
  url: string,
  params: object,
  who: object,
  most: number,
  wrong: unknown,
]

const ROLL = 16_384
const asked = {
  kind: 'skill',
  key: 'prc',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
}
const PLAYER = `${APP}/api/characters/char-1`
const AT_GM = `${APP}/api/campaigns/c1/characters/${PARTY.thorin}`
const ROUTES: Route[] = [
  [
    'rolls, player',
    rolls.POST,
    'POST',
    `${PLAYER}/rolls`,
    { id: 'char-1' },
    THORIN,
    ROLL,
    asked,
  ],
  [
    'rolls, gm',
    gmRolls.POST,
    'POST',
    `${AT_GM}/rolls`,
    { id: 'c1', actor: PARTY.thorin },
    GM,
    ROLL,
    { ...asked, character: 'vex' },
  ],
  [
    'companion rolls, player',
    companionRolls.POST,
    'POST',
    `${PLAYER}/companions/wolfBrakka/rolls`,
    { id: 'char-1', companion: 'wolfBrakka' },
    THORIN,
    ROLL,
    asked,
  ],
  [
    'companion rolls, gm',
    gmCompanionRolls.POST,
    'POST',
    `${AT_GM}/companions/wolfBrakka/rolls`,
    { id: 'c1', actor: PARTY.thorin, companion: 'wolfBrakka' },
    GM,
    ROLL,
    asked,
  ],
  [
    'notes, player',
    notes.POST,
    'POST',
    `${PLAYER}/notes`,
    { id: 'char-1' },
    THORIN,
    MAX_NOTE_BYTES,
    { role: 'chapter', title: 'Road', body: 'x' },
  ],
  [
    'notes, gm',
    gmNotes.POST,
    'POST',
    `${AT_GM}/notes`,
    { id: 'c1', actor: PARTY.thorin },
    GM,
    MAX_NOTE_BYTES,
    { role: 'entry', title: '' },
  ],
  [
    'party notes, player',
    partyNotes.POST,
    'POST',
    `${PLAYER}/party/company/notes`,
    { id: 'char-1', group: 'company' },
    THORIN,
    MAX_NOTE_BYTES,
    { role: 'entry', title: 'Road', id: 'n1' },
  ],
  [
    'party notes, gm',
    gmPartyNotes.POST,
    'POST',
    `${APP}/api/campaigns/c1/party/company/notes`,
    { id: 'c1', group: 'company' },
    GM,
    MAX_NOTE_BYTES,
    { role: 'entry', title: 'Road\nTo' },
  ],
  [
    'a note changed',
    note.PATCH,
    'PATCH',
    `${PLAYER}/notes/${NOTE_IDS.cave}`,
    { id: 'char-1', note: NOTE_IDS.cave },
    THORIN,
    MAX_NOTE_BYTES,
    { title: 'Road' },
  ],
  [
    'an order',
    notesOrder.PUT,
    'PUT',
    `${PLAYER}/notes/order`,
    { id: 'char-1' },
    THORIN,
    MAX_NOTE_BYTES,
    { chapterId: null, ids: [], stamp: 'o:0' },
  ],
  [
    'an order settled',
    notesOrder.PATCH,
    'PATCH',
    `${PLAYER}/notes/order`,
    { id: 'char-1' },
    THORIN,
    MAX_NOTE_BYTES,
    { resolve: 'both', stamp: 'o:0' },
  ],
  [
    'a preview',
    notesPreview.POST,
    'POST',
    `${PLAYER}/notes/preview`,
    { id: 'char-1' },
    THORIN,
    MAX_NOTE_BYTES,
    { body: 7 },
  ],
  [
    'a dish',
    dishes.POST,
    'POST',
    `${APP}/api/cookbook/dishes`,
    {},
    {},
    MAX_DISH_BYTES,
    { version: 1, dish: {} },
  ],
]

describe('the routes that read a body', () => {
  beforeEach(() => {
    resetPrisma()
  })

  describe.each(ROUTES)(
    '%s',
    (_, handler, method, url, params, who, most, wrong) => {
      it.each(bodies(most, wrong))('refuses a body %s', async (name, body) => {
        const fake = prismaFake(seats())
        jest.mocked(getCurrentUser).mockResolvedValue(who as never)
        const {
          status,
          headers,
          body: text,
        } = await routeCall(handler as never, {
          method,
          url,
          params,
          headers: {
            ...body.headers,
            authorization: `Bearer ${COOKBOOK_CODE}`,
          },
          body: body.body,
        })
        expect({
          status,
          headers,
          body: text,
          calls: ordered(fake.calls),
        }).toMatchSnapshot(name)
      })
    },
  )
})
