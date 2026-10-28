/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { envelopeSchema, parseGameEvent } from './sending-stone'
import {
  castingSheet,
  characterSheet,
  checkingSheet,
  combat,
  DISHES_OTHER_SYSTEM,
  DISHES_SWITCHED_OFF,
  dishResult,
  distributedResult,
  EFFECTS_OTHER_SYSTEM,
  EFFECTS_SWITCHED_OFF,
  effectResult,
  enchantingSheet,
  enchantUse,
  FAVORITING,
  favoritedResult,
  fullerSheet,
  MAGIC_WEAPON_PROFILES,
  LOCK_CHECK,
  MAZE_CHECK,
  mockJournalUpdated,
  movedResult,
  NOT_FAVORITING,
  NOT_REMOVING,
  NOTE_IDS,
  removedResult,
  REMOVING,
  roster,
  SENDING_TRANSFERS,
  sheetAction,
  sheetFavorites,
  sheetItem,
  sheetSpell,
  SLEIGHT_CHECK,
  TAKING_DISHES,
  TAKING_EFFECTS,
  TAKING_WILD_SHAPE,
  WILD_SHAPE_OTHER_SYSTEM,
  WILD_SHAPE_SWITCHED_OFF,
  beastsResult,
  druidSheet,
  FORM_IDS,
  KNOWN_FORMS,
  moonBlock,
  shapedSheet,
  wildShapeBlock,
  wildShapeResult,
  wolfForm,
  TEXTS,
  biteAction,
  mockCompanionEntry,
  mockCompanionSheet,
  mockCreature,
  mockSummonedEntry,
  mockTableDamage,
  aloneResult,
  battleaxeAction,
  burningHandsAction,
  longbowAction,
  mockCompanionPrompt,
  potionAction,
  TAKING_ALONE_CHOICES,
  BANE_DIE,
  BLESS_DIE,
  blessedSheet,
  EFFECT_DICE_FEATURES,
  GUIDANCE_DIE,
} from '@/mocks/sending-stone'
import { slimQuillSheet } from '@/mocks/slim-sheet'
import type {
  SheetAction,
  SheetActivityFavorite,
  SheetSpell,
  SheetSpellSection,
} from '@/types/sending-stone'

/** A chat message with these dnd5e details, as read. */
/** A roll with these fields, as a message's arrives, read. */
const rollWith = (fields: object) =>
  (
    parseGameEvent('chat.message.created', {
      message: {
        id: 'm1',
        timestamp: 1,
        audience: { public: true, characters: [] },
        rolls: [{ formula: '1d6', total: 4, dice: [], ...fields }],
      },
    })?.data as { message: { rolls: object[] } }
  ).message.rolls[0]

const messageWith = (dnd5e: object) =>
  parseGameEvent('chat.message.created', {
    message: {
      id: 'm1',
      timestamp: 1,
      audience: { public: true, characters: [] },
      dnd5e: { messageType: 'roll', ...dnd5e },
    },
  })?.data as any

/** A chat message with this ask, as read; or whether it has none at all. */
const askOf = (ask?: unknown) => {
  const { message } = parseGameEvent('chat.message.created', {
    message: {
      id: 'm1',
      timestamp: 1,
      audience: { public: true, characters: [] },
      ...(ask !== undefined && { ask }),
    },
  })?.data as any
  return 'ask' in message ? message.ask : 'absent'
}

/** A sheet with these tools, as read; with none, a sheet from before module 0.18.0. */
const sheetWithTools = (tools?: unknown) =>
  (
    parseGameEvent('character.updated', {
      character: { ...roster[0], sheet: { ...fullerSheet(), tools } },
    }) as any
  ).data.character.sheet

/** A bridge.hello with these features, as read. */
const helloWith = (features?: unknown) =>
  parseGameEvent('bridge.hello', { characters: [], combats: [], features })
    ?.data as any

/** How many dice a command's damage said its first roll throws for each of its own, as read. */
const perDieOf = (perDie?: unknown) =>
  (
    parseGameEvent('command.result', {
      id: 'req-1',
      status: 'done',
      visible: true,
      rolls: [],
      damage: {
        critical: true,
        plannable: true,
        rolls: [
          {
            formula: '2d8 + 4',
            type: 'Slashing',
            dice: [{ faces: 8, number: 2 }],
            perDie,
          },
        ],
      },
    })?.data as any
  ).damage.rolls[0].perDie

/** Whether a save the game asked for succeeded, as a command's result says and as read. */
const outcomeOf = (outcome?: unknown) =>
  (
    parseGameEvent('command.result', {
      id: 'req-1',
      status: 'done',
      visible: true,
      rolls: [],
      outcome,
    })?.data as any
  ).outcome

/** The hit points a hit die gave back, as a command's result says and as read. */
const healedOf = (healed?: unknown) =>
  (
    parseGameEvent('command.result', {
      id: 'req-1',
      status: 'done',
      visible: true,
      rolls: [],
      healed,
    })?.data as any
  ).healed

/** The world's rules, as a character's sheet says and as read. */
const rulesOf = (rules?: unknown) =>
  (
    parseGameEvent('character.updated', {
      character: { ...roster[0], sheet: { ...characterSheet(), rules } },
    }) as any
  ).data.character.sheet.rules

/** How the world rolls a critical hit's damage, as a character's sheet says and as read. */
const criticalOf = (...critical: unknown[]) =>
  (
    parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...characterSheet(),
          ...(critical.length > 0 && { critical: critical[0] }),
        },
      },
    }) as any
  ).data.character.sheet
/** Damage an attack or a use said follows, as a command's result says and as read. */
const damageOf = (damage: unknown) =>
  (
    parseGameEvent('command.result', {
      id: 'req-1',
      status: 'done',
      visible: true,
      rolls: [],
      damage,
    })?.data as { damage: any }
  ).damage
/** What came of an attack, as a command's result says and as read. */
const attackOf = (attack: unknown) =>
  (
    parseGameEvent('command.result', {
      id: 'req-1',
      status: 'done',
      visible: true,
      rolls: [],
      attack,
    })?.data as any
  ).attack

/** A wand's cast, as read: as an action's, an activity's and a favorite's. */
const readCast = (sent: unknown) => {
  const sheet = castingSheet()
  const [wand, flame] = sheet.actions[0].actions
  const [resource, item, fireball, ...favorites] = sheetFavorites()
  const event = parseGameEvent('character.updated', {
    character: {
      ...roster[0],
      sheet: {
        ...sheet,
        actions: [
          {
            ...sheet.actions[0],
            actions: [
              { ...wand, cast: sent },
              {
                ...flame,
                activities: [
                  flame.activities![0],
                  { ...flame.activities![1], cast: sent },
                ],
              },
            ],
          },
        ],
        favorites: [
          resource,
          item,
          { ...fireball, cast: sent, spellId: 'fireballCopy' },
          ...favorites,
        ],
      },
    },
  }) as any
  const read = event.data.character.sheet
  const [action, withActivities] = read.actions[0].actions
  return [
    action.cast,
    withActivities.activities[1].cast,
    read.favorites[2].cast,
  ]
}

/**
 * What an action, one of its activities and a favorite activity say they ask for, or spend, as
 * read: the fields given, on each.
 */
const readRolls = (fields: object) => {
  const activity = {
    id: 'act',
    name: 'Bind',
    type: 'check',
    activation: 'Action',
    range: null,
    target: null,
    toHit: null,
    save: null,
    damage: [],
    uses: null,
  }
  const event = parseGameEvent('character.updated', {
    character: {
      ...roster[0],
      sheet: characterSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'manacles',
                name: 'Manacles',
                ...fields,
                activities: [
                  { ...activity, id: 'first' },
                  { ...activity, ...fields },
                ],
              }),
            ],
          },
        ],
        favorites: [
          {
            ...activity,
            type: 'activity',
            itemId: 'manacles',
            itemType: 'equipment',
            itemName: 'Manacles',
            img: null,
            ...fields,
          },
        ],
      }),
    },
  }) as any
  const read = event.data.character.sheet
  const [action] = read.actions[0].actions
  return [action, action.activities[1], read.favorites[0]]
}

/** What a prompt opening reads as. */
const opened = (prompt: object) =>
  parseGameEvent('roll.prompt.opened', { prompt })?.data as any

