/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { envelopeSchema, parseGameEvent } from './sending-stone'
import {
  castingSheet,
  characterSheet,
  checkingSheet,
  combat,
  enchantingSheet,
  enchantUse,
  fullerSheet,
  MAGIC_WEAPON_PROFILES,
  LOCK_CHECK,
  MAZE_CHECK,
  roster,
  sheetAction,
  sheetFavorites,
  SLEIGHT_CHECK,
  TEXTS,
} from '@/mocks/sending-stone'
import type {
  SheetAction,
  SheetActivityFavorite,
  SheetSpell,
  SheetSpellSection,
} from '@/types/sending-stone'

/** A chat message with these dnd5e details, as read. */
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
      module: { id: 'sending-stone' },
      characters: [{ ...roster[0], owners: [] }],
      combats: [combat()],
    }

    expect(parseGameEvent('bridge.hello', data)).toEqual({
      type: 'bridge.hello',
      // None of the saves the game asks for, as from a module before 0.13.0.
      data: { ...data, prompts: [] },
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
    ).toEqual({ characters: [], combats: [], prompts: [] })

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
      data: { characters: [character], combats: [], prompts: [] },
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
