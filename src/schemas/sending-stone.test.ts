/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { envelopeSchema, parseGameEvent } from './sending-stone'
import { combat, roster } from '@/mocks/sending-stone'

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