describe('schemas/sending-stone', () => {
  const envelope = {
    protocol: 2,
    id: 'ev1',
    session: 's1',
    sequence: 4,
    type: 'chat.cleared',
    time: '2026-10-04T19:02:00Z',
    world: { id: 'erebor', title: 'Erebor' },
    campaign: { id: 'camp-a', title: 'The Lonely Mountain' },
    data: {},
  }

  it('reads an envelope and the campaign it is for', () => {
    expect(envelopeSchema.parse(envelope)).toEqual(envelope)
  })

  it('reads an envelope for no campaign', () => {
    const ping = { ...envelope, type: 'bridge.ping', sequence: null }

    expect(envelopeSchema.parse({ ...ping, campaign: null })).toEqual({
      ...ping,
      campaign: null,
    })
  })

  it.each([
    ['missing', undefined],
    ['without an id', { id: '', title: 'The Lonely Mountain' }],
    ['without a title', { id: 'camp-a', title: ' ' }],
  ])('rejects an envelope whose campaign is %s', (_, campaign) => {
    expect(envelopeSchema.safeParse({ ...envelope, campaign }).success).toBe(
      false,
    )
  })

  it('ignores types it does not act on', () => {
    expect(parseGameEvent('bridge.ping', {})).toBeUndefined()
    expect(parseGameEvent('actor.updated', {})).toBeUndefined()
    expect(parseGameEvent('characters.updated', {})).toBeUndefined()
  })

  it('reads bridge.hello, keeping fields it does not know', () => {
    const data = {
      module: { id: 'sending-stone', version: '0.29.0' },
      characters: [{ ...roster[0], owners: [] }],
      combats: [combat()],
    }

    expect(parseGameEvent('bridge.hello', data)).toEqual({
      type: 'bridge.hello',
      // None of the saves the game asks for, as from a module before 0.13.0, nor groups, as
      // before 0.30.0; nor companions, as before 0.36.0 (changed on purpose, round 0.36.0 §7.12).
      data: { ...data, prompts: [], groups: [], companions: [] },
    })
  })

  it("reads what the game does beyond its events, from module 0.10.0, as missing when it can't", () => {
    expect(
      helloWith({
        rolls: { enabled: true, kinds: ['skill', 'death'], reason: null },
        later: { enabled: true },
      }).features,
    ).toEqual({
      rolls: { enabled: true, kinds: ['skill', 'death'], reason: null },
      later: { enabled: true },
    })
    expect(
      helloWith({ rolls: { enabled: 'yes', kinds: 'skill' } }).features,
    ).toEqual({ rolls: { enabled: false, kinds: [], reason: null } })
    expect(helloWith({ rolls: 'on' }).features).toEqual({ rolls: null })
    expect(helloWith('all').features).toBeNull()
    expect(helloWith().features).toBeUndefined()
  })

  it('reads whether the game takes damage a player changed, from module 0.13.0', () => {
    const rolls = { enabled: true, kinds: ['damage'], reason: null }
    expect(
      helloWith({ rolls: { ...rolls, modifiers: true } }).features.rolls,
    ).toEqual({ ...rolls, modifiers: true })
    expect(
      helloWith({ rolls: { ...rolls, modifiers: 'yes' } }).features.rolls,
    ).toEqual({ ...rolls, modifiers: false })
  })

  it('reads whether players are asked for the saves their game asks of them, from module 0.13.0', () => {
    const rolls = { enabled: true, kinds: ['save'], reason: null }
    expect(
      helloWith({ rolls: { ...rolls, prompts: true } }).features.rolls,
    ).toEqual({ ...rolls, prompts: true })
    expect(
      helloWith({ rolls: { ...rolls, prompts: 1 } }).features.rolls,
    ).toEqual({ ...rolls, prompts: false })
  })

  it('reads whether the game makes an area attack at the combatants its player picks, from module 0.16.0', () => {
    const rolls = {
      enabled: true,
      kinds: ['attack', 'hitDie', 'formula'],
      reason: null,
    }
    expect(
      helloWith({ rolls: { ...rolls, areaAttacks: true } }).features.rolls,
    ).toEqual({ ...rolls, areaAttacks: true })
    expect(
      helloWith({ rolls: { ...rolls, areaAttacks: 'yes' } }).features.rolls,
    ).toEqual({ ...rolls, areaAttacks: false })
    // A module before 0.16.0 says nothing of it.
    expect(helloWith({ rolls }).features.rolls).not.toHaveProperty(
      'areaAttacks',
    )
  })

  it('reads whether players may enter their own dice results, and whether each character does, from module 0.26.0, as false where it can’t', () => {
    const rolls = { enabled: true, kinds: ['skill'], reason: null }
    expect(
      helloWith({ rolls: { ...rolls, manualDice: true } }).features.rolls,
    ).toEqual({ ...rolls, manualDice: true })
    for (const junk of ['yes', 1, null, { on: true }]) {
      expect(
        helloWith({ rolls: { ...rolls, manualDice: junk } }).features.rolls,
      ).toEqual({ ...rolls, manualDice: false })
    }
    // A module before 0.26.0 says nothing of it.
    expect(helloWith({ rolls }).features.rolls).not.toHaveProperty('manualDice')

    const [thorin, vex] = roster
    const characters = (
      parseGameEvent('bridge.hello', {
        characters: [
          { ...thorin, sheet: null, manualDice: false },
          { ...vex, sheet: null, manualDice: true },
          { id: 'actor-bilbo', name: 'Bilbo', sheet: null, manualDice: 'no' },
          { id: 'actor-balin', name: 'Balin', sheet: null },
        ],
        combats: [],
      })?.data as any
    ).characters
    expect(characters.map(({ manualDice }: any) => manualDice)).toEqual([
      false,
      true,
      false,
      undefined,
    ])
    expect(characters[3]).not.toHaveProperty('manualDice')
  })

  it('reads the saves the game asks for, in its hello and as they open and close, from module 0.13.0', () => {
    const prompt = {
      id: 'msg1-thorin',
      actorId: 'thorin',
      messageId: 'msg1',
      type: 'save',
      abilities: ['dex', 'str'],
      dc: 15,
      label: 'Burning Hands',
      openedAt: '2026-10-08T12:00:00.000Z',
      expiresAt: '2026-10-08T12:10:00.000Z',
    }
    const concentration = {
      ...prompt,
      id: 'msg2-thorin',
      messageId: 'msg2',
      type: 'concentration',
      abilities: ['con'],
      dc: null,
      label: null,
    }
    // A prompt without what it asks for, or of a kind this app doesn't know, is dropped.
    const hello = parseGameEvent('bridge.hello', {
      characters: [],
      combats: [],
      prompts: [
        prompt,
        concentration,
        { ...prompt, id: 'no-dash-here' },
        { ...prompt, type: 'check' },
        { ...prompt, abilities: [] },
        'msg3-thorin',
      ],
    })?.data as any
    expect(hello.prompts).toEqual([prompt, concentration])
    expect(
      parseGameEvent('bridge.hello', {
        characters: [],
        combats: [],
        prompts: 'none',
      })?.data,
    ).toEqual({
      characters: [],
      combats: [],
      prompts: [],
      groups: [],
      // Changed on purpose (round 0.36.0 §7.12).
      companions: [],
    })

    // Its label and DC are only shown, so an odd one is taken as none.
    expect(
      parseGameEvent('roll.prompt.opened', {
        prompt: { ...prompt, dc: 'fifteen', label: 7 },
      }),
    ).toEqual({
      type: 'roll.prompt.opened',
      data: { prompt: { ...prompt, dc: null, label: null } },
    })
    expect(() =>
      parseGameEvent('roll.prompt.opened', {
        prompt: { ...prompt, expiresAt: 'soon' },
      }),
    ).toThrow()

    expect(
      parseGameEvent('roll.prompt.closed', {
        id: 'msg1-thorin',
        reason: 'answered',
      }),
    ).toEqual({
      type: 'roll.prompt.closed',
      data: { id: 'msg1-thorin', reason: 'answered' },
    })
    expect(
      parseGameEvent('roll.prompt.closed', { id: 'msg1-thorin' })?.data,
    ).toEqual({ id: 'msg1-thorin', reason: 'gone' })
    expect(() =>
      parseGameEvent('roll.prompt.closed', { id: 'msg1 thorin' }),
    ).toThrow()
  })

  it('reads whether the game asks here what Midi-QOL asks, from module 0.27.0', () => {
    const rolls = { enabled: true, kinds: ['save'], reason: null }
    expect(
      helloWith({ rolls: { ...rolls, midiPrompts: true } }).features.rolls,
    ).toEqual({ ...rolls, midiPrompts: true })
    expect(
      helloWith({ rolls: { ...rolls, midiPrompts: 1 } }).features.rolls,
    ).toEqual({ ...rolls, midiPrompts: false })
    expect(helloWith({ rolls }).features.rolls).not.toHaveProperty(
      'midiPrompts',
    )
  })

  describe('what Midi-QOL asks, from module 0.27.0', () => {
    /** Midi-QOL asks Thorin for Athletics or Acrobatics, with advantage on Athletics. */
    const web = {
      id: 'k3yk3yk3yk3yk3yk-thorin',
      actorId: 'thorin',
      messageId: 'k3yk3yk3yk3yk3yk',
      type: 'skill',
      abilities: [],
      skills: ['ath', 'acr'],
      dc: 12,
      label: 'Web',
      openedAt: '2026-10-08T12:00:00.000Z',
      expiresAt: '2026-10-08T12:01:00.000Z',
      source: 'overtime',
      advantage: { ath: 'adv' },
      askedInFoundry: true,
    }
    /** And a Strength or Dexterity save a spell calls for, asked in Foundry too. */
    const save = {
      ...web,
      id: 'card1-thorin',
      messageId: 'card1',
      type: 'save',
      abilities: ['str', 'dex'],
      skills: undefined,
      label: 'Hold Person',
      source: 'midi',
      advantage: { dex: 'dis' },
      askedInFoundry: undefined,
    }

    it('reads where it comes from, its choices, and how Midi-QOL has each rolled', () => {
      expect(opened(web).prompt).toEqual(web)
      // Not asked in Foundry unless it says so; and normally, unless it says otherwise.
      expect(opened(save).prompt).toEqual({
        ...save,
        askedInFoundry: false,
      })
      expect(
        opened({ ...save, advantage: undefined }).prompt.advantage,
      ).toEqual({})
      for (const [type, source] of [
        ['concentration', 'concentration'],
        ['check', 'overtime'],
        ['save', 'midi'],
      ]) {
        expect(
          opened({ ...save, type, source, abilities: ['con'] }).prompt,
        ).toMatchObject({ type, source })
      }
    })

    it('drops advantage it gives a choice it does not offer', () => {
      expect(
        opened({ ...web, advantage: { ath: 'adv', str: 'dis', acr: 'dis' } })
          .prompt.advantage,
      ).toEqual({ ath: 'adv', acr: 'dis' })
      expect(
        opened({ ...save, advantage: { ath: 'adv' } }).prompt.advantage,
      ).toEqual({})
    })

    it.each([
      [
        'an ability check said to come from no source',
        { ...save, type: 'check', source: undefined },
      ],
      [
        'a skill check said to come from no source',
        { ...web, source: undefined },
      ],
      ['a source it does not know', { ...web, source: 'mtb' }],
      ['skills for a save', { ...save, skills: ['ath'] }],
      ['no skills for a skill check', { ...web, skills: undefined }],
      ['no skill at all', { ...web, skills: [] }],
      ['no ability for a save', { ...save, abilities: [] }],
      ['advantage not one it knows', { ...web, advantage: { ath: 'double' } }],
      ['a skill that is no key', { ...web, skills: ['ath', '1st'] }],
      ['a word for whether Foundry asks', { ...web, askedInFoundry: 'yes' }],
    ])(
      'refuses one with %s, as it couldn’t be answered as asked',
      (_, prompt) => {
        expect(() => opened(prompt)).toThrow()
        const hello = parseGameEvent('bridge.hello', {
          characters: [],
          combats: [],
          prompts: [prompt, web],
        })?.data as any
        expect(hello.prompts).toEqual([web])
      },
    )

    it('reads a chat card’s save as before, leaving out what only Midi-QOL’s say', () => {
      const card = {
        id: 'msg1-thorin',
        actorId: 'thorin',
        messageId: 'msg1',
        type: 'save',
        abilities: ['dex'],
        dc: 15,
        label: 'Burning Hands',
        openedAt: '2026-10-08T12:00:00.000Z',
        expiresAt: '2026-10-08T12:10:00.000Z',
      }
      const read = opened({
        ...card,
        skills: 'none',
        advantage: { dex: 'adv' },
        askedInFoundry: true,
      }).prompt
      expect(read).toEqual(card)
      expect(Object.keys(read).toSorted()).toEqual(Object.keys(card).toSorted())
    })
  })

  it("reads how many dice each of damage's rolls throws for each of its own, from module 0.13.0", () => {
    expect(perDieOf(2)).toBe(2)
    expect(perDieOf()).toBeUndefined()
    expect(perDieOf(0)).toBe(1)
    expect(perDieOf('two')).toBe(1)
  })

  it("reads a command's result, keeping only what the app shows", () => {
    const roll = {
      formula: '1d20 + 4',
      total: 18,
      dice: [{ faces: 20, results: [{ result: 14, active: true }] }],
    }
    expect(
      parseGameEvent('command.result', {
        id: 'req-1',
        status: 'done',
        messageId: 'msg-1',
        visible: true,
        rolls: [roll],
        dice: { planned: [14], used: [14], foundry: [] },
      }),
    ).toEqual({
      type: 'command.result',
      data: {
        id: 'req-1',
        status: 'done',
        reason: null,
        error: null,
        messageId: 'msg-1',
        visible: true,
        rolls: [expect.objectContaining({ formula: '1d20 + 4', total: 18 })],
      },
    })
    expect(
      parseGameEvent('command.result', {
        id: 'req-1',
        status: 'failed',
        reason: 'not-dying',
        error: 42,
        visible: 'no',
        rolls: 'none',
      })?.data,
    ).toEqual({
      id: 'req-1',
      status: 'failed',
      reason: 'not-dying',
      error: null,
      messageId: null,
      visible: false,
      rolls: [],
    })
  })

  it("reads whether a save the game asked for succeeded, from module 0.13.0, as unknown when it can't", () => {
    expect(outcomeOf('success')).toBe('success')
    expect(outcomeOf('failure')).toBe('failure')
    expect(outcomeOf(null)).toBeNull()
    expect(outcomeOf('saved')).toBeNull()
    expect(outcomeOf()).toBeUndefined()
  })

  it("reads the hit points a hit die gave back, from module 0.16.0, as unknown when it can't", () => {
    expect(healedOf(7)).toBe(7)
    expect(healedOf(0)).toBe(0)
    expect(healedOf(null)).toBeNull()
    expect(healedOf(-1)).toBeNull()
    expect(healedOf(2.5)).toBeNull()
    expect(healedOf('7')).toBeNull()
    expect(healedOf(1_000_001)).toBeNull()
    expect(healedOf()).toBeUndefined()
  })

  it("reads how many hit dice spent at once the game made, from module 0.20.0, as unknown when it can't", () => {
    const spentOf = (spent?: unknown) =>
      (
        parseGameEvent('command.result', {
          id: 'req-1',
          status: 'failed',
          reason: 'full-hp',
          visible: true,
          rolls: [],
          healed: 9,
          spent,
        })?.data as any
      ).spent
    expect(spentOf({ count: 3, made: 1 })).toEqual({ count: 3, made: 1 })
    expect(spentOf({ count: 20, made: 0 })).toEqual({ count: 20, made: 0 })
    expect(spentOf({ count: 3 })).toBeNull()
    expect(spentOf({ count: 0, made: 0 })).toBeNull()
    expect(spentOf({ count: 21, made: 21 })).toBeNull()
    expect(spentOf({ count: 3, made: -1 })).toBeNull()
    expect(spentOf({ count: 3, made: 1.5 })).toBeNull()
    expect(spentOf(null)).toBeNull()
    // An older module's result says nothing of it.
    expect(spentOf()).toBeUndefined()
    expect(
      parseGameEvent('command.result', {
        id: 'req-1',
        status: 'done',
        visible: true,
        rolls: [],
        healed: 9,
      })?.data,
    ).not.toHaveProperty('spent')
  })

  it('keeps every roll of hit dice spent at once, as many as a module adds, up to 40', () => {
    const roll = {
      formula: '1d10 + 3',
      total: 9,
      dice: [{ faces: 10, results: [{ result: 6, active: true }] }],
    }
    const rollsOf = (count: number) =>
      (
        parseGameEvent('command.result', {
          id: 'req-1',
          status: 'done',
          visible: true,
          rolls: Array.from({ length: count }, () => roll),
          spent: { count: 20, made: 20 },
        })?.data as any
      ).rolls
    expect(rollsOf(40)).toHaveLength(40)
    expect(rollsOf(41)).toEqual([])
  })

  it("reads an attack's result: what came of it, and the dice its damage throws", () => {
    const damage = {
      critical: true,
      plannable: true,
      rolls: [
        {
          formula: '2d8 + 4',
          type: 'slashing',
          dice: [{ faces: 8, number: 2 }],
        },
        { formula: '2d6', type: 'fire', dice: [{ faces: 6, number: 2 }] },
      ],
    }
    const result = {
      id: 'req-1',
      status: 'done',
      messageId: 'msg-1',
      visible: true,
      rolls: [],
      attack: { critical: true, fumble: false, outcome: 'hit' },
      damage,
    }

    expect(parseGameEvent('command.result', result)?.data).toMatchObject({
      attack: { critical: true, fumble: false, outcome: 'hit' },
      damage,
    })
    // What came of it, where the Gamemaster doesn't show it; and an attack with no damage.
    expect(
      parseGameEvent('command.result', {
        ...result,
        attack: { critical: false, fumble: true, outcome: 'graze' },
        damage: null,
      })?.data,
    ).toMatchObject({
      attack: { critical: false, fumble: true, outcome: null },
      damage: null,
    })
    expect(
      parseGameEvent('command.result', {
        ...result,
        attack: 'hit',
        damage: { ...damage, rolls: 'many' },
      })?.data,
    ).toMatchObject({ attack: null, damage: null })
  })

  it("reads whether an area attack hit each combatant picked, from module 0.16.0, leaving them out when it can't", () => {
    const attack = { critical: false, fumble: false, outcome: null }
    const hits = [
      { combatId: 'cmbt1', combatantId: 'goblin', outcome: 'hit' },
      { combatId: 'cmbt1', combatantId: 'ogre', outcome: 'miss' },
      { combatId: 'cmbt1', combatantId: 'lurker', outcome: null },
    ]
    expect(attackOf({ ...attack, targets: hits })).toEqual({
      ...attack,
      targets: hits,
    })
    // What came of it at one it can't read is unknown.
    expect(
      attackOf({ ...attack, targets: [{ ...hits[0], outcome: 'graze' }] })
        .targets,
    ).toEqual([{ ...hits[0], outcome: null }])

    // Those it can't read are left out, keeping the rest of the attack.
    for (const targets of [
      'all',
      [{ combatantId: 'goblin', outcome: 'hit' }],
      [{ ...hits[0], combatId: 'c'.repeat(65) }],
      Array.from({ length: 21 }, (_, index) => ({
        ...hits[0],
        combatantId: `c${index}`,
      })),
    ]) {
      const read = attackOf({ ...attack, outcome: 'hit', targets })
      expect(read).toMatchObject({ ...attack, outcome: 'hit' })
      expect(read.targets).toBeUndefined()
    }
    // A module before 0.16.0 sends none.
    expect(attackOf(attack)).not.toHaveProperty('targets')
  })

  it("reads a use's result: the kind of activity used, and its healing's dice, or the kinds of damage to choose", () => {
    const healing = {
      critical: false,
      plannable: true,
      healing: true,
      rolls: [
        {
          formula: '2d8 + 3',
          type: 'Healing',
          types: null,
          dice: [{ faces: 8, number: 2 }],
        },
      ],
    }
    const result = {
      id: 'req-2',
      status: 'done',
      messageId: 'msg-2',
      visible: true,
      rolls: [],
      use: { type: 'heal' },
      damage: healing,
    }
    expect(parseGameEvent('command.result', result)?.data).toMatchObject({
      use: { type: 'heal' },
      damage: healing,
    })

    const choices = [
      { key: 'acid', label: 'Acid' },
      { key: 'fire', label: 'Fire' },
    ]
    const orb = parseGameEvent('command.result', {
      ...result,
      use: undefined,
      damage: {
        critical: false,
        plannable: true,
        rolls: [
          { formula: '3d8', type: 'Acid', types: choices, dice: [] },
          {
            formula: '1d6',
            type: 'Fire',
            types: [{ key: 'fire acid' }],
            dice: [],
          },
        ],
      },
    })?.data as any
    expect(orb.damage.rolls.map((roll: any) => roll.types)).toEqual([
      choices,
      null,
    ])
    // A module before 0.12.0 says neither.
    expect(orb.use).toBeUndefined()
    expect(orb.damage.healing).toBeUndefined()
    expect(
      parseGameEvent('command.result', { ...result, use: 'heal' })?.data,
    ).toMatchObject({ use: null })
  })

  it("reads the dice of a critical hit's critical damage as added, from module 0.20.0, leaving out anything else said of them", () => {
    const greataxe = {
      critical: true,
      plannable: true,
      rolls: [
        {
          formula: '3d12 + 3 + 1d6',
          type: 'Slashing',
          dice: [
            { faces: 12, number: 3 },
            { faces: 6, number: 1, added: true },
          ],
          perDie: 2,
        },
      ],
    }
    expect(damageOf(greataxe)).toEqual(greataxe)
    for (const junk of [false, 'true', 1, null]) {
      const read = damageOf({
        ...greataxe,
        rolls: [
          {
            ...greataxe.rolls[0],
            dice: [
              { faces: 12, number: 3, added: junk },
              { faces: 6, number: 1, added: true },
            ],
          },
        ],
      })
      expect(read).toEqual(greataxe)
      expect(read.rolls[0].dice[0].added).toBeUndefined()
    }
  })

  it('reads the dice damage takes away as subtracted, from module 0.21.0, leaving out anything else said of them', () => {
    // A greataxe's critical hit under Reduce: 3d12 + 3, less 2d4, and the weapon's 1d6; and
    // Midi-QOL's copy of the d4, placed after a minus, both critical damage and taken away.
    const reduced = {
      critical: true,
      plannable: true,
      rolls: [
        {
          formula: '3d12 + 3 - 2d4 + 1d6 - 1d4min4',
          type: 'Slashing',
          dice: [
            { faces: 12, number: 3 },
            { faces: 4, number: 2, subtracted: true },
            { faces: 6, number: 1, added: true },
            { faces: 4, number: 1, added: true, subtracted: true },
          ],
          perDie: 2,
        },
      ],
    }
    const read = damageOf(reduced)
    expect(read).toEqual(reduced)
    expect(Object.keys(read.rolls[0].dice[3])).toEqual([
      'faces',
      'number',
      'added',
      'subtracted',
    ])
    for (const junk of [false, 'yes', 1, null]) {
      const junked = damageOf({
        ...reduced,
        rolls: [
          {
            ...reduced.rolls[0],
            dice: [
              { faces: 12, number: 3, subtracted: junk },
              ...reduced.rolls[0].dice.slice(1),
            ],
          },
        ],
      })
      expect(junked).toEqual(reduced)
      expect(junked.rolls[0].dice[0].subtracted).toBeUndefined()
    }
  })

  it('leaves damage throwing more dice than a player may send for the game to roll', () => {
    const many = Array.from({ length: 11 }, () => ({ faces: 6, number: 1 }))
    const data = parseGameEvent('command.result', {
      id: 'req-1',
      status: 'done',
      visible: true,
      rolls: [],
      damage: {
        critical: false,
        plannable: true,
        rolls: [
          { formula: '11d6', type: 'fire', dice: many },
          { formula: '11d6', type: 'cold', dice: many },
        ],
      },
    })?.data as { damage: unknown }

    expect(data.damage).toEqual({
      critical: false,
      plannable: false,
      rolls: [
        { formula: '11d6', type: 'fire', dice: [] },
        { formula: '11d6', type: 'cold', dice: [] },
      ],
    })
  })

  it("reads the messages the Gamemaster's roll made, from module 0.25.0, ignoring anything else", () => {
    const result = { id: 'req-gm', status: 'done', visible: true, rolls: [] }
    const listed = (messages: unknown) =>
      (
        parseGameEvent('command.result', { ...result, messages })?.data as {
          messages?: string[]
        }
      ).messages
    const twenty = Array.from({ length: 20 }, (_, index) => `m${index}`)

    expect(listed(['m-roll', 'm-outcome'])).toEqual(['m-roll', 'm-outcome'])
    expect(listed([])).toEqual([])
    expect(listed(twenty)).toEqual(twenty)
    expect(listed(['x'.repeat(64)])).toEqual(['x'.repeat(64)])
    for (const junk of [
      [...twenty, 'm20'],
      ['x'.repeat(65)],
      [''],
      ['m-roll', 7],
      'm-roll',
      null,
      { 0: 'm-roll' },
    ]) {
      expect(listed(junk)).toBeUndefined()
    }
    // Left out by an older module, and for a player's roll.
    expect(parseGameEvent('command.result', result)?.data).not.toHaveProperty(
      'messages',
    )
  })

  it('reads what a move of items and coins moved, from module 0.31.0, keeping the rest of a result whose move it can’t read', () => {
    const result = {
      id: 'req-move',
      status: 'done',
      reason: null,
      messageId: 'm-line',
      visible: true,
      rolls: [],
    }
    const transfer = {
      from: 'groupIronCo01',
      to: 'actorThorin1',
      items: [
        {
          id: 'potionHeal01',
          quantity: 2,
          created: null,
          stacked: 'potionThorin',
        },
        {
          id: 'backpack0001',
          quantity: 1,
          created: 'newPack00001',
          stacked: null,
        },
      ],
      currency: { gp: 50 },
    }
    const read = (moved: unknown) =>
      parseGameEvent('command.result', { ...result, transfer: moved })
        ?.data as { transfer?: unknown; messageId: string | null }

    expect(read(transfer).transfer).toEqual(transfer)
    expect(read({ ...transfer, currency: null }).transfer).toEqual({
      ...transfer,
      currency: null,
    })
    expect(read({ ...transfer, items: [] }).transfer).toEqual({
      ...transfer,
      items: [],
    })
    const most = Array.from({ length: 10 }, (_, index) => ({
      id: `item${index}`,
      quantity: 10_000_000,
      created: `copy${index}`,
      stacked: null,
    }))
    expect(read({ ...transfer, items: most }).transfer).toEqual({
      ...transfer,
      items: most,
    })
    // Names, or anything else, are left out.
    expect(
      read({
        ...transfer,
        items: [{ ...transfer.items[0], name: 'Potion of Healing' }],
      }).transfer,
    ).toEqual({ ...transfer, items: [transfer.items[0]] })
    for (const junk of [
      { ...transfer, from: '' },
      { ...transfer, to: 'x'.repeat(65) },
      { ...transfer, items: [...most, most[0]] },
      { ...transfer, items: [{ ...transfer.items[0], quantity: 0 }] },
      { ...transfer, items: [{ ...transfer.items[0], quantity: 10_000_001 }] },
      { ...transfer, items: [{ ...transfer.items[0], quantity: 1.5 }] },
      { ...transfer, items: [{ ...transfer.items[0], created: undefined }] },
      { ...transfer, currency: { gp: 0 } },
      { ...transfer, currency: { gp: '50' } },
      {
        ...transfer,
        currency: Object.fromEntries(
          Array.from({ length: 11 }, (_, index) => [`c${index}`, 1]),
        ),
      },
      { ...transfer, currency: undefined },
      'moved',
      null,
    ]) {
      const data = read(junk)
      expect(data.transfer).toBeUndefined()
      expect(data.messageId).toBe('m-line')
    }
    // Left out by an older module, and by any other command.
    expect(parseGameEvent('command.result', result)?.data).not.toHaveProperty(
      'transfer',
    )
  })

  it.each([
    ['without its id', { status: 'done' }],
    ['with an outcome it does not know', { id: 'req-1', status: 'maybe' }],
  ])('refuses a command result %s', (_name, data) => {
    expect(() => parseGameEvent('command.result', data)).toThrow()
  })

  it("reads a character's sheet in bridge.hello and character.updated", () => {
    const character = { ...roster[0], sheet: characterSheet() }

    expect(
      parseGameEvent('bridge.hello', { characters: [character], combats: [] }),
    ).toEqual({
      type: 'bridge.hello',
      // Changed on purpose (round 0.36.0 §7.12): no companions.
      data: {
        characters: [character],
        combats: [],
        prompts: [],
        groups: [],
        companions: [],
      },
    })
    expect(parseGameEvent('character.updated', { character })).toEqual({
      type: 'character.updated',
      data: { character },
    })
  })

  describe('sheets apart, from module 0.22.0', () => {
    /** A character as a hello from module 0.22.0 names it, with no sheet. */
    const named = {
      ...roster[0],
      uuid: 'Actor.actor-thorin',
      img: null,
      type: 'character',
      owners: ['u-player'],
    }

    it('reads a hello whose characters carry no sheets, and says so, keeping them without', () => {
      const hello = parseGameEvent('bridge.hello', {
        sheetsApart: true,
        characters: [named],
        combats: [],
      })

      expect(hello).toEqual({
        type: 'bridge.hello',
        data: {
          sheetsApart: true,
          characters: [named],
          combats: [],
          prompts: [],
          groups: [],
          // Changed on purpose (round 0.36.0 §7.12).
          companions: [],
        },
      })
      expect((hello?.data as any).characters[0]).not.toHaveProperty('sheet')
    })

    it('reads a hello from an earlier module, with its sheets, as before', () => {
      const character = { ...roster[0], sheet: characterSheet() }
      const hello = parseGameEvent('bridge.hello', {
        characters: [character, { ...roster[1], sheet: null }],
        combats: [],
      })

      expect(hello?.data).toEqual({
        characters: [character, { ...roster[1], sheet: null }],
        combats: [],
        prompts: [],
        groups: [],
        // Changed on purpose (round 0.36.0 §7.12).
        companions: [],
      })
      expect(hello?.data).not.toHaveProperty('sheetsApart')
    })

    it.each([['yes'], [1], [null]])(
      "reads a hello's sheetsApart of %p as false",
      sheetsApart => {
        expect(
          parseGameEvent('bridge.hello', {
            sheetsApart,
            characters: [],
            combats: [],
          })?.data,
        ).toMatchObject({ sheetsApart: false })
      },
    )

    it('reads why a sheet was held back, with its size and the limit', () => {
      const withheld = {
        reason: 'tooLarge',
        bytes: 5_200_000,
        limit: 4_000_000,
      }
      const read = (sheetWithheld: unknown) =>
        (
          parseGameEvent('character.updated', {
            character: { ...named, sheet: null, sheetWithheld },
          })?.data as any
        ).character

      expect(read(withheld)).toEqual({
        ...named,
        sheet: null,
        sheetWithheld: withheld,
      })
      // A size it can't read is unknown, the reason still read.
      expect(read({ reason: 'tooLarge', bytes: '5 MB', limit: -1 })).toEqual({
        ...named,
        sheet: null,
        sheetWithheld: { reason: 'tooLarge', bytes: null, limit: null },
      })
      expect(read({ reason: 'later', bytes: 1.5 }).sheetWithheld).toEqual({
        reason: 'later',
        bytes: null,
        limit: null,
      })
      // One without a reason it can read is left out, the character kept.
      for (const junk of [
        { bytes: 5 },
        { reason: 'x'.repeat(33) },
        'tooLarge',
      ]) {
        expect(read(junk)).toEqual({ ...named, sheet: null })
      }
      expect(
        (parseGameEvent('character.updated', { character: named })?.data as any)
          .character,
      ).toEqual(named)
    })

    it('reads a slim sheet as the sheet the module built, and one it can’t expand as none', () => {
      const sheet = characterSheet()
      const slim = { ...sheet, slim: 1 }

      expect(
        parseGameEvent('character.updated', {
          character: { ...named, sheet: slim },
        }),
      ).toEqual({
        type: 'character.updated',
        data: { character: { ...named, sheet } },
      })
      expect(
        parseGameEvent('bridge.hello', {
          characters: [{ ...named, sheet: slim }],
          combats: [],
        })?.data,
      ).toMatchObject({ characters: [{ ...named, sheet }] })
      expect(
        parseGameEvent('character.updated', {
          character: { ...named, sheet: { ...sheet, slim: 2 } },
        })?.data,
      ).toEqual({ character: { ...named, sheet: null } })
    })
  })

  it('fills in what a sheet only displays when it is missing or odd', () => {
    const sheet = characterSheet()
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          level: '5',
          inspiration: 'yes',
          speed: 30,
          classes: 'Fighter',
          abilities: [{ ...sheet.abilities[0], label: 5, checkMode: 2 }],
        },
      },
    }) as any

    expect(event.data.character.sheet).toMatchObject({
      level: null,
      inspiration: false,
      speed: null,
      classes: [],
      abilities: [{ id: 'str', label: '', checkMode: 0, save: 7 }],
    })
  })

  it("reads the world's rules, from module 0.16.0, as unknown when it can't", () => {
    expect(rulesOf('modern')).toBe('modern')
    expect(rulesOf('legacy')).toBe('legacy')
    expect(rulesOf('2014')).toBeNull()
    expect(rulesOf(null)).toBeNull()
    expect(rulesOf()).toBeUndefined()
  })

  it("reads how the world rolls a critical hit's damage, from module 0.19.0, as none when it can't say, and absent before", () => {
    const rule = {
      perDie: 2,
      multiplyNumeric: false,
      powerfulCritical: false,
      altered: false,
    }
    expect(criticalOf(rule).critical).toEqual(rule)
    const powerful = {
      perDie: 1,
      multiplyNumeric: true,
      powerfulCritical: true,
      altered: false,
    }
    expect(criticalOf(powerful).critical).toEqual(powerful)
    // Midi-QOL's rules that roll its dice at their highest.
    expect(criticalOf({ ...rule, altered: true }).critical).toEqual({
      ...rule,
      altered: true,
    })
    expect(criticalOf(null).critical).toBeNull()
    // From before it said whether the dice are altered.
    const unaltered = {
      perDie: 2,
      multiplyNumeric: false,
      powerfulCritical: false,
    }
    for (const junk of [
      'double',
      { ...rule, perDie: 0 },
      { ...rule, perDie: 1.5 },
      { ...rule, perDie: 5 },
      { ...rule, multiplyNumeric: 'yes' },
      { ...rule, altered: 'no' },
      unaltered,
      { perDie: 2 },
    ]) {
      expect(criticalOf(junk).critical).toBeNull()
    }
    // A sheet from before module 0.19.0, which says nothing of it, is told from one that can't say.
    expect(criticalOf()).not.toHaveProperty('critical')
  })

  it('reads how the world throws the dice a critical hit adds, from module 0.20.0, as null where it can’t say, the rule kept', () => {
    const rule = {
      perDie: 2,
      multiplyNumeric: false,
      powerfulCritical: false,
      altered: false,
    }
    for (const bonusDice of ['rolled', 'maximized', 'ignored', null]) {
      expect(criticalOf({ ...rule, bonusDice }).critical).toEqual({
        ...rule,
        bonusDice,
      })
    }
    // From module 0.19.0, which doesn't say: the rule as it was, taking no dice added.
    const older = criticalOf(rule).critical
    expect(older).toEqual(rule)
    expect(older.bonusDice).toBeUndefined()
    // What this app doesn't know is as though it can't say, the rule still read.
    for (const junk of ['doubled', 1, true, {}, ['rolled']]) {
      expect(criticalOf({ ...rule, bonusDice: junk }).critical).toEqual({
        ...rule,
        bonusDice: null,
      })
    }
  })

  it('reads features, conditions and effects, as sent from module 0.6.0', () => {
    const character = { ...roster[0], sheet: fullerSheet() }

    expect(parseGameEvent('character.updated', { character })).toEqual({
      type: 'character.updated',
      data: { character },
    })
  })

  it('drops a malformed feature, condition or effect, rather than the sheet', () => {
    const sheet = fullerSheet()
    const [section] = sheet.features
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          conditions: [{ id: 'poisoned' }, ...sheet.conditions],
          features: [
            {
              ...section,
              text: 'not a hash',
              features: [
                { ...section.features[0], uses: { value: 'one' } },
                { name: 'No id' },
              ],
            },
          ],
          effects: 'none',
        },
      },
    }) as any

    expect(event.data.character.sheet).toMatchObject({
      conditions: sheet.conditions,
      features: [
        {
          id: 'fighter',
          text: null,
          features: [{ id: 'second-wind', uses: null, text: TEXTS.secondWind }],
        },
      ],
      effects: [],
    })
  })

  it('reads a sheet from before module 0.6.0 as having no features, conditions or effects', () => {
    const { conditions, features, effects, ...older } = characterSheet()
    const event = parseGameEvent('character.updated', {
      character: { ...roster[0], sheet: older },
    }) as any

    expect([conditions, features, effects]).toEqual([[], [], []])
    expect(event.data.character.sheet).toMatchObject({
      conditions: [],
      features: [],
      effects: [],
    })
  })

  it('drops a malformed item, spell, trait or detail, rather than the sheet', () => {
    const sheet = fullerSheet()
    const { inventory, spells, details } = sheet
    const [backpack] = inventory.containers
    const [cantrips, first] = spells
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          inventory: {
            ...inventory,
            sections: [
              {
                ...inventory.sections[0],
                items: [
                  { name: 'No id' },
                  { ...inventory.sections[0].items[0], weight: 'heavy' },
                ],
              },
            ],
            containers: [
              {
                ...backpack,
                capacity: { value: 'some' },
                contents: [
                  { type: 'container', name: 'No id' },
                  { ...backpack.contents?.[0], attunement: 'maybe' },
                  {
                    id: 'sack',
                    name: 'Sack',
                    type: 'container',
                    contents: 'lots',
                  },
                  null,
                ],
              },
            ],
            encumbrance: { value: 'lots' },
          },
          spellcasting: 'yes',
          spells: [
            { ...cantrips, spells: [{ id: 'nameless' }] },
            {
              ...first,
              slots: { value: 1 },
              spells: [{ ...first.spells[0], prepared: 3 }],
            },
          ],
          traits: [{ id: 'senses' }, sheet.traits[0]],
          deathSaves: { success: 'one' },
          details: {
            ...details,
            xp: { value: 'lots' },
            about: [{ id: 'age' }],
          },
        },
      },
    }) as any

    expect(event.data.character.sheet).toMatchObject({
      inventory: {
        sections: [
          { id: 'weapons', items: [{ id: 'warhammer', weight: null }] },
        ],
        containers: [
          {
            id: 'backpack',
            capacity: null,
            contents: [
              { id: 'rope', attunement: null },
              { id: 'sack', contents: null, capacity: null },
            ],
          },
        ],
        currency: inventory.currency,
        encumbrance: null,
        attunement: inventory.attunement,
      },
      spellcasting: null,
      spells: [
        { id: 'spell0', spells: [] },
        {
          id: 'spell1',
          slots: null,
          spells: [{ id: 'shield', prepared: null, text: TEXTS.shield }],
        },
      ],
      traits: [sheet.traits[0]],
      deathSaves: null,
      details: { about: [], xp: null, biography: TEXTS.biography },
    })
  })

  it("reads the level each spell slot casts at, from module 0.8.1, keeping a slot whose level it can't read", () => {
    const sheet = fullerSheet()
    const [cantrips, first, ...rest] = sheet.spells
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          spells: [
            cantrips,
            { ...first, slots: { value: 1, max: 2, level: 1 } },
            {
              id: 'pact',
              label: 'Pact Magic — 3rd Level',
              slots: { value: 2, max: 2, level: 'third' },
              spells: [],
            },
            ...rest,
          ],
        },
      },
    }) as any

    expect(
      event.data.character.sheet.spells.map(
        (section: SheetSpellSection) => section.slots,
      ),
    ).toEqual([
      null,
      { value: 1, max: 2, level: 1 },
      { value: 2, max: 2, level: null },
      { value: 0, max: 0 },
      null,
    ])
  })

  it('reads the item a spell is cast from, from module 0.8.2, leaving it out as an older module does', () => {
    const sheet = fullerSheet()
    const [cantrips, first, ...rest] = sheet.spells
    const [section, ...others] = sheet.actions
    const wand = { id: 'wand', name: 'Wand of Magic Missiles' }
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          spells: [
            cantrips,
            {
              ...first,
              spells: [
                { ...first.spells[0], castFrom: wand },
                { ...first.spells[1], castFrom: { id: 7 } },
                ...first.spells.slice(2),
              ],
            },
            ...rest,
          ],
          actions: [
            {
              ...section,
              actions: [
                { ...section.actions[0], castFrom: null },
                { ...section.actions[1], castFrom: wand },
                ...section.actions.slice(2),
              ],
            },
            ...others,
          ],
        },
      },
    }) as any

    const { spells, actions } = event.data.character.sheet
    expect(spells[1].spells.map((spell: SheetSpell) => spell.castFrom)).toEqual(
      [wand, null, undefined],
    )
    expect(
      actions[0].actions.map((action: SheetAction) => action.castFrom),
    ).toEqual([null, wand, undefined, undefined])
    expect('castFrom' in actions[0].actions[2]).toBe(false)
  })

  it('reads whether the item a spell is cast from can cast it now, from module 0.16.0', () => {
    const sheet = fullerSheet()
    const [cantrips, first, ...rest] = sheet.spells
    const flame = { id: 'flame', name: 'Worn Bardic Eternal Flame' }
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          spells: [
            cantrips,
            {
              ...first,
              spells: [
                {
                  ...first.spells[0],
                  castFrom: { ...flame, usable: false, attune: true },
                },
                {
                  ...first.spells[1],
                  castFrom: { ...flame, usable: 'no', attune: 1 },
                },
                { ...first.spells[2], castFrom: flame },
              ],
            },
            ...rest,
          ],
        },
      },
    }) as any

    expect(
      event.data.character.sheet.spells[1].spells.map(
        (spell: SheetSpell) => spell.castFrom,
      ),
    ).toEqual([
      { ...flame, usable: false, attune: true },
      { ...flame, usable: true, attune: false },
      flame,
    ])
    expect(
      'usable' in event.data.character.sheet.spells[1].spells[2].castFrom,
    ).toBe(false)
  })

  it('reads actions, dropping a malformed action, damage or saving throw rather than the sheet', () => {
    const sheet = fullerSheet()
    const [section, ...rest] = sheet.actions
    const [warhammer, ...others] = section.actions
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          actions: [
            {
              ...section,
              actions: [
                { name: 'No id' },
                {
                  ...warhammer,
                  toHit: '7',
                  save: { ability: 7 },
                  damage: [{ formula: 5 }, ...warhammer.damage],
                  uses: { value: 'all' },
                },
                ...others,
              ],
            },
            { id: 'nameless' },
            ...rest,
          ],
        },
      },
    }) as any

    expect(event.data.character.sheet.actions).toEqual([
      {
        ...section,
        actions: [
          { ...warhammer, toHit: null, save: null, uses: null },
          ...others,
        ],
      },
      ...rest,
    ])
  })

  it('reads what else an action is used through, its attack modes and its ammunition, as sent from module 0.12.0', () => {
    const sheet = fullerSheet()
    const [section, ...rest] = sheet.actions
    const [warhammer, handaxe, ...others] = section.actions
    const blast = {
      id: 'blast',
      type: 'save',
      targets: {
        self: false,
        area: true,
        count: null,
        perLevel: null,
        affects: 'creature',
      },
    }
    const modes = [
      { value: 'oneHanded', label: 'One-Handed' },
      { value: 'thrown', label: 'Thrown' },
    ]
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          actions: [
            {
              ...section,
              actions: [
                {
                  ...warhammer,
                  activity: blast,
                  ammunition: [
                    { id: 'bolts', name: 'Bolts', quantity: 'many' },
                  ],
                },
                { ...handaxe, attackModes: modes },
                {
                  ...others[0],
                  activity: { ...blast, type: 'summon' },
                  attackModes: 'all',
                },
                {
                  ...others[1],
                  activity: {
                    ...blast,
                    targets: { ...blast.targets, count: 0, perLevel: 'one' },
                  },
                },
              ],
            },
            ...rest,
          ],
        },
      },
    }) as any
    const [hammer, axe, guidance, breath] =
      event.data.character.sheet.actions[0].actions
    expect(hammer.activity).toEqual(blast)
    expect(hammer.ammunition).toEqual([
      { id: 'bolts', name: 'Bolts', quantity: 0 },
    ])
    expect(axe.attackModes).toEqual(modes)
    expect([guidance.activity, guidance.attackModes]).toEqual([null, null])
    expect(breath.activity.targets).toEqual({
      ...blast.targets,
      count: null,
      perLevel: null,
    })
  })

  it('reads what spells, features and items roll, as sent from module 0.13.0, leaving it out of those that roll nothing', () => {
    const sheet = fullerSheet()
    const [cantrips, ...spellbook] = sheet.spells
    const [fighter, ...origins] = sheet.features
    const [weapons, ...kinds] = sheet.inventory.sections
    const [backpack, ...containers] = sheet.inventory.containers
    const [rope, ...packed] = backpack.contents ?? []
    const flame = {
      toHit: null,
      activity: {
        id: 'flame',
        type: 'save',
        targets: {
          self: false,
          area: false,
          count: 1,
          perLevel: null,
          affects: 'creature',
        },
      },
      save: { ability: 'DEX', dc: 12 },
      damage: [{ formula: '1d8', type: 'Radiant', healing: false }],
    }
    const hammer = {
      activation: '1 Action',
      range: 'reach 5 ft',
      target: '1 Creature',
      concentration: false,
      toHit: 7,
      attackId: 'swing',
      attackModes: null,
      ammunition: null,
      save: null,
      damage: [{ formula: '1d8 + 4', type: 'Bludgeoning', healing: false }],
    }
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          spells: [
            { ...cantrips, spells: [{ ...cantrips.spells[0], ...flame }] },
            ...spellbook,
          ],
          features: [
            {
              ...fighter,
              features: [
                {
                  ...fighter.features[0],
                  range: 'Self',
                  target: null,
                  concentration: false,
                  ...flame,
                },
                {
                  ...fighter.features[1],
                  toHit: 'high',
                  damage: 'lots',
                  range: 5,
                },
              ],
            },
            ...origins,
          ],
          inventory: {
            ...sheet.inventory,
            sections: [
              {
                ...weapons,
                items: [{ ...weapons.items[0], ...hammer }, weapons.items[1]],
              },
              ...kinds,
            ],
            containers: [
              { ...backpack, contents: [{ ...rope, ...hammer }, ...packed] },
              ...containers,
            ],
          },
        },
      },
    }) as any

    const read = event.data.character.sheet
    expect(read.spells[0].spells[0]).toEqual({
      ...cantrips.spells[0],
      ...flame,
    })
    expect(read.features[0].features).toEqual([
      {
        ...fighter.features[0],
        range: 'Self',
        target: null,
        concentration: false,
        ...flame,
      },
      { ...fighter.features[1], toHit: null, damage: [], range: null },
    ])
    expect(read.inventory.sections[0].items[0]).toEqual({
      ...weapons.items[0],
      ...hammer,
    })
    expect(read.inventory.containers[0].contents[0]).toEqual({
      ...rope,
      ...hammer,
    })
    // Those that roll nothing are read as sent, with none of it.
    expect(read.spells[1].spells).toEqual(spellbook[0].spells)
    expect(read.features[1]).toEqual(origins[0])
    expect(read.inventory.sections[0].items[1]).toEqual(weapons.items[1])
    expect(Object.keys(read.inventory.sections[0].items[1]).toSorted()).toEqual(
      Object.keys(weapons.items[1]).toSorted(),
    )
  })

  it("reads each of an item's activities, and whether one spends a spell slot, as sent from module 0.14.0", () => {
    const sheet = fullerSheet()
    const [section, ...rest] = sheet.actions
    const [warhammer, ...others] = section.actions
    const [cantrips, ...spellbook] = sheet.spells
    const swing = {
      id: 'swing',
      name: 'Attack',
      type: 'attack',
      activation: '1 Action',
      range: 'reach 5 ft',
      target: null,
      toHit: 7,
      attackId: 'swing',
      activity: null,
      attackModes: null,
      ammunition: null,
      save: null,
      damage: [{ formula: '1d8 + 4', type: 'Bludgeoning', healing: false }],
      uses: null,
    }
    const shove = {
      ...swing,
      id: 'shove',
      name: 'Grapple/Shove',
      type: 'save',
      range: '5 ft',
      toHit: null,
      attackId: null,
      activity: {
        id: 'shove',
        type: 'save',
        targets: {
          self: false,
          area: false,
          count: 1,
          perLevel: null,
          affects: 'creature',
        },
      },
      save: { ability: 'DC', dc: 15 },
      damage: [],
    }
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          actions: [
            {
              ...section,
              actions: [
                {
                  ...warhammer,
                  activities: [
                    swing,
                    shove,
                    { id: 7 },
                    { ...shove, id: 'trip', consumesSlot: 'never' },
                  ],
                },
                ...others,
              ],
            },
            ...rest,
          ],
          spells: [
            {
              ...cantrips,
              spells: [
                {
                  ...cantrips.spells[0],
                  toHit: null,
                  save: null,
                  damage: [],
                  consumesSlot: false,
                  activities: 'many',
                },
              ],
            },
            ...spellbook,
          ],
        },
      },
    }) as any

    const read = event.data.character.sheet
    // A malformed one is dropped, and a slot spent unless it's said none is.
    expect(read.actions[0].actions[0].activities).toEqual([
      swing,
      shove,
      { ...shove, id: 'trip', consumesSlot: true },
    ])
    expect(read.actions[0].actions[1]).not.toHaveProperty('activities')
    expect(read.spells[0].spells[0]).toMatchObject({
      consumesSlot: false,
      activities: [],
    })
  })

  it('reads an item under each kind of action it has, the spells it casts and what is used up, as sent from module 0.15.0', () => {
    const sheet = fullerSheet()
    const [section, ...rest] = sheet.actions
    const [warhammer, ...others] = section.actions
    const cast = { level: 1, concentration: false, charges: 1, short: true }
    const barbs = {
      id: 'cast-barbs',
      name: 'Silvery Barbs',
      type: 'cast',
      activation: 'Reaction',
      activationType: 'reaction',
      range: '60 ft',
      target: null,
      toHit: null,
      attackId: null,
      activity: null,
      attackModes: null,
      ammunition: null,
      save: null,
      damage: [],
      cast,
      uses: null,
    }
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          actions: [
            {
              ...section,
              actions: [
                {
                  ...warhammer,
                  activityName: 'Silvery Barbs',
                  activationType: 'reaction',
                  consumable: true,
                  cast: { ...cast, text: TEXTS.shield },
                  activities: [barbs, { ...barbs, id: 'odd', cast: 'yes' }],
                },
                {
                  ...others[0],
                  activityName: 7,
                  activationType: 5,
                  consumable: 'yes',
                  cast: { level: 'high', short: 'no' },
                },
                ...others.slice(1),
              ],
            },
            ...rest,
          ],
        },
      },
    }) as any

    const [read, odd] = event.data.character.sheet.actions[0].actions
    expect(read).toMatchObject({
      activityName: 'Silvery Barbs',
      activationType: 'reaction',
      consumable: true,
      cast: { ...cast, text: TEXTS.shield },
      activities: [barbs, { ...barbs, id: 'odd', cast: null }],
    })
    // Malformed, each reads as though it weren't sent.
    expect(odd).toMatchObject({
      activityName: null,
      activationType: null,
      consumable: false,
      cast: { level: 0, concentration: false, charges: null, short: false },
    })
  })

  it("reads an action's own formula, and whom an area attack is made at, of actions, activities and favorites, from module 0.16.0", () => {
    const sheet = fullerSheet()
    const [section, bonus, ...rest] = sheet.actions
    const [warhammer, handaxe, guidance, breath] = section.actions
    const [resource, item, fireball, ...favorites] = sheetFavorites()
    const light = { formula: '1d4 + 3', name: 'Light radius' }
    const cone = { count: 3, perLevel: 1, affects: 'creature' }
    const shine = {
      id: 'shine',
      name: 'Shine',
      type: 'utility',
      activation: '1 Action',
      range: 'Self',
      target: null,
      toHit: null,
      attackId: null,
      activity: null,
      attackModes: null,
      ammunition: null,
      save: null,
      damage: [],
      uses: null,
    }
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          actions: [
            {
              ...section,
              actions: [
                {
                  ...warhammer,
                  rollFormula: light,
                  attackArea: cone,
                  activities: [
                    { ...shine, rollFormula: light, attackArea: cone },
                    { ...shine, id: 'odd', rollFormula: 'radius' },
                  ],
                },
                {
                  ...handaxe,
                  rollFormula: { formula: '' },
                  attackArea: { count: 0, perLevel: 'one', affects: 5 },
                },
                {
                  ...guidance,
                  rollFormula: { formula: 'x'.repeat(501), name: 'Long' },
                  attackArea: 'cone',
                },
                {
                  ...breath,
                  rollFormula: { formula: '2d6' },
                  attackArea: { count: null, affects: null },
                },
              ],
            },
            bonus,
            ...rest,
          ],
          favorites: [
            resource,
            item,
            { ...fireball, rollFormula: light, attackArea: cone },
            ...favorites,
          ],
        },
      },
    }) as any

    const read = event.data.character.sheet
    const [hammer, axe, odd, fire] = read.actions[0].actions
    expect(hammer).toMatchObject({ rollFormula: light, attackArea: cone })
    expect(hammer.activities).toEqual([
      { ...shine, rollFormula: light, attackArea: cone },
      { ...shine, id: 'odd', rollFormula: null },
    ])
    // Malformed, a formula is none; an area keeps what it can read of whom it's made at.
    expect([axe.rollFormula, axe.attackArea]).toEqual([
      null,
      { count: null, perLevel: null, affects: null },
    ])
    expect([odd.rollFormula, odd.attackArea]).toEqual([null, null])
    expect([fire.rollFormula, fire.attackArea]).toEqual([
      { formula: '2d6', name: null },
      { count: null, perLevel: null, affects: null },
    ])
    expect(read.favorites[2]).toEqual({
      ...fireball,
      rollFormula: light,
      attackArea: cone,
    })
    // As an older module sends it, an action has neither.
    expect(read.actions[1].actions[0]).not.toHaveProperty('rollFormula')
    expect(read.actions[1].actions[0]).not.toHaveProperty('attackArea')
  })

  it('reads the spell copy a Cast is of, and what an activity says of itself, of actions, activities, favorites and items, from module 0.17.0', () => {
    const sheet = fullerSheet()
    const [section, ...rest] = sheet.actions
    const [warhammer, handaxe, ...actions] = section.actions
    const [resource, item, fireball, ...favorites] = sheetFavorites()
    const [weapons, ...kinds] = sheet.inventory.sections
    const casts = {
      level: 1,
      concentration: false,
      charges: 1,
      short: false,
      text: TEXTS.bless,
    }
    const wisp = {
      id: 'wisp',
      name: 'Starry Wisp',
      type: 'cast',
      activation: '1 Action',
      range: '60 ft',
      target: null,
      toHit: 5,
      attackId: 'wisp',
      activity: null,
      attackModes: null,
      ammunition: null,
      save: null,
      damage: [],
      uses: null,
      cast: casts,
      spellId: 'wispCopy',
      duration: '1 Round',
      trigger: null,
      text: TEXTS.ring,
    }
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          actions: [
            {
              ...section,
              actions: [
                {
                  ...warhammer,
                  cast: casts,
                  spellId: 'wispCopy',
                  activities: [
                    wisp,
                    {
                      ...wisp,
                      id: 'odd',
                      spellId: 7,
                      duration: 3,
                      trigger: ['hit'],
                      text: 'Starry Wisp',
                    },
                    {
                      ...wisp,
                      id: 'barbs',
                      trigger: 'When a creature succeeds on a save',
                      spellId: '',
                    },
                  ],
                },
                handaxe,
                ...actions,
              ],
            },
            ...rest,
          ],
          favorites: [
            resource,
            item,
            {
              ...fireball,
              cast: casts,
              spellId: 'fireballCopy',
              duration: 'Instantaneous',
              trigger: null,
              text: TEXTS.shield,
            },
            ...favorites,
          ],
          inventory: {
            ...sheet.inventory,
            sections: [
              {
                ...weapons,
                items: [
                  { ...weapons.items[0], cast: casts, spellId: 'wispCopy' },
                  { ...weapons.items[1], cast: 'yes', spellId: 3 },
                ],
              },
              ...kinds,
            ],
          },
        },
      },
    }) as any

    const read = event.data.character.sheet
    const [hammer, axe] = read.actions[0].actions
    expect(hammer).toMatchObject({ cast: casts, spellId: 'wispCopy' })
    expect(hammer.activities).toEqual([
      wisp,
      {
        ...wisp,
        id: 'odd',
        spellId: null,
        duration: null,
        trigger: null,
        text: null,
      },
      {
        ...wisp,
        id: 'barbs',
        trigger: 'When a creature succeeds on a save',
        spellId: null,
      },
    ])
    expect(read.favorites[2]).toEqual({
      ...fireball,
      cast: casts,
      spellId: 'fireballCopy',
      duration: 'Instantaneous',
      trigger: null,
      text: TEXTS.shield,
    })
    expect(read.inventory.sections[0].items[0]).toEqual({
      ...weapons.items[0],
      cast: casts,
      spellId: 'wispCopy',
    })
    expect(read.inventory.sections[0].items[1]).toEqual({
      ...weapons.items[1],
      cast: null,
      spellId: null,
    })
    // As an older module sends them, they have none of these.
    for (const unsent of [
      axe,
      read.favorites[1],
      read.inventory.containers[0],
    ]) {
      for (const field of ['spellId', 'duration', 'trigger', 'cast']) {
        expect(unsent).not.toHaveProperty(field)
      }
    }
  })

  describe('the levels a spell an item casts may be cast at, from module 0.20.0', () => {
    const levels = [
      { level: 1, charges: 1, short: false },
      { level: 2, charges: 2, short: false },
      { level: 3, charges: 3, short: true },
    ]
    const cast = { level: 1, concentration: false, charges: 1, short: false }

    it('reads each, with the charges it spends there and whether fewer are left', () => {
      for (const read of readCast({ ...cast, levels })) {
        expect(read).toEqual({ ...cast, levels })
      }
      // What's said of a level that can't be read is taken as for nothing, or enough left.
      const [read] = readCast({
        ...cast,
        levels: [
          { level: 1, charges: 1, short: false },
          { level: 2, charges: 'two', short: 'no' },
        ],
      })
      expect(read.levels).toEqual([
        { level: 1, charges: 1, short: false },
        { level: 2, charges: null, short: false },
      ])
    })

    it.each([
      ['out of order', [levels[0], levels[2], levels[1]]],
      ['twice the same', [levels[0], levels[1], levels[1]]],
      ['at level 0', [{ level: 0, charges: 0, short: false }, ...levels]],
      ['at level 10', [...levels, { level: 10, charges: 10, short: true }]],
      ['not from the level it is cast at', levels.slice(1)],
      ['just one', levels.slice(0, 1)],
      [
        'ten of them',
        Array.from({ length: 10 }, (_, index) => ({
          level: index + 1,
          charges: index + 1,
          short: false,
        })),
      ],
      ['not a list', 'spell1-spell3'],
    ])('leaves them out, the rest of the cast kept, %s', (_name, sent) => {
      for (const read of readCast({ ...cast, levels: sent })) {
        expect(read).toEqual(cast)
        expect(read).not.toHaveProperty('levels')
      }
    })

    it('leaves them out as an older module does', () => {
      for (const read of readCast(cast)) {
        expect(read).toEqual(cast)
        expect(read).not.toHaveProperty('levels')
      }
    })
  })

  it('reads the formulas and areas of spells, features and items, from module 0.16.0, leaving them out where not sent', () => {
    const sheet = fullerSheet()
    const [cantrips, ...spellbook] = sheet.spells
    const [fighter, ...origins] = sheet.features
    const [weapons, ...kinds] = sheet.inventory.sections
    const light = { formula: '1d4 + 3', name: 'Light radius' }
    const cone = { count: null, perLevel: null, affects: 'creature' }
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: {
          ...sheet,
          spells: [
            {
              ...cantrips,
              spells: [
                { ...cantrips.spells[0], rollFormula: light, attackArea: cone },
              ],
            },
            ...spellbook,
          ],
          features: [
            {
              ...fighter,
              features: [
                {
                  ...fighter.features[0],
                  rollFormula: { formula: 7 },
                  attackArea: { count: 'two', affects: 'creature' },
                },
                fighter.features[1],
              ],
            },
            ...origins,
          ],
          inventory: {
            ...sheet.inventory,
            sections: [
              {
                ...weapons,
                items: [
                  { ...weapons.items[0], rollFormula: light },
                  weapons.items[1],
                ],
              },
              ...kinds,
            ],
          },
        },
      },
    }) as any

    const read = event.data.character.sheet
    expect(read.spells[0].spells[0]).toEqual({
      ...cantrips.spells[0],
      rollFormula: light,
      attackArea: cone,
    })
    // Malformed, a formula is none; an area keeps what it can read of whom it's made at.
    expect(read.features[0].features[0]).toEqual({
      ...fighter.features[0],
      rollFormula: null,
      attackArea: { count: null, perLevel: null, affects: 'creature' },
    })
    expect(read.inventory.sections[0].items[0]).toEqual({
      ...weapons.items[0],
      rollFormula: light,
    })
    for (const unsent of [
      read.features[0].features[1],
      read.inventory.sections[0].items[0],
      read.inventory.sections[0].items[1],
    ]) {
      expect(unsent).not.toHaveProperty('attackArea')
    }
    expect(read.features[0].features[1]).not.toHaveProperty('rollFormula')
    expect(read.inventory.sections[0].items[1]).not.toHaveProperty(
      'rollFormula',
    )
  })

  it('reads a sheet from before module 0.8.0 as having no actions', () => {
    const { actions, ...older } = characterSheet()
    const event = parseGameEvent('character.updated', {
      character: { ...roster[0], sheet: older },
    }) as any

    expect(actions).toEqual([])
    expect(event.data.character.sheet.actions).toEqual([])
  })

  it('reads favorites of every kind, as sent from module 0.9.0', () => {
    const favorites = sheetFavorites()
    const event = parseGameEvent('character.updated', {
      character: { ...roster[0], sheet: fullerSheet({ favorites }) },
    }) as any

    expect(event.data.character.sheet.favorites).toEqual(favorites)
  })

  it("drops a malformed favorite, or one of a kind it doesn't know, rather than the sheet", () => {
    const [resource, warhammer, fireball, bless, perception, tools, slots] =
      sheetFavorites()
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: fullerSheet({
          favorites: [
            { type: 'facility', id: 'forge', name: 'Forge' },
            { type: 'item', name: 'No id' },
            'warhammer',
            { ...resource, uses: { value: 'all' } },
            { ...warhammer, itemType: 7, img: 7 },
            {
              ...fireball,
              toHit: '+7',
              save: { ability: 7 },
              damage: [
                { formula: 5 },
                ...(fireball as SheetActivityFavorite).damage,
              ],
            },
            { ...bless, disabled: 'yes', suppressed: undefined },
            { ...perception, name: undefined },
            { ...tools, total: '+5' },
            { ...tools, id: 'herb', passive: '12', mode: 2 },
            { ...slots, level: 'first' },
          ] as any,
        }),
      },
    }) as any

    expect(event.data.character.sheet.favorites).toEqual([
      { ...resource, uses: null },
      { ...warhammer, itemType: '', img: null },
      { ...fireball, toHit: null, save: null },
      { ...bless, disabled: false, suppressed: false },
      { ...perception, name: '' },
      { ...tools, id: 'herb', passive: null, mode: 0 },
      { ...slots, level: null },
    ])
  })

  it('reads the feature a resource stands for, from module 0.23.0, keeping the resource where it is malformed', () => {
    const [resource] = sheetFavorites()
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: fullerSheet({
          favorites: [
            { ...resource, itemId: 'second-wind' },
            { ...resource, id: 'secondary', itemId: null },
            { ...resource, id: 'tertiary' },
            { ...resource, id: 'quaternary', itemId: 7 },
          ] as any,
        }),
      },
    }) as any
    const read = event.data.character.sheet.favorites

    expect(read).toEqual([
      { ...resource, itemId: 'second-wind' },
      { ...resource, id: 'secondary', itemId: null },
      { ...resource, id: 'tertiary' },
      { ...resource, id: 'quaternary' },
    ])
    // Absent, from an older module, or malformed: the app finds the feature by name.
    expect(read[2].itemId).toBeUndefined()
    expect(read[3].itemId).toBeUndefined()
  })

  it('reads the tools the character has, from module 0.18.0, dropping a malformed one; none before', () => {
    const thief = {
      id: 'thief',
      name: "Thieves' Tools",
      ability: 'dex',
      total: 5,
      passive: null,
      proficiency: 1,
      mode: 0,
    }
    const herb = { ...thief, id: 'herb', name: 'Herbalism Kit' }

    expect(sheetWithTools([thief, herb]).tools).toEqual([thief, herb])
    expect(
      sheetWithTools([
        { ...thief, total: '+5' },
        'herb',
        { ...herb, ability: 7, passive: '12', mode: 2, proficiency: 'yes' },
      ]).tools,
    ).toEqual([
      { ...herb, ability: null, passive: null, mode: 0, proficiency: 0 },
    ])
    expect(sheetWithTools('all').tools).toEqual([])
    expect(sheetWithTools().tools).toBeUndefined()
  })

  it('reads a sheet from before module 0.9.0 as having no favorites', () => {
    const { favorites, ...older } = characterSheet()
    const event = parseGameEvent('character.updated', {
      character: { ...roster[0], sheet: older },
    }) as any

    expect(favorites).toEqual([])
    expect(event.data.character.sheet.favorites).toEqual([])
  })

  it("reads an inventory or details it can't make sense of as empty", () => {
    const event = parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: { ...fullerSheet(), inventory: 'lots', details: 'none' },
      },
    }) as any

    expect(event.data.character.sheet).toMatchObject({
      inventory: {
        sections: [],
        containers: [],
        currency: [],
        encumbrance: null,
        attunement: null,
      },
      details: {
        about: [],
        personality: [],
        appearance: null,
        xp: null,
        biography: null,
      },
    })
  })

  it('reads a sheet from before module 0.7.0 as having no items, spells, traits or biography', () => {
    const {
      inventory,
      spellcasting,
      spells,
      traits,
      deathSaves,
      details,
      ...older
    } = characterSheet()
    const event = parseGameEvent('character.updated', {
      character: { ...roster[0], sheet: older },
    }) as any

    expect(event.data.character.sheet).toMatchObject({
      inventory,
      spellcasting,
      spells,
      traits,
      deathSaves,
      details,
    })
    expect(event.data.character.sheet.spellcasting).toBeNull()
  })

  it('reads character.texts, dropping any description that is malformed', () => {
    expect(
      parseGameEvent('character.texts', {
        texts: {
          [TEXTS.bless]: '<p>Bless</p>',
          'not-a-hash': '<p>Odd</p>',
          [TEXTS.fighter]: 5,
          [TEXTS.poisoned]: 'x'.repeat(200_001),
        },
      }),
    ).toEqual({
      type: 'character.texts',
      data: { texts: { [TEXTS.bless]: '<p>Bless</p>' } },
    })
    expect(() => parseGameEvent('character.texts', {})).toThrow()
  })

  it("drops a sheet it can't read, keeping the character", () => {
    const event = parseGameEvent('character.updated', {
      character: { ...roster[0], sheet: { abilities: 'many' } },
    }) as any

    expect(event.data.character).toEqual({ ...roster[0], sheet: null })
  })

  it('refuses character.updated without its character', () => {
    expect(() => parseGameEvent('character.updated', {})).toThrow()
  })

  it('fills in what a message only displays when it is missing or odd', () => {
    const event = parseGameEvent('chat.message.created', {
      message: {
        id: 'm1',
        timestamp: 1,
        audience: { public: true, characters: [] },
        flavor: 7,
        rolls: 'nope',
      },
    })

    expect(event?.data).toEqual({
      message: {
        id: 'm1',
        type: 'base',
        timestamp: 1,
        speaker: { alias: null, actorId: null },
        author: null,
        character: null,
        title: null,
        flavor: '',
        text: '',
        audience: { public: true, characters: [] },
        rolls: [],
        dnd5e: null,
      },
    })
  })

  it('reads a roll and dnd5e data', () => {
    const roll = {
      class: 'D20Roll',
      formula: '2d20kh + 7',
      total: 24,
      dice: [{ faces: 20, results: [{ result: 17, active: true }] }],
      advantage: true,
    }
    const dnd5e = {
      messageType: 'roll',
      roll: { type: 'skill', skillId: 'acr' },
      item: null,
      activity: null,
      targets: [{ name: 'Goblin', uuid: 'x' }],
    }
    const event = parseGameEvent('chat.message.updated', {
      changes: ['rolls'],
      message: {
        id: 'm1',
        timestamp: 1,
        audience: { public: true, characters: [] },
        rolls: [roll],
        dnd5e,
      },
    })

    expect(event?.data).toMatchObject({
      message: { rolls: [roll], dnd5e },
    })
  })

  it("reads module 0.28.0's marks on a roll, and leaves out those that don't hold up", () => {
    const marks = {
      class: 'DamageRoll',
      damage: true,
      damageLabel: ' Stich ',
      section: 'bonus',
      flavor: ' Sneak Attack ',
      attack: true,
    }

    expect(rollWith(marks)).toEqual({
      formula: '1d6',
      total: 4,
      dice: [],
      ...marks,
      damageLabel: 'Stich',
      flavor: 'Sneak Attack',
    })
    const junk = rollWith({
      class: 7,
      damage: 'yes',
      damageLabel: '  ',
      section: 'weird',
      flavor: 'x'.repeat(101),
      attack: 1,
    })
    // Left out: undefined, which the stored JSON has none of.
    expect(junk).toEqual({ formula: '1d6', total: 4, dice: [] })
    expect(rollWith({})).toEqual({ formula: '1d6', total: 4, dice: [] })
  })

  it('reads what marks a combat roll, and drops a malformed armor class', () => {
    expect(
      messageWith({
        roll: { type: 'attack' },
        item: { name: 'Fire Bolt', type: 'spell' },
        targets: [
          { name: 'Goblin', ac: 15 },
          { name: 'Wisp', ac: 'high' },
        ],
        originatingMessage: 'm0',
      }).message.dnd5e,
    ).toMatchObject({
      item: { name: 'Fire Bolt', type: 'spell' },
      targets: [{ name: 'Goblin', ac: 15 }, { name: 'Wisp' }],
      originatingMessage: 'm0',
    })
    expect(
      messageWith({ item: { name: 'Club', type: 7 }, originatingMessage: 3 })
        .message.dnd5e,
    ).toMatchObject({
      item: { name: 'Club', type: null },
      originatingMessage: null,
    })
  })

  describe("a message's ask", () => {
    it('reads the saving throw a roll request card asks the table for, from module 0.17.0', () => {
      expect(
        askOf({
          type: 'save',
          abilities: ['str', 'dex', 'dex'],
          dc: 15,
          label: ' Worn Bardic Eternal Flame ',
        }),
      ).toEqual({
        type: 'save',
        abilities: ['str', 'dex'],
        dc: 15,
        label: 'Worn Bardic Eternal Flame',
      })
      expect(askOf({ type: 'concentration', abilities: [] })).toEqual({
        type: 'concentration',
        abilities: [],
      })
    })

    it('tells a message that asks nothing from an older module, which sends no ask', () => {
      expect(askOf(null)).toBeNull()
      expect(askOf()).toBe('absent')
    })

    it.each([
      ['an ability dnd5e lacks', { abilities: ['luck'] }],
      ['a name any object answers to', { abilities: ['constructor'] }],
      ['a prototype', { abilities: ['__proto__'] }],
      ['no ability for a save', { abilities: [] }],
      [
        'too many abilities',
        { abilities: Array.from({ length: 7 }, () => 'dex') },
      ],
      ['another kind', { type: 'attack' }],
      ['a check with no ways to make it', { type: 'check' }],
      ['abilities that are not a list', { abilities: 'dex' }],
    ])(
      'takes an ask with %s as none, not as from an older module',
      (_name, fields) => {
        expect(
          askOf({ type: 'save', abilities: ['dex'], ...fields }),
        ).toBeNull()
        expect(askOf('Dexterity')).toBeNull()
      },
    )

    it('reads the check a roll request card asks the table for, from module 0.18.0', () => {
      const checks = [
        { type: 'skill', ability: 'str', skill: 'ath' },
        {
          type: 'tool',
          ability: 'dex',
          tool: 'thief',
          name: " Thieves' Tools ",
        },
        { type: 'check', ability: 'int' },
      ]

      expect(
        askOf({ type: 'check', checks, dc: 15, label: 'Cloak of Climbing' }),
      ).toEqual({
        type: 'check',
        checks: [
          { type: 'skill', ability: 'str', skill: 'ath' },
          {
            type: 'tool',
            ability: 'dex',
            tool: 'thief',
            name: "Thieves' Tools",
          },
          { type: 'check', ability: 'int' },
        ],
        dc: 15,
        label: 'Cloak of Climbing',
      })
      // A Gamemaster's card, which nothing names, and whose DC players may not see.
      expect(askOf({ type: 'check', checks: [checks[2]] })).toEqual({
        type: 'check',
        checks: [{ type: 'check', ability: 'int' }],
      })
    })

    it.each([
      ['no ways', []],
      [
        'more than ten ways',
        Array.from({ length: 11 }, () => ({ type: 'check', ability: 'str' })),
      ],
      ['an ability dnd5e lacks', [{ type: 'check', ability: 'san' }]],
      ['a name any object answers to', [{ type: 'check', ability: 'valueOf' }]],
      ['a kind of roll that isn’t a check', [{ type: 'save', ability: 'dex' }]],
      ['a skill check of no skill', [{ type: 'skill', ability: 'str' }]],
      [
        'a skill check of a tool',
        [{ type: 'skill', ability: 'dex', tool: 'thief' }],
      ],
      [
        'a tool check of a skill too',
        [{ type: 'tool', ability: 'dex', tool: 'thief', skill: 'slt' }],
      ],
      [
        'an ability check of a skill',
        [{ type: 'check', ability: 'str', skill: 'ath' }],
      ],
      [
        'a key that isn’t one',
        [{ type: 'skill', ability: 'str', skill: 'ath|acr' }],
      ],
      [
        'one way that doesn’t hold up among others',
        [
          { type: 'check', ability: 'str' },
          { type: 'check', ability: 'luck' },
        ],
      ],
      ['ways that are not a list', { type: 'check', ability: 'str' }],
    ])('takes a check asked for with %s as none', (_name, checks) => {
      expect(askOf({ type: 'check', checks, dc: 15 })).toBeNull()
    })

    it('leaves out a tool’s name too long or not one', () => {
      const tool = { type: 'tool', ability: 'dex', tool: 'thief' }

      for (const name of ['x'.repeat(101), 7, '  ']) {
        expect(askOf({ type: 'check', checks: [{ ...tool, name }] })).toEqual({
          type: 'check',
          checks: [tool],
        })
      }
    })

    it.each([
      ['of 0', 0],
      ['of 100', 100],
      ['in part', 12.5],
      ['in words', '15'],
    ])('leaves out a DC %s, and a label too long or not one', (_name, dc) => {
      expect(
        askOf({ type: 'save', abilities: ['dex'], dc, label: 'x'.repeat(201) }),
      ).toEqual({ type: 'save', abilities: ['dex'] })
      expect(askOf({ type: 'save', abilities: ['dex'], label: 7 })).toEqual({
        type: 'save',
        abilities: ['dex'],
      })
      expect(askOf({ type: 'save', abilities: ['dex'], label: '  ' })).toEqual({
        type: 'save',
        abilities: ['dex'],
      })
    })
  })

  it('refuses a message without what routing it needs', () => {
    expect(() =>
      parseGameEvent('chat.message.created', { message: { id: 'm1' } }),
    ).toThrow(/timestamp/)
  })

  it.each([
    ['chat.message.deleted', { id: 'm1' }],
    ['combat.combatant.removed', { combatId: 'c', combatantId: 'x' }],
  ])('reads %s', (type, data) => {
    expect(parseGameEvent(type, data)).toEqual({ type, data })
  })

  it('reads chat.cleared, which carries nothing', () => {
    expect(parseGameEvent('chat.cleared', { extra: 1 })).toEqual({
      type: 'chat.cleared',
      data: {},
    })
  })

  it.each([
    'combat.created',
    'combat.started',
    'combat.turn',
    'combat.updated',
    'combat.ended',
  ])('reads %s', type => {
    expect(parseGameEvent(type, { combat: combat() })).toEqual({
      type,
      data: { combat: combat() },
    })
  })

  it('reads a combatant, with or without hit points', () => {
    const event = parseGameEvent('combat.combatant.added', {
      combatId: 'cmbt1',
      combatant: { id: 'c1', name: 'Goblin', hp: 'secret' },
    })

    expect(event?.data).toEqual({
      combatId: 'cmbt1',
      combatant: {
        id: 'c1',
        name: 'Goblin',
        initiative: null,
        defeated: false,
        character: null,
        playerOwned: false,
        hp: null,
      },
    })
  })

  it.each([
    ['friendly', 'friendly'],
    ['neutral', 'neutral'],
    ['hostile', 'hostile'],
    [null, null],
    // Never kept: what the game calls a secret one, by name or by number, or anything else.
    ['secret', undefined],
    [-2, undefined],
    [1, undefined],
    [undefined, undefined],
  ])(
    'reads a combatant disposed %p as %p, from module 0.29.0',
    (sent, read) => {
      const event = parseGameEvent('combat.combatant.updated', {
        combatId: 'cmbt1',
        combatant: { id: 'c1', name: 'Goblin', disposition: sent },
      }) as any

      expect(event.data.combatant.disposition).toBe(read)
      expect(JSON.stringify(event)).not.toMatch(/secret|-2/)
    },
  )

  it('refuses a combat without its turn state', () => {
    expect(() =>
      parseGameEvent('combat.turn', { combat: { id: 'cmbt1' } }),
    ).toThrow()
  })

  describe('checks activities ask for, and activities that use others, from module 0.21.0', () => {
    it('reads them on actions, activities, spells and items, as sent', () => {
      const sheet = checkingSheet()
      const event = parseGameEvent('character.updated', {
        character: { ...roster[0], sheet },
      }) as any
      const read = event.data.character.sheet
      const [tools, maze, bless] = read.actions[0].actions
      const [fastHands] = read.actions[1].actions
      expect(tools.check).toEqual(LOCK_CHECK)
      expect(tools.activity.type).toBe('check')
      expect(maze.check).toEqual(MAZE_CHECK)
      expect(fastHands.check).toEqual(SLEIGHT_CHECK)
      expect(fastHands.activities.map((each: any) => each.check)).toEqual(
        sheet.actions[1].actions[0].activities!.map(each => each.check),
      )
      expect(bless.activities[1]).toEqual(
        sheet.actions[0].actions[2].activities![1],
      )
      expect(read.spells[1].spells[0].check).toEqual(MAZE_CHECK)
      expect(read.spells[0].spells[0].activities[1].forward).toEqual({
        charges: 1,
        short: false,
      })
      expect(read.inventory.sections[0].items[0].check).toEqual(LOCK_CHECK)
    })

    it('reads them on a favorite activity', () => {
      for (const read of readRolls({
        activity: {
          id: 'act',
          type: 'check',
          targets: {
            self: false,
            area: false,
            count: 1,
            perLevel: null,
            affects: 'creature',
          },
        },
        check: LOCK_CHECK,
        forward: { charges: 2, short: true },
      })) {
        expect(read.activity.type).toBe('check')
        expect(read.check).toEqual(LOCK_CHECK)
        expect(read.forward).toEqual({ charges: 2, short: true })
      }
    })

    it('reads an ability check, and drops a malformed way to make one, or one twice', () => {
      const [read] = readRolls({
        check: {
          checks: [
            { type: 'check', ability: 'str' },
            { type: 'skill', ability: 'dex' },
            { type: 'skill', ability: 'dex', key: 'slt', bonus: 'two' },
            { type: 'tool', ability: 'luck', key: 'thief' },
            { type: 'check', ability: 'str', key: 'ath' },
            { type: 'vehicle', ability: 'dex', key: 'land' },
            { type: 'skill', ability: 'int', key: 'slt' },
            'Sleight of Hand',
          ],
          dc: 13,
          own: true,
        },
      })
      expect(read.check).toEqual({
        checks: [
          { type: 'check', ability: 'str' },
          { type: 'skill', ability: 'dex', key: 'slt' },
        ],
        dc: 13,
        own: true,
      })
    })

    it('takes a DC it can’t read as none, and one whose maker it can’t read as another’s', () => {
      const [read] = readRolls({
        check: { ...LOCK_CHECK, dc: 100, own: 'yes' },
      })
      expect(read.check).toEqual({ ...LOCK_CHECK, dc: null, own: false })
    })

    it.each([
      ['no way to make it', { ...LOCK_CHECK, checks: [] }],
      ['no way it can read', { ...LOCK_CHECK, checks: [{ type: 'skill' }] }],
      [
        'more than ten ways',
        {
          ...LOCK_CHECK,
          checks: [
            'acr',
            'ani',
            'arc',
            'ath',
            'dec',
            'his',
            'ins',
            'itm',
            'inv',
            'med',
            'nat',
          ].map(key => ({ type: 'skill', ability: 'dex', key })),
        },
      ],
      ['not an object', 'Sleight of Hand'],
    ])('leaves out a check with %s, the activity kept', (_name, check) => {
      for (const read of readRolls({
        activity: {
          id: 'act',
          type: 'check',
          targets: {
            self: true,
            area: false,
            count: null,
            perLevel: null,
            affects: null,
          },
        },
        check,
      })) {
        expect(read).not.toHaveProperty('check', expect.anything())
        expect(read.activity.type).toBe('check')
      }
    })

    it('reads what an activity that uses another spends, as nothing where it can’t, or not enough left where it can’t say', () => {
      expect(readRolls({ forward: { charges: 1.5, short: 'no' } })[0]).toEqual(
        expect.objectContaining({ forward: { charges: null, short: false } }),
      )
      for (const read of readRolls({ forward: 'one use' })) {
        expect(read).not.toHaveProperty('forward', expect.anything())
      }
    })

    it('reads one that spends nothing as sent, and spending fewer than none as nothing it can say', () => {
      for (const read of readRolls({ forward: { charges: 0, short: false } })) {
        expect(read.forward).toEqual({ charges: 0, short: false })
      }
      for (const read of readRolls({
        forward: { charges: -1, short: false },
      })) {
        expect(read.forward).toEqual({ charges: null, short: false })
      }
    })

    it('leaves them out as an older module does', () => {
      for (const read of readRolls({})) {
        expect(read).not.toHaveProperty('check')
        expect(read).not.toHaveProperty('forward')
      }
    })

    it('reads a hello saying whether a check an activity asks for is made against it', () => {
      const rolls = {
        enabled: true,
        kinds: ['skill', 'tool', 'ability', 'use'],
        reason: null,
      }
      expect(
        helloWith({ rolls: { ...rolls, activityChecks: true } }).features.rolls,
      ).toEqual({ ...rolls, activityChecks: true })
      expect(
        helloWith({ rolls: { ...rolls, activityChecks: 'yes' } }).features
          .rolls,
      ).toEqual({ ...rolls, activityChecks: false })
      // A module before 0.21.0 says nothing of it.
      expect(helloWith({ rolls }).features.rolls).not.toHaveProperty(
        'activityChecks',
      )
    })
  })
})

