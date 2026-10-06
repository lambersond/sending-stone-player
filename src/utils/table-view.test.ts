/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import {
  htmlToText,
  pickCombat,
  toTableCombat,
  toTableMessage,
  toTableMessages,
  toTableSheet,
  type Viewer,
} from './table-view'
import {
  characterSheet,
  fullerSheet,
  chatMessage,
  combat,
  combatant,
  sheetItem,
} from '@/mocks/sending-stone'
import type {
  CharacterSheet,
  SerializedMessage,
  SheetContainer,
} from '@/types/sending-stone'

const viewer: Viewer = {
  actorId: 'actor-thorin',
  party: new Set(['actor-thorin', 'actor-vex']),
}
const dnd5e = (
  fields: Partial<NonNullable<SerializedMessage['dnd5e']>>,
): SerializedMessage['dnd5e'] => ({
  messageType: 'roll',
  roll: null,
  item: null,
  activity: null,
  targets: [],
  ...fields,
})
const d20 = { formula: '1d20 + 7', total: 24, dice: [] }
const roll = (fields: object = {}) => ({ ...d20, ...fields })
/** A message using an item of this type. */
const cast = (type: string) =>
  chatMessage({
    dnd5e: dnd5e({ messageType: 'usage', item: { name: 'Fireball', type } }),
  })

