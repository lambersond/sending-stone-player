/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import {
  askTitle,
  damageKinds,
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
  dispositionCombat,
  sheetFavorites,
  sheetItem,
} from '@/mocks/sending-stone'
import type {
  CharacterSheet,
  RollSummary,
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

/** dnd5e 5.3.3's request card's button for a save, as `createRequestButton` makes it. */
const button = (ability: string, type = 'save', action = 'rollRequest') =>
  `<button type="button" data-type="${type}" data-ability="${ability}" data-dc="15" data-format="long" data-action="${action}" data-visibility="all">` +
  `<span class="visible-dc"><i class="fas fa-shield-heart"></i>DC 15 ${ability} saving throw</span>` +
  `<span class="hidden-dc"><i class="fas fa-shield-heart"></i>${ability} saving throw</span></button>`
/**
 * dnd5e 5.3.3's request card's button for a check, as `createCheckRequestButtons` makes it, with
 * these data attributes.
 */
const checkButton = (data: string) =>
  `<button type="button" ${data} data-dc="15" data-format="short" data-action="rollRequest" data-visibility="all">` +
  '<span class="visible-dc"><i class="dnd5e-icon"></i>DC 15 check</span>' +
  '<span class="hidden-dc"><i class="dnd5e-icon"></i>check</span></button>'
const card = (...buttons: string[]) =>
  `<div class="chat-card request-card"><div class="card-buttons">${buttons.join('')}</div></div>`
/** The Gamemaster's card, as a module before 0.17.0 sends it: its text doubled, DC and all. */
const gmCard = (content: string, fields: Partial<SerializedMessage> = {}) =>
  chatMessage({
    flavor: 'Roll Request',
    content,
    text: 'DC 15 Dexterity saving throw Dexterity saving throw',
    ...fields,
  })
/** A player's ask from the app, as module 0.17.0 sends it. */
const asked = (ask: SerializedMessage['ask']) =>
  chatMessage({
    speaker: { alias: 'Thorin Oakenshield', actorId: 'actor-thorin' },
    author: { id: 'u-thorin', name: 'Dave' },
    character: 'actor-thorin',
    flavor: 'Roll Request: Worn Bardic Eternal Flame',
    content: card(button('dex')),
    text: 'DC 15 Dexterity saving throw',
    ask,
  })

/** What the server shows of a player's ask with these fields. */
const askWith = (fields: object) =>
  toTableMessage(
    asked({ type: 'save', abilities: ['dex'], ...fields } as any),
    viewer,
  ).ask

/** What the server shows of a player's ask for a check, its ways these. */
const checkWith = (checks: unknown, fields: object = {}) =>
  askWith({ type: 'check', abilities: undefined, checks, ...fields })

/** A die of these faces, come up so. */
const die = (faces: number, ...results: number[]) => ({
  faces,
  results: results.map(result => ({ result, active: true })),
})
/** A damage roll as module 0.27.0 sends one: of dnd5e's DamageRoll, of this type. */
const part = (
  total: number | null,
  damageType?: string,
  fields: object = {},
): RollSummary => ({
  class: 'DamageRoll',
  formula: '1d6',
  total,
  dice: [],
  ...(damageType !== undefined && { damageType }),
  ...fields,
})
/** And as module 0.28.0 sends it, marked as damage, its type's label said. */
const marked = (roll: RollSummary, section = 'damage'): RollSummary =>
  ({
    ...roll,
    damage: true,
    ...(roll.damageType && {
      damageLabel:
        roll.damageType.charAt(0).toUpperCase() + roll.damageType.slice(1),
    }),
    section,
  }) as RollSummary
const piercing = part(5, 'piercing', {
  formula: '1d4 + 4',
  dice: [die(4, 1)],
})
const poison = part(7, 'poison', { formula: '2d6', dice: [die(6, 2, 5)] })
/** The attack's d20, as Midi-QOL's card holds it. */
const d20Roll = (total: number, fields: object = {}): RollSummary => ({
  class: 'D20Roll',
  formula: '1d20 + 6',
  total,
  dice: [die(20, total - 6)],
  ...fields,
})
/** Corvin's dagger, as Midi-QOL's usage card holds its rolls, as dnd5e 5.x posts it. */
const corvin = (rolls: RollSummary[], fields: object = {}) =>
  chatMessage({
    type: 'usage',
    title: 'Dagger (Melee) - Midi Attack',
    text: '',
    rolls,
    dnd5e: dnd5e({
      messageType: null,
      roll: null,
      item: { name: 'Dagger (Melee)', type: 'weapon' },
      activity: { name: 'Midi Attack', type: 'attack' },
      ...fields,
    }),
  })
/** dnd5e's own damage message, with these parts, and this in its roll's flags. */
const dnd5eDamage = (rolls: RollSummary[], roll: object = {}) =>
  chatMessage({
    text: '',
    rolls,
    dnd5e: dnd5e({
      roll: { type: 'damage', ...roll },
      item: { name: 'Longbow', type: 'weapon' },
    }),
  })
/** What the server shows of a message's damage. */
const damageOf = (message: SerializedMessage) =>
  toTableMessage(message, viewer).damage
/** A message flavored as dnd5e words a damage roll's, and naming nothing else, with these rolls. */
const flavored = (rolls: RollSummary[]) =>
  chatMessage({
    text: '',
    flavor: 'Fire Bolt - Damage Roll',
    rolls,
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
          },
        ],
        dnd5e: dnd5e({ targets: [{ name: 'Goblin' }] }),
      })

      const shown = toTableMessage(message, viewer)
      expect(shown).toMatchObject({
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
          },
        ],
      })
      // No damage, nor an attack, said to be any.
      expect(shown).not.toHaveProperty('damage')
      expect(shown).not.toHaveProperty('attackRoll')
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
      [
        "a spell an item casts, by the spell's name and the item's, not the item's alone",
        { type: 'damage' },
        'Starry Wisp (Worn Bardic Eternal Flame) - Damage Roll',
        'Worn Bardic Eternal Flame',
        'Starry Wisp (Worn Bardic Eternal Flame)',
      ],
      [
        'healing, its name escaped',
        { type: 'healing' },
        'Tasha&#39;s Tonic - Healing Roll',
        'Tasha’s Bag',
        "Tasha's Tonic",
      ],
      [
        'a biography, by the character it belongs to',
        { type: 'damage' },
        'Thorin Oakenshield - Damage Roll',
        undefined,
        'Thorin Oakenshield',
      ],
      [
        'a flavor not made so, by its item',
        { type: 'damage' },
        'Damage Roll',
        'Longbow',
        'Longbow',
      ],
    ])(
      "names damage from a description as its card does, for where it's from: %s",
      (_, roll, flavor, item, label) => {
        const message = chatMessage({
          rolls: [d20],
          flavor,
          dnd5e: dnd5e({ roll, item: item ? { name: item } : null }),
        })

        expect(toTableMessage(message, viewer).label).toBe(label)
      },
    )

    it('names damage an activity rolled by its item, whatever its flavor says', () => {
      const message = chatMessage({
        rolls: [d20],
        flavor: 'Attack - Damage Roll',
        dnd5e: dnd5e({
          roll: { type: 'damage' },
          item: { name: 'Longbow' },
          activity: { name: 'Attack', type: 'attack' },
        }),
      })

      expect(toTableMessage(message, viewer).label).toBe('Longbow')
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
      [
        'damage that only raises maximum hit points',
        { type: 'damage' },
        'spell',
        [roll({ damageType: 'maximum' })],
        'healing',
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

    it('marks a spell cast as dnd5e 5.x posts its card: of type usage, its flags saying nothing', () => {
      const card = chatMessage({
        type: 'usage',
        title: 'Fireball - Cast',
        dnd5e: dnd5e({
          messageType: null,
          item: { name: 'Fireball', type: 'spell' },
          activity: { name: 'Cast', type: 'save' },
        }),
      })

      expect(toTableMessage(card, viewer)).toMatchObject({
        kind: 'card',
        action: 'spell',
        label: 'Fireball · Cast',
      })
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

  describe('damage cards', () => {
    it.each([
      ['as module 0.27.0 sends them', [piercing, poison]],
      ['as module 0.28.0 sends them', [marked(piercing), marked(poison)]],
    ])(
      "folds Corvin's piercing and poison into one card, totalling 12: %s",
      (_, rolls) => {
        const shown = toTableMessage(corvin(rolls), viewer)

        expect(shown).toMatchObject({
          kind: 'roll',
          label: 'Dagger (Melee)',
          rolls: [],
        })
        expect(shown).not.toHaveProperty('attackRoll')
        expect(shown.damage).toEqual([
          {
            section: 'main',
            action: 'damage',
            formula: '1d4 + 4 + 2d6',
            kinds: [
              { type: 'piercing', label: 'Piercing', total: 5, pool: 'harm' },
              { type: 'poison', label: 'Poison', total: 7, pool: 'harm' },
            ],
            total: 12,
            critical: false,
            rolls: [
              {
                formula: '1d4 + 4',
                total: 5,
                dice: [{ faces: 4, value: 1, active: true }],
                label: 'Piercing',
              },
              {
                formula: '2d6',
                total: 7,
                dice: [
                  { faces: 6, value: 2, active: true },
                  { faces: 6, value: 5, active: true },
                ],
                label: 'Poison',
              },
            ],
          },
        ])
      },
    )

    it('keeps the attack as a card of its own, marked, and judges it against armor class', () => {
      const hit = toTableMessage(
        corvin(
          [d20Roll(19, { attack: true }), marked(piercing), marked(poison)],
          { targets: [{ name: 'Mira', ac: 14 }] },
        ),
        viewer,
      )
      const missed = toTableMessage(
        corvin([d20Roll(9), piercing], {
          targets: [{ name: 'Mira', ac: 14 }],
        }),
        viewer,
      )

      expect(hit.attackRoll).toEqual({ index: 0, action: 'attack' })
      expect(hit.rolls).toHaveLength(1)
      expect(hit.rolls[0]).toMatchObject({ formula: '1d20 + 6', total: 19 })
      expect(hit.targets).toEqual([{ name: 'Mira', ac: 14, outcome: 'hit' }])
      expect(hit.damage?.[0].total).toBe(12)
      // As module 0.27.0 sends it: found by its class, on an attack's card.
      expect(missed.attackRoll).toEqual({ index: 0, action: 'attack' })
      expect(missed.targets).toEqual([
        { name: 'Mira', ac: 14, outcome: 'miss' },
      ])
    })

    it('marks a spell attack on a spell', () => {
      const shown = toTableMessage(
        corvin([d20Roll(15, { attack: true }), part(9, 'fire')], {
          item: { name: 'Fire Bolt', type: 'spell' },
        }),
        viewer,
      )

      expect(shown.attackRoll).toEqual({ index: 0, action: 'spell-attack' })
    })

    it("never takes Midi-QOL's utility d20 for the attack, even where the attack was skipped", () => {
      const utility = {
        class: 'BasicRoll',
        formula: '1d20',
        total: 20,
        dice: [die(20, 20)],
      }
      const shown = toTableMessage(
        corvin([utility, piercing], { targets: [{ name: 'Mira', ac: 10 }] }),
        viewer,
      )

      expect(shown).not.toHaveProperty('attackRoll')
      expect(shown.rolls).toEqual([
        expect.objectContaining({ formula: '1d20', total: 20 }),
      ])
      expect(shown.targets).toEqual([{ name: 'Mira', ac: 10 }])
      expect(shown.damage?.[0].kinds).toHaveLength(1)
    })

    it("marks no attack on a card of another activity, or a d20 that isn't one", () => {
      const save = corvin([d20Roll(12), piercing], {
        activity: { name: 'Save', type: 'save' },
      })
      const check = chatMessage({
        rolls: [d20Roll(12)],
        dnd5e: dnd5e({ roll: { type: 'skill', skillId: 'prc' } }),
      })

      expect(toTableMessage(save, viewer)).not.toHaveProperty('attackRoll')
      expect(toTableMessage(check, viewer)).not.toHaveProperty('attackRoll')
    })

    it.each([
      [19, 'hit'],
      [9, 'miss'],
    ])(
      "marks the attack of Midi-QOL's own attack activity, as module 0.27.0 sends it: %p is a %s",
      (total, outcome) => {
        // Midi-QOL's attack activity, where it doesn't replace dnd5e's, and no roll marked.
        const shown = toTableMessage(
          corvin([d20Roll(total), piercing, poison], {
            activity: { name: 'Midi Attack', type: 'midiAttack' },
            targets: [{ name: 'Mira', ac: 14 }],
          }),
          viewer,
        )

        expect(shown.attackRoll).toEqual({ index: 0, action: 'attack' })
        expect(shown.targets).toEqual([{ name: 'Mira', ac: 14, outcome }])
      },
    )

    it("gives Midi-QOL's other damage a card of its own, out of the main card's total", () => {
      expect(damageOf(corvin([piercing, marked(poison, 'other')]))).toEqual([
        expect.objectContaining({ section: 'main', total: 5 }),
        expect.objectContaining({
          section: 'other',
          action: 'damage',
          formula: '2d6',
          kinds: [{ type: 'poison', label: 'Poison', total: 7, pool: 'harm' }],
          total: 7,
        }),
      ])
      expect(
        damageOf(corvin([marked(poison, 'other')]))?.map(card => card.section),
      ).toEqual(['other'])
    })

    it("tags Midi-QOL's bonus damage, and adds it to its type's", () => {
      const sneak = marked(part(21, 'piercing', { formula: '6d6' }), 'bonus')
      const [card] =
        damageOf(
          corvin([
            marked(piercing),
            { ...sneak, flavor: 'Sneak Attack' } as RollSummary,
            marked(part(3, 'force'), 'bonus'),
          ]),
        ) ?? []

      expect(card.kinds).toEqual([
        { type: 'piercing', label: 'Piercing', total: 26, pool: 'harm' },
        { type: 'force', label: 'Force', total: 3, pool: 'harm' },
      ])
      expect(card.total).toBe(29)
      expect(card.formula).toBe('1d4 + 4 + 6d6 + 1d6')
      expect(card.rolls.map(({ tag }) => tag)).toEqual([
        undefined,
        'Sneak Attack',
        'Bonus',
      ])
    })

    it("folds a bonus macro's plain roll, which only Midi-QOL's tag marks as damage", () => {
      // Midi-QOL keeps a plain Roll a bonus damage macro returns as it is, and tags it.
      const sneak: RollSummary = {
        class: 'Roll',
        formula: '3d6',
        total: 11,
        dice: [],
        section: 'bonus',
        flavor: 'Sneak Attack',
      }
      const shown = toTableMessage(
        corvin([
          d20Roll(17, { attack: true }),
          marked(part(9, 'piercing', { formula: '1d8 + 4' })),
          sneak,
        ]),
        viewer,
      )

      expect(shown.rolls).toEqual([
        expect.objectContaining({ formula: '1d20 + 6' }),
      ])
      expect(shown.attackRoll).toEqual({ index: 0, action: 'attack' })
      expect(shown.damage).toHaveLength(1)
      const [card] = shown.damage ?? []
      expect(card.kinds).toEqual([
        { type: 'piercing', label: 'Piercing', total: 9, pool: 'harm' },
        { total: 11, pool: 'harm' },
      ])
      expect(card.total).toBe(20)
      expect(card.formula).toBe('1d8 + 4 + 3d6')
      expect(card.rolls[1]).toMatchObject({
        formula: '3d6',
        tag: 'Sneak Attack',
      })
    })

    it('folds a roll the module marks as damage, whatever its class', () => {
      const homebrew: RollSummary = {
        class: 'HomebrewRoll',
        formula: '1d4',
        total: 2,
        dice: [],
        damage: true,
      }
      const shown = toTableMessage(corvin([marked(piercing), homebrew]), viewer)

      expect(shown.rolls).toEqual([])
      expect(shown.damage).toHaveLength(1)
      expect(shown.damage?.[0]).toMatchObject({
        formula: '1d4 + 4 + 1d4',
        kinds: [
          { type: 'piercing', total: 5 },
          { total: 2, pool: 'harm' },
        ],
        total: 7,
      })
    })

    it("folds dnd5e's own damage message into one card, kind by kind, as its card puts its formula", () => {
      const [card] =
        damageOf(
          dnd5eDamage([
            part(13, 'piercing', { formula: '2d8 + 4' }),
            part(17, 'fire', { formula: '4d6' }),
            part(21, 'piercing', { formula: '6d6' }),
          ]),
        ) ?? []

      expect(card).toMatchObject({
        section: 'main',
        action: 'damage',
        formula: '2d8 + 4 + 6d6 + 4d6',
        total: 51,
      })
      expect(card.kinds.map(({ label, total }) => [label, total])).toEqual([
        ['Piercing', 34],
        ['Fire', 17],
      ])
      // Its rolls as they were rolled.
      expect(card.rolls.map(({ formula }) => formula)).toEqual([
        '2d8 + 4',
        '4d6',
        '6d6',
      ])
      expect(toTableMessage(dnd5eDamage([part(5)]), viewer)).toMatchObject({
        label: 'Longbow',
        action: 'damage',
        rolls: [],
      })
    })

    it('takes a negative part away in the formula', () => {
      const [card] =
        damageOf(
          dnd5eDamage([
            part(5, 'fire', { formula: ' 1d8 ' }),
            part(-1, 'fire', { formula: '-1' }),
          ]),
        ) ?? []

      expect(card.formula).toBe('1d8 - 1')
    })

    it('counts each kind at least 0, though each roll stays as rolled', () => {
      const [card] =
        damageOf(
          dnd5eDamage([
            part(-2, 'piercing', { formula: '1d4 - 5' }),
            part(6, 'fire'),
          ]),
        ) ?? []

      expect(card.kinds.map(({ total }) => total)).toEqual([0, 6])
      expect(card.total).toBe(6)
      expect(card.rolls[0].total).toBe(-2)
    })

    it('shows an unknown total as unknown, never part of it', () => {
      const [card] =
        damageOf(dnd5eDamage([part(null, 'piercing'), part(7, 'poison')])) ?? []

      expect(card.kinds.map(({ total }) => total)).toEqual([null, 7])
      expect(card.total).toBeNull()
    })

    it('makes damage of no type a kind of its own, with no word', () => {
      const [card] =
        damageOf(dnd5eDamage([part(4), part(3, 'fire'), part(2)])) ?? []

      expect(card.kinds).toEqual([
        { total: 6, pool: 'harm' },
        { type: 'fire', label: 'Fire', total: 3, pool: 'harm' },
      ])
      expect(card.rolls[0]).not.toHaveProperty('label')
      expect(card.total).toBe(9)
    })

    it("doesn't count Midi-QOL's damage of none at all", () => {
      const [card] =
        damageOf(dnd5eDamage([part(5, 'piercing'), part(4, 'midi-none')])) ?? []
      const [none] = damageOf(dnd5eDamage([part(4, 'midi-none')])) ?? []

      expect(card.kinds[1]).toEqual({
        type: 'midi-none',
        label: 'No damage',
        total: 4,
        pool: 'none',
      })
      expect(card.total).toBe(5)
      expect(none).toMatchObject({
        action: 'damage',
        kinds: [{ pool: 'none' }],
      })
      expect(none).not.toHaveProperty('total')
    })

    it("counts Midi-QOL's none, damage of no type, as Midi-QOL counts and applies it", () => {
      // A bonus macro that names no type, as Hunter's Mark's may: Midi makes its type "none"
      // (utils.ts:28-29) and its sumRolls adds it in (utils.ts:9216-9228). Sent with no label, it
      // has the app's own word for it.
      const [card] =
        damageOf(
          corvin([
            piercing,
            part(3, 'none', {
              formula: '1d6',
              section: 'bonus',
              flavor: "Hunter's Mark",
            }),
          ]),
        ) ?? []
      const [alone] = damageOf(dnd5eDamage([part(4, 'none')])) ?? []

      expect(card.kinds).toEqual([
        { type: 'piercing', label: 'Piercing', total: 5, pool: 'harm' },
        { type: 'none', label: 'No Type', total: 3, pool: 'harm' },
      ])
      expect(card.total).toBe(8)
      expect(card.formula).toBe('1d4 + 4 + 1d6')
      expect(card.rolls[1]).toMatchObject({
        label: 'No Type',
        tag: "Hunter's Mark",
      })
      expect(alone).toMatchObject({ action: 'damage', total: 4 })
    })

    it("words Midi-QOL's damage of none at all as no damage, whatever the module says the game calls it", () => {
      // Midi-QOL adds its types to dnd5e's damage types, with labels of its own.
      const [card] =
        damageOf(
          corvin([
            marked(piercing),
            { ...marked(part(4, 'midi-none')), damageLabel: 'None' },
            { ...marked(part(2, 'none')), damageLabel: 'Ohne Typ' },
          ]),
        ) ?? []

      expect(card.kinds.map(({ label }) => label)).toEqual([
        'Piercing',
        'No damage',
        'Ohne Typ',
      ])
      expect(card.rolls.map(({ label }) => label)).toEqual([
        'Piercing',
        'No damage',
        'Ohne Typ',
      ])
      expect(card.total).toBe(7)
    })

    it.each([
      [
        'healing and temporary hit points: healing, with no one total',
        ['healing', 'temphp'],
        'healing',
        undefined,
      ],
      [
        'healing and harm: damage, with no one total',
        ['healing', 'necrotic'],
        'damage',
        undefined,
      ],
      ['maximum hit points alone: healing', ['maximum'], 'healing', 5],
      [
        "healing and Midi-QOL's none: healing",
        ['healing', 'midi-none'],
        'healing',
        5,
      ],
    ])('marks %s', (_, types, action, total) => {
      const [card] =
        damageOf(
          chatMessage({
            rolls: types.map(type => part(5, type)),
            dnd5e: dnd5e({ roll: { type: 'damage' } }),
          }),
        ) ?? []

      expect(card.action).toBe(action)
      expect(card.total).toBe(total)
    })

    it("words the pools as dnd5e's card does", () => {
      const [card] =
        damageOf(
          dnd5eDamage([
            part(5, 'healing'),
            part(4, 'temphp'),
            part(3, 'maximum'),
          ]),
        ) ?? []

      expect(card.kinds.map(({ label, pool }) => [label, pool])).toEqual([
        ['Healing', 'healing'],
        ['Temp HP', 'temphp'],
        ['Max HP', 'maximum'],
      ])
    })

    it('marks healing that dnd5e called healing, and words a type it has no word for', () => {
      const [card] =
        damageOf(
          chatMessage({
            rolls: [part(5, 'radiant'), part(2, 'homebrew')],
            dnd5e: dnd5e({ roll: { type: 'healing' } }),
          }),
        ) ?? []

      expect(card.action).toBe('healing')
      expect(card.kinds.map(({ label }) => label)).toEqual([
        'Radiant',
        'Homebrew',
      ])
    })

    it('words a type as the game does, where the module says', () => {
      const [card] =
        damageOf(
          corvin([
            { ...marked(piercing), damageLabel: 'Stich' } as RollSummary,
          ]),
        ) ?? []

      expect(card.kinds[0].label).toBe('Stich')
      expect(card.rolls[0].label).toBe('Stich')
    })

    it('is a critical as its first damage roll is', () => {
      const [first] =
        damageOf(
          dnd5eDamage([
            part(10, 'piercing', { critical: true }),
            part(7, 'poison'),
          ]),
        ) ?? []
      const [second] =
        damageOf(
          dnd5eDamage([
            part(5, 'piercing'),
            part(14, 'poison', { critical: true }),
          ]),
        ) ?? []

      expect(first.critical).toBe(true)
      expect(second.critical).toBe(false)
    })

    it.each([
      ['half', 'half'],
      ['none', 'none'],
      ['full', 'full'],
      [0.5, undefined],
      [null, undefined],
    ])(
      'says what a creature that saves takes, of %p',
      (damageOnSave, onSave) => {
        const [card, other] =
          damageOf(
            dnd5eDamage(
              [part(28, 'fire'), marked(part(7, 'poison'), 'other')],
              {
                damageOnSave,
              },
            ),
          ) ?? []

        expect(card.onSave).toBe(onSave)
        // Never of Midi-QOL's other damage.
        expect(other).not.toHaveProperty('onSave')
      },
    )

    it('labels a card used with rolls by its item alone, and one without by its activity too', () => {
      expect(toTableMessage(corvin([piercing]), viewer).label).toBe(
        'Dagger (Melee)',
      )
      expect(toTableMessage(corvin([]), viewer)).toMatchObject({
        kind: 'card',
        label: 'Dagger (Melee) · Midi Attack',
      })
      // With no item named, as before.
      expect(
        toTableMessage(corvin([piercing], { item: null }), viewer).label,
      ).toBe('Dagger (Melee) - Midi Attack')
    })

    it('names damage that recorded nothing of where it is from as its flavor does', () => {
      expect(toTableMessage(flavored([part(9, 'fire')]), viewer).label).toBe(
        'Fire Bolt',
      )
      expect(toTableMessage(flavored([d20Roll(12)]), viewer).label).toBe(
        'Fire Bolt - Damage Roll',
      )
    })

    it('shows folded damage against the targets of the attack it came from', () => {
      const attack = chatMessage({
        id: 'attack',
        rolls: [d20Roll(19)],
        dnd5e: dnd5e({
          roll: { type: 'attack' },
          targets: [{ name: 'Goblin Boss', ac: 15 }],
        }),
      })
      const damage = chatMessage({
        id: 'damage',
        rolls: [piercing, poison],
        dnd5e: dnd5e({
          roll: { type: 'damage' },
          originatingMessage: 'attack',
        }),
      })

      const [shownAttack, shownDamage] = toTableMessages(
        [attack, damage],
        viewer,
      )
      expect(shownAttack.targets).toEqual([
        { name: 'Goblin Boss', ac: 15, outcome: 'hit' },
      ])
      // Not judged again: damage isn't an attack.
      expect(shownDamage).toMatchObject({
        rolls: [],
        targets: [{ name: 'Goblin Boss', ac: 15 }],
      })
      expect(shownDamage.damage?.[0].total).toBe(12)
    })

    it("reads a stored roll's marks only where they hold up, as rows aren't checked again", () => {
      const junk = {
        class: 'Roll',
        formula: '1d20',
        total: 12,
        dice: [],
        section: 'weird',
        damage: 'yes',
        flavor: 5,
        attack: 1,
        damageLabel: '',
      } as unknown as RollSummary
      const shown = toTableMessage(corvin([junk]), viewer)

      // Not damage, nor an attack.
      expect(shown).not.toHaveProperty('damage')
      expect(shown).not.toHaveProperty('attackRoll')
      expect(shown.rolls).toHaveLength(1)

      const [card] =
        damageOf(
          corvin([
            {
              ...part(4, 'piercing', { section: 'bonus' }),
              flavor: 5,
              damageLabel: '  ',
            } as unknown as RollSummary,
            {
              ...part(3, 'fire', { class: 7 }),
              damageLabel: 'x'.repeat(65),
              flavor: 'y'.repeat(101),
            } as unknown as RollSummary,
            part(2, 9 as unknown as string, { class: 'Roll' }),
          ]),
        ) ?? []
      expect(card.rolls.map(({ tag, label }) => [tag, label])).toEqual([
        ['Bonus', 'Piercing'],
        [undefined, 'Fire'],
      ])
    })
  })

  describe('damageKinds', () => {
    it('adds up each kind in the order it first comes, at least 0, null where any is unknown', () => {
      expect(
        damageKinds([
          { total: 4, damageType: 'fire' },
          { total: -6, damageType: 'cold' },
          { total: 3 },
          { total: 2, damageType: 'fire' },
          { total: null, damageType: 'acid' },
          { total: 1, damageType: 'acid' },
        ]),
      ).toEqual([
        { type: 'fire', total: 6 },
        { type: 'cold', total: 0 },
        { type: undefined, total: 3 },
        { type: 'acid', total: null },
      ])
      expect(damageKinds([])).toEqual([])
    })
  })

  describe("the Gamemaster's rolls as a character (#156)", () => {
    it("marks a message the Gamemaster's only as this app knows it, never as it claims", () => {
      const messages = toTableMessages(
        [
          chatMessage({ id: 'gm' }),
          chatMessage({ id: 'claims', gmRoll: 'req-forged' }),
          chatMessage({ id: 'plain' }),
        ],
        viewer,
        new Set(['gm']),
      )

      expect(messages.map(({ id, byGm }) => [id, byGm])).toEqual([
        ['gm', true],
        ['claims', undefined],
        ['plain', undefined],
      ])
      expect(messages[1]).not.toHaveProperty('byGm')
      expect(toTableMessage(chatMessage(), viewer, undefined, true).byGm).toBe(
        true,
      )
      expect(toTableMessages([chatMessage()], viewer)[0]).not.toHaveProperty(
        'byGm',
      )
    })
  })

  describe('roll request cards', () => {
    it("shows the module's ask, with a line of text without its DC for pages that don't read it", () => {
      expect(
        toTableMessage(
          asked({
            type: 'save',
            abilities: ['dex'],
            dc: 15,
            label: 'Worn Bardic Eternal Flame',
          }),
          viewer,
        ),
      ).toEqual({
        id: 'm1',
        sentAt: '2026-10-04T19:02:00.000Z',
        speaker: 'Thorin Oakenshield',
        side: 'me',
        whisper: false,
        kind: 'text',
        label: 'Roll Request: Worn Bardic Eternal Flame',
        text: 'Dexterity saving throw',
        rolls: [],
        targets: [],
        ask: {
          type: 'save',
          abilities: ['dex'],
          dc: 15,
          label: 'Worn Bardic Eternal Flame',
        },
      })
    })

    it("shows a module's message that asks nothing as before, its buttons unread", () => {
      const message = toTableMessage(asked(null), viewer)

      expect(message.ask).toBeUndefined()
      expect(message.text).toBe('DC 15 Dexterity saving throw')
    })

    it("never reads the buttons of a Gamemaster's card whose ask the app couldn't read", () => {
      // Its ask names dnd5e's Honor, an ability the app doesn't have, so it was stored as null.
      const message = toTableMessage(
        gmCard(card(button('dex'), button('hon')), {
          text: 'DC 15 Dexterity or Honor saving throw',
          ask: null,
        }),
        viewer,
      )

      expect(message.ask).toBeUndefined()
      expect(message.text).toBe('DC 15 Dexterity or Honor saving throw')
    })

    it("checks the module's ask again, as one stored before it was checked may not be", () => {
      expect(askWith({ abilities: ['constructor', 'dex'] })).toEqual({
        type: 'save',
        abilities: ['dex'],
      })
      expect(askWith({ abilities: ['constructor'] })).toBeUndefined()
      expect(askWith({ abilities: 'dex' })).toBeUndefined()
      expect(askWith({ type: 'check' })).toBeUndefined()
      expect(askWith({ dc: '15', label: { name: 'x' } })).toEqual({
        type: 'save',
        abilities: ['dex'],
      })
      expect(
        askWith({ type: 'concentration', abilities: [], label: ' ' }),
      ).toEqual({ type: 'concentration', abilities: [] })
    })

    it("reads an older module's Gamemaster card from its buttons, without its DC, and never its doubled text", () => {
      const message = toTableMessage(
        gmCard(card(button('str'), button('dex'), button('str'))),
        viewer,
      )

      expect(message).toMatchObject({
        speaker: 'Gamemaster',
        kind: 'text',
        label: 'Roll Request',
        text: 'Strength or Dexterity saving throw',
        ask: { type: 'save', abilities: ['str', 'dex'] },
      })
      expect(message.ask).not.toHaveProperty('dc')
      expect(JSON.stringify(message)).not.toContain('15')
    })

    it("reads a concentration card's buttons, and only those of its first kind", () => {
      expect(
        toTableMessage(
          gmCard(
            card(
              button('con', 'concentration'),
              button('dex'),
              "<button data-action='rollRequest' data-type='concentration' data-ability='wis'>",
            ),
          ),
          viewer,
        ).ask,
      ).toEqual({ type: 'concentration', abilities: ['con', 'wis'] })
    })

    it.each([
      [
        'spoken by a character',
        gmCard(card(button('dex')), {
          speaker: { alias: 'Vex', actorId: 'actor-vex' },
          character: 'actor-vex',
        }),
      ],
      [
        'spoken as an actor not in the campaign',
        gmCard(card(button('dex')), {
          speaker: { alias: 'Goblin', actorId: 'actor-goblin' },
        }),
      ],
      ['without content', gmCard(undefined as unknown as string)],
      [
        'whose buttons do something else',
        gmCard(card(button('dex', 'save', 'rollSave'))),
      ],
      [
        'asking for a check with an ability dnd5e lacks',
        gmCard(card(button('ath', 'skill'))),
      ],
      [
        'asking with abilities dnd5e lacks',
        gmCard(
          card(button('constructor'), button('__proto__'), button('luck')),
        ),
      ],
      ['with no button', gmCard('<p>rollRequest</p>')],
    ])("reads no ask from an older module's card %s", (_name, message) => {
      const view = toTableMessage(message, viewer)

      expect(view.ask).toBeUndefined()
      expect(view.text).toBe(
        'DC 15 Dexterity saving throw Dexterity saving throw',
      )
    })

    it("shows the module's ask for a check, the game's name for a tool, with a line of text without its DC", () => {
      const message = toTableMessage(
        asked({
          type: 'check',
          checks: [
            { type: 'skill', ability: 'str', skill: 'ath' },
            { type: 'tool', ability: 'dex', tool: 'thief', name: 'Lockpicks' },
          ],
          dc: 15,
          label: 'Cloak of Climbing',
        }),
        viewer,
      )

      expect(message).toMatchObject({
        kind: 'text',
        text: 'Strength (Athletics) or Dexterity (Lockpicks) check',
        ask: {
          type: 'check',
          checks: [
            { type: 'skill', ability: 'str', skill: 'ath' },
            { type: 'tool', ability: 'dex', tool: 'thief', name: 'Lockpicks' },
          ],
          dc: 15,
          label: 'Cloak of Climbing',
        },
      })
    })

    it("checks the module's ask for a check again, reading none where a way to make it doesn't hold up", () => {
      expect(
        checkWith([{ type: 'check', ability: 'int' }], {
          dc: 12.5,
          label: ' Map ',
        }),
      ).toEqual({
        type: 'check',
        checks: [{ type: 'check', ability: 'int' }],
        label: 'Map',
      })
      // What only a tool has is left off any other.
      expect(
        checkWith([
          { type: 'skill', ability: 'str', skill: 'ath', name: 'Climbing' },
        ]),
      ).toEqual({
        type: 'check',
        checks: [{ type: 'skill', ability: 'str', skill: 'ath' }],
      })
      expect(checkWith([])).toBeUndefined()
      expect(checkWith('ath')).toBeUndefined()
      expect(
        checkWith([
          { type: 'check', ability: 'int' },
          { type: 'check', ability: 'constructor' },
        ]),
      ).toBeUndefined()
      expect(checkWith([{ type: 'skill', ability: 'str' }])).toBeUndefined()
      expect(
        checkWith([{ type: 'tool', ability: 'dex', tool: 'a b' }]),
      ).toBeUndefined()
      expect(checkWith([{ type: 'save', ability: 'dex' }])).toBeUndefined()
      expect(
        checkWith(
          Array.from({ length: 11 }, () => ({ type: 'check', ability: 'str' })),
        ),
      ).toBeUndefined()
    })

    it("reads an older module's Gamemaster card for a check from its buttons, each way once, without its DC", () => {
      const message = toTableMessage(
        gmCard(
          card(
            checkButton(
              'data-type="skill" data-ability="str" data-skill="ath"',
            ),
            checkButton(
              'data-type="skill" data-ability="dex" data-skill="acr" data-using-tool="thief"',
            ),
            checkButton(
              'data-type="skill" data-ability="str" data-skill="ath"',
            ),
            checkButton(
              'data-type="tool" data-ability="dex" data-tool="thief"',
            ),
            checkButton('data-type="check" data-ability="luck"'),
          ),
          { text: 'DC 15 check check' },
        ),
        viewer,
      )

      expect(message).toMatchObject({
        text: "Strength (Athletics), Dexterity (Acrobatics), or Dexterity (Thieves' Tools) check",
        ask: {
          type: 'check',
          checks: [
            { type: 'skill', ability: 'str', skill: 'ath' },
            { type: 'skill', ability: 'dex', skill: 'acr' },
            { type: 'tool', ability: 'dex', tool: 'thief' },
          ],
        },
      })
      expect(message.ask).not.toHaveProperty('dc')
      expect(JSON.stringify(message)).not.toContain('15')
    })

    it("reads no ask from an older module's card offering more checks than a check may, rather than less than it asks", () => {
      const skills = [
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
      ]
      const message = (count: number) =>
        gmCard(
          card(
            ...skills
              .slice(0, count)
              .map(skill =>
                checkButton(
                  `data-type="skill" data-ability="int" data-skill="${skill}"`,
                ),
              ),
          ),
        )

      expect(toTableMessage(message(10), viewer).ask).toMatchObject({
        type: 'check',
        checks: expect.arrayContaining([
          { type: 'skill', ability: 'int', skill: 'med' },
        ]),
      })
      const eleven = toTableMessage(message(11), viewer)
      expect(eleven.ask).toBeUndefined()
      expect(eleven.text).toBe(
        'DC 15 Dexterity saving throw Dexterity saving throw',
      )
    })

    it.each([
      [
        'a long run of "data-" in a tag',
        `<button data-action="rollRequest" data-type="save" data-ability="dex" title="${'data-'.repeat(20_000)}">`,
        { type: 'save', abilities: ['dex'] },
      ],
      [
        'a long run of unclosed tags',
        `<button data-action="rollRequest" data-type="save" data-ability="dex">${'<button'.repeat(15_000)}`,
        { type: 'save', abilities: ['dex'] },
      ],
    ])(
      "reads an older module's card with %s quickly, each tag once",
      (_name, content, ask) => {
        const started = performance.now()
        const message = toTableMessage(gmCard(content), viewer)
        const took = performance.now() - started

        expect(message.ask).toEqual(ask)
        // Read from each "data-" or "<button" to the end, 100,000 characters take seconds.
        expect(took).toBeLessThan(500)
      },
    )

    it('never takes a data attribute for one of its own', () => {
      expect(
        toTableMessage(
          gmCard(
            card(
              '<button data-action="rollRequest" data-type="save" data-ability="dex" data-__proto__="x" data-constructor="y">',
            ),
          ),
          viewer,
        ).ask,
      ).toEqual({ type: 'save', abilities: ['dex'] })
    })

    it('reads no ask from a roll', () => {
      const message = toTableMessage(
        {
          ...asked({ type: 'save', abilities: ['dex'] }),
          rolls: [d20],
        },
        viewer,
      )

      expect(message.kind).toBe('roll')
      expect(message.ask).toBeUndefined()
    })

    it.each([
      [
        { type: 'save', abilities: ['dex'], dc: 15 },
        'DC 15 Dexterity saving throw',
      ],
      [
        { type: 'save', abilities: ['str', 'dex'] },
        'Strength or Dexterity saving throw',
      ],
      [
        { type: 'save', abilities: ['str', 'dex', 'con'] },
        'Strength, Dexterity, or Constitution saving throw',
      ],
      [
        { type: 'concentration', abilities: [], dc: 10 },
        'DC 10 Concentration check',
      ],
      [{ type: 'concentration', abilities: ['con'] }, 'Concentration check'],
      [
        { type: 'concentration', abilities: ['wis'] },
        'Concentration check (Wisdom)',
      ],
      [
        { type: 'save', abilities: ['constructor', 'int'] },
        'Intelligence saving throw',
      ],
    ] as const)('words %j as "%s"', (ask, title) => {
      expect(askTitle({ ...ask, abilities: [...ask.abilities] })).toBe(title)
    })

    it.each([
      [
        [{ type: 'skill', ability: 'str', skill: 'ath' }],
        15,
        'DC 15 Strength (Athletics) check',
      ],
      [
        [
          { type: 'check', ability: 'int' },
          { type: 'check', ability: 'wis' },
        ],
        undefined,
        'Intelligence or Wisdom check',
      ],
      [
        [{ type: 'tool', ability: 'dex', tool: 'thief' }],
        10,
        "DC 10 Dexterity (Thieves' Tools) check",
      ],
      [
        [{ type: 'tool', ability: 'int', tool: 'herb', name: 'Herbs' }],
        undefined,
        'Intelligence (Herbs) check',
      ],
      [
        [{ type: 'skill', ability: 'wis', skill: 'pil' }],
        undefined,
        'Wisdom (pil) check',
      ],
    ] as const)(
      'words a check of %j against DC %s as "%s"',
      (checks, dc, title) => {
        expect(
          askTitle({
            type: 'check',
            checks: checks.map(check => ({ ...check })),
            ...(dc !== undefined && { dc }),
          }),
        ).toBe(title)
      },
    )
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

    it('marks those the game has disposed as allies or neutral, from module 0.29.0, leaving their side and hit points alone', () => {
      const { combatants } = toTableCombat(dispositionCombat(), viewer)

      expect(
        combatants.map(({ id, side, stance, hp }) => ({
          id,
          side,
          stance,
          hp: hp !== undefined,
        })),
      ).toEqual([
        { id: 'c-thorin', side: 'me', stance: undefined, hp: true },
        // A charmed ally, marked Hostile, is still of the party.
        { id: 'c-vex', side: 'party', stance: undefined, hp: true },
        { id: 'c-mira', side: 'other', stance: 'ally', hp: false },
        { id: 'c-merchant', side: 'other', stance: 'neutral', hp: false },
        { id: 'c-goblin', side: 'other', stance: undefined, hp: false },
        { id: 'c-lurker', side: 'other', stance: undefined, hp: false },
      ])
      // None is sent where it isn't one.
      for (const each of combatants.filter(({ stance }) => !stance)) {
        expect(each).not.toHaveProperty('stance')
      }
    })

    it.each([
      ['friendly', 'other', 'ally'],
      ['neutral', 'other', 'neutral'],
      ['hostile', 'other', undefined],
      [null, 'other', undefined],
      [undefined, 'other', undefined],
      ['friendly', 'party', undefined],
      ['neutral', 'party', undefined],
      ['hostile', 'party', undefined],
      [null, 'party', undefined],
      ['friendly', 'me', undefined],
      ['neutral', 'me', undefined],
      ['hostile', 'me', undefined],
      [undefined, 'me', undefined],
    ] as const)(
      'gives a combatant disposed %p, whose side is %s, the stance %p',
      (disposition, side, stance) => {
        const fields = {
          me: { character: 'actor-thorin', playerOwned: true },
          party: { character: null, playerOwned: true },
          other: { character: null, playerOwned: false },
        }[side]
        const snapshot = combat({
          combatants: [
            combatant({
              id: 'c-one',
              ...fields,
              ...(disposition !== undefined && { disposition }),
            }),
          ],
        })

        const [one] = toTableCombat(snapshot, viewer).combatants

        expect(one.side).toBe(side)
        expect(one.stance).toBe(stance)
      },
    )
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

    it("names the tools the character has, from module 0.18.0, by dnd5e's name where the sheet has none", () => {
      const thief = {
        id: 'thief',
        name: '',
        ability: 'dex',
        total: 5,
        passive: null,
        proficiency: 1,
        mode: 0,
      } as const
      const view = toTableSheet(
        characterSheet({ tools: [thief, { ...thief, id: 'x', name: '' }] }),
        origin,
      )

      expect(view.tools).toEqual([
        { ...thief, name: "Thieves' Tools" },
        { ...thief, id: 'x', name: 'x' },
      ])
      expect(toTableSheet(characterSheet(), origin)).not.toHaveProperty('tools')
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

    it("finds favorites' icons at the game, and reads a sheet from before module 0.9.0 as having none", () => {
      const favorites = sheetFavorites()
      const view = toTableSheet(fullerSheet({ favorites }), origin)
      const { favorites: none, ...older } = characterSheet()

      expect(view.favorites).toEqual([
        favorites[0],
        {
          ...favorites[1],
          img: `${origin}/icons/weapons/hammers/hammer-war.webp`,
        },
        {
          ...favorites[2],
          img: `${origin}/systems/dnd5e/icons/svg/activity/cast.svg`,
        },
        {
          ...favorites[3],
          img: `${origin}/icons/magic/control/buff-flight-wings-blue.webp`,
        },
        ...favorites.slice(4),
      ])
      expect(none).toEqual([])
      expect(toTableSheet(older as CharacterSheet, origin).favorites).toEqual(
        [],
      )
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

const TRIO = [
  { name: 'Goblin', uuid: 'Actor.gob' },
  { name: 'Orc', uuid: 'Actor.orc' },
  { name: 'Kobold', uuid: 'Actor.kob' },
]

/** A Fireball's card at a goblin, an orc and a kobold, as dnd5e names its targets. */
const fireball = (targets: object[] = TRIO) =>
  chatMessage({
    id: 'fireball',
    timestamp: 1000,
    speaker: { alias: 'Ember', actorId: 'actor-ember' },
    dnd5e: dnd5e({
      messageType: 'usage',
      item: { name: 'Fireball', type: 'spell' },
      activity: { name: 'Save', type: 'save' },
      targets: targets as never,
    }),
  })
/** A creature's save rolled from the card, as module 0.29.0 sends it. */
const saved = (id: string, speaker: string, save?: object, timestamp = 2000) =>
  chatMessage({
    id,
    timestamp,
    speaker: { alias: speaker, actorId: null },
    rolls: [roll({ total: 12 })],
    dnd5e: dnd5e({
      roll: { type: 'save', ability: 'dex' },
      originatingMessage: 'fireball',
      ...(save && { save: save as never }),
    }),
  })
const shown = (messages: SerializedMessage[], seen: Viewer = viewer) =>
  Object.fromEntries(
    toTableMessages(messages, seen).map(({ id, targets, summary }) => [
      id,
      { targets, summary },
    ]),
  )

describe('utils/table-view for hits, misses and saves, from module 0.29.0', () => {
  it("takes the module's word for a hit or a miss over the armor class", () => {
    const message = chatMessage({
      rolls: [roll({ total: 15 })],
      dnd5e: dnd5e({
        roll: { type: 'attack' },
        targets: [
          { name: 'Goblin', ac: 20, outcome: 'hit' },
          { name: 'Orc', ac: 10, outcome: 'miss' },
          { name: 'Kobold', outcome: 'miss' },
        ] as never,
      }),
    })

    expect(toTableMessage(message, viewer).targets).toEqual([
      { name: 'Goblin', ac: 20, outcome: 'hit' },
      { name: 'Orc', ac: 10, outcome: 'miss' },
      { name: 'Kobold', outcome: 'miss' },
    ])
  })

  it('still judges an attack against the armor class it has, from an older module with Gamemaster-only information, and sums it up', () => {
    const message = chatMessage({
      rolls: [roll({ total: 15 })],
      dnd5e: dnd5e({
        roll: { type: 'attack' },
        targets: [
          { name: 'Goblin', ac: 12 },
          { name: 'Orc', ac: 16 },
          { name: 'Kobold', ac: 15 },
        ],
      }),
    })

    expect(toTableMessage(message, viewer)).toMatchObject({
      targets: [
        { name: 'Goblin', ac: 12, outcome: 'hit' },
        { name: 'Orc', ac: 16, outcome: 'miss' },
        { name: 'Kobold', ac: 15, outcome: 'hit' },
      ],
      summary: 'Hit 2 of 3',
    })
  })

  it("says whether each saved against Midi-QOL's card, as it says, summing up only those with a result", () => {
    const message = fireball([
      { name: 'Goblin', uuid: 'Actor.gob', save: 'failure' },
      { name: 'Orc', uuid: 'Actor.orc', save: 'success' },
      { name: 'Kobold', uuid: 'Actor.kob' },
    ])

    expect(toTableMessage(message, viewer)).toMatchObject({
      targets: [
        { name: 'Goblin', save: 'failed' },
        { name: 'Orc', save: 'saved' },
        { name: 'Kobold' },
      ],
      summary: '1 of 2 saved',
    })
    expect(toTableMessage(message, viewer).targets[2]).toEqual({
      name: 'Kobold',
    })
  })

  it('sums up hits and saves together, and nothing for one target or none with a result', () => {
    const both = fireball([
      { name: 'Goblin', uuid: 'Actor.gob', outcome: 'hit', save: 'failure' },
      { name: 'Orc', uuid: 'Actor.orc', outcome: 'miss' },
    ])
    expect(toTableMessage(both, viewer).summary).toBe(
      'Hit 1 of 2 · 0 of 1 saved',
    )
    expect(
      toTableMessage(
        fireball([{ name: 'Goblin', uuid: 'Actor.gob', outcome: 'hit' }]),
        viewer,
      ),
    ).not.toHaveProperty('summary')
    expect(toTableMessage(fireball(), viewer)).not.toHaveProperty('summary')
    // Counting only those whose hit or miss is told.
    expect(
      toTableMessage(
        fireball([
          { name: 'Goblin', uuid: 'Actor.gob', outcome: 'hit' },
          { name: 'Orc', uuid: 'Actor.orc', outcome: 'miss' },
          { name: 'Kobold', uuid: 'Actor.kob' },
        ]),
        viewer,
      ).summary,
    ).toBe('Hit 1 of 2')
  })

  it("joins each creature's save onto the card by its uuid, the latest it may see winning", () => {
    const messages = shown([
      fireball(),
      saved(
        'gob1',
        'Goblin',
        { target: 'Actor.gob', outcome: 'success' },
        2000,
      ),
      // Rolled again, later: this one stands.
      saved(
        'gob2',
        'Goblin',
        { target: 'Actor.gob', outcome: 'failure' },
        3000,
      ),
      saved('orc', 'Orc', { target: 'Actor.orc', outcome: 'success' }),
      // Not decided, as of a modified d20: none.
      saved('kob', 'Kobold', { target: 'Actor.kob' }),
    ])

    expect(messages.fireball).toEqual({
      targets: [
        { name: 'Goblin', save: 'failed' },
        { name: 'Orc', save: 'saved' },
        { name: 'Kobold' },
      ],
      summary: '1 of 2 saved',
    })
  })

  it("keeps a save's outcome from viewers it names no character of, but shows it to those it does", () => {
    const messages = [
      fireball(),
      saved('gob', 'Goblin', {
        target: 'Actor.gob',
        outcome: 'failure',
        readers: ['actor-ember'],
      }),
      // A later one the viewer may not see doesn't hide an earlier one they may.
      saved('orc1', 'Orc', { target: 'Actor.orc', outcome: 'success' }, 2000),
      saved(
        'orc2',
        'Orc',
        { target: 'Actor.orc', outcome: 'failure', readers: ['actor-ember'] },
        3000,
      ),
    ]

    expect(shown(messages).fireball.targets).toEqual([
      { name: 'Goblin' },
      { name: 'Orc', save: 'saved' },
      { name: 'Kobold' },
    ])
    expect(shown(messages).gob.targets).toEqual([{ name: 'Goblin' }])
    const ember = { ...viewer, actorId: 'actor-ember' }
    expect(shown(messages, ember).fireball.targets).toEqual([
      { name: 'Goblin', save: 'failed' },
      { name: 'Orc', save: 'failed' },
      { name: 'Kobold' },
    ])
    expect(shown(messages, ember).gob.targets).toEqual([
      { name: 'Goblin', save: 'failed' },
    ])
    // A viewer with no character of their own is named by none.
    expect(
      shown(messages, { ...viewer, actorId: undefined }).gob.targets,
    ).toEqual([{ name: 'Goblin' }])
  })

  it("names a creature's own save alone, as the card names it, or else as it speaks", () => {
    const messages = shown([
      fireball([{ name: 'Goblin Boss', uuid: 'Actor.gob' }, ...TRIO.slice(1)]),
      saved('gob', 'Grik', { target: 'Actor.gob', outcome: 'success' }),
      saved('stray', 'Bat', { target: 'Actor.bat', outcome: 'failure' }),
      saved('pending', 'Orc', { target: 'Actor.orc' }),
    ])

    expect(messages.gob).toEqual({
      targets: [{ name: 'Goblin Boss', save: 'saved' }],
      summary: undefined,
    })
    // One the card didn't name, as dnd5e's button rolls for whoever is controlled.
    expect(messages.stray.targets).toEqual([{ name: 'Bat', save: 'failed' }])
    expect(messages.pending.targets).toEqual([{ name: 'Orc' }])
  })

  it("keeps an older module's save showing its card's targets, as before", () => {
    const messages = shown([fireball(), saved('old', 'Goblin')])

    expect(messages.old.targets).toEqual([
      { name: 'Goblin' },
      { name: 'Orc' },
      { name: 'Kobold' },
    ])
  })

  it("shows damage rolled from a card against the card's targets bare, without what came of them there", () => {
    const attack = chatMessage({
      id: 'attack',
      rolls: [roll({ total: 18 })],
      dnd5e: dnd5e({
        roll: { type: 'attack' },
        targets: [
          { name: 'Goblin', uuid: 'Actor.gob', ac: 12, outcome: 'hit' },
          { name: 'Orc', uuid: 'Actor.orc', save: 'success' },
        ] as never,
      }),
    })
    const damage = chatMessage({
      id: 'damage',
      rolls: [roll()],
      dnd5e: dnd5e({ roll: { type: 'damage' }, originatingMessage: 'attack' }),
    })
    const messages = shown([attack, damage])

    expect(messages.attack.targets).toEqual([
      { name: 'Goblin', ac: 12, outcome: 'hit' },
      { name: 'Orc', save: 'saved' },
    ])
    expect(messages.damage).toEqual({
      targets: [{ name: 'Goblin', ac: 12 }, { name: 'Orc' }],
      summary: undefined,
    })
  })
})