/** A sheet as read from character.updated. */
const readSheet = (sheet: unknown) =>
  (
    parseGameEvent('character.updated', {
      character: { ...roster[0], sheet },
    }) as any
  ).data.character.sheet

/** An enchant activity, as read wherever an action, activity or favorite has one. */
const readUse = (activity: unknown) =>
  readRolls({ activity }).map(read => read.activity)

/** A use's result, as read, with these fields. */
const enchantResult = (fields: object) =>
  parseGameEvent('command.result', {
    id: 'req-1',
    status: 'done',
    messageId: 'msg-1',
    visible: true,
    rolls: [],
    use: { type: 'enchant' },
    damage: null,
    ...fields,
  })?.data as any

describe('enchant activities and enchantments, from module 0.21.0', () => {
  const magicWeapon = enchantUse('mw-cast', {
    profiles: MAGIC_WEAPON_PROFILES,
    items: ['longsword', 'club'],
    applied: [
      { item: 'club', effect: 'effect000000001', profile: 'SLSudYaACjmmmZsU' },
    ],
  })

  it('reads what an enchant activity enchants, on spells, items, their activities, actions and favorites', () => {
    const sheet = enchantingSheet()
    const read = readSheet(sheet)
    expect(read.spells[1].spells[0].activity).toEqual(
      sheet.spells[1].spells[0].activity,
    )
    expect(read.spells[0].spells[0].activity.enchant.applied).toEqual([
      {
        item: 'quarterstaff',
        effect: 'shillEffect01',
        profile: 'Oy8fP2N3q4R5s6T7',
      },
    ])
    const flameTongue = read.inventory.sections[0].items[3]
    expect(flameTongue.activities[1].activity.enchant).toEqual({
      self: true,
      toggle: true,
      profiles: [
        { id: 'ablazeProfile01', name: 'Ablaze', min: null, max: null },
      ],
      items: [],
      applied: [],
    })
    for (const use of readUse(magicWeapon)) {
      expect(use).toEqual(magicWeapon)
    }
  })

  it.each([
    ['without what it enchants', { ...magicWeapon, enchant: undefined }],
    ['with what it enchants malformed', { ...magicWeapon, enchant: 'all' }],
    [
      'with no way to enchant',
      { ...magicWeapon, enchant: { ...magicWeapon.enchant, profiles: [] } },
    ],
    [
      'with no way it can read',
      {
        ...magicWeapon,
        enchant: {
          ...magicWeapon.enchant,
          profiles: [{ id: 'not an id', name: '+1', min: null, max: null }],
        },
      },
    ],
    [
      'that can’t say whether it enchants its own item',
      { ...magicWeapon, enchant: { ...magicWeapon.enchant, self: 'no' } },
    ],
  ])('reads an enchant activity %s as none, used in Foundry', (_name, use) => {
    for (const read of readUse(use)) expect(read).toBeNull()
  })

  it('drops a malformed way, item or enchantment applied, or one twice, the rest kept', () => {
    const [read] = readUse({
      ...magicWeapon,
      enchant: {
        ...magicWeapon.enchant,
        profiles: [
          ...MAGIC_WEAPON_PROFILES,
          MAGIC_WEAPON_PROFILES[0],
          { id: 'backwards000000', name: 'Backwards', min: 5, max: 4 },
          { id: 'unnamed00000000', name: '', min: null, max: null },
          { id: 'limitless000000', name: 'Limitless', min: 'low', max: null },
        ],
        items: ['longsword', 'longsword', 'the club', 42, 'club'],
        applied: [
          { item: 'club', effect: 'effect000000001' },
          ...magicWeapon.enchant!.applied,
        ],
      },
    })
    expect(read.enchant).toEqual({
      ...magicWeapon.enchant,
      profiles: MAGIC_WEAPON_PROFILES,
      items: ['longsword', 'club'],
    })
  })

  it('takes one that enchants its own item as enchanting no other, and only it as a switch', () => {
    const [own] = readUse({
      ...magicWeapon,
      enchant: { ...magicWeapon.enchant, self: true, toggle: 'yes' },
    })
    expect(own.enchant).toEqual(
      expect.objectContaining({ self: true, toggle: false, items: [] }),
    )
    const [other] = readUse({
      ...magicWeapon,
      enchant: { ...magicWeapon.enchant, toggle: true },
    })
    expect(other.enchant.toggle).toBe(false)
  })

  it('reads the enchantments on items, those in containers too, spells, features and actions', () => {
    const shining = {
      id: 'contFlame01',
      name: 'Continual Flame',
      source: 'Continual Flame',
      concentration: false,
      duration: '7 Days',
      expired: false,
      endable: true,
    }
    const enchantments = [
      shining,
      { ...shining, id: 'bad id', name: 'Bad' },
      { ...shining, id: 'unnamed', name: '  ' },
      {
        ...shining,
        id: 'odd',
        source: 7,
        concentration: 'yes',
        duration: 3,
        expired: 'no',
        endable: 1,
      },
      'Ablaze',
    ]
    const read = readSheet(
      enchantingSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'longsword',
                name: 'Longsword',
                enchantments,
              } as any),
            ],
          },
        ],
        features: [
          {
            id: 'class',
            label: 'Class Features',
            text: null,
            features: [
              {
                id: 'blade',
                name: 'Pact of the Blade',
                img: null,
                kind: null,
                requirements: null,
                activation: '1 Bonus Action',
                passive: false,
                uses: null,
                text: null,
                enchantments,
              } as any,
            ],
          },
        ],
        spells: [
          {
            id: 'spell1',
            label: '1st Level',
            slots: null,
            spells: [
              { ...enchantingSheet().spells[1].spells[0], enchantments } as any,
            ],
          },
        ],
        inventory: {
          ...enchantingSheet().inventory,
          containers: [
            {
              ...enchantingSheet().inventory.sections[1].items[0],
              id: 'bag',
              name: 'Bag',
              type: 'container',
              capacity: null,
              contents: [{ id: 'gem', name: 'Gem', enchantments }],
            } as any,
          ],
        },
      }),
    )
    const expected = [
      shining,
      {
        ...shining,
        id: 'odd',
        source: null,
        concentration: false,
        duration: null,
        expired: false,
        endable: false,
      },
    ]
    expect(read.actions[0].actions[0].enchantments).toEqual(expected)
    expect(read.features[0].features[0].enchantments).toEqual(expected)
    expect(read.spells[0].spells[0].enchantments).toEqual(expected)
    expect(read.inventory.containers[0].contents[0].enchantments).toEqual(
      expected,
    )
    // Another's on an item of hers, which she may end, and a template's, which she may not.
    expect(read.inventory.sections[0].items[1].enchantments).toEqual([
      expect.objectContaining({ id: 'brynMagicWeap', endable: true }),
    ])
    expect(read.inventory.sections[0].items[5].enchantments).toEqual([
      expect.objectContaining({ id: 'weaponPlusOne1', endable: false }),
    ])
  })

  it('keeps no more than fifty enchantments on one item', () => {
    const many = Array.from({ length: 60 }, (_, index) => ({
      id: `effect${index}`,
      name: `Enchantment ${index}`,
    }))
    const read = readSheet(
      enchantingSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'longsword',
                name: 'Longsword',
                enchantments: many,
              } as any),
            ],
          },
        ],
      }),
    )
    expect(read.actions[0].actions[0].enchantments).toHaveLength(50)
  })

  it('reads a sheet from before module 0.21.0 as it was, with no enchantments', () => {
    const sheet = fullerSheet()
    const read = readSheet(sheet)
    expect(JSON.stringify(read)).not.toMatch(/enchant/i)
    expect(read).toEqual(readSheet(fullerSheet()))
  })

  it('reads a use’s result with the enchantment applied and the one ended, as null where it can’t', () => {
    const enchanted = {
      item: 'longsword',
      itemName: 'Longsword',
      effect: 'effect000000002',
      profile: 'SLSudYaACjmmmZsU',
      name: 'Magic Weapon, +1',
    }
    const ended = {
      item: 'longsword',
      itemName: 'Longsword',
      effect: 'effect000000001',
      name: 'Magic Weapon, +1',
    }
    expect(
      enchantResult({ enchantment: { enchanted, ended } }).enchantment,
    ).toEqual({
      enchanted,
      ended,
    })
    expect(
      enchantResult({
        enchantment: { enchanted: { ...enchanted, name: 7 }, ended },
      }).enchantment,
    ).toEqual({ enchanted: null, ended })
    expect(
      enchantResult({
        enchantment: { enchanted, ended: { ...ended, effect: 'x'.repeat(65) } },
      }).enchantment,
    ).toEqual({ enchanted, ended: null })
    expect(enchantResult({ enchantment: 'applied' }).enchantment).toBeNull()
    // An older module says nothing of it.
    expect(enchantResult({})).not.toHaveProperty('enchantment')
  })

  it('keeps the card of a use whose enchantment wasn’t applied', () => {
    expect(
      parseGameEvent('command.result', {
        id: 'req-1',
        status: 'failed',
        reason: 'enchant',
        error: null,
        messageId: 'card-1',
        visible: true,
        rolls: [],
        use: { type: 'enchant' },
        damage: null,
        enchantment: null,
      })?.data,
    ).toEqual(
      expect.objectContaining({
        status: 'failed',
        reason: 'enchant',
        messageId: 'card-1',
        enchantment: null,
      }),
    )
  })
})

