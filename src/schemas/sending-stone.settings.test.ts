/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { parseGameEvent } from './sending-stone'
import { combat, foundrySettings, roster } from '@/mocks/sending-stone'

// What a hello from module 0.30.0 adds for the Gamemaster's campaign card, the settings it posts
// when one changes, and what it says of saves and checks from anywhere.

/** What Foundry's hello says of itself, as every module sends it. */
const ABOUT = {
  module: { id: 'sending-stone', version: '0.30.0' },
  foundry: { version: '14.365', generation: 14 },
  system: { id: 'dnd5e', title: 'D&D Fifth Edition', version: '5.3.3' },
}

const hello = (fields: object = {}) =>
  parseGameEvent('bridge.hello', {
    characters: roster,
    combats: [combat()],
    ...fields,
  })?.data as Record<string, unknown>

const dnd5eOf = (dnd5e: object) =>
  (
    parseGameEvent('chat.message.created', {
      message: {
        id: 'm1',
        timestamp: 1,
        audience: { public: true, characters: [] },
        dnd5e: { messageType: 'roll', ...dnd5e },
      },
    })?.data as any
  ).message.dnd5e

describe("schemas/sending-stone, Foundry's settings, from module 0.30.0", () => {
  it("reads what a hello says of Foundry, and its settings, for the Gamemaster's card", () => {
    expect(hello({ ...ABOUT, settings: foundrySettings() })).toMatchObject({
      ...ABOUT,
      settings: foundrySettings(),
    })
  })

  it('reads a hello from an older module, which reports no settings, as before', () => {
    const read = hello(ABOUT)

    expect(read).toMatchObject(ABOUT)
    expect(read.settings).toBeUndefined()
    // And one that says nothing of Foundry at all.
    expect(hello()).toMatchObject({ characters: roster })
    expect(hello()).not.toHaveProperty('module')
    expect(hello().settings).toBeUndefined()
  })

  it.each([
    ['settings of another format', { settings: { format: 2 } }],
    ['settings that are no object', { settings: 'On' }],
    ['a module with no version', { module: { id: 'sending-stone' } }],
    ['a version too long', { foundry: { version: 'x'.repeat(51) } }],
    ['a system with no title', { system: { id: 'dnd5e', version: '5.3.3' } }],
  ])('never refuses a hello for %s, taking it as unsaid', (_name, junk) => {
    const read = hello({ ...ABOUT, settings: foundrySettings(), ...junk })

    expect(read.characters).toEqual(roster)
    const [key] = Object.keys(junk)
    expect(read[key]).toBeUndefined()
  })

  it('reads bridge.settings, and one it can’t read as none', () => {
    expect(
      parseGameEvent('bridge.settings', { settings: foundrySettings() }),
    ).toEqual({
      type: 'bridge.settings',
      data: { settings: foundrySettings() },
    })
    expect(
      parseGameEvent('bridge.settings', { settings: { format: 2 } })?.data,
    ).toEqual({ settings: undefined })
    expect(parseGameEvent('bridge.settings', {})?.data).toEqual({})
  })
})

describe('schemas/sending-stone, saves and checks from anywhere, from module 0.30.0', () => {
  it("reads a check's creature, outcome and readers, as a save's", () => {
    const check = {
      target: 'Actor.thorin',
      outcome: 'success',
      readers: ['actor-thorin'],
    }

    expect(
      dnd5eOf({ roll: { type: 'skill', skillId: 'prc' }, check }),
    ).toMatchObject({
      check,
    })
    expect(
      dnd5eOf({ check: { target: 'Actor.thorin', outcome: 'tie' } }).check,
    ).toEqual({ target: 'Actor.thorin' })
    // Never shown to everyone for a readers list it couldn't read.
    expect(
      dnd5eOf({ check: { ...check, readers: 'actor-thorin' } }).check,
    ).toBeUndefined()
    expect(dnd5eOf({ check: { outcome: 'failure' } }).check).toBeUndefined()
    expect(dnd5eOf({}).check).toBeUndefined()
  })

  it('drops a target it can’t read, keeping the others', () => {
    const { targets } = dnd5eOf({
      roll: { type: 'attack' },
      targets: [
        { name: 'Goblin', uuid: 'Actor.gob', outcome: 'hit' },
        { uuid: 'Actor.nameless', outcome: 'hit' },
        'Orc',
        null,
        { name: 'Kobold', uuid: 'Actor.kob', outcome: 'miss' },
      ],
    })

    expect(targets).toEqual([
      { name: 'Goblin', uuid: 'Actor.gob', outcome: 'hit' },
      { name: 'Kobold', uuid: 'Actor.kob', outcome: 'miss' },
    ])
  })

  it('reads targets that are no list as none', () => {
    expect(dnd5eOf({ targets: 'Goblin' }).targets).toEqual([])
    expect(dnd5eOf({}).targets).toEqual([])
  })
})
