/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { envelopeSchema, parseGameEvent } from './sending-stone'
import {
  characterSheet,
  combat,
  fullerSheet,
  roster,
  sheetFavorites,
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

/** A bridge.hello with these features, as read. */
const helloWith = (features?: unknown) =>
  parseGameEvent('bridge.hello', { characters: [], combats: [], features })
    ?.data as any

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