describe('dice damage takes away, from module 0.21.0', () => {
  /** The rest of what a hello says of rolls, kept whatever it says of these. */
  const rolls = {
    enabled: true,
    kinds: ['damage', 'textDamage'],
    reason: null,
    modifiers: true,
    activityChecks: true,
  }

  it('reads a hello saying whether more dice and another die change only a die damage adds', () => {
    expect(
      helloWith({ rolls: { ...rolls, signedDice: true } }).features.rolls,
    ).toEqual({ ...rolls, signedDice: true })
    // One it can't read is taken as not said.
    expect(
      helloWith({ rolls: { ...rolls, signedDice: 'yes' } }).features.rolls,
    ).toEqual({ ...rolls, signedDice: false })
    // A module before 0.21.0 says nothing of it.
    const before = helloWith({ rolls }).features.rolls
    expect(before).toEqual(rolls)
    expect(before.signedDice).toBeFalsy()
  })
})

/** An action's use, its targets these, as read on a sheet. */
const useTargetsRead = (targets: Record<string, unknown>) => {
  const sheet = fullerSheet()
  const [section, ...rest] = sheet.actions
  const [first, ...others] = section.actions
  const use = {
    id: 'drink',
    type: 'heal',
    targets: {
      self: false,
      area: false,
      count: null,
      perLevel: null,
      affects: 'creature',
      ...targets,
    },
  }
  const event = parseGameEvent('character.updated', {
    character: {
      ...roster[0],
      sheet: {
        ...sheet,
        actions: [
          { ...section, actions: [{ ...first, activity: use }, ...others] },
          ...rest,
        ],
      },
    },
  }) as any
  return event.data.character.sheet.actions[0].actions[0].activity.targets
}

