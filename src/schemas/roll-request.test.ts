/* eslint-disable unicorn/no-null -- the protocol says no target with null */
import { commandsPollSchema, rollRequestSchema } from './roll-request'

/** A Perception check, rolled normally. */
const perception = {
  kind: 'skill',
  key: 'prc',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
}

const parse = (fields: object) =>
  rollRequestSchema.safeParse({ ...perception, ...fields })

/** A longsword attack, rolled normally, at a goblin. */
const attack = {
  kind: 'attack',
  item: 'longsword',
  activity: 'swing',
  target: { combatId: 'cmbt1', combatantId: 'goblin' },
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
}

/** Its damage, 1d8 + 4 slashing and 1d6 fire, as the attack said. */
const damage = {
  kind: 'damage',
  use: 'req-1',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [
    { faces: 8, results: [5] },
    { faces: 6, results: [6] },
  ],
}

/** Fireball, cast at two goblins with a 4th-level slot. */
const use = {
  kind: 'use',
  item: 'fireball',
  activity: 'blast',
  targets: [
    { combatId: 'cmbt1', combatantId: 'goblin' },
    { combatId: 'cmbt1', combatantId: 'hobgoblin' },
  ],
  slot: 'spell4',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
}

const parseAttack = (fields: object) =>
  rollRequestSchema.safeParse({ ...attack, ...fields })

const parseUse = (fields: object) =>
  rollRequestSchema.safeParse({ ...use, ...fields })

const parseDamage = (fields: object) =>
  rollRequestSchema.safeParse({ ...damage, ...fields })

/** Fire Breath, an area attack, at a goblin and a hobgoblin. */
const parseArea = (fields: object) =>
  parseAttack({ target: undefined, targets: use.targets, ...fields })

/** A d10 hit die spent, landing on 7. */
const hitDie = {
  kind: 'hitDie',
  denomination: 'd10',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 10, results: [7] }],
}

const parseHitDie = (fields: object) =>
  rollRequestSchema.safeParse({ ...hitDie, ...fields })

/** A lantern's light, whose radius is 1d4 + 2d6 + 3. */
const formula = {
  kind: 'formula',
  item: 'lantern',
  activity: 'shine',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [
    { faces: 4, results: [3] },
    { faces: 6, results: [2, 5] },
  ],
}

const parseFormula = (fields: object) =>
  rollRequestSchema.safeParse({ ...formula, ...fields })