describe('utils/table-view', () => {
  describe('toTableMessage', () => {
    it("shows a campaign character's portrait as the speaker's avatar", () => {
      const withPortraits: Viewer = {
        ...viewer,
        portraits: new Map([['actor-vex', 'https://game.example/vex.webp']]),
      }

      expect(
        toTableMessage(chatMessage({ character: 'actor-vex' }), withPortraits)
          .avatar,
      ).toBe('https://game.example/vex.webp')
      expect(
        toTableMessage(
          chatMessage({ speaker: { alias: 'Vex', actorId: 'actor-vex' } }),
          withPortraits,
        ).avatar,
      ).toBe('https://game.example/vex.webp')
      expect(
        toTableMessage(
          chatMessage({ character: 'actor-thorin' }),
          withPortraits,
        ).avatar,
      ).toBeUndefined()
      expect(toTableMessage(chatMessage(), viewer).avatar).toBeUndefined()
    })

    it('shows something said', () => {
      expect(toTableMessage(chatMessage(), viewer)).toEqual({
        id: 'm1',
        sentAt: '2026-10-04T19:02:00.000Z',
        speaker: 'Gamemaster',
        side: 'other',
        whisper: false,
        kind: 'text',
        label: undefined,
        text: 'Roll initiative!',
        rolls: [],
        targets: [],
      })
    })

    it.each([
      ['actor-thorin', 'me'],
      ['actor-vex', 'party'],
      [null, 'other'],
    ])('puts a speaker connected as %s on the %s side', (character, side) => {
      expect(toTableMessage(chatMessage({ character }), viewer).side).toBe(side)
    })

    it('marks a whisper', () => {
      const message = chatMessage({
        audience: { public: false, characters: ['actor-thorin'] },
      })

      expect(toTableMessage(message, viewer).whisper).toBe(true)
    })

    it("falls back to the author's name, then Unknown", () => {
      const noAlias = chatMessage({ speaker: { alias: ' ', actorId: null } })
      const nobody = chatMessage({
        speaker: { alias: null, actorId: null },
        author: null,
      })

      expect(toTableMessage(noAlias, viewer).speaker).toBe('Gamemaster')
      expect(toTableMessage(nobody, viewer).speaker).toBe('Unknown')
    })

    it('leaves out blank text', () => {
      expect(toTableMessage(chatMessage({ text: '  ' }), viewer).text).toBe(
        undefined,
      )
    })

    it('lays out a roll and leaves out its rendered content', () => {
      const message = chatMessage({
        text: '1d20 + 7 17 24',
        rolls: [
          {
            formula: '2d20kh + 7',
            total: 24,
            dice: [
              {
                faces: 20,
                results: [
                  { result: 17, active: true },
                  { result: 4, active: false },
                ],
              },
            ],
            advantage: true,
            critical: false,
            damageType: 'slashing',
          },
        ],
        dnd5e: dnd5e({ targets: [{ name: 'Goblin' }] }),
      })

      expect(toTableMessage(message, viewer)).toMatchObject({
        kind: 'roll',
        text: undefined,
        action: undefined,
        targets: [{ name: 'Goblin' }],
        rolls: [
          {
            formula: '2d20kh + 7',
            total: 24,
            dice: [
              { faces: 20, value: 17, active: true },
              { faces: 20, value: 4, active: false },
            ],
            advantage: true,
            disadvantage: false,
            critical: false,
            fumble: false,
            damageType: 'slashing',
          },
        ],
      })
    })

    it('shows an item used as a card', () => {
      const message = chatMessage({
        type: 'usage',
        text: 'Second Wind You have a limited well…',
        dnd5e: dnd5e({
          messageType: 'usage',
          item: { name: 'Second Wind' },
          activity: { name: 'Heal', type: 'heal' },
        }),
      })

      expect(toTableMessage(message, viewer)).toMatchObject({
        kind: 'card',
        label: 'Second Wind · Heal',
        text: undefined,
      })
    })

    it("doesn't repeat an activity named after its item", () => {
      const message = chatMessage({
        dnd5e: dnd5e({
          messageType: 'usage',
          item: { name: 'Second Wind' },
          activity: { name: 'Second Wind', type: 'heal' },
        }),
      })

      expect(toTableMessage(message, viewer).label).toBe('Second Wind')
    })

    it.each([
      [{ type: 'skill', skillId: 'prc' }, undefined, 'Perception check'],
      [{ type: 'ability', ability: 'str' }, undefined, 'Strength check'],
      [{ type: 'save', ability: 'dex' }, undefined, 'Dexterity save'],
      [{ type: 'attack' }, 'Longbow', 'Longbow'],
      [{ type: 'damage' }, 'Longbow', 'Longbow'],
      [{ type: 'healing' }, 'Cure Wounds', 'Cure Wounds'],
      [{ type: 'death' }, undefined, 'Death save'],
      [{ type: 'hitDie' }, undefined, 'Hit Die'],
      [{ type: 'concentration' }, undefined, 'Concentration'],
    ])('labels a %o roll', (roll, item, label) => {
      const message = chatMessage({
        rolls: [d20],
        dnd5e: dnd5e({ roll, item: item ? { name: item } : null }),
      })

      expect(toTableMessage(message, viewer).label).toBe(label)
    })

    it.each([
      { type: 'skill', skillId: 'nope' },
      { type: 'ability', ability: 'nope' },
      { type: 'save' },
      { type: 'generic' },
      { type: 'attack' },
      { type: 'damage' },
    ])('falls back to the flavor for %o', roll => {
      const message = chatMessage({
        rolls: [d20],
        flavor: '<b>Lucky</b> roll',
        dnd5e: dnd5e({ roll }),
      })

      expect(toTableMessage(message, viewer).label).toBe('Lucky roll')
    })

    it('falls back to the title when there is no flavor', () => {
      const message = chatMessage({ title: ' Ancient Lore ' })

      expect(toTableMessage(message, viewer).label).toBe('Ancient Lore')
    })
  })

  describe('combat messages', () => {
    it.each([
      ['an attack', { type: 'attack' }, 'weapon', [roll()], 'attack'],
      ['a spell attack', { type: 'attack' }, 'spell', [roll()], 'spell-attack'],
      [
        'damage',
        { type: 'damage' },
        'spell',
        [roll({ damageType: 'fire' })],
        'damage',
      ],
      [
        'damage that only heals',
        { type: 'damage' },
        'spell',
        [roll({ damageType: 'healing' }), roll({ damageType: 'temphp' })],
        'healing',
      ],
      [
        'damage with some harm',
        { type: 'damage' },
        'weapon',
        [roll({ damageType: 'healing' }), roll({ damageType: 'necrotic' })],
        'damage',
      ],
      ['healing', { type: 'healing' }, 'spell', [roll()], 'healing'],
      ['a check', { type: 'skill', skillId: 'prc' }, null, [roll()], undefined],
    ])('marks %s', (_, rollData, itemType, rolls, action) => {
      const message = chatMessage({
        rolls,
        dnd5e: dnd5e({
          roll: rollData,
          item: itemType ? { name: 'Thing', type: itemType } : null,
        }),
      })

      expect(toTableMessage(message, viewer).action).toBe(action)
    })

    it('marks a spell cast as a card, but not another item used', () => {
      expect(toTableMessage(cast('spell'), viewer).action).toBe('spell')
      expect(toTableMessage(cast('feat'), viewer).action).toBeUndefined()
    })

    it.each([
      ['meets', 15, {}, 'hit'],
      ['falls short of', 16, { total: 15 }, 'miss'],
      ['crits against', 30, { critical: true }, 'hit'],
      ['rolls a 1 against', 5, { fumble: true }, 'miss'],
    ])(
      'says whether an attack that %s the armor class hit',
      (_, ac, fields, outcome) => {
        const message = chatMessage({
          rolls: [{ ...d20, total: 15, ...fields }],
          dnd5e: dnd5e({
            roll: { type: 'attack' },
            targets: [{ name: 'Goblin', ac }, { name: 'Smaug' }],
          }),
        })

        expect(toTableMessage(message, viewer).targets).toEqual([
          { name: 'Goblin', ac, outcome },
          { name: 'Smaug' },
        ])
      },
    )

    it("doesn't judge damage, or an attack with no total, against armor class", () => {
      const targets = [{ name: 'Goblin', ac: 12 }]
      const damage = chatMessage({
        rolls: [d20],
        dnd5e: dnd5e({ roll: { type: 'damage' }, targets }),
      })
      const blank = chatMessage({
        rolls: [{ ...d20, total: null }],
        dnd5e: dnd5e({ roll: { type: 'attack' }, targets }),
      })

      expect(toTableMessage(damage, viewer).targets).toEqual(targets)
      expect(toTableMessage(blank, viewer).targets).toEqual(targets)
    })

    it('shows damage against the targets of the attack it came from, if it has none', () => {
      const attack = chatMessage({
        id: 'attack',
        rolls: [d20],
        dnd5e: dnd5e({
          roll: { type: 'attack' },
          targets: [{ name: 'Goblin Boss' }],
        }),
      })
      const damage = (id: string, fields: object = {}) =>
        chatMessage({
          id,
          rolls: [d20],
          dnd5e: dnd5e({
            roll: { type: 'damage' },
            originatingMessage: 'attack',
            ...fields,
          }),
        })

      const messages = toTableMessages(
        [
          attack,
          damage('inherits'),
          damage('own', { targets: [{ name: 'Goblin' }] }),
          damage('orphan', { originatingMessage: 'gone' }),
          damage('alone', { originatingMessage: null }),
        ],
        viewer,
      )

      expect(messages.map(({ id, targets }) => [id, targets])).toEqual([
        ['attack', [{ name: 'Goblin Boss' }]],
        ['inherits', [{ name: 'Goblin Boss' }]],
        ['own', [{ name: 'Goblin' }]],
        ['orphan', []],
        ['alone', []],
      ])
    })
  })

  describe('htmlToText', () => {
    it('drops tags, decodes entities and keeps content link labels', () => {
      expect(
        htmlToText(
          '<h4>Fire &amp; Ice&nbsp;&#8212;&#x2014;</h4> @UUID[Item.x]{Frost Brand} &lt;3 &unknown; &#xZZ;',
        ),
      ).toBe('Fire & Ice —— Frost Brand <3 &unknown; &#xZZ;')
    })

    it('has nothing to say for empty markup', () => {
      expect(htmlToText('<p> </p>')).toBeUndefined()
    })
  })

  describe('pickCombat', () => {
    it("prefers the tracker's encounter under way", () => {
      const setUp = combat({ id: 'a', active: false, started: false })
      const elsewhere = combat({ id: 'b', active: false, started: true })
      const shown = combat({ id: 'c', active: true, started: false })
      const fighting = combat({ id: 'd', active: true, started: true })

      expect(pickCombat([setUp, elsewhere, shown, fighting])?.id).toBe('d')
      expect(pickCombat([setUp, elsewhere, shown])?.id).toBe('c')
      expect(pickCombat([setUp, elsewhere])?.id).toBe('b')
      expect(pickCombat([setUp])?.id).toBe('a')
      expect(pickCombat([])).toBeUndefined()
    })
  })

  describe('toTableCombat', () => {
    it('sides each combatant, and shows hit points only for the party', () => {
      const snapshot = combat({
        combatants: [
          combatant({ id: 'c-boss', hp: { value: 5, max: 50, temp: 0 } }),
          combatant({
            id: 'c-thorin',
            character: 'actor-thorin',
            hp: { value: 31, max: 44, temp: 2 },
          }),
          combatant({ id: 'c-vex', character: 'actor-vex' }),
          combatant({ id: 'c-pet', playerOwned: true }),
        ],
      })

      const { combatants } = toTableCombat(snapshot, viewer)

      expect(combatants.map(({ id, side, hp }) => ({ id, side, hp }))).toEqual([
        { id: 'c-boss', side: 'other', hp: undefined },
        { id: 'c-thorin', side: 'me', hp: { value: 31, max: 44, temp: 2 } },
        { id: 'c-vex', side: 'party', hp: undefined },
        { id: 'c-pet', side: 'party', hp: undefined },
      ])
    })

    it('leaves out hidden combatants and their turns', () => {
      const snapshot = combat({
        combatantId: 'c-lurker',
        combatants: [
          combatant({ id: 'c-lurker', hidden: true }),
          combatant({ id: 'c-boss', hidden: false }),
        ],
      })

      const view = toTableCombat(snapshot, viewer)

      expect(view.combatants.map(({ id }) => id)).toEqual(['c-boss'])
      expect(view.currentId).toBeUndefined()
    })

    it('keeps whose turn it is', () => {
      expect(toTableCombat(combat(), viewer)).toMatchObject({
        id: 'cmbt1',
        name: null,
        started: true,
        round: 1,
        currentId: 'c-boss',
      })
    })

    it('has no current turn before the start', () => {
      const view = toTableCombat(
        combat({ started: false, combatantId: null }),
        viewer,
      )

      expect(view.currentId).toBeUndefined()
    })

    it('knows no one as me when the character is not connected', () => {
      const stranger: Viewer = { actorId: undefined, party: new Set() }

      const { combatants } = toTableCombat(combat(), stranger)

      // Still an ally, being player-owned, so their hit points still show.
      expect(combatants[1]).toMatchObject({
        side: 'party',
        hp: { value: 31, max: 44, temp: 0 },
      })
    })
  })

  describe('toTableSheet', () => {
    const origin = 'https://my-game.forge-vtt.com'

    it.each([
      [
        'worlds/erebor/thorin.webp',
        'https://my-game.forge-vtt.com/worlds/erebor/thorin.webp',
      ],
      [
        'https://assets.forge-vtt.com/u/thorin.webp',
        'https://assets.forge-vtt.com/u/thorin.webp',
      ],
      ['icons/svg/mystery-man.svg', undefined],
      ['javascript:alert(1)', undefined],
      ['https://[bad', undefined],
      [null, undefined],
    ])('finds the portrait %s at %s', (img, portrait) => {
      expect(toTableSheet(characterSheet({ img }), origin).portrait).toBe(
        portrait,
      )
    })

    it('finds the icons of conditions, features and effects at the game', () => {
      const view = toTableSheet(fullerSheet(), origin)

      expect(view.conditions.map(({ img }) => img)).toEqual([
        `${origin}/systems/dnd5e/icons/svg/statuses/concentrating.svg`,
        `${origin}/systems/dnd5e/icons/svg/statuses/exhaustion.svg`,
        `${origin}/systems/dnd5e/icons/svg/statuses/poisoned.svg`,
      ])
      expect(
        view.features.flatMap(({ features }) => features.map(({ img }) => img)),
      ).toEqual([
        `${origin}/icons/magic/life/heart-cross-green.webp`,
        null,
        'https://assets.forge-vtt.com/darkvision.webp',
      ])
      expect(view.effects[0].effects[0].img).toBe(
        `${origin}/icons/magic/control/buff-flight-wings-blue.webp`,
      )
    })

    it('reads a sheet from before module 0.6.0 as having no features, conditions or effects', () => {
      const { conditions, features, effects, ...older } = characterSheet()
      const view = toTableSheet(older as CharacterSheet, origin)

      expect([conditions, features, effects]).toEqual([[], [], []])
      expect([view.conditions, view.features, view.effects]).toEqual([
        [],
        [],
        [],
      ])
    })

    it('finds the icons of items, those in containers too, and spells at the game', () => {
      const sheet = fullerSheet()
      const [backpack] = sheet.inventory.containers
      const view = toTableSheet(
        {
          ...sheet,
          inventory: {
            ...sheet.inventory,
            containers: [
              {
                ...backpack,
                img: 'icons/containers/bags/pack-leather.webp',
                contents: [
                  {
                    ...backpack.contents![1],
                    contents: [
                      sheetItem({
                        id: 'coin',
                        name: 'Old Coin',
                        img: 'icons/commodities/currency/coin.webp',
                      }),
                    ],
                  } as SheetContainer,
                ],
              },
            ],
          },
        },
        origin,
      )

      expect(view.inventory.sections[0].items.map(({ img }) => img)).toEqual([
        `${origin}/icons/weapons/hammers/hammer-war.webp`,
        null,
      ])
      const [pack] = view.inventory.containers
      expect(pack.img).toBe(`${origin}/icons/containers/bags/pack-leather.webp`)
      const pouch = pack.contents?.[0] as SheetContainer
      expect(pouch.contents?.[0].img).toBe(
        `${origin}/icons/commodities/currency/coin.webp`,
      )
      expect(view.spells[1].spells[0].img).toBe(
        `${origin}/icons/magic/defensive/shield-barrier.webp`,
      )
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
      const view = toTableSheet(older as CharacterSheet, origin)

      expect(view).toMatchObject({
        inventory,
        spellcasting,
        spells,
        traits,
        deathSaves,
        details,
      })
      expect(view.spellcasting).toBeNull()
    })

    it("finds actions' icons at the game, and reads a sheet from before module 0.8.0 as having none", () => {
      const view = toTableSheet(fullerSheet(), origin)
      const { actions, ...older } = characterSheet()

      expect(view.actions[0].actions.map(({ img }) => img)).toEqual([
        `${origin}/icons/weapons/hammers/hammer-war.webp`,
        null,
        null,
        null,
      ])
      expect(actions).toEqual([])
      expect(toTableSheet(older as CharacterSheet, origin).actions).toEqual([])
    })

    it("keeps a container's secret contents secret", () => {
      const sheet = fullerSheet()
      const view = toTableSheet(sheet, origin)

      expect(view.inventory.containers[1]).toMatchObject({
        name: 'Puzzle Box',
        contents: null,
      })
    })

    it("names abilities and skills in dnd5e's English when the module left them blank", () => {
      const sheet = characterSheet()
      const view = toTableSheet(
        {
          ...sheet,
          abilities: [{ ...sheet.abilities[0], label: '', abbreviation: '' }],
          skills: [
            { ...sheet.skills[0], label: '' },
            { ...sheet.skills[0], id: 'xyz', label: '' },
          ],
        },
        origin,
      )

      expect(view.abilities[0]).toMatchObject({
        label: 'Strength',
        abbreviation: 'STR',
      })
      expect(view.skills.map(({ label }) => label)).toEqual([
        'Athletics',
        'xyz',
      ])
    })
  })
})