describe('Self, from module 0.22.0', () => {
  it("reads whether a use's range is Self, and nothing where it says nothing, or what it can't", () => {
    expect(useTargetsRead({ fromSelf: true }).fromSelf).toBe(true)
    expect(useTargetsRead({ fromSelf: false }).fromSelf).toBe(false)
    expect(useTargetsRead({})).not.toHaveProperty('fromSelf')
    expect(useTargetsRead({ fromSelf: 'yes' }).fromSelf).toBeUndefined()
  })

  it('reads a hello saying whether a use may be made at its user', () => {
    const rolls = { enabled: true, kinds: ['use'], reason: null }
    expect(
      helloWith({ rolls: { ...rolls, selfTargets: true } }).features.rolls
        .selfTargets,
    ).toBe(true)
    expect(
      helloWith({ rolls: { ...rolls, selfTargets: 'yes' } }).features.rolls
        .selfTargets,
    ).toBe(false)
    expect(helloWith({ rolls }).features.rolls.selfTargets).toBeFalsy()
  })
})

/** The Gamemaster's roll a chat message claims it was made for, as read. */
const claimOf = (gmRoll?: unknown) => {
  const { message } = parseGameEvent('chat.message.created', {
    message: {
      id: 'm1',
      timestamp: 1,
      audience: { public: true, characters: [] },
      ...(gmRoll !== undefined && { gmRoll }),
    },
  })?.data as any
  return message.gmRoll
}

describe("The Gamemaster's rolls as a character, from module 0.23.0 (#156)", () => {
  it('reads a hello saying the game makes them, and nothing where it says nothing, or what it cannot', () => {
    const rolls = { enabled: true, kinds: ['skill'], reason: null }
    expect(
      helloWith({ rolls: { ...rolls, gmRolls: true } }).features.rolls.gmRolls,
    ).toBe(true)
    expect(
      helloWith({ rolls: { ...rolls, gmRolls: 'yes' } }).features.rolls.gmRolls,
    ).toBe(false)
    expect(helloWith({ rolls }).features.rolls.gmRolls).toBeFalsy()
  })

  it("reads a message's claim of the Gamemaster's roll it was made for, and no claim it can't", () => {
    expect(claimOf('cmgm0roll000001')).toBe('cmgm0roll000001')
    expect(claimOf('req-1_a')).toBe('req-1_a')
    for (const junk of [7, '', 'a b', 'x'.repeat(65), '<b>', null, {}]) {
      expect(claimOf(junk)).toBeUndefined()
    }
    expect(claimOf()).toBeUndefined()
  })
})

/** A utility used on its user, saying what it spends, if anything. */
const spendingUse = (spends?: unknown) => ({
  id: 'spUtility',
  type: 'utility',
  targets: {
    self: true,
    area: false,
    count: null,
    perLevel: null,
    affects: null,
  },
  ...(spends !== undefined && { spends }),
})

/** A save message's `dnd5e.save`, as read. */
const saveOf = (save?: unknown) =>
  messageWith({ roll: { type: 'save' }, save }).message.dnd5e.save

/** As many characters' ids, as a save's readers. */
const readerIds = (count: number) =>
  Array.from({ length: count }, (_, index) => `actor-${index}`)

describe('concentration, counters and outcomes, from module 0.29.0', () => {
  const effect = { id: 'concBless0001', name: 'Bless', item: 'bless' }

  it("reads a sheet's concentrations, dropping a malformed one, and none as none", () => {
    expect(
      readSheet(
        characterSheet({
          concentration: {
            effects: [
              effect,
              {
                id: 'concNoSource1',
                name: 'Concentration With No Source',
                item: null,
              },
              { id: 'not an id', name: 'Hex', item: 'hex' },
              { id: 'concBlank0001', name: '  ', item: null },
            ],
          },
        }),
      ).concentration,
    ).toEqual({
      effects: [
        effect,
        {
          id: 'concNoSource1',
          name: 'Concentration With No Source',
          item: null,
        },
      ],
    })
    expect(
      readSheet(characterSheet({ concentration: { effects: [] } }))
        .concentration,
    ).toEqual({ effects: [] })
    expect(readSheet(characterSheet()).concentration).toBeUndefined()
    expect(
      readSheet({ ...characterSheet(), concentration: 'Bless' }).concentration,
    ).toBeUndefined()
    // An item that can't be read is none, the concentration kept.
    expect(
      readSheet(
        characterSheet({
          concentration: { effects: [{ ...effect, item: 7 }] } as never,
        }),
      ).concentration,
    ).toEqual({ effects: [{ ...effect, item: null }] })
  })

  it.each([
    [{ item: 'sorcery' }],
    [{ item: 'staff', activity: 'castStaff01' }],
    [{ resource: 'primary' }],
    [{ resource: 'secondary' }],
    [{ resource: 'tertiary' }],
  ])("reads uses' counter %j, and that they're spendable", counter => {
    const uses = { value: 2, max: 3, recovery: null, counter, spendable: true }
    for (const read of readRolls({ uses })) {
      expect(read.uses).toEqual(uses)
    }
  })

  it.each([
    ['of an item and a resource', { item: 'sorcery', resource: 'primary' }],
    ['of no such resource', { resource: 'fourth' }],
    ['of an item not an id', { item: 'sorcery points' }],
    ['of an activity not an id', { item: 'staff', activity: 'cast staff' }],
    ['of anything else', { item: 'sorcery', uses: 2 }],
    ['of no shape', 'sorcery'],
  ])('reads a counter %s as none, the uses kept', (_name, counter) => {
    for (const read of readRolls({
      uses: { value: 2, max: 3, recovery: null, counter, spendable: true },
    })) {
      expect(read.uses).toEqual({
        value: 2,
        max: 3,
        recovery: null,
        spendable: true,
      })
    }
  })

  it.each([[false], ['yes'], [1], [null]])(
    'reads spendable said as %p as not',
    spendable => {
      for (const read of readRolls({
        uses: { value: 2, max: 3, recovery: null, spendable },
      })) {
        expect(read.uses).toEqual({ value: 2, max: 3, recovery: null })
      }
    },
  )

  it('reads what a use spends, dropping what it can’t read, and none as none', () => {
    const [read] = readUse(
      spendingUse([
        { counter: { item: 'sorcery' }, amount: 1 },
        { counter: { item: 'font', activity: 'regain01' }, amount: null },
        { counter: { resource: 'primary' }, amount: 'lots' },
        { counter: { item: 'not an id' }, amount: 1 },
        { amount: 2 },
      ]),
    )
    expect(read.spends).toEqual([
      { counter: { item: 'sorcery' }, amount: 1 },
      { counter: { item: 'font', activity: 'regain01' }, amount: null },
      { counter: { resource: 'primary' }, amount: null },
    ])
    expect(readUse(spendingUse())[0]).not.toHaveProperty('spends')
    expect(readUse(spendingUse('sorcery'))[0].spends).toEqual([])
  })

  it('reads no more than 20 of what a use spends', () => {
    const spends = Array.from({ length: 21 }, (_, index) => ({
      counter: { item: `counter${index}` },
      amount: 1,
    }))
    const [read] = readUse(spendingUse(spends))
    expect(read.spends).toEqual(spends.slice(0, 20))
  })

  it("reads each target's uuid, whether it was hit and whether it saved, dropping junk", () => {
    const { message } = messageWith({
      targets: [
        { name: 'Goblin', uuid: 'Actor.gob', outcome: 'hit', save: 'failure' },
        { name: 'Orc', uuid: 'Actor.orc', outcome: 'miss', save: 'success' },
        { name: 'Kobold', uuid: 7, outcome: 'crit', save: true },
        { name: 'Bat' },
      ],
    })

    expect(message.dnd5e.targets).toEqual([
      { name: 'Goblin', uuid: 'Actor.gob', outcome: 'hit', save: 'failure' },
      { name: 'Orc', uuid: 'Actor.orc', outcome: 'miss', save: 'success' },
      { name: 'Kobold' },
      { name: 'Bat' },
    ])
  })

  it("reads a save's creature, outcome and readers; a readers list it can't read drops it all", () => {
    expect(saveOf({ target: 'Actor.gob', outcome: 'failure' })).toEqual({
      target: 'Actor.gob',
      outcome: 'failure',
    })
    expect(
      saveOf({
        target: 'Actor.gob',
        outcome: 'success',
        readers: ['actor-vex'],
      }),
    ).toEqual({
      target: 'Actor.gob',
      outcome: 'success',
      readers: ['actor-vex'],
    })
    expect(saveOf({ target: 'Actor.gob' })).toEqual({ target: 'Actor.gob' })
    expect(saveOf({ target: 'Actor.gob', outcome: 'resisted' })).toEqual({
      target: 'Actor.gob',
    })
    // Never shown to everyone for a list it couldn't read.
    expect(
      saveOf({ target: 'Actor.gob', outcome: 'success', readers: 'actor-vex' }),
    ).toBeUndefined()
    expect(
      saveOf({ target: 'Actor.gob', outcome: 'success', readers: [7] }),
    ).toBeUndefined()
    expect(saveOf({ outcome: 'success' })).toBeUndefined()
    expect(saveOf()).toBeUndefined()
  })

  it('reads as many as 200 readers of a save, and drops it all for more', () => {
    expect(
      saveOf({
        target: 'Actor.gob',
        outcome: 'success',
        readers: readerIds(200),
      }),
    ).toEqual({
      target: 'Actor.gob',
      outcome: 'success',
      readers: readerIds(200),
    })
    expect(
      saveOf({
        target: 'Actor.gob',
        outcome: 'success',
        readers: readerIds(201),
      }),
    ).toBeUndefined()
  })
})

/**
 * An attack's rolls, as one dnd5e gives Elven Accuracy says them, with these fields: junk among
 * them, as sent.
 */
const rapier = (fields: object = {}): any => ({
  toHit: 7,
  attackId: 'rapierAttack',
  damage: [{ formula: '1d8 + 3', type: 'Piercing', healing: false }],
  elvenAccuracy: true,
  ...fields,
})