describe('schemas/roll-request', () => {
  it('takes a roll with exactly the dice it throws', () => {
    expect(parse({}).success).toBe(true)
    expect(
      parse({
        mode: 1,
        explicit: true,
        extras: [
          { sign: 1, count: 1, sides: 4 },
          { sign: -1, flat: 1 },
          { sign: 1, count: 2, sides: 6 },
        ],
        dice: [
          { faces: 20, results: [17, 3] },
          { faces: 4, results: [2] },
          { faces: 6, results: [6, 1] },
        ],
      }).success,
    ).toBe(true)
  })

  it.each([
    ['one d20 short with advantage', { mode: 1 }],
    ['a d20 too many', { dice: [{ faces: 20, results: [3, 4] }] }],
    ['a result past the die', { dice: [{ faces: 20, results: [21] }] }],
    ['a result of nothing', { dice: [{ faces: 20, results: [0] }] }],
    [
      "an added term's dice missing",
      { extras: [{ sign: 1, count: 1, sides: 4 }] },
    ],
    [
      'dice no term adds',
      {
        dice: [
          { faces: 20, results: [14] },
          { faces: 6, results: [3] },
        ],
      },
    ],
    [
      'the wrong die for a term',
      {
        extras: [{ sign: 1, count: 1, sides: 4 }],
        dice: [
          { faces: 20, results: [14] },
          { faces: 6, results: [3] },
        ],
      },
    ],
    [
      'a die that does not exist',
      {
        extras: [{ sign: 1, count: 1, sides: 7 }],
        dice: [
          { faces: 20, results: [14] },
          { faces: 7, results: [3] },
        ],
      },
    ],
    ['a fractional die', { dice: [{ faces: 20, results: [1.5] }] }],
    [
      'too many of a die',
      {
        extras: [{ sign: 1, count: 21, sides: 6 }],
        dice: [
          { faces: 20, results: [14] },
          { faces: 6, results: Array.from({ length: 21 }, () => 1) },
        ],
      },
    ],
    ['a number too big', { extras: [{ sign: 1, flat: 101 }] }],
    ['a skill without its key', { key: undefined }],
    ['a key that is not a key', { key: '@abilities.str.mod' }],
    ['a death save with a key', { kind: 'death' }],
    ['initiative without its combat', { kind: 'initiative', key: undefined }],
    ['a combat for a skill', { combatId: 'cmbt1' }],
    ['a kind it does not know', { kind: 'heal', key: undefined }],
    ['an item for a skill', { item: 'longsword', activity: 'swing' }],
    ['a target for a skill', { target: null }],
    ['an attack for a skill', { use: 'req-1' }],
    ['a formula', { formula: '1d20 + 99' }],
  ])('refuses %s', (_name, fields) => {
    expect(parse(fields).success).toBe(false)
  })

  it('takes a death save and initiative, which name nothing', () => {
    expect(parse({ kind: 'death', key: undefined }).success).toBe(true)
    expect(
      parse({ kind: 'initiative', key: undefined, combatId: 'cmbt1' }).success,
    ).toBe(true)
  })

  it('takes an attack with an item and its attack activity, at a combatant or none', () => {
    expect(parseAttack({}).success).toBe(true)
    expect(parseAttack({ target: null }).success).toBe(true)
    expect(parseAttack({ target: undefined }).success).toBe(true)
    expect(
      parseAttack({
        mode: -1,
        explicit: true,
        extras: [{ sign: 1, count: 1, sides: 4 }],
        dice: [
          { faces: 20, results: [3, 19] },
          { faces: 4, results: [4] },
        ],
      }).success,
    ).toBe(true)
  })

  it.each([
    ['without its item', { item: undefined }],
    ['without its attack', { activity: undefined }],
    ['with an id that is not one', { activity: 'swing.attack' }],
    ['naming a key', { key: 'prc' }],
    ['in a combat of its own', { combatId: 'cmbt1' }],
    ['at a target with no combat', { target: { combatantId: 'goblin' } }],
    ['at more than its target', { target: { ...attack.target, tokenId: 'a' } }],
    ['following an attack', { use: 'req-1' }],
    ['with no d20', { dice: [] }],
  ])('refuses an attack %s', (_name, fields) => {
    expect(parseAttack(fields).success).toBe(false)
  })

  it('takes an attack with the spell slot, ammunition and attack mode chosen', () => {
    expect(
      parseAttack({
        slot: 'spell2',
        ammunition: 'silverArrows',
        attackMode: 'thrown-offhand',
      }).success,
    ).toBe(true)
    expect(parseAttack({ slot: 'pact' }).success).toBe(true)
    expect(parseAttack({ slot: null }).success).toBe(true)
  })

  it.each([
    ['with a slot that is not one', { slot: 'spell10' }],
    ['with a slot of nothing', { slot: '' }],
    ['with ammunition that is not an id', { ammunition: 'silver arrows' }],
    ['in a mode that is not one', { attackMode: '2 hands' }],
    ['at targets', { targets: [] }],
    ['with kinds of damage', { types: ['fire'] }],
    ['with its damage changed', { modifiers: { maximize: true } }],
  ])('refuses an attack %s', (_name, fields) => {
    expect(parseAttack(fields).success).toBe(false)
  })

  it('takes an area attack at the combatants in its area, all in one combat, in place of a target', () => {
    expect(parseArea({}).success).toBe(true)
    expect(parseArea({ targets: [use.targets[0]] }).success).toBe(true)
    expect(parseArea({ slot: 'spell2' }).success).toBe(true)
  })

  it.each([
    ['at a target as well', { target: attack.target }],
    ['at no target as well', { target: null }],
    [
      'at the same combatant twice',
      { targets: [use.targets[0], use.targets[0]] },
    ],
    [
      'at combatants of two combats',
      { targets: [use.targets[0], { combatId: 'cmbt2', combatantId: 'ogre' }] },
    ],
    [
      'at too many',
      {
        targets: Array.from({ length: 21 }, (_, index) => ({
          combatId: 'cmbt1',
          combatantId: `c${index}`,
        })),
      },
    ],
    ['at a combatant with no combat', { targets: [{ combatantId: 'goblin' }] }],
  ])('refuses an area attack %s', (_name, fields) => {
    expect(parseArea(fields).success).toBe(false)
  })

  it('takes targets for an attack or a use, and nothing else', () => {
    expect(parse({ targets: use.targets }).success).toBe(false)
    expect(parseDamage({ targets: use.targets }).success).toBe(false)
    expect(
      parse({ kind: 'death', key: undefined, targets: use.targets }).success,
    ).toBe(false)
  })

  it('takes a hit die spent, of any size a class has, with its one die', () => {
    expect(parseHitDie({}).success).toBe(true)
    for (const faces of [4, 6, 8, 10, 12]) {
      expect(
        parseHitDie({
          denomination: `d${faces}`,
          dice: [{ faces, results: [faces] }],
        }).success,
      ).toBe(true)
    }
  })

  it.each([
    ['without its size', { denomination: undefined }],
    [
      'of a size no class has',
      { denomination: 'd20', dice: [{ faces: 20, results: [7] }] },
    ],
    ['of a size that is not a die', { denomination: '10' }],
    ['of a size written otherwise', { denomination: 'D10' }],
    ['with a die of another size', { dice: [{ faces: 8, results: [7] }] }],
    ['with no die', { dice: [] }],
    [
      'with two dice',
      {
        dice: [
          { faces: 10, results: [7] },
          { faces: 10, results: [2] },
        ],
      },
    ],
    ['with two results', { dice: [{ faces: 10, results: [7, 2] }] }],
    ['with a result past the die', { dice: [{ faces: 10, results: [11] }] }],
    ['with advantage', { mode: 1 }],
    ['rolled as the player chose', { explicit: true }],
    ['with something added', { extras: [{ sign: 1, flat: 2 }] }],
    ['naming a key', { key: 'con' }],
    ['naming an item', { item: 'lantern', activity: 'shine' }],
    ['at a target', { target: null }],
    ['at targets', { targets: [] }],
    ['with a spell slot', { slot: 'spell1' }],
    ['in a combat', { combatId: 'cmbt1' }],
    ['following an attack', { use: 'req-1' }],
    ['answering what the game asked', { prompt: 'msg1-thorin' }],
  ])('refuses a hit die %s', (_name, fields) => {
    expect(parseHitDie(fields).success).toBe(false)
  })

  it('gives a size to a hit die, and to nothing else', () => {
    expect(parse({ denomination: 'd10' }).success).toBe(false)
    expect(parseAttack({ denomination: 'd10' }).success).toBe(false)
    expect(parseDamage({ denomination: 'd10' }).success).toBe(false)
    expect(parseFormula({ denomination: 'd10' }).success).toBe(false)
  })

  it("takes a feature's own formula with its item and activity, and the dice it throws, or none", () => {
    expect(parseFormula({}).success).toBe(true)
    expect(parseFormula({ dice: [] }).success).toBe(true)
    expect(
      parseFormula({ dice: [{ faces: 100, results: [100] }] }).success,
    ).toBe(true)
  })

  it.each([
    ['without its item', { item: undefined }],
    ['without its activity', { activity: undefined }],
    ['with an id that is not one', { activity: 'shine.light' }],
    ['with a die that does not exist', { dice: [{ faces: 7, results: [3] }] }],
    ['with a result past the die', { dice: [{ faces: 4, results: [5] }] }],
    ['with a result of nothing', { dice: [{ faces: 4, results: [0] }] }],
    ['with a die thrown for nothing', { dice: [{ faces: 4, results: [] }] }],
    ['with advantage', { mode: -1 }],
    ['rolled as the player chose', { explicit: true }],
    ['with something added', { extras: [{ sign: 1, count: 1, sides: 4 }] }],
    ['naming a key', { key: 'prc' }],
    ['at a target', { target: null }],
    ['at targets', { targets: [] }],
    ['with a spell slot', { slot: 'spell1' }],
    ['with ammunition', { ammunition: 'arrows' }],
    ['with kinds of damage', { types: ['fire'] }],
    ['changed as damage is', { modifiers: { maximize: true } }],
    ['following an attack', { use: 'req-1' }],
  ])('refuses a formula %s', (_name, fields) => {
    expect(parseFormula(fields).success).toBe(false)
  })

  it('takes a use at the combatants picked, or none, with the slot chosen, or none', () => {
    expect(parseUse({}).success).toBe(true)
    expect(parseUse({ targets: [], slot: null }).success).toBe(true)
    expect(parseUse({ slot: undefined }).success).toBe(true)
  })

  it.each([
    ['without its item', { item: undefined }],
    ['without its activity', { activity: undefined }],
    ['without its targets', { targets: undefined }],
    ['at one target', { target: use.targets[0] }],
    [
      'at the same combatant twice',
      { targets: [use.targets[0], use.targets[0]] },
    ],
    [
      'at combatants of two combats',
      { targets: [use.targets[0], { combatId: 'cmbt2', combatantId: 'ogre' }] },
    ],
    [
      'at too many',
      {
        targets: Array.from({ length: 21 }, (_, index) => ({
          combatId: 'cmbt1',
          combatantId: `c${index}`,
        })),
      },
    ],
    ['with a slot that is not one', { slot: 'spell0' }],
    ['with ammunition', { ammunition: 'arrows' }],
    ['in an attack mode', { attackMode: 'thrown' }],
    ['with a d20', { dice: [{ faces: 20, results: [12] }] }],
    ['with advantage', { mode: 1 }],
    ['with something added', { extras: [{ sign: 1, flat: 2 }] }],
    ['following an attack', { use: 'req-1' }],
  ])('refuses a use %s', (_name, fields) => {
    expect(parseUse(fields).success).toBe(false)
  })

  it('takes damage with the dice its attack said, or none for the game to roll', () => {
    expect(parseDamage({}).success).toBe(true)
    expect(parseDamage({ dice: [] }).success).toBe(true)
    // A critical hit's dice, doubled.
    expect(parseDamage({ dice: [{ faces: 8, results: [1, 8] }] }).success).toBe(
      true,
    )
  })

  it.each([
    ['without its attack', { use: undefined }],
    ['of an attack that is not one', { use: 'req 1' }],
    ['with advantage', { mode: 1 }],
    ['rolled as the player chose', { explicit: true }],
    ['with something added', { extras: [{ sign: 1, flat: 2 }] }],
    ['with a die that does not exist', { dice: [{ faces: 7, results: [3] }] }],
    ['with a result past the die', { dice: [{ faces: 6, results: [7] }] }],
    ['with a die thrown for nothing', { dice: [{ faces: 6, results: [] }] }],
    [
      'with too many terms',
      { dice: Array.from({ length: 21 }, () => ({ faces: 6, results: [1] })) },
    ],
    ['naming an item', { item: 'longsword', activity: 'swing' }],
    ['at a target', { target: null }],
    ['naming a key', { key: 'prc' }],
    ['in a combat', { combatId: 'cmbt1' }],
    ['at targets', { targets: [] }],
    ['with a spell slot', { slot: 'spell1' }],
    ['with a kind of damage that is not one', { types: ['fire damage'] }],
    [
      'with too many kinds of damage',
      { types: Array.from({ length: 21 }, () => null) },
    ],
    ['made a die there is no such damage of', { modifiers: { faces: 20 } }],
    ['with dice taken away', { modifiers: { extra: -1 } }],
    ['with more dice than a roll throws', { modifiers: { extra: 41 } }],
    ['changed some other way', { modifiers: { halve: true } }],
  ])('refuses damage %s', (_name, fields) => {
    expect(parseDamage(fields).success).toBe(false)
  })

  it('takes damage with the kind chosen for each roll offering one', () => {
    expect(parseDamage({ types: ['fire', null] }).success).toBe(true)
    expect(parseDamage({ types: [] }).success).toBe(true)
  })

  it('takes damage changed as the player chose: more dice, another die, its highest', () => {
    expect(
      parseDamage({
        modifiers: { extra: 2, faces: 12, maximize: true },
        dice: [{ faces: 12, results: [12, 12, 12] }],
      }).success,
    ).toBe(true)
    expect(parseDamage({ modifiers: {} }).success).toBe(true)
  })

  it('takes a saving throw answering what the game asked, and only a saving throw', () => {
    const save = { kind: 'save', key: 'dex' }
    expect(parse({ ...save, prompt: 'msg1-thorin' }).success).toBe(true)
    expect(parse({ ...save, prompt: 'msg1 thorin' }).success).toBe(false)
    expect(parse({ ...save, prompt: 'msg1-thorin-2' }).success).toBe(false)
    expect(parse({ prompt: 'msg1-thorin' }).success).toBe(false)
    expect(parseAttack({ prompt: 'msg1-thorin' }).success).toBe(false)
  })

  describe('from a link in a description', () => {
    const TEXT = '0f1a2b3c4d5e6f'
    /** Asking the table for the save link 3 of a description calls for. */
    const ask = {
      kind: 'ask',
      text: TEXT,
      link: 3,
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    }
    /** Its damage: 2d6 fire and 1d4 cold, chosen. */
    const textDamage = {
      ...ask,
      kind: 'textDamage',
      link: 4,
      dice: [
        { faces: 6, results: [3, 5] },
        { faces: 4, results: [2] },
      ],
      types: ['fire', 'cold'],
    }
    /** A roll of its own: 1d6 + 2. */
    const textRoll = {
      ...ask,
      kind: 'textRoll',
      link: 5,
      dice: [{ faces: 6, results: [4] }],
    }
    const parseAsk = (fields: object) =>
      rollRequestSchema.safeParse({ ...ask, ...fields })

    it('takes an ask of the table, which throws no dice', () => {
      expect(parseAsk({}).data).toEqual(ask)
      expect(parseAsk({ link: 0 }).success).toBe(true)
      expect(parseAsk({ link: 199 }).success).toBe(true)
    })

    it.each([
      ['without its description', { text: undefined }],
      ['without its link', { link: undefined }],
      ['without its description or link', { text: undefined, link: undefined }],
      ['naming no description', { text: 'Second Wind' }],
      ['naming a description in capitals', { text: TEXT.toUpperCase() }],
      ['naming a link past the last', { link: 200 }],
      ['naming a link before the first', { link: -1 }],
      ['naming part of a link', { link: 1.5 }],
      ['naming a link in words', { link: '3' }],
      ['with a die', { dice: [{ faces: 20, results: [12] }] }],
      ['with advantage', { mode: 1 }],
      ['rolled as the player chose', { explicit: true }],
      ['with something added', { extras: [{ sign: 1, flat: 2 }] }],
      ['naming an ability', { key: 'dex' }],
      ['answering what the game asked', { prompt: 'msg1-thorin' }],
      ['naming an item', { item: 'staff', activity: 'cast' }],
      ['with kinds of damage', { types: ['fire'] }],
      ['following an attack', { use: 'req-1' }],
      ['naming a DC', { dc: 15 }],
    ])('refuses an ask %s', (_name, fields) => {
      expect(parseAsk(fields).success).toBe(false)
    })

    it("takes a description's damage and roll with the dice their formulas throw", () => {
      expect(rollRequestSchema.safeParse(textDamage).data).toEqual(textDamage)
      expect(
        rollRequestSchema.safeParse({ ...textDamage, types: [null, 'cold'] })
          .success,
      ).toBe(true)
      expect(
        rollRequestSchema.safeParse({ ...textDamage, types: undefined })
          .success,
      ).toBe(true)
      expect(rollRequestSchema.safeParse(textRoll).data).toEqual(textRoll)
      // A formula of numbers alone throws none.
      expect(
        rollRequestSchema.safeParse({ ...textRoll, dice: [] }).success,
      ).toBe(true)
    })

    it.each([
      ['without its description', { text: undefined }],
      ['without its link', { link: undefined }],
      ['without its description or link', { text: undefined, link: undefined }],
      ['with advantage', { mode: -1 }],
      ['rolled as the player chose', { explicit: true }],
      ['with something added', { extras: [{ sign: 1, count: 1, sides: 4 }] }],
      [
        'with a die that does not exist',
        { dice: [{ faces: 7, results: [3] }] },
      ],
      ['with a result past the die', { dice: [{ faces: 6, results: [7] }] }],
      ['with a die thrown for nothing', { dice: [{ faces: 6, results: [] }] }],
      ['changed as damage may be', { modifiers: { extra: 1 } }],
      ['with a kind of damage that is not one', { types: ['fire damage'] }],
      ['following an attack', { use: 'req-1' }],
      ['naming an ability', { key: 'dex' }],
      ['at a target', { target: null }],
      ['answering what the game asked', { prompt: 'msg1-thorin' }],
      ['naming an item', { item: 'staff', activity: 'cast' }],
    ])("refuses a description's damage or roll %s", (_name, fields) => {
      expect(
        rollRequestSchema.safeParse({ ...textDamage, ...fields }).success,
      ).toBe(false)
      expect(
        rollRequestSchema.safeParse({ ...textRoll, ...fields }).success,
      ).toBe(false)
    })

    it("gives kinds of damage to a description's damage, and not to its roll", () => {
      expect(
        rollRequestSchema.safeParse({ ...textRoll, types: ['fire'] }).success,
      ).toBe(false)
    })

    it("takes a player's own saving throw a description calls for, but not one answering the game too", () => {
      const save = { kind: 'save', key: 'dex', text: TEXT, link: 3 }

      expect(parse(save).success).toBe(true)
      expect(parse({ ...save, link: undefined }).success).toBe(false)
      expect(parse({ ...save, text: undefined }).success).toBe(false)
      expect(parse({ ...save, prompt: 'msg1-thorin' }).success).toBe(false)
    })

    it('names a link for nothing else', () => {
      expect(parse({ text: TEXT, link: 3 }).success).toBe(false)
      expect(
        parse({ kind: 'ability', key: 'dex', text: TEXT, link: 3 }).success,
      ).toBe(false)
      expect(parseDamage({ text: TEXT, link: 3 }).success).toBe(false)
      expect(parseUse({ text: TEXT, link: 3 }).success).toBe(false)
      expect(parseAttack({ link: 3 }).success).toBe(false)
    })
  })

  it("reads the module's fetch, for one of its campaigns", () => {
    const poll = {
      protocol: 2,
      session: 'NXUK8r',
      campaign: { id: 'camp-a', title: 'Ashlands' },
    }
    expect(commandsPollSchema.safeParse(poll).success).toBe(true)
    expect(commandsPollSchema.safeParse({ ...poll, protocol: 1 }).success).toBe(
      false,
    )
    expect(
      commandsPollSchema.safeParse({ ...poll, campaign: undefined }).success,
    ).toBe(false)
  })
})
