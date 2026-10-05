/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { envelopeSchema, parseGameEvent } from './sending-stone'
import {
  characterSheet,
  combat,
  fullerSheet,
  roster,
  TEXTS,
} from '@/mocks/sending-stone'

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
      data,
    })
  })

  it("reads a character's sheet in bridge.hello and character.updated", () => {
    const character = { ...roster[0], sheet: characterSheet() }

    expect(
      parseGameEvent('bridge.hello', { characters: [character], combats: [] }),
    ).toEqual({
      type: 'bridge.hello',
      data: { characters: [character], combats: [] },
    })
    expect(parseGameEvent('character.updated', { character })).toEqual({
      type: 'character.updated',
      data: { character },
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
})