describe('Elven Accuracy, from module 0.32.0', () => {
  it("keeps it on an action, its activities and a favorite activity, and leaves out what isn't true", () => {
    for (const read of readRolls(rapier())) {
      expect(read.elvenAccuracy).toBe(true)
    }
    for (const elvenAccuracy of [false, 'yes', 1, null]) {
      for (const read of readRolls(rapier({ elvenAccuracy }))) {
        // Left out, as junk: never anything but true.
        expect(read.elvenAccuracy).toBeUndefined()
        expect(read.attackId).toBe('rapierAttack')
      }
    }
    for (const read of readRolls(rapier({ elvenAccuracy: undefined }))) {
      expect(read.elvenAccuracy).toBeUndefined()
    }
  })

  it("keeps it on an inventory item's, a spell's and a feature's rolls", () => {
    const read = readSheet(
      characterSheet({
        inventory: {
          sections: [
            {
              id: 'weapons',
              label: 'Weapons',
              items: [
                sheetItem({
                  id: 'rapier',
                  name: 'Rapier',
                  type: 'weapon',
                  ...rapier(),
                }),
              ],
            },
          ],
          containers: [],
          currency: [],
          encumbrance: null,
          attunement: null,
        },
        spells: [
          {
            id: 'spell0',
            label: 'Cantrips',
            slots: null,
            spells: [
              sheetSpell({
                id: 'bolt',
                name: 'Fire Bolt',
                level: 0,
                ...rapier({ attackId: 'boltAttack' }),
              }),
            ],
          },
        ],
        features: [
          {
            id: 'race',
            label: 'Elf Features',
            text: null,
            features: [
              {
                id: 'thorns',
                name: 'Thorn Lash',
                img: null,
                kind: 'Feature',
                requirements: null,
                activation: '1 Action',
                passive: false,
                uses: null,
                text: null,
                ...rapier({ attackId: 'lashAttack', elvenAccuracy: 'yes' }),
              },
            ],
          },
        ],
      }),
    ) as any
    expect(read.inventory.sections[0].items[0].elvenAccuracy).toBe(true)
    expect(read.spells[0].spells[0].elvenAccuracy).toBe(true)
    expect(read.features[0].features[0].elvenAccuracy).toBeUndefined()
    expect(read.features[0].features[0].attackId).toBe('lashAttack')
  })

  it('keeps it on a slim action by reference, as the action has it, whatever its row says', () => {
    const slim = slimQuillSheet() as any
    const [staff] = slim.actions[0].actions
    slim.actions[0].actions[0] = { ...staff, elvenAccuracy: true }
    const event = parseGameEvent('character.updated', {
      character: { ...roster[0], sheet: slim },
    }) as any

    const [read, next] = event.data.character.sheet.actions[0].actions
    expect(read.id).toBe('staff')
    expect(read.elvenAccuracy).toBe(true)
    expect(next.elvenAccuracy).toBeUndefined()
  })
})

/** What a hello's features say of moves, as read. */
const transfers = (sent: unknown) =>
  (
    parseGameEvent('bridge.hello', {
      characters: [],
      combats: [],
      features: { transfers: sent },
    })?.data as { features?: { transfers?: unknown } }
  ).features?.transfers

describe('schemas/sending-stone, a party’s things sent and distributed, from module 0.32.0', () => {
  it('reads features.transfers’ sends and distributions, and reads junk as false', () => {
    expect(transfers(SENDING_TRANSFERS)).toEqual(SENDING_TRANSFERS)
    expect(
      transfers({ ...SENDING_TRANSFERS, partySends: 'yes', distribute: 1 }),
    ).toEqual({ ...SENDING_TRANSFERS, partySends: false, distribute: false })
    // Module 0.31.0 says neither.
    expect(
      transfers({ enabled: true, kinds: ['transfer'], reason: null }),
    ).toEqual({ enabled: true, kinds: ['transfer'], reason: null })
  })

  it('reads a distribution’s result: no end, and those given their share, in order', () => {
    const read = (fields: object) => {
      const { transfer, ...result } = distributedResult()
      return parseGameEvent('command.result', {
        ...result,
        transfer: { ...transfer, ...fields },
      })?.data as { transfer?: unknown; messageId: string | null }
    }
    expect(read({}).transfer).toEqual(distributedResult().transfer)
    expect(read({ among: [] }).transfer).toMatchObject({ among: [] })
    expect(
      read({
        among: Array.from({ length: 20 }, (_, index) => `actor${index}`),
      }).transfer,
    ).toMatchObject({ to: null })
    // More than one distribution shares among, or what isn't an id: the move left out, the rest
    // kept.
    for (const among of [
      Array.from({ length: 21 }, (_, index) => `actor${index}`),
      [''],
      'everyone',
    ]) {
      const data = read({ among })
      expect(data.transfer).toBeUndefined()
      expect(data.messageId).toBe('m-line')
    }
  })
})

/** What a hello's features say of removals, as read. */
const removals = (sent: unknown) =>
  (
    parseGameEvent('bridge.hello', {
      characters: [],
      combats: [],
      features: { removals: sent },
    })?.data as { features?: { removals?: unknown } }
  ).features?.removals

describe('schemas/sending-stone, an item removed from a character, from module 0.33.0', () => {
  it('reads features.removals, on and off, and junk as off or nothing', () => {
    expect(removals(REMOVING)).toEqual(REMOVING)
    expect(removals(NOT_REMOVING)).toEqual(NOT_REMOVING)
    expect(removals({ enabled: 'yes', kinds: 'remove' })).toEqual({
      enabled: false,
      kinds: [],
      reason: null,
    })
    expect(removals('on')).toBeNull()
    // Module 0.32.0 says nothing of them.
    expect(
      (
        parseGameEvent('bridge.hello', {
          characters: [],
          combats: [],
          features: { transfers: SENDING_TRANSFERS },
        })?.data as { features?: object }
      ).features,
    ).not.toHaveProperty('removals')
  })

  it('reads what a removal removed, keeping the rest of a result whose removal it can’t read', () => {
    const read = (removed: unknown) =>
      parseGameEvent('command.result', { ...removedResult(), removed })
        ?.data as { removed?: unknown; messageId: string | null }
    expect(read({ item: 'potionThorin', quantity: 2 }).removed).toEqual({
      item: 'potionThorin',
      quantity: 2,
    })
    expect(read({ item: 'arrowsThorin', quantity: 0 }).removed).toEqual({
      item: 'arrowsThorin',
      quantity: 0,
    })
    // A name, or anything else, is left out.
    expect(
      read({ item: 'potionThorin', quantity: 2, name: 'Potion of Healing' })
        .removed,
    ).toEqual({ item: 'potionThorin', quantity: 2 })
    for (const junk of [
      { item: '', quantity: 1 },
      { item: 'x'.repeat(65), quantity: 1 },
      { item: 'potionThorin', quantity: -1 },
      { item: 'potionThorin', quantity: 1.5 },
      { item: 'potionThorin', quantity: 10_000_001 },
      { item: 'potionThorin', quantity: '2' },
      { item: 'potionThorin' },
      'removed',
      null,
    ]) {
      const data = read(junk)
      expect(data.removed).toBeUndefined()
      expect(data.messageId).toBe('m-line')
    }
    // Left out by an older module, and by any other command.
    expect(
      parseGameEvent('command.result', movedResult())?.data,
    ).not.toHaveProperty('removed')
  })
})

/** What a hello's features say of journal notes, as read. */
const notes = (sent: unknown) =>
  (
    parseGameEvent('bridge.hello', {
      characters: [],
      combats: [],
      features: { removals: REMOVING, notes: sent },
    })?.data as { features?: { notes?: unknown } }
  ).features?.notes

/** A note at every limit the app takes, as the module sends one. */
const longest = (n: number) => ({
  id: `${'N'.repeat(12)}${n.toString().padStart(4, '0')}`,
  role: 'entry' as const,
  chapter: 'C'.repeat(16),
  title: 't'.repeat(200),
  format: 2 as const,
  markdown: 'm'.repeat(100_000),
  cut: true as const,
  createdAt: 0,
  modifiedAt: Number.MAX_SAFE_INTEGER,
  modifiedBy: 'b'.repeat(200),
  modifiedIn: 'foundry' as const,
  author: { actorId: 'a'.repeat(64), gm: false, name: 'n'.repeat(200) },
  rev: 'abcdef01234567',
})

describe('schemas/sending-stone, journal notes, from module 0.34.0', () => {
  const KEEPING = {
    enabled: true,
    kinds: ['personal', 'party'],
    reason: null,
    journals: [
      { kind: 'personal', actorId: 'thorin' },
      { kind: 'party', actorId: 'company' },
    ],
  }

  it('reads features.notes, and junk as off or nothing', () => {
    expect(notes(KEEPING)).toEqual(KEEPING)
    expect(notes({ ...KEEPING, journals: [] })).toEqual({
      ...KEEPING,
      journals: [],
    })
    expect(notes({ enabled: 'yes', kinds: 'personal' })).toEqual({
      enabled: false,
      kinds: [],
      reason: null,
      journals: [],
    })
    // A journal list that can't be read is taken as none, never as some.
    for (const journals of [
      [{ kind: 'shared', actorId: 'thorin' }],
      [{ kind: 'personal', actorId: 'thor-in' }],
      Array.from({ length: 2001 }, () => ({ kind: 'personal', actorId: 'a' })),
      'all',
    ]) {
      expect(notes({ ...KEEPING, journals })).toEqual({
        ...KEEPING,
        journals: [],
      })
    }
    expect(notes('on')).toBeNull()
    // Module 0.33.0 says nothing of them.
    expect(
      (
        parseGameEvent('bridge.hello', {
          characters: [],
          combats: [],
          features: { removals: REMOVING },
        })?.data as { features?: object }
      ).features,
    ).not.toHaveProperty('notes')
  })

  it('reads a book as the module sends it, personal or a party’s', () => {
    for (const kind of ['personal', 'party'] as const) {
      const event = mockJournalUpdated(kind)
      expect(parseGameEvent('journal.updated', event)).toEqual({
        type: 'journal.updated',
        data: event,
      })
    }
  })

  it('reads a book held back, or with no journal', () => {
    for (const data of [
      {
        kind: 'party',
        actorId: 'company',
        journal: null,
        withheld: { reason: 'private' },
      },
      {
        kind: 'personal',
        actorId: 'thorin',
        journal: null,
        withheld: { reason: 'tooLarge', bytes: 1_200_000, limit: 1_000_000 },
      },
      { kind: 'personal', actorId: 'thorin', journal: null },
    ]) {
      expect(parseGameEvent('journal.updated', data)?.data).toEqual(data)
    }
  })

  it('takes a module-shaped book with every field at its limit', () => {
    const data = {
      kind: 'party',
      actorId: 'g'.repeat(64),
      journal: {
        id: 'j'.repeat(64),
        name: 'n'.repeat(200),
        notes: [
          ...Array.from({ length: 399 }, (_, n) => longest(n)),
          {
            ...longest(399),
            format: 1,
            markdown: undefined,
            html: 'h'.repeat(100_000),
            secret: true,
          },
        ],
      },
    }

    const read = parseGameEvent('journal.updated', data)?.data as {
      journal: { notes: unknown[] }
    }
    expect(read.journal.notes).toHaveLength(400)
  })

  it.each<[string, Record<string, unknown>]>([
    ['an id of 15', { id: 'N'.repeat(15) }],
    ['an id of 17', { id: 'N'.repeat(17) }],
    ['an id with a dash', { id: 'NNNNNNNN-NNNNNNN' }],
    ['a chapter of another shape', { chapter: 'a b' }],
    ['an empty title', { title: '' }],
    ['a title of 201', { title: 't'.repeat(201) }],
    ['another format', { format: 3 }],
    ['Markdown with no Markdown', { markdown: undefined }],
    ['Markdown marked secret', { secret: true }],
    ['HTML with no HTML', { format: 1, markdown: undefined }],
    ['Markdown of 100,001', { markdown: 'm'.repeat(100_001) }],
    ['a time before 1970', { createdAt: -1 }],
    ['a time in parts', { modifiedAt: 1.5 }],
    ['a time as text', { createdAt: '0' }],
    ['a name of 201', { modifiedBy: 'b'.repeat(201) }],
    ['another place', { modifiedIn: 'elsewhere' }],
    [
      'an author named at 201',
      { author: { actorId: null, gm: true, name: 'n'.repeat(201) } },
    ],
    [
      'an author of another shape',
      { author: { actorId: 'a b', gm: false, name: 'n' } },
    ],
    ['a revision in capitals', { rev: 'ABCDEF01234567' }],
    ['a revision of 13', { rev: 'abcdef0123456' }],
  ])(
    'refuses a book with a note with %s, as one bad note fails it',
    (_name, junk) => {
      const data = {
        kind: 'personal',
        actorId: 'thorin',
        journal: {
          id: 'thorinJournal001',
          name: "Thorin's notes",
          notes: [{ ...longest(1), ...junk }],
        },
      }

      expect(() => parseGameEvent('journal.updated', data)).toThrow()
    },
  )

  it.each<[string, Record<string, unknown>]>([
    ['another kind', { kind: 'shared' }],
    ['an actor of another shape', { actorId: 'thor-in' }],
    [
      'a journal named at 201',
      { journal: { id: 'j', name: 'n'.repeat(201), notes: [] } },
    ],
    [
      '401 notes',
      {
        journal: {
          id: 'j',
          name: 'n',
          notes: Array.from({ length: 401 }, (_, n) => longest(n)),
        },
      },
    ],
    [
      'held back for another reason',
      { journal: null, withheld: { reason: 'lost' } },
    ],
  ])('refuses a book with %s', (_name, junk) => {
    expect(() =>
      parseGameEvent('journal.updated', {
        kind: 'personal',
        actorId: 'thorin',
        journal: null,
        ...junk,
      }),
    ).toThrow()
  })

  it('reads what a note command did, never more, keeping the rest of a result it can’t read', () => {
    const read = (note: unknown) =>
      parseGameEvent('command.result', { ...removedResult(), note })?.data as {
        note?: unknown
        messageId: string | null
      }
    expect(read({ id: NOTE_IDS.cave, rev: 'abcdef01234567' }).note).toEqual({
      id: NOTE_IDS.cave,
      rev: 'abcdef01234567',
    })
    expect(read({ id: NOTE_IDS.cave, rev: null, deleted: true }).note).toEqual({
      id: NOTE_IDS.cave,
      rev: null,
      deleted: true,
    })
    // Its title or text, or anything else, is left out.
    expect(
      read({ id: NOTE_IDS.cave, rev: null, title: 'The goblin cave' }).note,
    ).toEqual({ id: NOTE_IDS.cave, rev: null })
    for (const junk of [
      { id: 'short', rev: null },
      { id: NOTE_IDS.cave, rev: 'ABCDEF01234567' },
      { id: NOTE_IDS.cave, rev: null, deleted: false },
      { id: NOTE_IDS.cave },
      'note',
    ]) {
      const data = read(junk)
      expect(data.note).toBeUndefined()
      expect(data.messageId).toBe('m-line')
    }
    expect(
      parseGameEvent('command.result', movedResult())?.data,
    ).not.toHaveProperty('note')
  })
})

describe('schemas/sending-stone, orders and who changed a journal, from module 0.35.0', () => {
  const KEEPING = {
    enabled: true,
    kinds: ['personal', 'party'],
    reason: null,
    journals: [{ kind: 'personal', actorId: 'thorin' }],
  }

  it('reads whether the module takes orders and says who changed a journal, and a 0.34.0 hello without them', () => {
    expect(notes({ ...KEEPING, orders: true, changes: true })).toEqual({
      ...KEEPING,
      orders: true,
      changes: true,
    })
    expect(notes({ ...KEEPING, orders: false, changes: false })).toEqual({
      ...KEEPING,
      orders: false,
      changes: false,
    })
    // Module 0.34.0 says nothing of them: nothing is made up.
    const old = notes(KEEPING) as object
    expect(old).toEqual(KEEPING)
    expect(old).not.toHaveProperty('orders')
    expect(old).not.toHaveProperty('changes')
    // Junk is read as unsaid, never as true, and the rest is kept.
    const junk = notes({ ...KEEPING, orders: 'yes', changes: 1 }) as {
      orders?: unknown
      changes?: unknown
    }
    expect(junk).toMatchObject(KEEPING)
    expect(junk.orders).toBeUndefined()
    expect(junk.changes).toBeUndefined()
  })

  it('reads who last deleted or reordered a page in Foundry, and drops an odd one, never the book', () => {
    const book = mockJournalUpdated('party')
    expect(book.journal?.changed).toEqual({
      what: 'delete',
      by: 'Gamemaster',
      at: expect.any(Number),
    })
    expect(parseGameEvent('journal.updated', book)?.data).toEqual(book)
    const ordered = {
      ...book,
      journal: {
        ...book.journal!,
        changed: { what: 'order', by: 'b'.repeat(200), at: 0 },
      },
    }
    expect(parseGameEvent('journal.updated', ordered)?.data).toEqual(ordered)

    for (const changed of [
      { what: 'rename', by: 'Gamemaster', at: 1 },
      { what: 'delete', by: 'b'.repeat(201), at: 1 },
      { what: 'delete', by: 'Gamemaster', at: -1 },
      { what: 'delete', by: 'Gamemaster', at: 1.5 },
      { what: 'delete', at: 1 },
      'deleted',
    ]) {
      const read = parseGameEvent('journal.updated', {
        ...book,
        journal: { ...book.journal!, changed },
      })?.data as { journal: { changed?: unknown; notes: unknown[] } }
      expect(read.journal.changed).toBeUndefined()
      expect(read.journal.notes).toHaveLength(book.journal!.notes.length)
    }
    // A book from module 0.34.0 says nothing of it.
    expect(
      (
        parseGameEvent('journal.updated', mockJournalUpdated('personal'))
          ?.data as { journal: object }
      ).journal,
    ).not.toHaveProperty('changed')
  })

  it('reads the order an order of a group made, by ids alone, and drops an odd one, keeping the result', () => {
    const read = (order: unknown) =>
      parseGameEvent('command.result', { ...removedResult(), order })?.data as {
        order?: unknown
        messageId: string | null
      }
    const ids = Array.from(
      { length: 400 },
      (_, n) => `note${String(n).padStart(12, '0')}`,
    )
    expect(read({ chapter: NOTE_IDS.session, ids }).order).toEqual({
      chapter: NOTE_IDS.session,
      ids,
    })
    expect(read({ chapter: null, ids: [] }).order).toEqual({
      chapter: null,
      ids: [],
    })
    for (const junk of [
      { chapter: 'a b', ids: [] },
      { chapter: null, ids: [...ids, 'note000000000400'] },
      { chapter: null, ids: ['short'] },
      { ids: [] },
      'order',
    ]) {
      const data = read(junk)
      expect(data.order).toBeUndefined()
      expect(data.messageId).toBe('m-line')
    }
    expect(
      parseGameEvent('command.result', movedResult())?.data,
    ).not.toHaveProperty('order')
  })
})

/** A hello from module 0.36.0 with these companions, and what it says of them. */
const hello = (companions: unknown, features?: unknown) =>
  parseGameEvent('bridge.hello', {
    characters: roster,
    combats: [],
    companions,
    features,
  })?.data as any

/** A sheet's first action, with these fields, as read. */
const actionWith = (fields: object) =>
  (
    parseGameEvent('character.updated', {
      character: {
        ...roster[0],
        sheet: characterSheet({
          actions: [
            {
              id: 'action',
              label: 'Actions',
              actions: [{ ...biteAction(), ...fields } as SheetAction],
            },
          ],
        }),
      },
    }) as any
  ).data.character.sheet.actions[0].actions[0]

const creatureOf = (creature: unknown) =>
  (
    parseGameEvent('character.updated', {
      character: { ...roster[0], sheet: { ...characterSheet(), creature } },
    }) as any
  ).data.character.sheet.creature

const usesOf = (recharge: unknown) =>
  actionWith({
    uses: { value: 0, max: 1, recovery: 'Recharge [5+]', recharge },
  }).uses

const combatantOf = (companion: unknown) =>
  (
    parseGameEvent('combat.combatant.added', {
      combatId: 'cmbt1',
      combatant: { id: 'c-wolf', name: 'Wolf', companion },
    }) as any
  ).data.combatant.companion

const messageOf = (companion: unknown) =>
  (
    parseGameEvent('chat.message.created', {
      message: {
        id: 'm1',
        timestamp: 1,
        audience: { public: true, characters: [] },
        companion,
      },
    }) as any
  ).data.message.companion

/** Whether a message says it's a damage or healing card made on its own, as read. */
const aloneOf = (alone?: unknown) =>
  (
    parseGameEvent('chat.message.created', {
      message: {
        id: 'm1',
        timestamp: 1,
        audience: { public: true, characters: [] },
        ...(alone !== undefined && { alone }),
      },
    }) as any
  ).data.message.alone

describe('schemas/sending-stone, companions, from module 0.36.0', () => {
  const wolf = mockCompanionEntry()
  const imp = mockSummonedEntry()

  it('reads a hello listing companions, with what the campaign takes for them', () => {
    const data = hello([wolf, imp], {
      rolls: { enabled: true, kinds: ['attack', 'damage'], reason: null },
      companions: { kinds: ['attack', 'damage'], initiative: 'own' },
    })

    expect(data.companions).toEqual([wolf, imp])
    expect(data.features.companions).toEqual({
      kinds: ['attack', 'damage'],
      initiative: 'own',
    })
    // Never among its characters.
    expect(data.characters).toEqual(roster)
  })

  it('reads a hello from module 0.35.0, which lists none, as none', () => {
    const data = hello(undefined, {
      rolls: { enabled: true, kinds: ['attack'], reason: null },
    })

    expect(data.companions).toEqual([])
    expect(data.features.companions).toBeUndefined()
  })

  it('drops an entry that can’t be read, keeping the hello and the rest', () => {
    const data = hello([
      { ...wolf, key: 'wolf.brakka' },
      { ...wolf, key: 'wolfA', of: [] },
      { ...wolf, key: 'wolfB', kind: 'pet' },
      { ...wolf, key: 'wolfC', tokenId: 'a b' },
      'wolf',
      imp,
    ])

    expect(data.companions).toEqual([imp])
    expect(data.characters).toEqual(roster)
  })

  it('cuts a long name, and reads a long portrait or a broken summon as none, keeping the entry', () => {
    const [read] = hello([
      {
        ...imp,
        name: 'I'.repeat(300),
        img: `worlds/${'i'.repeat(3000)}.webp`,
        summon: { ...imp.summon, item: 'F'.repeat(300) },
      },
    ]).companions
    expect(read.name).toBe('I'.repeat(200))
    expect(read.img).toBeNull()
    expect(read.summon.item).toBe('F'.repeat(200))

    const [unsummoned] = hello([
      { ...imp, summon: { item: 'Find Familiar' } },
    ]).companions
    expect(unsummoned.summon).toBeNull()
    expect(unsummoned.key).toBe(imp.key)
  })

  it('keeps one entry per key, and no more than fifty', () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      mockCompanionEntry({ key: `wolf${index}`, actorId: `wolf${index}` }),
    )
    expect(hello([wolf, { ...wolf, name: 'Again' }, imp]).companions).toEqual([
      wolf,
      imp,
    ])
    const kept = hello(many).companions
    expect(kept).toHaveLength(50)
    expect(kept[49].key).toBe('wolf49')
  })

  it('reads how companions enter initiative, anything but "after" as their own roll', () => {
    const initiative = (said: unknown) =>
      hello([], { companions: { kinds: [], initiative: said } }).features
        .companions.initiative
    expect(initiative('after')).toBe('after')
    expect(initiative('own')).toBe('own')
    for (const junk of ['After', 'first', 1, null, undefined]) {
      expect(initiative(junk)).toBe('own')
    }
    expect(
      hello([], { companions: { kinds: 'attack', initiative: 'after' } })
        .features.companions,
    ).toEqual({ kinds: [], initiative: 'after' })
  })

  it('reads companions.listed, dropping what it can’t read', () => {
    expect(
      parseGameEvent('companions.listed', {
        companions: [wolf, { key: 'x' }, imp],
      }),
    ).toEqual({ type: 'companions.listed', data: { companions: [wolf, imp] } })
    expect(parseGameEvent('companions.listed', {})?.data).toEqual({
      companions: [],
    })
  })

  it('reads companion.updated with its sheet, a slim one made whole, or none', () => {
    const sheet = mockCompanionSheet()
    expect(
      parseGameEvent('companion.updated', { companion: wolf, sheet }),
    ).toEqual({ type: 'companion.updated', data: { companion: wolf, sheet } })

    const withheld = {
      ...wolf,
      sheetWithheld: { reason: 'tooLarge', bytes: 5_000_000, limit: 4_000_000 },
    }
    expect(
      parseGameEvent('companion.updated', { companion: withheld, sheet: null })
        ?.data,
    ).toEqual({ companion: withheld, sheet: null })
    // A sheet that can't be read is none; one left out is none too.
    expect(
      (
        parseGameEvent('companion.updated', {
          companion: wolf,
          sheet: 'x',
        }) as any
      ).data.sheet,
    ).toBeNull()
    expect(
      (parseGameEvent('companion.updated', { companion: wolf }) as any).data
        .sheet,
    ).toBeNull()

    const slim = parseGameEvent('companion.updated', {
      companion: wolf,
      sheet: slimQuillSheet(),
    }) as any
    expect(slim.data.sheet).not.toHaveProperty('slim')
    expect(slim.data.sheet.actions[0].actions[0]).toMatchObject({
      id: 'staff',
      name: expect.any(String),
    })
    // A companion that can't be read fails the event.
    expect(() =>
      parseGameEvent('companion.updated', { companion: { key: 'x' }, sheet }),
    ).toThrow()
  })

  it("reads an NPC's sheet's creature, a part that can't be read as none, and junk as no creature", () => {
    const dragon = mockCreature({
      cr: 17,
      type: 'Dragon',
      size: 'Huge',
      alignment: 'Chaotic Evil',
      important: true,
      legendary: { value: 4, max: 4 },
      resistance: { value: 3, max: 4 },
      lair: { inside: true, initiative: 20 },
      hitDice: { denomination: 'd12', value: 17, max: 17 },
    })
    expect(creatureOf(dragon)).toEqual(dragon)
    expect(creatureOf(mockCreature())).toEqual(mockCreature())
    expect(
      creatureOf({
        ...dragon,
        cr: '17',
        legendary: { value: 'four', max: 4 },
        lair: 'yes',
        hitDice: { denomination: '12', value: 1, max: 1 },
        important: 'yes',
      }),
    ).toEqual({
      ...dragon,
      cr: null,
      legendary: null,
      lair: null,
      hitDice: null,
      important: false,
    })
    expect(creatureOf('dragon')).toBeUndefined()
    // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
    expect(creatureOf(undefined)).toBeUndefined()
  })

  it('reads the d6 that recharges uses, leaving out one it can’t read', () => {
    expect(usesOf(5).recharge).toBe(5)
    expect(usesOf(6).recharge).toBe(6)
    for (const junk of [1, 7, 5.5, '5', null]) {
      const uses = usesOf(junk)
      expect(uses.recharge).toBeUndefined()
      expect(uses.value).toBe(0)
    }
  })

  it('reads damage on its own wherever a row has damage, leaving out a plan it can’t read', () => {
    const plan = mockTableDamage()
    expect(actionWith({}).tableDamage).toEqual(plan)
    expect(actionWith({ tableDamage: null }).tableDamage).toBeNull()
    expect(
      actionWith({ tableDamage: { ...plan, critical: null } }).tableDamage,
    ).toEqual({ ...plan, critical: null })
    for (const junk of [
      'damage',
      { normal: plan.normal },
      { normal: { ...plan.normal, rolls: 'x' }, critical: null },
    ]) {
      const read = actionWith({ tableDamage: junk })
      expect(read.tableDamage).toBeUndefined()
      expect(read.damage).toHaveLength(1)
    }
    // An activity's, and a spell's.
    const activity = actionWith({
      activities: [
        { ...biteAction(), id: 'biteAttack', name: 'Bite', type: 'attack' },
        {
          ...biteAction(),
          id: 'pounce',
          name: 'Pounce',
          type: 'attack',
          tableDamage: { ...plan, critical: null },
        },
      ],
    }).activities[1]
    expect(activity.tableDamage).toEqual({ ...plan, critical: null })
    const spell = (
      parseGameEvent('character.updated', {
        character: {
          ...roster[0],
          sheet: characterSheet({
            spells: [
              {
                id: 'spell1',
                label: '1st Level',
                slots: null,
                spells: [
                  sheetSpell({
                    id: 'thunderwave',
                    name: 'Thunderwave',
                    damage: [
                      { formula: '2d8', type: 'Thunder', healing: false },
                    ],
                    tableDamage: { ...plan, critical: null },
                  }),
                ],
              },
            ],
          }),
        },
      }) as any
    ).data.character.sheet.spells[0].spells[0]
    expect(spell.tableDamage).toEqual({ ...plan, critical: null })
  })

  it('reads which listed companion a combatant and a message are, as junk none', () => {
    expect(combatantOf('wolfBrakka')).toBe('wolfBrakka')
    expect(combatantOf('sceneFrost-tokenImp')).toBe('sceneFrost-tokenImp')
    expect(combatantOf(null)).toBeNull()
    expect(combatantOf('a.b')).toBeNull()
    expect(combatantOf(7)).toBeNull()

    expect(messageOf('sceneFrost-tokenImp')).toBe('sceneFrost-tokenImp')
    expect(messageOf('a b')).toBeNull()
  })

  it('reads a damage card made on its own, and nothing else as one (round 0.36.0 §20)', () => {
    expect(aloneOf(true)).toBe(true)
    for (const junk of [false, 'true', 1, null, {}]) {
      expect(aloneOf(junk)).toBeUndefined()
    }
    expect(aloneOf()).toBeUndefined()
  })
})

/** What a hello's features say of favorites, as read. */
const favorites = (sent: unknown) =>
  (
    parseGameEvent('bridge.hello', {
      characters: [],
      combats: [],
      features: { favorites: sent },
    })?.data as { features?: { favorites?: unknown } }
  ).features?.favorites

describe('schemas/sending-stone, favorites added and removed, from module 0.37.0', () => {
  it('reads features.favorites, on and off, and junk as off or nothing', () => {
    expect(favorites(FAVORITING)).toEqual(FAVORITING)
    expect(favorites(NOT_FAVORITING)).toEqual(NOT_FAVORITING)
    expect(favorites({ enabled: 'yes', kinds: 'favorite' })).toEqual({
      enabled: false,
      kinds: [],
      reason: null,
    })
    expect(favorites('on')).toBeNull()
    // Module 0.36.0 says nothing of them.
    expect(
      (
        parseGameEvent('bridge.hello', {
          characters: [],
          combats: [],
          features: { removals: REMOVING },
        })?.data as { features?: object }
      ).features,
    ).not.toHaveProperty('favorites')
  })

  it('reads whether it is one of the favorites now, keeping the rest of a result where it can’t', () => {
    const read = (favorited: unknown) =>
      parseGameEvent('command.result', { ...favoritedResult(), favorited })
        ?.data as { favorited?: unknown; status: string }
    expect(read(true).favorited).toBe(true)
    expect(read(false).favorited).toBe(false)
    for (const junk of ['true', 1, null, {}]) {
      const data = read(junk)
      expect(data.favorited).toBeUndefined()
      expect(data.status).toBe('done')
    }
    // Left out by an older module, and by any other command.
    expect(
      parseGameEvent('command.result', removedResult())?.data,
    ).not.toHaveProperty('favorited')
  })
})

/** What a hello's features say of dishes, as read. */
const dishes = (sent: unknown) =>
  (
    parseGameEvent('bridge.hello', {
      characters: [],
      combats: [],
      features: { dishes: sent },
    })?.data as { features?: { dishes?: unknown } }
  ).features?.dishes

describe('schemas/sending-stone, dishes from the Magical Recipe Book, from module 0.38.0', () => {
  const at = { time: '2026-10-24T20:15:00.000Z', worldTime: 1_234_567 }
  const by = { userId: 'GmUser0000000001', name: 'Gamemaster' }
  const thorin = {
    actorId: 'kH2b9QeX1sZ4mN7p',
    name: 'Thorin Oakenshield',
    effectId: 'Ae0000dish000001',
    replaced: { id: 'cmh1zzz0n0009ab12cd34ef56', recipe: 'Ashen Root Stew' },
    healed: 7,
    exhaustion: 0,
    skipped: [],
  }
  const applied = (fields: object = {}) => ({
    dish: 'cmh9q2x7k0003ssdish0001',
    id: 'cmh2k8q0n0001ab12cd34ef56',
    card: 'Xy12ChatCardId00',
    outcome: 'boon',
    characters: [thorin],
    rolled: [{ type: 'maxHitPoints', value: 7, formula: '3+1d6' }],
    by,
    at,
    ...fields,
  })
  const dismissed = (fields: object = {}) => ({
    dish: 'cmh9q2x7k0003ssdish0001',
    id: 'cmh2k8q0n0001ab12cd34ef56',
    card: 'Xy12ChatCardId00',
    reason: 'dismissed',
    by,
    at,
    ...fields,
  })

  it('reads features.dishes, on and off, and junk as off or nothing', () => {
    expect(dishes(TAKING_DISHES)).toEqual(TAKING_DISHES)
    expect(dishes(DISHES_SWITCHED_OFF)).toEqual(DISHES_SWITCHED_OFF)
    expect(dishes(DISHES_OTHER_SYSTEM)).toEqual(DISHES_OTHER_SYSTEM)
    expect(dishes({ enabled: 'yes', kinds: 'dish', versions: 'all' })).toEqual({
      enabled: false,
      kinds: [],
      reason: null,
      versions: [],
    })
    expect(
      dishes({
        ...TAKING_DISHES,
        versions: Array.from({ length: 21 }, () => 1),
      }),
    ).toMatchObject({ versions: [] })
    expect(dishes('on')).toBeNull()
    // Module 0.37.0 says nothing of them.
    expect(
      (
        parseGameEvent('bridge.hello', {
          characters: [],
          combats: [],
          features: { favorites: FAVORITING },
        })?.data as { features?: object }
      ).features,
    ).not.toHaveProperty('dishes')
  })

  it('keeps a dish result’s card and state, and the rest of a result where it can’t', () => {
    expect(parseGameEvent('command.result', dishResult())?.data).toEqual(
      dishResult(),
    )
    for (const junk of [
      'waiting',
      { card: 'x', state: 'eaten' },
      { card: 7 },
    ]) {
      const data = parseGameEvent(
        'command.result',
        dishResult({ dish: junk as any }),
      )?.data as { dish?: unknown; status: string }
      expect(data.dish).toBeUndefined()
      expect(data.status).toBe('done')
    }
  })

  it('reads dish.applied, cutting what is too long rather than refusing it', () => {
    const many = Array.from({ length: 250 }, (_, n) => ({
      ...thorin,
      actorId: `actor${n}`,
      name: 'T'.repeat(300),
      skipped: Array.from({ length: 120 }, () => ({
        type: 'tempHitPoints',
        reason: 'kind',
      })),
    }))
    const event = parseGameEvent('dish.applied', applied({ characters: many }))
    if (event?.type !== 'dish.applied') throw new Error('not read')
    expect(event.data.characters).toHaveLength(200)
    expect(event.data.characters[0].name).toBe('T'.repeat(200))
    expect(event.data.characters[0].skipped).toHaveLength(100)
    expect(event.data.dish).toBe('cmh9q2x7k0003ssdish0001')
    expect(event.data.rolled).toEqual([
      { type: 'maxHitPoints', value: 7, formula: '3+1d6' },
    ])
  })

  it('cleans what Postgres cannot store from a dish event, never refusing it', () => {
    const left = `${'a'.repeat(199)}�`
    const event = parseGameEvent(
      'dish.applied',
      applied({
        characters: [
          // An emoji at 199 and 200, split by this app's cut.
          { ...thorin, name: `${'a'.repeat(199)}\u{1F600}b` },
          // The same name as the module cuts it, at 200, its half arriving alone.
          {
            ...thorin,
            actorId: 'actor2',
            name: `${'a'.repeat(199)}\uD83D`,
            replaced: { id: 'old\u0000dish', recipe: 'Ashen\u0000 Root Stew' },
          },
          { ...thorin, actorId: 'actor3', name: 'Tho\u0000rin\uDC00' },
        ],
        rolled: [
          {
            type: 'maxHitPoints',
            value: 7,
            formula: `${'1'.repeat(31)}\u{1F600}`,
          },
        ],
        by: { userId: 'GmUser\u0000', name: 'Game\u0000master' },
      }),
    )
    if (event?.type !== 'dish.applied') throw new Error('not read')
    expect(event.data.characters.map(({ name }) => name)).toEqual([
      left,
      left,
      'Thorin�',
    ])
    expect(event.data.characters[1].replaced).toEqual({
      id: 'olddish',
      recipe: 'Ashen Root Stew',
    })
    expect(event.data.rolled[0].formula).toBe(`${'1'.repeat(31)}�`)
    expect(event.data.by).toEqual({ userId: 'GmUser', name: 'Gamemaster' })
    expect(JSON.stringify(event.data)).not.toMatch(/\\u0000|\\ud[89a-f]/i)

    const dismissal = parseGameEvent(
      'dish.dismissed',
      dismissed({ card: 'Xy12\u0000Card\uD800', by: { name: 'G\u0000M' } }),
    )
    expect(dismissal?.data).toMatchObject({
      card: 'Xy12Card�',
      by: { name: 'GM' },
    })
  })

  it('reads every other field of dish.applied as best it can, dropping entries it can’t', () => {
    const event = parseGameEvent(
      'dish.applied',
      applied({
        card: 7,
        characters: [thorin, { name: 'No actor' }, 'junk'],
        rolled: [
          { type: 'maxHitPoints', value: 7.5 },
          { type: 'x', value: 2, formula: 9 },
        ],
        by: 'gm',
        at: { time: 5 },
      }),
    )
    if (event?.type !== 'dish.applied') throw new Error('not read')
    expect(event.data.characters.map(({ name }) => name)).toEqual([
      'Thorin Oakenshield',
    ])
    expect(event.data.rolled).toEqual([{ type: 'x', value: 2 }])
    expect(event.data.by).toBeNull()
    expect(event.data.at).toEqual({ time: '', worldTime: 0 })
    expect(event.data.card).toBe('')
  })

  it('reads dish.dismissed, an unknown reason as set aside', () => {
    const event = parseGameEvent(
      'dish.dismissed',
      dismissed({ reason: 'deleted' }),
    )
    expect(event).toEqual({
      type: 'dish.dismissed',
      data: dismissed({ reason: 'deleted' }),
    })
    const junk = parseGameEvent(
      'dish.dismissed',
      dismissed({ reason: 'eaten' }),
    )
    expect(junk?.data).toMatchObject({ reason: 'dismissed' })
  })

  it.each(['dish.applied', 'dish.dismissed'])(
    'refuses %s without this app’s id for the dish, the one field that refuses',
    type => {
      const sent = type === 'dish.applied' ? applied : dismissed
      expect(() => parseGameEvent(type, sent({ dish: undefined }))).toThrow()
      expect(() => parseGameEvent(type, sent({ dish: 'a b' }))).toThrow()
      expect(() =>
        parseGameEvent(type, sent({ dish: 'x'.repeat(65) })),
      ).toThrow()
    },
  )
})

/** What a hello's features say of a player's own effects, as read. */
const effects = (sent: unknown) =>
  (
    parseGameEvent('bridge.hello', {
      characters: [],
      combats: [],
      features: { effects: sent },
    })?.data as { features?: { effects?: unknown } }
  ).features?.effects

/** Bless, as fullerSheet has it, with these ops, as read from a sheet. */
const blessWith = (ops: unknown) => {
  const sheet = fullerSheet()
  const [temporary, ...rest] = sheet.effects
  const [bless, ...others] = temporary.effects
  return readSheet({
    ...sheet,
    effects: [
      { ...temporary, effects: [{ ...bless, ops }, ...others] },
      ...rest,
    ],
  }).effects[0].effects[0]
}

describe("schemas/sending-stone, a player's own effects, from module 0.39.0", () => {
  it("reads each effect's ops, as the module lists them", () => {
    expect(blessWith(['disable', 'delete']).ops).toEqual(['disable', 'delete'])
    expect(blessWith(['enable']).ops).toEqual(['enable'])
    expect(blessWith(['disable', 'enable', 'delete']).ops).toEqual([
      'disable',
      'enable',
      'delete',
    ])
    expect(blessWith([]).ops).toEqual([])
    // Every row of the sheet keeps its own.
    expect(
      readSheet(fullerSheet()).effects.flatMap(({ effects }: any) =>
        effects.map(({ id, ops }: any) => [id, ops]),
      ),
    ).toEqual([
      ['blessed', ['disable', 'delete']],
      ['rage.raging', ['disable']],
      ['shieldOfFaith', ['enable', 'delete']],
    ])
  })

  it.each([
    ['an op this app doesn’t know', ['disable', 'toggle']],
    ['more than three', ['disable', 'enable', 'delete', 'delete']],
    ['not a list', 'disable'],
    ['null', null],
  ])('reads %s as no ops, so no control, keeping the effect', (_name, ops) => {
    const bless = blessWith(ops)
    expect(bless).not.toHaveProperty('ops', expect.anything())
    expect(bless.ops).toBeUndefined()
    expect(bless).toMatchObject({ id: 'blessed', name: 'Bless' })
  })

  it('reads an effect from a module before 0.39.0 as having no ops', () => {
    const sheet = fullerSheet()
    const [temporary, ...rest] = sheet.effects
    const bless = { ...temporary.effects[0] }
    delete bless.ops
    const read = readSheet({
      ...sheet,
      effects: [{ ...temporary, effects: [bless] }, ...rest],
    }).effects[0].effects[0]
    expect(read).not.toHaveProperty('ops')
  })

  it('reads features.effects, on and off, and junk as off or nothing', () => {
    expect(effects(TAKING_EFFECTS)).toEqual(TAKING_EFFECTS)
    expect(effects(EFFECTS_SWITCHED_OFF)).toEqual(EFFECTS_SWITCHED_OFF)
    expect(effects(EFFECTS_OTHER_SYSTEM)).toEqual(EFFECTS_OTHER_SYSTEM)
    expect(effects({ enabled: 'yes', kinds: 'effect' })).toEqual({
      enabled: false,
      kinds: [],
      reason: null,
    })
    expect(effects('on')).toBeNull()
    // Module 0.38.1 says nothing of them.
    expect(
      (
        parseGameEvent('bridge.hello', {
          characters: [],
          combats: [],
          features: { dishes: TAKING_DISHES },
        })?.data as { features?: object }
      ).features,
    ).not.toHaveProperty('effects')
  })

  it('keeps what became of an effect, and the rest of a result where it can’t', () => {
    expect(parseGameEvent('command.result', effectResult())?.data).toEqual(
      effectResult(),
    )
    const deleted = effectResult({
      effect: { id: 'rage.raging', disabled: null, deleted: true },
    })
    expect(parseGameEvent('command.result', deleted)?.data).toEqual(deleted)
    for (const junk of [
      'blessed',
      { id: 'blessed', disabled: true },
      { id: 'a b', disabled: true, deleted: false },
      { id: 'blessed', disabled: 'no', deleted: false },
    ]) {
      const data = parseGameEvent(
        'command.result',
        effectResult({ effect: junk as any }),
      )?.data as { effect?: unknown; status: string }
      expect(data.effect).toBeUndefined()
      expect(data.status).toBe('done')
    }
    // Left out by an older module, and by any other command.
    expect(
      parseGameEvent('command.result', favoritedResult())?.data,
    ).not.toHaveProperty('effect')
  })
})

/** What a hello's features say of Wild Shape, as read. */
const wildShapeFeature = (sent: unknown) =>
  (
    parseGameEvent('bridge.hello', {
      characters: [],
      combats: [],
      features: { wildShape: sent },
    })?.data as { features?: { wildShape?: unknown } }
  ).features?.wildShape
/** A Wild Shape command's result, as read. */
const wildShapeOf = (wildShape: unknown) =>
  (
    parseGameEvent('command.result', wildShapeResult({ wildShape } as any))
      ?.data as { wildShape?: unknown; status: string }
  ).wildShape

describe('schemas/sending-stone, Wild Shape, from module 0.40.0', () => {
  it("reads a shaped sheet's form and Wild Shape as the module sends them", () => {
    const read = readSheet(shapedSheet())
    expect(read.form).toEqual(wolfForm())
    expect(read.wildShape).toEqual(
      wildShapeBlock({ uses: { value: 1, max: 2 } }),
    )
    // The form's numbers are the sheet's own, read as any sheet's.
    expect(read).toMatchObject({ ac: 12, speed: { value: 40, units: 'ft' } })
    expect(readSheet(druidSheet({ wildShape: moonBlock() })).wildShape).toEqual(
      moonBlock(),
    )
  })

  it('reads a sheet from a module before 0.40.0, or of a character herself, as having neither', () => {
    const read = readSheet(fullerSheet())
    expect(read).not.toHaveProperty('form')
    expect(read).not.toHaveProperty('wildShape')
    expect(readSheet(druidSheet())).not.toHaveProperty('form')
  })

  it('reads a form from another transformation, or with no record, as the module says it', () => {
    const polymorph = wolfForm({
      kind: 'other',
      name: 'Giant Ape',
      img: null,
      size: 'Huge',
      cr: 7,
      profile: null,
      hours: null,
      minutesLeft: null,
      beast: { abilities: ['str', 'dex', 'con'], saves: [], skills: [] },
    })
    expect(readSheet(shapedSheet({ form: polymorph })).form).toEqual(polymorph)
  })

  it.each([
    [
      'a kind it doesn’t know, as another transformation',
      { kind: 'curse' },
      { kind: 'other' },
    ],
    [
      'hours it can’t read, as none, so no Return',
      { hours: '2' },
      { hours: null },
    ],
    ['hours of 0, as none', { hours: 0 }, { hours: null }],
    [
      'minutes left it can’t read, as none',
      { minutesLeft: 1.5 },
      { minutesLeft: null },
    ],
    [
      'minutes left below 0, as none',
      { minutesLeft: -1 },
      { minutesLeft: null },
    ],
    [
      'a profile that isn’t a profile id, as none',
      { profile: 'wolf' },
      { profile: null },
    ],
    [
      'a floor it can’t read, as none',
      { flooredAc: 'yes' },
      { flooredAc: false },
    ],
    [
      'the beast’s numbers it can’t read, as none',
      { beast: 'all' },
      { beast: { abilities: [], saves: [], skills: [] } },
    ],
    [
      'an ability it doesn’t know, leaving the rest',
      {
        beast: {
          abilities: ['str', 'luck'],
          saves: ['str'],
          skills: ['prc', 7],
        },
      },
      { beast: { abilities: ['str'], saves: ['str'], skills: ['prc'] } },
    ],
  ])('reads a form with %s', (_name, fields, read) => {
    expect(
      readSheet(shapedSheet({ form: wolfForm(fields as any) })).form,
    ).toEqual(wolfForm(read as any))
  })

  it('leaves out a form with no name, or not an object, keeping the sheet', () => {
    for (const form of [
      wolfForm({ name: '' }),
      { ...wolfForm(), name: undefined },
      'Wolf',
      7,
    ]) {
      const read = readSheet(shapedSheet({ form: form as any }))
      expect(read).not.toHaveProperty('form', expect.anything())
      expect(read.form).toBeUndefined()
      expect(read.ac).toBe(12)
    }
  })

  it('reads each known form as sent: one not loaded yet, one not found, one from elsewhere', () => {
    const known = [
      KNOWN_FORMS.wolf,
      {
        id: FORM_IDS.panther,
        uuid: KNOWN_FORMS.panther.uuid,
        name: 'Panther',
        pool: true,
        fits: true,
      },
      { ...KNOWN_FORMS.crocodile, found: false },
      { id: 'Zq0Lm4Tn8Rb2Vc6X', name: 'Giant Elk', pool: false },
    ]
    expect(
      readSheet(druidSheet({ wildShape: wildShapeBlock({ known }) })).wildShape
        .known,
    ).toEqual(known)
  })

  it.each([
    ['fits it can’t read, as not fitting', { fits: 'yes' }, { fits: false }],
    ['found it can’t read, as not found', { found: 1 }, { found: false }],
    [
      'pool it can’t read, as from elsewhere',
      { pool: 'pack' },
      { pool: false },
    ],
    ['an attack it can’t read, as none', { attack: 'Bite' }, { attack: null }],
    [
      'speeds it can’t read, as none',
      { speeds: 'Walk 40 ft' },
      { speeds: undefined },
    ],
  ])('reads a known form with %s', (_name, fields, read) => {
    const [first] = readSheet(
      druidSheet({
        wildShape: wildShapeBlock({
          known: [{ ...KNOWN_FORMS.wolf, ...fields } as any],
        }),
      }),
    ).wildShape.known
    expect(first).toEqual({ ...KNOWN_FORMS.wolf, ...read })
  })

  it('leaves out a known form with no profile id, keeping the others', () => {
    const known = readSheet(
      druidSheet({
        wildShape: wildShapeBlock({
          known: [
            { ...KNOWN_FORMS.wolf, id: 'wolf' },
            { ...KNOWN_FORMS.blackBear, id: undefined },
            'Panther',
            KNOWN_FORMS.crocodile,
          ] as any,
        }),
      }),
    ).wildShape.known
    expect(known).toEqual([KNOWN_FORMS.crocodile])
  })

  it('keeps a known form with no name, as dnd5e leaves one dropped on her Wild Shape in Foundry, so all are counted as the game counts them', () => {
    // The module sends the profile's own name, empty where dnd5e wrote none: for a form from
    // elsewhere, for good; for a pool form, until the game loads it, or for good where it's gone.
    const nameless = [
      { id: 'Zq0Lm4Tn8Rb2Vc6X', name: '', pool: false },
      {
        id: FORM_IDS.crocodile,
        uuid: KNOWN_FORMS.crocodile.uuid,
        name: '',
        pool: true,
        fits: true,
      },
      {
        id: FORM_IDS.reefShark,
        uuid: KNOWN_FORMS.reefShark.uuid,
        name: '',
        pool: true,
        fits: false,
        found: false,
      },
    ]
    const sent = [
      KNOWN_FORMS.wolf,
      KNOWN_FORMS.blackBear,
      KNOWN_FORMS.panther,
      ...nameless,
    ]
    const read = readSheet(
      druidSheet({ wildShape: wildShapeBlock({ known: sent }) }),
    ).wildShape
    expect(read.known).toEqual(sent)
    expect(read.known).toHaveLength(read.limits.count)
    // A name that isn't one, or none at all, reads as none, the form kept.
    expect(
      readSheet(
        druidSheet({
          wildShape: wildShapeBlock({
            known: [
              { id: 'Zq0Lm4Tn8Rb2Vc6X', pool: false },
              { ...KNOWN_FORMS.wolf, name: 7 },
            ] as any,
          }),
        }),
      ).wildShape.known,
    ).toEqual([
      { id: 'Zq0Lm4Tn8Rb2Vc6X', name: '', pool: false },
      { ...KNOWN_FORMS.wolf, name: '' },
    ])
  })

  it.each([
    [
      'uses it can’t read, as none left',
      { uses: '2/2' },
      { uses: { value: 0, max: 0 } },
    ],
    [
      'limits it can’t read, as none',
      { limits: { count: 'six', cr: 0.5, fly: false } },
      { limits: { count: 0, cr: 0, fly: false } },
    ],
    ['a circle it doesn’t know, as none', { circle: 'land' }, { circle: null }],
    ['a floor it can’t read, as none', { acFloor: '16' }, { acFloor: null }],
    ['a replacement it can’t read, as none', { swap: 'yes' }, { swap: false }],
    [
      'an ending it can’t read, as none',
      { ended: { form: 'Wolf', why: 'nap', at: 1, formId: 'x' } },
      { ended: null },
    ],
  ])('reads Wild Shape with %s', (_name, fields, read) => {
    expect(
      readSheet(druidSheet({ wildShape: wildShapeBlock(fields as any) }))
        .wildShape,
    ).toEqual(wildShapeBlock(read as any))
  })

  it.each(['app', 'time', 'hp', 'incapacitated', 'foundry'] as const)(
    'reads an ending of why %s',
    why => {
      const ended = {
        form: 'Wolf',
        why,
        at: 1_793_000_000_000,
        formId: 'formWolf00000001',
      }
      expect(
        readSheet(druidSheet({ wildShape: wildShapeBlock({ ended }) }))
          .wildShape.ended,
      ).toEqual(ended)
    },
  )

  it('leaves out Wild Shape with no row, or not an object, keeping the sheet', () => {
    for (const wildShape of [
      { ...wildShapeBlock(), item: '' },
      'druid',
      null,
    ]) {
      const read = readSheet(druidSheet({ wildShape: wildShape as any }))
      expect(read.wildShape).toBeUndefined()
      expect(read.ac).toBe(14)
    }
  })

  it('reads features.wildShape, on and off, and junk as off or nothing', () => {
    expect(wildShapeFeature(TAKING_WILD_SHAPE)).toEqual(TAKING_WILD_SHAPE)
    expect(wildShapeFeature(WILD_SHAPE_SWITCHED_OFF)).toEqual(
      WILD_SHAPE_SWITCHED_OFF,
    )
    expect(wildShapeFeature(WILD_SHAPE_OTHER_SYSTEM)).toEqual(
      WILD_SHAPE_OTHER_SYSTEM,
    )
    expect(wildShapeFeature({ enabled: 'yes', kinds: 'wildShape' })).toEqual({
      enabled: false,
      kinds: [],
      reason: null,
    })
    expect(wildShapeFeature('on')).toBeNull()
    // Module 0.39.0 says nothing of it.
    expect(
      (
        parseGameEvent('bridge.hello', {
          characters: [],
          combats: [],
          features: { effects: TAKING_EFFECTS },
        })?.data as { features?: object }
      ).features,
    ).not.toHaveProperty('wildShape')
  })

  it('keeps what a Wild Shape command made, by its op', () => {
    expect(parseGameEvent('command.result', wildShapeResult())?.data).toEqual(
      wildShapeResult(),
    )
    for (const wildShape of [
      { op: 'revert', form: { name: 'Wolf' } },
      { op: 'revert', form: null },
      {
        op: 'learn',
        form: { id: FORM_IDS.wolf, name: 'Wolf', uuid: KNOWN_FORMS.wolf.uuid },
        replaced: null,
      },
      {
        op: 'learn',
        form: {
          id: FORM_IDS.panther,
          name: 'Riding Horse',
          uuid: 'Compendium.dnd5e.actors24.Actor.mmRidingHorse000',
        },
        replaced: { id: FORM_IDS.panther, name: 'Panther' },
      },
    ]) {
      expect(wildShapeOf(wildShape)).toEqual(wildShape)
    }
    expect(parseGameEvent('command.result', beastsResult())?.data).toEqual(
      beastsResult(),
    )
  })

  it('leaves out a Wild Shape result it can’t read, keeping the rest of the result', () => {
    const { forms } = beastsResult().wildShape as { forms: object[] }
    for (const junk of [
      'transform',
      { op: 'transform', form: { id: FORM_IDS.wolf, name: 'Wolf' } },
      { op: 'shift', form: null },
      { op: 'revert' },
      {
        op: 'learn',
        form: { id: 'wolf', name: 'Wolf', uuid: 'x' },
        replaced: null,
      },
      {
        op: 'forms',
        forms,
        more: 'no',
        limits: { count: 6, cr: 0.5, fly: false },
      },
      // More Beasts than the game ever lists at once.
      {
        op: 'forms',
        forms: Array.from({ length: 201 }, () => forms[0]),
        more: true,
        limits: { count: 6, cr: 0.5, fly: false },
      },
    ]) {
      const data = parseGameEvent(
        'command.result',
        wildShapeResult({ wildShape: junk } as any),
      )?.data as { wildShape?: unknown; status: string }
      expect(data.wildShape).toBeUndefined()
      expect(data.status).toBe('done')
    }
  })

  it('keeps 200 Beasts, and drops one whose uuid this app couldn’t ask to learn, keeping the rest', () => {
    const { forms, limits } = beastsResult().wildShape as {
      forms: { uuid: string }[]
      limits: object
    }
    const many = Array.from({ length: 200 }, () => forms[0])
    expect(
      (wildShapeOf({ op: 'forms', forms: many, more: true, limits }) as any)
        .forms,
    ).toHaveLength(200)
    const odd = [{ ...forms[0], uuid: 'Actor.hiddenOgre000000' }, forms[1]]
    expect(
      (wildShapeOf({ op: 'forms', forms: odd, more: false, limits }) as any)
        .forms,
    ).toEqual([forms[1]])
  })

  it('leaves Wild Shape out of any other command’s result', () => {
    expect(
      parseGameEvent('command.result', effectResult())?.data,
    ).not.toHaveProperty('wildShape')
  })

  it('keeps each schema’s documentation on its own schema: the result’s on the result’s, none left stacked on another', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/schemas/sending-stone.ts'),
      'utf8',
    )
    // A doc comment followed by another documents nothing, and leaves the schema it was written for
    // without one.
    expect(source).not.toMatch(/\*\/\s*\n\s*\/\*\*/)
    expect(source).toMatch(
      /\/\*\*\n \* What became of a command;[^/]*\*\/\nconst commandResultSchema = /,
    )
  })
})

/** A plan of damage on its own as read from a row's sheet. */
const tablePlanOf = (tableDamage: unknown) =>
  actionWith({ tableDamage }).tableDamage

describe("schemas/sending-stone, damage on its own's choices and companions' saves, from module 0.41.0", () => {
  it("reads a row's plans at each level, mode and ammunition, and what it would spend", () => {
    for (const action of [
      burningHandsAction(),
      battleaxeAction(),
      longbowAction(),
      potionAction(),
    ]) {
      expect(tablePlanOf(action.tableDamage)).toEqual(action.tableDamage)
    }
    // A plan of a module before 0.41.0, or to an app that said nothing of them, has neither.
    const read = tablePlanOf(mockTableDamage())
    expect(read).not.toHaveProperty('choices')
    expect(read).not.toHaveProperty('spends')
  })

  it('leaves out choices it can’t read, keeping the row’s own plan, and spends likewise', () => {
    const { tableDamage } = burningHandsAction()
    const plan = tableDamage!
    const [entry] = plan.choices!
    for (const choices of [
      'levels',
      [{ ...entry, level: 0 }],
      [{ ...entry, level: 10 }],
      [{ ...entry, level: 2.5 }],
      [{ ...entry, attackMode: 'two handed' }],
      [{ ...entry, ammunition: '' }],
      [{ ...entry, normal: 'dice' }],
      [{ level: 2 }],
    ]) {
      const read = tablePlanOf({ ...plan, choices })
      expect(read.choices).toBeUndefined()
      expect(read).toMatchObject({ normal: plan.normal, spends: ['slot'] })
    }
    for (const spends of ['slot', ['slot', 'charges'], [3]]) {
      const read = tablePlanOf({ ...plan, spends })
      expect(read.spends).toBeUndefined()
      expect(read.choices).toEqual(plan.choices)
    }
    // What the module would never send is left out of what it sends.
    expect(
      tablePlanOf({ ...plan, choices: [{ ...entry, extra: 1 }] }).choices,
    ).toEqual([entry])
  })

  it('leaves out more than 64 plans, as the module sends none past them: 64 read, 65 and 70 not', () => {
    const { tableDamage } = longbowAction()
    const plan = tableDamage!
    const [entry] = plan.choices!
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...entry,
        ammunition: `arrows${index}`,
      }))
    expect(tablePlanOf({ ...plan, choices: many(64) }).choices).toHaveLength(64)
    for (const count of [65, 70]) {
      const read = tablePlanOf({ ...plan, choices: many(count) })
      expect(read.choices).toBeUndefined()
      expect(read.normal).toEqual(plan.normal)
    }
  })

  it("reads whether damage on its own takes its choices, and whether companions' saves are asked here", () => {
    const rolls = { enabled: true, kinds: ['itemDamage', 'save'], reason: null }
    expect(
      helloWith({
        rolls: {
          ...rolls,
          prompts: true,
          aloneChoices: true,
          companionPrompts: true,
        },
      }).features.rolls,
    ).toEqual({
      ...rolls,
      prompts: true,
      aloneChoices: true,
      companionPrompts: true,
    })
    expect(helloWith({ rolls: TAKING_ALONE_CHOICES }).features.rolls).toEqual(
      TAKING_ALONE_CHOICES,
    )
    expect(
      helloWith({
        rolls: { ...rolls, aloneChoices: 1, companionPrompts: 'yes' },
      }).features.rolls,
    ).toEqual({ ...rolls, aloneChoices: false, companionPrompts: false })
    const before = helloWith({ rolls }).features.rolls
    expect(before).not.toHaveProperty('aloneChoices')
    expect(before).not.toHaveProperty('companionPrompts')
  })

  it('reads what damage on its own spent, and whether concentration began, as the game says', () => {
    const resultOf = (alone: unknown) =>
      (
        parseGameEvent('command.result', {
          ...aloneResult([]),
          alone,
        })?.data as any
      ).alone
    expect(
      parseGameEvent('command.result', aloneResult(['slot']))?.data,
    ).toEqual(aloneResult(['slot']))
    expect(resultOf({ spent: ['slot', 'uses'], concentrating: true })).toEqual({
      spent: ['slot', 'uses'],
      concentrating: true,
    })
    expect(resultOf({ spent: ['ammunition'] })).toEqual({
      spent: ['ammunition'],
    })
    expect(resultOf({ spent: [] })).toEqual({ spent: [] })
    // What it can't read of it is read as nothing spent, and no concentration.
    expect(resultOf({ spent: ['charges'], concentrating: 'yes' })).toEqual({
      spent: [],
    })
    expect(resultOf('spent')).toBeUndefined()
    expect(
      parseGameEvent('command.result', effectResult())?.data,
    ).not.toHaveProperty('alone')
  })

  it("reads a save the game asks of a companion, filed under its key, as a character's", () => {
    const prompt = mockCompanionPrompt()
    expect(parseGameEvent('roll.prompt.opened', { prompt })?.data).toEqual({
      prompt,
    })
    expect(
      (
        parseGameEvent('bridge.hello', {
          characters: roster,
          combats: [],
          prompts: [prompt],
        })?.data as any
      ).prompts,
    ).toEqual([prompt])
  })
})

/** A sheet's dice its effects add, from module 0.42.0, as read. */
const effectDiceOf = (effectDice: unknown) =>
  readSheet(characterSheet({ effectDice } as any)).effectDice

describe("schemas/sending-stone, effects' dice and rerolls kept, from module 0.42.0", () => {
  it('reads the dice the effects add as the module lists them', () => {
    expect(readSheet(blessedSheet()).effectDice).toEqual([
      BLESS_DIE,
      BANE_DIE,
      GUIDANCE_DIE,
    ])
  })

  it('reads a sheet without them, as one before, with none', () => {
    expect(readSheet(characterSheet())).not.toHaveProperty('effectDice')
  })

  it('takes every size but a d20, two of a die, and a tool or skill by its key', () => {
    const dice = [
      { ...BLESS_DIE, faces: 100 },
      { ...BLESS_DIE, faces: 12, count: 2 },
      { ...GUIDANCE_DIE, on: ['tool.thieves_tools', 'skill.slt', 'check.str'] },
      { ...BLESS_DIE, effect: 'cloak01.protect', on: ['save.dex'] },
    ]
    expect(effectDiceOf(dice)).toEqual(dice)
  })

  it.each([
    ['a d20', { ...BLESS_DIE, faces: 20 }],
    ['a d3', { ...BLESS_DIE, faces: 3 }],
    ['no name', { ...BLESS_DIE, name: '' }],
    ['a name too long', { ...BLESS_DIE, name: 'B'.repeat(101) }],
    ['an effect no sheet names so', { ...BLESS_DIE, effect: 'blessed..x' }],
    ['no dice', { ...BLESS_DIE, count: 0 }],
    ['21 dice', { ...BLESS_DIE, count: 21 }],
    ['a sign of 0', { ...BLESS_DIE, sign: 0 }],
    ['no rolls', { ...BLESS_DIE, on: [] }],
    ['a roll of no kind', { ...BLESS_DIE, on: ['damage'] }],
    ['a key with other characters', { ...BLESS_DIE, on: ['skill.a b'] }],
    [
      '61 rolls',
      { ...BLESS_DIE, on: Array.from({ length: 61 }, () => 'save') },
    ],
    ['junk', 'Bless'],
  ])('drops one with %s, and keeps the rest', (_name, bad) => {
    expect(effectDiceOf([BLESS_DIE, bad, GUIDANCE_DIE])).toEqual([
      BLESS_DIE,
      GUIDANCE_DIE,
    ])
  })

  it("drops one with a key module 0.42.0 doesn't write, such as a later module's offer of a die the game doesn't add, and keeps the rest", () => {
    // Module 0.42.1's Bardic Inspiration, as its contract shapes it (round 0.42.0 §11.2): on every
    // d20 roll, for the player to add once the Gamemaster says the roll fails, which dnd5e never
    // adds. Read as a die the game adds, it would be asked on every roll.
    const inspiration = {
      name: 'Bardic Inspiration',
      effect: 'inspired01',
      faces: 8,
      count: 1,
      sign: 1,
      on: [
        'attack',
        'check',
        'save',
        'skill',
        'tool',
        'initiative',
        'death',
        'concentration',
      ],
      offer: true,
    }
    expect(effectDiceOf([BLESS_DIE, inspiration, GUIDANCE_DIE])).toEqual([
      BLESS_DIE,
      GUIDANCE_DIE,
    ])
    expect(effectDiceOf([inspiration])).toBeUndefined()
    expect(effectDiceOf([{ ...BLESS_DIE, caster: 'Vex' }, BANE_DIE])).toEqual([
      BANE_DIE,
    ])
  })

  it('reads none where none can be read, more than ten are sent, or the list is junk', () => {
    expect(effectDiceOf([{ ...BLESS_DIE, faces: 20 }, 'Bane'])).toBeUndefined()
    expect(effectDiceOf([])).toBeUndefined()
    expect(
      effectDiceOf(Array.from({ length: 11 }, () => BLESS_DIE)),
    ).toBeUndefined()
    expect(
      effectDiceOf(Array.from({ length: 10 }, () => BLESS_DIE)),
    ).toHaveLength(10)
    expect(effectDiceOf('Bless')).toBeUndefined()
    expect(effectDiceOf(null)).toBeUndefined()
  })

  it('keeps them on a slim sheet, which leaves the keys it knows nothing of as they are', () => {
    const slim = readSheet({ ...slimQuillSheet(), effectDice: [BLESS_DIE] })
    expect(slim.effectDice).toEqual([BLESS_DIE])
  })

  it("reads whether a typed roll's effects' dice are its player's, and whether its rerolls may be", () => {
    expect(helloWith({ rolls: EFFECT_DICE_FEATURES }).features.rolls).toEqual(
      EFFECT_DICE_FEATURES,
    )
    const rolls = { enabled: true, kinds: ['save'], reason: null }
    expect(
      helloWith({ rolls: { ...rolls, effectDice: 'yes', keptRerolls: 1 } })
        .features.rolls,
    ).toEqual({ ...rolls, effectDice: false, keptRerolls: false })
    expect(
      helloWith({ rolls: { ...rolls, effectDice: false, keptRerolls: true } })
        .features.rolls,
    ).toEqual({ ...rolls, effectDice: false, keptRerolls: true })
    const before = helloWith({ rolls }).features.rolls
    expect(before).not.toHaveProperty('effectDice')
    expect(before).not.toHaveProperty('keptRerolls')
  })
})
