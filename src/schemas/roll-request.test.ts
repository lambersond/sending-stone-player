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

/** Two d10 hit dice and a d8 spent at once, landing on 7 and 3, and 4. */
const hitDice = {
  kind: 'hitDice',
  hitDice: [
    { denomination: 'd10', count: 2 },
    { denomination: 'd8', count: 1 },
  ],
  mode: 0,
  explicit: false,
  extras: [],
  dice: [
    { faces: 10, results: [7, 3] },
    { faces: 8, results: [4] },
  ],
}

const parseHitDice = (fields: object) =>
  rollRequestSchema.safeParse({ ...hitDice, ...fields })

/** Hit dice of these sizes spent at once, this many of each, each die landing on 1. */
const spentAtOnce = (counts: [number, number][]) => ({
  hitDice: counts.map(([faces, count]) => ({
    denomination: `d${faces}`,
    count,
  })),
  dice: counts.map(([faces, count]) => ({
    faces,
    results: Array.from({ length: count }, () => 1),
  })),
})

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
    // From module 0.21.0, a skill check an activity asks for names both.
    ['an item for a skill, without its activity', { item: 'longsword' }],
    ['a target for a skill', { target: null }],
    ['an attack for a skill', { use: 'req-1' }],
    ['a formula', { formula: '1d20 + 99' }],
  ])('refuses %s', (_name, fields) => {
    expect(parse(fields).success).toBe(false)
  })

  it('takes what the page that sent it calls it, 1 to 120 characters, shown only as text (#156)', () => {
    for (const label of [
      'Perception check',
      'x',
      'x'.repeat(120),
      '<b>Hi</b>',
    ]) {
      expect(parse({ label })).toMatchObject({
        success: true,
        data: { label },
      })
    }
    for (const label of ['', 'x'.repeat(121), 7, null, ['Perception']]) {
      expect(parse({ label }).success).toBe(false)
    }
    expect(parse({}).data).not.toHaveProperty('label')
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
    ['as a critical hit’s', { critical: true }],
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

  it('takes hit dice spent at once, of one size or several, with a roll of each size in the same order', () => {
    expect(parseHitDice({}).success).toBe(true)
    expect(parseHitDice({}).data).toEqual(hitDice)
    expect(parseHitDice(spentAtOnce([[6, 2]])).success).toBe(true)
    // Every size there is, in any order, as many as the most at once.
    expect(
      parseHitDice(
        spentAtOnce([
          [4, 1],
          [12, 4],
          [8, 5],
          [6, 5],
          [10, 5],
        ]),
      ).success,
    ).toBe(true)
    expect(parseHitDice(spentAtOnce([[10, 20]])).success).toBe(true)
  })

  it.each([
    ['without how many of each size', { hitDice: undefined }],
    ['of no size', spentAtOnce([])],
    [
      'of a size no class has',
      spentAtOnce([
        [20, 1],
        [10, 1],
      ]),
    ],
    [
      'of a size written otherwise',
      {
        hitDice: [
          { denomination: 'D10', count: 2 },
          { denomination: 'd8', count: 1 },
        ],
      },
    ],
    [
      'with none of a size',
      {
        hitDice: [
          { denomination: 'd10', count: 0 },
          { denomination: 'd8', count: 1 },
        ],
        dice: [
          { faces: 10, results: [] },
          { faces: 8, results: [4] },
        ],
      },
    ],
    [
      'with part of a die',
      {
        hitDice: [
          { denomination: 'd10', count: 1.5 },
          { denomination: 'd8', count: 1 },
        ],
      },
    ],
    [
      'of one size twice',
      spentAtOnce([
        [10, 1],
        [10, 1],
      ]),
    ],
    [
      'of more than 20 in all',
      spentAtOnce([
        [10, 15],
        [8, 6],
      ]),
    ],
    ['of more than 20 of one size', spentAtOnce([[10, 21]])],
    [
      'with more to them',
      {
        hitDice: [
          { denomination: 'd10', count: 2, class: 'fighter' },
          { denomination: 'd8', count: 1 },
        ],
      },
    ],
    ['with no dice', { dice: [] }],
    [
      'with the rolls of its sizes the other way round',
      { dice: [...hitDice.dice].toReversed() },
    ],
    [
      'with a die of another size',
      {
        dice: [
          { faces: 10, results: [7, 3] },
          { faces: 6, results: [4] },
        ],
      },
    ],
    [
      'with too few dice of a size',
      {
        dice: [
          { faces: 10, results: [7] },
          { faces: 8, results: [4] },
        ],
      },
    ],
    [
      'with too many dice of a size',
      {
        dice: [
          { faces: 10, results: [7, 3] },
          { faces: 8, results: [4, 1] },
        ],
      },
    ],
    [
      'with a roll of a size more',
      {
        dice: [...hitDice.dice, { faces: 6, results: [1] }],
      },
    ],
    [
      'with a result past the die',
      {
        dice: [
          { faces: 10, results: [7, 11] },
          { faces: 8, results: [4] },
        ],
      },
    ],
    [
      'with a result of none',
      {
        dice: [
          { faces: 10, results: [7, 0] },
          { faces: 8, results: [4] },
        ],
      },
    ],
    ['with advantage', { mode: 1 }],
    ['rolled as the player chose', { explicit: true }],
    ['with something added', { extras: [{ sign: 1, flat: 2 }] }],
    ['with a size of its own', { denomination: 'd10' }],
    ['naming a key', { key: 'con' }],
    ['naming an item', { item: 'lantern', activity: 'shine' }],
    ['at a target', { target: null }],
    ['with a spell slot', { slot: 'spell1' }],
    ['answering what the game asked', { prompt: 'msg1-thorin' }],
    ['from a link in a description', { text: '0f1a2b3c4d5e6f', link: 0 }],
    ["as a critical hit's", { critical: true }],
  ])('refuses hit dice spent at once %s', (_name, fields) => {
    expect(parseHitDice(fields).success).toBe(false)
  })

  it('says how many of each size only of hit dice spent at once', () => {
    const { hitDice: counts } = hitDice
    expect(parseHitDie({ hitDice: counts }).success).toBe(false)
    expect(parse({ hitDice: counts }).success).toBe(false)
    expect(parseFormula({ hitDice: counts }).success).toBe(false)
    expect(parseDamage({ hitDice: counts }).success).toBe(false)
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
    ['as a critical hit’s', { critical: true }],
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
    // Its attack said whether it was a critical hit.
    ['as a critical hit’s', { critical: true }],
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

  it('takes a saving throw answering what the game asked, or an ability or skill check answering what Midi-QOL asked, and only those', () => {
    const save = { kind: 'save', key: 'dex' }
    expect(parse({ ...save, prompt: 'msg1-thorin' }).success).toBe(true)
    expect(parse({ ...save, prompt: 'msg1 thorin' }).success).toBe(false)
    expect(parse({ ...save, prompt: 'msg1-thorin-2' }).success).toBe(false)
    // From module 0.27.0: an ability or skill check Midi-QOL asks for, such as Athletics to escape.
    expect(parse({ prompt: 'k3y-thorin' }).success).toBe(true)
    expect(
      parse({ kind: 'ability', key: 'str', prompt: 'k3y-thorin' }).success,
    ).toBe(true)
    expect(
      parse({ kind: 'tool', key: 'thief', prompt: 'k3y-thorin' }).success,
    ).toBe(false)
    expect(parseAttack({ prompt: 'msg1-thorin' }).success).toBe(false)
    expect(
      parse({ kind: 'death', key: undefined, prompt: 'k3y-thorin' }).success,
    ).toBe(false)
    // Never also a check an activity asks for, nor what a description calls for.
    expect(
      parse({ item: 'web', activity: 'escape', prompt: 'k3y-thorin' }).success,
    ).toBe(false)
    expect(
      parse({ text: '0f1a2b3c4d5e6f', link: 1, prompt: 'k3y-thorin' }).success,
    ).toBe(false)
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
      ['changed as damage may be', { modifiers: { extra: 1 } }],
      ['as a critical hit’s', { critical: true }],
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

    it("takes a description's damage changed, as an attack's may be, or as a critical hit's, from module 0.19.0", () => {
      for (const fields of [
        { modifiers: { extra: 1 } },
        { modifiers: { extra: 2, faces: 8, maximize: true } },
        { critical: true },
        { critical: true, modifiers: { extra: 1, faces: 10 } },
      ]) {
        expect(
          rollRequestSchema.safeParse({ ...textDamage, ...fields }).data,
        ).toEqual({ ...textDamage, ...fields })
      }
    })

    it.each([
      ['changed so that it can’t be', { modifiers: { faces: 7 } }],
      ['with more dice than a roll may throw', { modifiers: { extra: 41 } }],
      ['changed in some other way', { modifiers: { minimize: true } }],
      ['as anything but a critical hit’s', { critical: false }],
      ['as a critical hit’s in words', { critical: 'true' }],
    ])("refuses a description's damage %s", (_name, fields) => {
      expect(
        rollRequestSchema.safeParse({ ...textDamage, ...fields }).success,
      ).toBe(false)
    })

    it.each([
      ['changed as damage may be', { modifiers: { extra: 1 } }],
      ['as a critical hit’s', { critical: true }],
    ])("refuses a description's own roll %s", (_name, fields) => {
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

    it.each([
      ['a skill check', { kind: 'skill', key: 'ath' }],
      ['a tool check', { kind: 'tool', key: 'thief' }],
      ['an ability check', { kind: 'ability', key: 'int' }],
    ])(
      "takes a player's own %s a description calls for, with the dice a check throws",
      (_name, fields) => {
        const check = { ...fields, text: TEXT, link: 3 }

        expect(parse(check).data).toEqual({ ...perception, ...check })
        expect(
          parse({
            ...check,
            mode: 1,
            explicit: true,
            dice: [{ faces: 20, results: [14, 3] }],
          }).success,
        ).toBe(true)
        expect(parse({ ...check, link: undefined }).success).toBe(false)
        expect(parse({ ...check, text: undefined }).success).toBe(false)
        expect(parse({ ...check, key: undefined }).success).toBe(false)
        // Only a saving throw answers what the game asks.
        expect(parse({ ...check, prompt: 'msg1-thorin' }).success).toBe(false)
        // Its d20 is thrown, as any check's.
        expect(parse({ ...check, dice: [] }).success).toBe(false)
      },
    )

    it('names a link for nothing else', () => {
      const death = { kind: 'death', key: undefined }
      const initiative = {
        kind: 'initiative',
        key: undefined,
        combatId: 'combat1',
      }
      expect(parse(death).success).toBe(true)
      expect(parse({ ...death, text: TEXT, link: 3 }).success).toBe(false)
      expect(parse(initiative).success).toBe(true)
      expect(parse({ ...initiative, text: TEXT, link: 3 }).success).toBe(false)
      expect(parseDamage({ text: TEXT, link: 3 }).success).toBe(false)
      expect(parseUse({ text: TEXT, link: 3 }).success).toBe(false)
      expect(parseAttack({ link: 3 }).success).toBe(false)
    })
  })

  describe('a check an activity asks for, from module 0.21.0', () => {
    const TEXT = '0f1a2b3c4d5e6f'
    /** The activity: Fast Hands' Sleight of Hand. */
    const named = { item: 'fastHands', activity: 'slt1' }

    it.each([
      ['a skill check', { kind: 'skill', key: 'slt' }],
      ['a tool check', { kind: 'tool', key: 'thief' }],
      ['an ability check', { kind: 'ability', key: 'str' }],
    ])(
      "takes the player's own %s, by its item and activity, with the dice a check throws",
      (_name, fields) => {
        const check = { ...fields, ...named }

        expect(parse(check).data).toEqual({ ...perception, ...check })
        expect(
          parse({
            ...check,
            mode: -1,
            explicit: true,
            extras: [{ sign: 1, count: 1, sides: 4 }],
            dice: [
              { faces: 20, results: [14, 3] },
              { faces: 4, results: [2] },
            ],
          }).success,
        ).toBe(true)
        // Its d20 is thrown, as any check's.
        expect(parse({ ...check, dice: [] }).success).toBe(false)
        expect(parse({ ...check, key: undefined }).success).toBe(false)
      },
    )

    it.each([
      ['its item alone', { item: 'fastHands' }],
      ['its activity alone', { activity: 'slt1' }],
      ['an item that is not an id', { ...named, item: 'Fast Hands' }],
      ['a description’s link too', { ...named, text: TEXT, link: 3 }],
      ['a description too', { ...named, text: TEXT }],
      ['a link too', { ...named, link: 3 }],
      ['answering what the game asked', { ...named, prompt: 'msg1-thorin' }],
    ])('refuses a check named by %s', (_name, fields) => {
      for (const kind of [
        { kind: 'skill', key: 'slt' },
        { kind: 'tool', key: 'thief' },
        { kind: 'ability', key: 'dex' },
      ]) {
        expect(parse({ ...kind, ...fields }).success).toBe(false)
      }
    })

    it('refuses a DC sent with it, as one it doesn’t know of: the game reads the DC from the activity', () => {
      const result = parse({ kind: 'skill', key: 'slt', ...named, dc: 15 })

      expect(result.success).toBe(false)
      expect(result.error?.issues).toEqual([
        expect.objectContaining({ code: 'unrecognized_keys', keys: ['dc'] }),
      ])
    })

    it.each([
      ['a saving throw', { kind: 'save', key: 'dex' }],
      ['a death save', { kind: 'death', key: undefined }],
      [
        'initiative',
        { kind: 'initiative', key: undefined, combatId: 'combat1' },
      ],
      [
        'a hit die',
        {
          kind: 'hitDie',
          key: undefined,
          denomination: 'd8',
          dice: [{ faces: 8, results: [5] }],
        },
      ],
      [
        'an ask',
        { kind: 'ask', key: undefined, text: TEXT, link: 3, dice: [] },
      ],
      [
        'a description’s roll',
        {
          kind: 'textRoll',
          key: undefined,
          text: TEXT,
          link: 3,
          dice: [{ faces: 6, results: [4] }],
        },
      ],
    ])('names no item for %s', (_name, fields) => {
      expect(parse(fields).success).toBe(true)
      expect(parse({ ...fields, ...named }).success).toBe(false)
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

/** Magic Weapon cast with a 4th-level slot, its +2 put on a longsword. */
const enchanting = {
  kind: 'use',
  item: 'magicweapon',
  activity: 'mwcast',
  targets: [],
  slot: 'spell4',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  enchant: { profile: '8OhsRxK3dF1JeQXO', item: 'longsword' },
}

/** A Flame Tongue's Ablaze put out. */
const ending = {
  kind: 'endEnchantment',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  enchantment: { item: 'flametongue', effect: 'ablazeEffect001' },
}

const parseEnchanting = (fields: object) =>
  rollRequestSchema.safeParse({ ...enchanting, ...fields })

const parseEnding = (fields: object) =>
  rollRequestSchema.safeParse({ ...ending, ...fields })

describe('enchant activities, from module 0.21.0', () => {
  it('takes a use saying how it enchants, and the item, or none', () => {
    expect(parseEnchanting({}).success).toBe(true)
    expect(
      parseEnchanting({ enchant: { profile: '8OhsRxK3dF1JeQXO' } }).success,
    ).toBe(true)
    // An enchant activity's use may say nothing of it, as dnd5e then chooses.
    expect(parseEnchanting({ enchant: undefined }).success).toBe(true)
  })

  it.each([
    ['a way that isn’t an id', { profile: 'Magic Weapon, +2' }],
    [
      'an item that isn’t an id',
      { profile: '8OhsRxK3dF1JeQXO', item: 'long sword' },
    ],
    ['no way', { item: 'longsword' }],
    ['anything else', { profile: '8OhsRxK3dF1JeQXO', level: 4 }],
  ])('refuses a use enchanting with %s', (_name, enchant) => {
    expect(parseEnchanting({ enchant }).success).toBe(false)
  })

  it('takes how it enchants only on a use', () => {
    const enchant = enchanting.enchant
    expect(parseAttack({ enchant }).success).toBe(false)
    expect(
      rollRequestSchema.safeParse({
        kind: 'formula',
        item: 'torch',
        activity: 'light',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 4, results: [3] }],
        enchant,
      }).success,
    ).toBe(false)
    expect(parse({ enchant }).success).toBe(false)
    expect(parseEnding({ enchant }).success).toBe(false)
  })

  it('takes an enchantment ended, naming its item and effect', () => {
    expect(parseEnding({}).success).toBe(true)
    expect(parseEnding({ enchantment: undefined }).success).toBe(false)
    expect(parseEnding({ enchantment: { item: 'flametongue' } }).success).toBe(
      false,
    )
    expect(
      parseEnding({
        enchantment: { item: 'flametongue', effect: 'ablaze!' },
      }).success,
    ).toBe(false)
    expect(
      parseEnding({
        enchantment: { ...ending.enchantment, profile: 'ablazeProfile01' },
      }).success,
    ).toBe(false)
  })

  it.each([
    ['an item', { item: 'flametongue' }],
    ['an activity', { activity: 'engulf' }],
    ['an item and activity', { item: 'flametongue', activity: 'engulf' }],
    ['targets', { targets: [] }],
    ['a slot', { slot: 'spell2' }],
    ['a target', { target: null }],
    ['a key', { key: 'prc' }],
    ['an attack or use it follows', { use: 'req-1' }],
    ['a link', { text: 'a3b4c5d6e7f809', link: 0 }],
  ])('refuses an enchantment ended with %s', (_name, fields) => {
    expect(parseEnding(fields).success).toBe(false)
  })

  it.each([
    ['advantage', { mode: 1 }],
    ['how it was rolled chosen', { explicit: true }],
    ['a term added', { extras: [{ sign: 1, flat: 2 }] }],
    ['a die', { dice: [{ faces: 20, results: [14] }] }],
  ])(
    'refuses an enchantment ended with %s, as it throws no dice',
    (_name, fields) => {
      expect(parseEnding(fields).success).toBe(false)
    },
  )

  it('names the enchantment ended only when it ends one, a use too, whose checks end early', () => {
    expect(parseEnchanting({ enchantment: ending.enchantment }).success).toBe(
      false,
    )
    expect(parse({ enchantment: ending.enchantment }).success).toBe(false)
    expect(
      rollRequestSchema.safeParse({
        kind: 'ask',
        text: 'a3b4c5d6e7f809',
        link: 0,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
        enchant: enchanting.enchant,
      }).success,
    ).toBe(false)
    // A use still throws no dice.
    expect(
      parseEnchanting({ dice: [{ faces: 20, results: [14] }] }).success,
    ).toBe(false)
  })
})

describe('a use at its user, from module 0.22.0', () => {
  it('takes a use at its user, besides its targets, or none', () => {
    expect(parseUse({ self: true }).success).toBe(true)
    expect(parseUse({ self: true, targets: [] }).success).toBe(true)
    expect(parseUse({}).success).toBe(true)
  })

  it.each([
    ['false', false],
    ['null', null],
    ['a word', 'yes'],
    ['a number', 1],
  ])('refuses a use at its user said as %s', (_name, self) => {
    expect(parseUse({ self }).success).toBe(false)
  })

  it('refuses anything else at its user, an attack above all', () => {
    expect(parseAttack({ self: true }).success).toBe(false)
    expect(parse({ self: true }).success).toBe(false)
    expect(rollRequestSchema.safeParse({ ...damage, self: true }).success).toBe(
      false,
    )
  })
})

/** A concentration on Bless ended. */
const endingConcentration = {
  kind: 'endConcentration',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  concentration: { effect: 'concBless0001' },
}

/** Two Sorcery Points spent. */
const spending = {
  kind: 'spend',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  counter: { item: 'sorcery' },
  count: 2,
}

/** Heroic Inspiration used. */
const inspiring = {
  kind: 'inspiration',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  inspiration: 'use',
}

const parseKind = (base: object, fields: object) =>
  rollRequestSchema.safeParse({ ...base, ...fields })

/** What the schema says is wrong with a request, by its path. */
const issuesOf = (base: object, fields: object) => {
  const parsed = parseKind(base, fields)
  return parsed.success
    ? []
    : parsed.error.issues.map(({ path, message }) => [path.join('.'), message])
}

describe('concentration, charges and Heroic Inspiration, from module 0.29.0', () => {
  it('takes each as the module does', () => {
    expect(parseKind(endingConcentration, {}).success).toBe(true)
    expect(parseKind(spending, {}).success).toBe(true)
    expect(parseKind(spending, { count: 1 }).success).toBe(true)
    expect(parseKind(spending, { count: 999 }).success).toBe(true)
    expect(
      parseKind(spending, { counter: { item: 'staff', activity: 'cast01' } })
        .success,
    ).toBe(true)
    expect(
      parseKind(spending, { counter: { resource: 'tertiary' } }).success,
    ).toBe(true)
    expect(parseKind(inspiring, {}).success).toBe(true)
    expect(parseKind(inspiring, { inspiration: 'gain' }).success).toBe(true)
  })

  it.each([
    ['no concentration', endingConcentration, { concentration: undefined }],
    [
      'an effect not an id',
      endingConcentration,
      { concentration: { effect: 'conc bless' } },
    ],
    [
      'anything else of the concentration',
      endingConcentration,
      { concentration: { effect: 'concBless0001', item: 'bless' } },
    ],
    ['no counter', spending, { counter: undefined }],
    ['no count', spending, { count: undefined }],
    ['a count of 0', spending, { count: 0 }],
    ['a count over 999', spending, { count: 1000 }],
    ['a count of a part', spending, { count: 1.5 }],
    ['a counter not an id', spending, { counter: { item: 'sorcery points' } }],
    [
      'a resource of no such name',
      spending,
      { counter: { resource: 'fourth' } },
    ],
    [
      'a counter of an item and a resource',
      spending,
      { counter: { item: 'sorcery', resource: 'primary' } },
    ],
    [
      'a counter of anything else',
      spending,
      { counter: { item: 'sorcery', uses: 2 } },
    ],
    ['nothing to say', inspiring, { inspiration: undefined }],
    ['a word of its own', inspiring, { inspiration: 'spend' }],
    ['true', inspiring, { inspiration: true }],
  ])('refuses %s', (_name, base, fields) => {
    expect(parseKind(base, fields).success).toBe(false)
  })

  it('takes each field only with its kind, and a count only with charges spent', () => {
    const { concentration } = endingConcentration
    const { counter, count } = spending
    expect(parse({ concentration }).success).toBe(false)
    expect(parse({ counter, count }).success).toBe(false)
    expect(parse({ count }).success).toBe(false)
    expect(parse({ inspiration: 'use' }).success).toBe(false)
    expect(parseKind(ending, { concentration }).success).toBe(false)
    expect(parseKind(spending, { concentration }).success).toBe(false)
    expect(parseKind(spending, { inspiration: 'use' }).success).toBe(false)
    expect(parseKind(inspiring, { counter, count }).success).toBe(false)
    expect(parseKind(endingConcentration, { counter, count }).success).toBe(
      false,
    )
    expect(parseKind(endingConcentration, { count }).success).toBe(false)
    expect(issuesOf(perception, { count })).toEqual([
      ['count', 'Charges spent, and only those, say how many'],
    ])
  })

  it.each([
    ['an item', { item: 'sorcery' }],
    ['an activity', { activity: 'spUtility' }],
    ['an item and activity', { item: 'sorcery', activity: 'spUtility' }],
    ['targets', { targets: [] }],
    ['a target', { target: null }],
    ['at its user', { self: true }],
    ['a slot', { slot: 'spell2' }],
    ['how it enchants', { enchant: { profile: '8OhsRxK3dF1JeQXO' } }],
    ['a prompt', { prompt: 'card1-actor1' }],
    ['a link', { text: 'a3b4c5d6e7f809', link: 0 }],
    ['a key', { key: 'prc' }],
  ])('refuses any of them with %s', (_name, fields) => {
    for (const base of [endingConcentration, spending, inspiring]) {
      expect(parseKind(base, fields).success).toBe(false)
    }
  })

  it.each([
    ['advantage', { mode: 1 }],
    ['how it was rolled chosen', { explicit: true }],
    ['a term added', { extras: [{ sign: 1, flat: 2 }] }],
    ['a die', { dice: [{ faces: 20, results: [14] }] }],
  ])('refuses any of them with %s, as none throws dice', (_name, fields) => {
    expect(issuesOf(endingConcentration, fields)).toEqual([
      ['dice', 'Ending concentration throws no dice'],
    ])
    expect(issuesOf(spending, fields)).toEqual([
      ['dice', 'Spending throws no dice'],
    ])
    expect(issuesOf(inspiring, fields)).toEqual([
      ['dice', 'Heroic Inspiration throws no dice'],
    ])
  })
})

/** Two Potions of Healing taken from the party, as a take sends them. */
const moving = {
  kind: 'transfer',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  transfer: {
    from: 'groupIronCo01',
    to: 'actorThorin1',
    items: [{ id: 'potionHeal01', quantity: 2 }],
  },
}

/** A move's own fields, the rest as `moving` has them. */
const moves = (transfer: object) =>
  parseKind(moving, { transfer: { ...moving.transfer, ...transfer } })

describe('moves of items and coins, from module 0.31.0', () => {
  it('takes a take, a give, a send, and items and coins together', () => {
    expect(parseKind(moving, {}).success).toBe(true)
    // A give of coins to the party.
    expect(
      parseKind(moving, {
        transfer: {
          from: 'actorThorin1',
          to: 'groupIronCo01',
          currency: { gp: 50 },
        },
      }).success,
    ).toBe(true)
    // A send to another character, of a Rope and 50 gp.
    expect(
      parseKind(moving, {
        transfer: {
          from: 'actorThorin1',
          to: 'actorVex0001',
          items: [{ id: 'rope00000001', quantity: 1 }],
          currency: { gp: 50, sp: 5 },
        },
      }).success,
    ).toBe(true)
    expect(
      moves({ items: [{ id: 'gem', quantity: 10_000_000 }] }).success,
    ).toBe(true)
    expect(
      moves({
        items: Array.from({ length: 10 }, (_, index) => ({
          id: `item${index}`,
          quantity: 1,
        })),
      }).success,
    ).toBe(true)
  })

  it.each([
    ['no move', { transfer: undefined }],
    [
      'anything else of it',
      { transfer: { ...moving.transfer, label: 'Take' } },
    ],
  ])('refuses %s', (_name, fields) => {
    expect(parseKind(moving, fields).success).toBe(false)
  })

  it('refuses an item named in place of the items', () => {
    const { from, to } = moving.transfer
    expect(
      parseKind(moving, {
        transfer: { from, to, item: { id: 'potionHeal01', quantity: 2 } },
      }).success,
    ).toBe(false)
  })

  it.each([
    [
      'from one end to the same',
      { to: 'groupIronCo01' },
      ['transfer.to', 'A move goes from one end to another'],
    ],
    [
      'more than ten items',
      {
        items: Array.from({ length: 11 }, (_, index) => ({
          id: `item${index}`,
          quantity: 1,
        })),
      },
      ['transfer.items'],
    ],
    [
      'an item twice',
      {
        items: [
          { id: 'potionHeal01', quantity: 1 },
          { id: 'potionHeal01', quantity: 1 },
        ],
      },
      ['transfer.items', 'Each item is moved once'],
    ],
    [
      'none of an item',
      { items: [{ id: 'potionHeal01', quantity: 0 }] },
      ['transfer.items.0.quantity'],
    ],
    [
      'more than the most',
      { items: [{ id: 'potionHeal01', quantity: 10_000_001 }] },
      ['transfer.items.0.quantity'],
    ],
    [
      'a part of one',
      { items: [{ id: 'potionHeal01', quantity: 1.5 }] },
      ['transfer.items.0.quantity'],
    ],
    ['no items in its list', { items: [] }, ['transfer.items']],
    [
      'an id not an id',
      { items: [{ id: 'potion heal', quantity: 1 }] },
      ['transfer.items.0.id'],
    ],
    ['an end not an id', { from: 'the party' }, ['transfer.from']],
    [
      'a coin of 0',
      { items: undefined, currency: { gp: 0 } },
      ['transfer.currency.gp'],
    ],
    [
      'a coin not a key',
      { items: undefined, currency: { GP: 5 } },
      ['transfer.currency.GP'],
    ],
    [
      'a key too long',
      { items: undefined, currency: { platinumpc: 5 } },
      ['transfer.currency.platinumpc'],
    ],
    [
      'eleven kinds of coin',
      {
        items: undefined,
        currency: Object.fromEntries(
          Array.from({ length: 11 }, (_, index) => [`c${index}`, 1]),
        ),
      },
      ['transfer.currency', 'From one to ten kinds of coin'],
    ],
    [
      'no kind of coin',
      { items: undefined, currency: {} },
      ['transfer.currency', 'From one to ten kinds of coin'],
    ],
    [
      'neither items nor coins',
      { items: undefined },
      ['transfer.items', 'A move moves an item or coins'],
    ],
  ])('refuses %s', (_name, fields, [path, message]) => {
    const parsed = moves(fields)
    expect(parsed.success).toBe(false)
    const issues = parsed.error!.issues.map(issue => [
      issue.path.join('.'),
      issue.message,
    ])
    expect(issues).toContainEqual(
      message === undefined ? [path, expect.any(String)] : [path, message],
    )
  })

  it('takes a move only as a transfer, and a transfer only with one', () => {
    expect(parse({ transfer: moving.transfer }).success).toBe(false)
    expect(parseKind(spending, { transfer: moving.transfer }).success).toBe(
      false,
    )
    expect(issuesOf(perception, { transfer: moving.transfer })).toEqual([
      ['transfer', 'A move, and only that, names what moves'],
    ])
    expect(issuesOf(moving, { transfer: undefined })).toEqual([
      ['transfer', 'A move, and only that, names what moves'],
    ])
  })

  it.each([
    ['an item', { item: 'potionHeal01' }],
    ['targets', { targets: [] }],
    ['a counter', { counter: { item: 'sorcery' } }],
    ['a key', { key: 'prc' }],
    ['a prompt', { prompt: 'card1-actor1' }],
    ['a link', { text: 'a3b4c5d6e7f809', link: 0 }],
    ['a slot', { slot: 'spell2' }],
  ])('refuses a move with %s, a roll’s field', (_name, fields) => {
    expect(parseKind(moving, fields).success).toBe(false)
  })

  it.each([
    ['advantage', { mode: 1 }],
    ['how it was rolled chosen', { explicit: true }],
    ['a term added', { extras: [{ sign: 1, flat: 2 }] }],
    ['a die', { dice: [{ faces: 20, results: [14] }] }],
  ])('refuses a move with %s, as it throws no dice', (_name, fields) => {
    expect(issuesOf(moving, fields)).toEqual([
      ['dice', 'Moving throws no dice'],
    ])
  })

  it("keeps the Gamemaster's label, as for any roll", () => {
    expect(
      parseKind(moving, {
        label: 'Take 2 Potion of Healing from The Iron Company',
      }).success,
    ).toBe(true)
  })
})

describe('dice typed in, and Elven Accuracy, from module 0.32.0', () => {
  const save = {
    kind: 'save',
    key: 'dex',
    mode: 1,
    explicit: true,
    extras: [],
    dice: [{ faces: 20, results: [4, 15] }],
  }

  it.each([
    ['a skill check', perception],
    ['an attack', attack],
    ['damage', damage],
    ['hit dice', hitDice],
  ])('takes %s its player typed in', (_name, base) => {
    const parsed = parseKind(base, { typed: true })
    expect(parsed.success).toBe(true)
    expect(parsed.data).toMatchObject({ typed: true })
  })

  it.each([false, 'yes', 1, null])('refuses typed: %p', typed => {
    expect(parseKind(perception, { typed }).success).toBe(false)
  })

  it('takes three d20s for an attack with advantage, for Elven Accuracy, and two still', () => {
    for (const results of [
      [3, 18, 7],
      [3, 18],
    ]) {
      expect(
        parseKind(attack, { mode: 1, dice: [{ faces: 20, results }] }).success,
      ).toBe(true)
    }
  })

  it.each([
    ['an attack rolled normally', attack, 0],
    ['an attack with disadvantage', attack, -1],
    ['a save with advantage', save, 1],
  ])('refuses three d20s for %s', (_name, base, mode) => {
    expect(
      issuesOf(base, { mode, dice: [{ faces: 20, results: [3, 18, 7] }] }),
    ).toEqual([['dice', 'The dice are not those the roll throws']])
  })

  it('refuses four d20s for an attack with advantage', () => {
    expect(
      issuesOf(attack, {
        mode: 1,
        dice: [{ faces: 20, results: [3, 18, 7, 9] }],
      }),
    ).toEqual([['dice', 'The dice are not those the roll throws']])
  })

  it('still counts the dice the player added after three d20s', () => {
    const extras = [{ sign: 1, count: 1, sides: 4 }]
    expect(
      parseKind(attack, {
        mode: 1,
        extras,
        dice: [
          { faces: 20, results: [3, 18, 7] },
          { faces: 4, results: [2] },
        ],
      }).success,
    ).toBe(true)
    expect(
      parseKind(attack, {
        mode: 1,
        extras,
        dice: [
          { faces: 20, results: [3, 18, 7] },
          { faces: 4, results: [2, 3] },
        ],
      }).success,
    ).toBe(false)
  })
})

describe('a party’s coin distributed, from module 0.32.0', () => {
  /** 103 gp of the party's shared among its four characters. */
  const distributing = {
    ...moving,
    transfer: {
      from: 'groupIronCo01',
      among: ['actorBram001', 'actorLia0001', 'actorThorin1', 'actorVex0001'],
      currency: { gp: 103 },
    },
  }
  const shares = (transfer: object) =>
    parseKind(distributing, {
      transfer: { ...distributing.transfer, ...transfer },
    })

  it('takes a distribution, and a party’s send to anyone', () => {
    expect(parseKind(distributing, {}).success).toBe(true)
    expect(shares({ among: ['actorVex0001'] }).success).toBe(true)
    expect(
      shares({
        among: Array.from({ length: 20 }, (_, index) => `actor${index}`),
      }).success,
    ).toBe(true)
    // A party's things sent to another party, as an Owner of both sends them.
    expect(
      parseKind(moving, {
        transfer: {
          from: 'groupIronCo01',
          to: 'groupWarden1',
          items: [{ id: 'rope00000001', quantity: 1 }],
        },
      }).success,
    ).toBe(true)
  })

  it.each([
    [
      'both an end and those it’s shared among',
      { to: 'actorThorin1' },
      ['transfer.to', 'A move goes to one end, or is shared among characters'],
    ],
    [
      'neither',
      { among: undefined },
      ['transfer.to', 'A move goes to one end, or is shared among characters'],
    ],
    ['no one to share among', { among: [] }, ['transfer.among']],
    [
      'more than twenty to share among',
      { among: Array.from({ length: 21 }, (_, index) => `actor${index}`) },
      ['transfer.among'],
    ],
    [
      'a character given two shares',
      { among: ['actorThorin1', 'actorThorin1'] },
      ['transfer.among', 'Each character is given one share'],
    ],
    [
      'the party sharing with itself',
      { among: ['actorThorin1', 'groupIronCo01'] },
      ['transfer.among', "A party doesn't share with itself"],
    ],
    [
      'items shared',
      { items: [{ id: 'rope00000001', quantity: 1 }] },
      ['transfer.items', 'Only coins are shared'],
    ],
    [
      'two kinds of coin',
      { currency: { gp: 103, sp: 8 } },
      ['transfer.currency', 'One kind of coin is shared at a time'],
    ],
    [
      'no kind of coin',
      { currency: {} },
      ['transfer.currency', 'One kind of coin is shared at a time'],
    ],
    [
      'no coins at all',
      { currency: undefined },
      ['transfer.currency', 'One kind of coin is shared at a time'],
    ],
    ['an id not an id', { among: ['the dwarf'] }, ['transfer.among.0']],
  ])('refuses %s', (_name, fields, [path, message]) => {
    const parsed = shares(fields)
    expect(parsed.success).toBe(false)
    const issues = parsed.error!.issues.map(issue => [
      issue.path.join('.'),
      issue.message,
    ])
    expect(issues).toContainEqual(
      message === undefined ? [path, expect.any(String)] : [path, message],
    )
  })

  it('asks a move with an end for what it moves, and never to the same end, as 0.31.0 does', () => {
    expect(
      issuesOf(moving, {
        transfer: { from: 'groupIronCo01', to: 'actorThorin1' },
      }),
    ).toEqual([['transfer.items', 'A move moves an item or coins']])
    expect(
      issuesOf(moving, {
        transfer: { ...moving.transfer, to: 'groupIronCo01' },
      }),
    ).toEqual([['transfer.to', 'A move goes from one end to another']])
  })
})

/** Two of three Potions of Healing removed from the character, as Remove… sends them. */
const removing = {
  kind: 'remove',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  remove: { item: 'potionHeal01', quantity: 2, held: 3 },
}

/** A removal's own fields, the rest as `removing` has them. */
const removes = (remove: object) =>
  parseKind(removing, { remove: { ...removing.remove, ...remove } })

describe('removals of items, from module 0.33.0', () => {
  it('takes part of a stack, all of it, and none of a stack of none', () => {
    expect(parseKind(removing, {}).success).toBe(true)
    expect(removes({ quantity: 3 }).success).toBe(true)
    expect(removes({ quantity: 0, held: 0 }).success).toBe(true)
    expect(removes({ quantity: 10_000_000, held: 10_000_000 }).success).toBe(
      true,
    )
  })

  it.each([
    ['-1 of it', { quantity: -1 }, 'remove.quantity'],
    ['part of one', { quantity: 1.5 }, 'remove.quantity'],
    ['more than the most', { quantity: 10_000_001 }, 'remove.quantity'],
    ['a count as text', { quantity: '2' }, 'remove.quantity'],
    ['-1 shown', { held: -1 }, 'remove.held'],
    ['part of one shown', { held: 1.5 }, 'remove.held'],
    ['more than the most shown', { held: 10_000_001 }, 'remove.held'],
    ['no count shown', { held: undefined }, 'remove.held'],
    ['no item', { item: undefined }, 'remove.item'],
    ['an id not an id', { item: 'potion heal' }, 'remove.item'],
    ['anything else of it', { label: 'Remove' }, 'remove'],
  ])('refuses %s', (_name, fields, path) => {
    const parsed = removes(fields)
    expect(parsed.success).toBe(false)
    expect(parsed.error!.issues.map(issue => issue.path.join('.'))).toContain(
      path,
    )
  })

  it.each([
    ['more than were shown', { quantity: 3, held: 2 }],
    ['none of a stack of some', { quantity: 0, held: 2 }],
  ])('refuses %s, as the page can’t have asked it', (_name, fields) => {
    expect(
      issuesOf(removing, { remove: { ...removing.remove, ...fields } }),
    ).toEqual([
      [
        'remove.quantity',
        'From 1 to as many as there are, or none of a stack of none',
      ],
    ])
  })

  it('takes a removal only as a remove, and a remove only with one', () => {
    expect(issuesOf(perception, { remove: removing.remove })).toEqual([
      ['remove', 'A removal, and only that, names what it removes'],
    ])
    expect(issuesOf(moving, { remove: removing.remove })).toEqual([
      ['remove', 'A removal, and only that, names what it removes'],
    ])
    expect(issuesOf(removing, { remove: undefined })).toEqual([
      ['remove', 'A removal, and only that, names what it removes'],
    ])
  })

  it('refuses a removal naming a move too', () => {
    expect(issuesOf(removing, { transfer: moving.transfer })).toContainEqual([
      'transfer',
      'A move, and only that, names what moves',
    ])
  })

  it.each([
    ['an item', { item: 'potionHeal01' }],
    ['targets', { targets: [] }],
    ['a key', { key: 'prc' }],
    ['a prompt', { prompt: 'card1-actor1' }],
    ['a slot', { slot: 'spell2' }],
  ])('refuses a removal with %s, a roll’s field', (_name, fields) => {
    expect(parseKind(removing, fields).success).toBe(false)
  })

  it.each([
    ['advantage', { mode: 1 }],
    ['how it was rolled chosen', { explicit: true }],
    ['a term added', { extras: [{ sign: 1, flat: 2 }] }],
    ['a die', { dice: [{ faces: 20, results: [14] }] }],
  ])('refuses a removal with %s, as it throws no dice', (_name, fields) => {
    expect(issuesOf(removing, fields)).toEqual([
      ['dice', 'Removing throws no dice'],
    ])
  })

  it("keeps the Gamemaster's label, as for any roll", () => {
    expect(
      parseKind(removing, { label: 'Remove 2 Potion of Healing' }).success,
    ).toBe(true)
  })
})

describe('schemas/roll-request, damage on its own and recharges, from module 0.36.0', () => {
  /** A Bite's damage on its own, 1d8 + 3 slashing, as the game said it throws. */
  const alone = {
    kind: 'itemDamage',
    item: 'wolfBite',
    activity: 'biteAttack',
    mode: 0,
    explicit: false,
    extras: [],
    dice: [{ faces: 8, results: [5] }],
  }
  /** A Frost Breath's recharge, its one d6. */
  const recharge = {
    kind: 'recharge',
    item: 'frostBreath',
    mode: 0,
    explicit: false,
    extras: [],
    dice: [{ faces: 6, results: [5] }],
  }
  const parseAlone = (fields: object) =>
    rollRequestSchema.safeParse({ ...alone, ...fields })
  const parseRecharge = (fields: object) =>
    rollRequestSchema.safeParse({ ...recharge, ...fields })

  it('takes damage on its own with its item and activity, as a critical hit’s, kinds chosen and changed', () => {
    expect(parseAlone({}).data).toEqual(alone)
    const critical = {
      critical: true,
      dice: [{ faces: 8, results: [5, 2] }],
      types: [null],
      modifiers: { extra: 1, maximize: false },
      typed: true,
    }
    expect(parseAlone(critical).data).toEqual({ ...alone, ...critical })
  })

  it.each([
    ['a use it follows', { use: 'req-1' }],
    ['targets', { targets: [{ combatId: 'cmbt1', combatantId: 'goblin' }] }],
    ['a target', { target: { combatId: 'cmbt1', combatantId: 'goblin' } }],
    // Changed on purpose (round 0.41.0 §8.3): from module 0.41.0, it may name a slot, an attack
    // mode and ammunition; never a slot left to the game.
    ['a slot left to the game', { slot: null }],
    ['a slot no pool is', { slot: 'spell10' }],
    ['an attack mode not one', { attackMode: '!' }],
    ['ammunition not an id', { ammunition: '' }],
    ['a description', { text: '0f1a2b3c4d5e6f', link: 0 }],
    ['its user', { self: true }],
    ['how it enchants', { enchant: { profile: 'plus1' } }],
    ['a key', { key: 'prc' }],
    ['a combat', { combatId: 'cmbt1' }],
    ['what the game asks', { prompt: 'm1-actor' }],
    ['no activity', { activity: undefined }],
    ['no item', { item: undefined }],
    ['no dice', { dice: [] }],
    ['a d20 thrown as advantage', { mode: 1 }],
    ['terms added', { extras: [{ sign: 1, flat: 2 }] }],
  ])('refuses damage on its own with %s', (_, fields) => {
    expect(parseAlone(fields).success).toBe(false)
  })

  it('takes a critical hit’s only for a description’s damage or an action’s on its own', () => {
    expect(parseAlone({ critical: true }).success).toBe(true)
    const damage = {
      kind: 'damage',
      use: 'req-1',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 8, results: [5] }],
    }
    expect(
      rollRequestSchema.safeParse({ ...damage, critical: true }).success,
    ).toBe(false)
    expect(rollRequestSchema.safeParse(damage).success).toBe(true)
  })

  it('takes damage on its own at a slot, in an attack mode, with ammunition, spending what it uses, from module 0.41.0', () => {
    const chosen = {
      slot: 'spell2',
      attackMode: 'twoHanded',
      ammunition: 'arrowsFire',
      consume: true,
    }
    expect(parseAlone(chosen).data).toEqual({ ...alone, ...chosen })
    expect(parseAlone({ slot: 'pact' }).data).toEqual({
      ...alone,
      slot: 'pact',
    })
  })

  it.each([
    ['false', false],
    ['a word', 'yes'],
    ['a number', 1],
  ])('refuses spending what it uses as %s', (_, consume) => {
    expect(issuesOf(alone, { consume })).toEqual([
      ['consume', expect.any(String)],
    ])
  })

  it('spends what it uses only for damage on its own', () => {
    const use = {
      kind: 'use',
      item: 'cure',
      activity: 'mend',
      targets: [],
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    }
    expect(parseKind(use, {}).success).toBe(true)
    expect(issuesOf(use, { consume: true })).toEqual([
      ['consume', 'Only damage on its own spends what it uses'],
    ])
    const attack = {
      kind: 'attack',
      item: 'longbow',
      activity: 'bowAttack',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 20, results: [12] }],
    }
    expect(issuesOf(attack, { consume: true })).toEqual([
      ['consume', 'Only damage on its own spends what it uses'],
    ])
    expect(issuesOf(attack, { slot: null })).toEqual([])
  })

  it('casts at a slot only for an attack, a use or damage on its own, and fires ammunition, in a mode, for an attack or damage on its own', () => {
    const save = {
      kind: 'save',
      key: 'dex',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 20, results: [12] }],
    }
    expect(issuesOf(save, { slot: 'spell2' })).toEqual([
      ['slot', 'Only an attack, a use or damage on its own casts at a slot'],
    ])
    expect(issuesOf(save, { attackMode: 'twoHanded' })).toEqual([
      [
        'attackMode',
        'Only an attack, or damage on its own, is made with ammunition, in a mode',
      ],
    ])
    expect(issuesOf(alone, { slot: null })).toEqual([
      ['slot', 'Only an attack, a use or damage on its own casts at a slot'],
    ])
  })

  it('takes a recharge of an item’s own uses, or one of its activities’, with its one d6', () => {
    expect(parseRecharge({}).data).toEqual(recharge)
    expect(parseRecharge({ activity: 'frostSave' }).data).toEqual({
      ...recharge,
      activity: 'frostSave',
    })
    expect(parseRecharge({ typed: true }).success).toBe(true)
  })

  it.each([
    ['two dice', { dice: [{ faces: 6, results: [5, 6] }] }],
    [
      'two rolls',
      {
        dice: [
          { faces: 6, results: [5] },
          { faces: 6, results: [1] },
        ],
      },
    ],
    ['a d8', { dice: [{ faces: 8, results: [5] }] }],
    ['a result no d6 throws', { dice: [{ faces: 6, results: [7] }] }],
    ['no dice', { dice: [] }],
    ['kinds of damage', { types: ['fire'] }],
    ['changes', { modifiers: { maximize: true } }],
    ['a critical hit', { critical: true }],
    ['a use', { use: 'req-1' }],
    ['a key', { key: 'prc' }],
    ['a combat', { combatId: 'cmbt1' }],
    ['targets', { targets: [{ combatId: 'cmbt1', combatantId: 'goblin' }] }],
    ['a description', { text: '0f1a2b3c4d5e6f', link: 0 }],
    ['a slot', { slot: 'spell1' }],
    ['ammunition', { ammunition: 'arrows' }],
    ['an attack mode', { attackMode: 'thrown' }],
    ['what it spends', { consume: true }],
    ['no item', { item: undefined }],
    ['an activity alone', { item: undefined, activity: 'frostSave' }],
    ['advantage', { mode: 1 }],
    ['the player choosing how', { explicit: true }],
  ])('refuses a recharge with %s', (_, fields) => {
    expect(parseRecharge(fields).success).toBe(false)
  })
})

/** Thorin's turn ended, as the page was shown it. */
const endingTurn = {
  kind: 'endTurn',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  turn: { combatId: 'cmbt1', round: 1, combatantId: 'cThorin' },
}

describe('schemas/roll-request, a turn ended, from module 0.36.0', () => {
  it('takes the turn the page was shown, by its combat, round and combatant, with no dice', () => {
    expect(parseKind(endingTurn, {}).success).toBe(true)
    expect(
      parseKind(endingTurn, {
        turn: { combatId: 'cmbt2', round: 100_000, combatantId: 'cBrakka' },
      }).success,
    ).toBe(true)
  })

  it('names the turn, and only it does', () => {
    // Changed on purpose (round 0.36.0 §12, v6): a turn taken back names it too.
    expect(issuesOf(endingTurn, { turn: undefined })).toEqual([
      ['turn', 'A turn ended or taken back, and only that, names the turn'],
    ])
    const { turn } = endingTurn
    expect(issuesOf(perception, { turn })).toEqual([
      ['turn', 'A turn ended or taken back, and only that, names the turn'],
    ])
    expect(
      parseKind(
        { ...perception, kind: 'initiative', key: undefined },
        { combatId: 'cmbt1', turn },
      ).success,
    ).toBe(false)
  })

  it.each([
    ['round 0', { round: 0 }],
    ['a round of a part', { round: 1.5 }],
    ['a round too far', { round: 100_001 }],
    ['no round', { round: undefined }],
    ['no combatant', { combatantId: undefined }],
    ['no combat', { combatId: undefined }],
    ['a combatant not an id', { combatantId: 'c thorin' }],
    ['a combat not an id', { combatId: 'cmbt.1' }],
    ['a turn index', { turn: 0 }],
    ['anything else of the turn', { name: 'Thorin' }],
  ])('refuses a turn with %s', (_name, fields) => {
    expect(
      parseKind(endingTurn, { turn: { ...endingTurn.turn, ...fields } })
        .success,
    ).toBe(false)
  })

  it.each([
    ['advantage', { mode: 1 }],
    ['how it was rolled chosen', { explicit: true }],
    ['a term added', { extras: [{ sign: 1, flat: 2 }] }],
    ['a die', { dice: [{ faces: 20, results: [14] }] }],
  ])('refuses a turn ended with %s, as it throws no dice', (_name, fields) => {
    expect(issuesOf(endingTurn, fields)).toEqual([
      ['dice', 'Ending a turn throws no dice'],
    ])
  })

  it.each([
    ['an item', { item: 'warhammer' }],
    ['an item and activity', { item: 'warhammer', activity: 'swing01' }],
    ['a combat of its own', { combatId: 'cmbt1' }],
    ['a target', { target: { combatId: 'cmbt1', combatantId: 'cGoblin' } }],
    ['targets', { targets: [{ combatId: 'cmbt1', combatantId: 'cGoblin' }] }],
    ['at its user', { self: true }],
    ['a slot', { slot: 'spell2' }],
    ['a key', { key: 'prc' }],
    ['a use', { use: 'req-1' }],
    ['kinds of damage', { types: ['fire'] }],
    ['changes', { modifiers: { maximize: true } }],
    ['a critical hit', { critical: true }],
    ['a prompt', { prompt: 'card1-actor1' }],
    ['a link', { text: 'a3b4c5d6e7f809', link: 0 }],
    ['a concentration', { concentration: { effect: 'concBless0001' } }],
    ['a companion', { of: 'actorThorin1' }],
    ['the Gamemaster', { by: 'gm' }],
  ])('refuses a turn ended with %s', (_name, fields) => {
    expect(parseKind(endingTurn, fields).success).toBe(false)
  })
})

/** Thorin's End Turn taken back, from Brakka's turn, where it left the combat. */
const undoingTurn = {
  kind: 'undoEndTurn',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  undo: 'cmx1end2turn3',
  turn: { combatId: 'cmbt1', round: 1, combatantId: 'cBrakka' },
}

describe('schemas/roll-request, a turn taken back, from module 0.36.0', () => {
  it('takes the End Turn it takes back and the turn that left, with no dice', () => {
    expect(parseKind(undoingTurn, {}).success).toBe(true)
    expect(parseKind(undoingTurn, { undo: 'a'.repeat(64) }).success).toBe(true)
    expect(parseKind(undoingTurn, { undo: 'req_1-b' }).success).toBe(true)
  })

  it('names the End Turn it takes back, and only it does', () => {
    expect(issuesOf(undoingTurn, { undo: undefined })).toEqual([
      [
        'undo',
        'A turn taken back, and only that, names the End Turn it takes back',
      ],
    ])
    expect(issuesOf(endingTurn, { undo: 'cmx1end2turn3' })).toEqual([
      [
        'undo',
        'A turn taken back, and only that, names the End Turn it takes back',
      ],
    ])
    expect(issuesOf(perception, { undo: 'cmx1end2turn3' })).toEqual([
      [
        'undo',
        'A turn taken back, and only that, names the End Turn it takes back',
      ],
    ])
  })

  it('names the turn, as a turn ended does, and nothing else does still', () => {
    expect(issuesOf(undoingTurn, { turn: undefined })).toEqual([
      ['turn', 'A turn ended or taken back, and only that, names the turn'],
    ])
    const { turn } = undoingTurn
    expect(
      parseKind(
        { ...perception, kind: 'initiative', key: undefined },
        { combatId: 'cmbt1', turn },
      ).success,
    ).toBe(false)
    expect(
      issuesOf(
        { ...perception, kind: 'initiative', key: undefined },
        { combatId: 'cmbt1', turn },
      ),
    ).toEqual([
      ['turn', 'A turn ended or taken back, and only that, names the turn'],
    ])
  })

  it.each([
    ['of 65 characters', 'a'.repeat(65)],
    ['with a space', 'a b'],
    ['empty', ''],
    ['with a dot', 'req.1'],
  ])('refuses an End Turn named by an id %s', (_name, undo) => {
    expect(parseKind(undoingTurn, { undo }).success).toBe(false)
  })

  it.each([
    ['round 0', { round: 0 }],
    ['no combatant', { combatantId: undefined }],
    ['a combatant not an id', { combatantId: 'c brakka' }],
    ['anything else of the turn', { name: 'Brakka' }],
    ['the turn it ended', { ended: 'cThorin' }],
  ])('refuses a turn with %s', (_name, fields) => {
    expect(
      parseKind(undoingTurn, { turn: { ...undoingTurn.turn, ...fields } })
        .success,
    ).toBe(false)
  })

  it.each([
    ['advantage', { mode: 1 }],
    ['how it was rolled chosen', { explicit: true }],
    ['a term added', { extras: [{ sign: 1, flat: 2 }] }],
    ['a die', { dice: [{ faces: 20, results: [14] }] }],
  ])(
    'refuses a turn taken back with %s, as it throws no dice',
    (_name, fields) => {
      expect(issuesOf(undoingTurn, fields)).toEqual([
        ['dice', 'Taking a turn back throws no dice'],
      ])
    },
  )

  it.each([
    ['an item', { item: 'warhammer' }],
    ['a combat of its own', { combatId: 'cmbt1' }],
    ['a target', { target: { combatId: 'cmbt1', combatantId: 'cGoblin' } }],
    ['a use', { use: 'req-1' }],
    ['a key', { key: 'prc' }],
    ['a concentration', { concentration: { effect: 'concBless0001' } }],
    ['a companion', { of: 'actorThorin1' }],
    ['the Gamemaster', { by: 'gm' }],
  ])('refuses a turn taken back with %s', (_name, fields) => {
    expect(parseKind(undoingTurn, fields).success).toBe(false)
  })
})

describe('schemas/roll-request, favorites added and removed, from module 0.37.0', () => {
  /** The Rope added to Thorin's favorites, as its row's menu sends it. */
  const favoriting = {
    kind: 'favorite',
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
    favorite: { op: 'add', type: 'item', id: 'ropeThorin01' },
  }
  /** A favorite as given, the rest as `favoriting` has it. */
  const favorite = (fields: object) =>
    parseKind(favoriting, { favorite: fields })

  it.each([
    ['an item added', { op: 'add', type: 'item', id: 'ropeThorin01' }],
    ['an item removed', { op: 'remove', type: 'item', id: 'ropeThorin01' }],
    [
      "one of an item's activities, by its item too",
      { op: 'add', type: 'activity', id: 'same', item: 'wandA' },
    ],
    ["an effect of the actor's", { op: 'add', type: 'effect', id: 'bless01' }],
    [
      "an effect of an item's",
      { op: 'remove', type: 'effect', id: 'cloak.protect01' },
    ],
    ['a skill', { op: 'add', type: 'skill', id: 'prc' }],
    ['a tool', { op: 'add', type: 'tool', id: 'thief' }],
    ['spell slots', { op: 'remove', type: 'slots', id: 'spell1' }],
    ['pact slots', { op: 'add', type: 'slots', id: 'pact' }],
  ])('takes %s', (_name, fields) => {
    const parsed = favorite(fields)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual({ ...favoriting, favorite: fields })
  })

  it.each([
    [
      'an old-style resource',
      { op: 'remove', type: 'resource', id: 'primary' },
    ],
    ['a type dnd5e has none of', { op: 'add', type: 'spell', id: 'abc' }],
    ['no op', { type: 'item', id: 'ropeThorin01' }],
    ['another op', { op: 'toggle', type: 'item', id: 'ropeThorin01' }],
    ['a key more', { op: 'add', type: 'item', id: 'ropeThorin01', sort: 100 }],
    [
      'an item on an item',
      { op: 'add', type: 'item', id: 'ropeThorin01', item: 'ropeThorin01' },
    ],
    [
      'an item on an effect',
      { op: 'add', type: 'effect', id: 'bless01', item: 'cloak' },
    ],
    ['no item on an activity', { op: 'add', type: 'activity', id: 'same' }],
    [
      'an activity id not an id',
      { op: 'add', type: 'activity', id: 'a.b', item: 'wandA' },
    ],
    ['an effect id of two dots', { op: 'add', type: 'effect', id: 'a.b.c' }],
    ['an item id with a dot', { op: 'add', type: 'item', id: 'rope.x' }],
    [
      'a tool named as a resource',
      { op: 'remove', type: 'tool', id: 'resources.primary' },
    ],
    ['a key beginning with a digit', { op: 'add', type: 'skill', id: '1prc' }],
    ['a key too long', { op: 'add', type: 'slots', id: `s${'x'.repeat(32)}` }],
    ['an id too long', { op: 'add', type: 'item', id: 'x'.repeat(65) }],
  ])('refuses %s', (_name, fields) => {
    expect(favorite(fields).success).toBe(false)
  })

  it('takes a favorite only as a favorite, and a favorite only with one', () => {
    const message = 'A favorite added or removed, and only that, names what'
    expect(issuesOf(perception, { favorite: favoriting.favorite })).toEqual([
      ['favorite', message],
    ])
    expect(issuesOf(removing, { favorite: favoriting.favorite })).toEqual([
      ['favorite', message],
    ])
    expect(issuesOf(favoriting, { favorite: undefined })).toEqual([
      ['favorite', message],
    ])
  })

  it.each([
    [
      'a removal',
      { remove: removing.remove },
      ['remove', 'A removal, and only that, names what it removes'],
    ],
    [
      'a move',
      { transfer: moving.transfer },
      ['transfer', 'A move, and only that, names what moves'],
    ],
    [
      'an item',
      { item: 'ropeThorin01' },
      [
        'activity',
        'An attack, a use, a formula or damage on its own, and only those or a check an activity asks for, is made with an item; a recharge, with its item',
      ],
    ],
    ['a key', { key: 'prc' }, ['key', 'Nothing to name']],
  ])(
    'refuses a favorite naming %s, another kind’s field',
    (_n, fields, issue) => {
      expect(issuesOf(favoriting, fields)).toContainEqual(issue)
    },
  )

  it.each([
    ['advantage', { mode: 1 }],
    ['how it was rolled chosen', { explicit: true }],
    ['a term added', { extras: [{ sign: 1, flat: 2 }] }],
    ['a die', { dice: [{ faces: 20, results: [14] }] }],
  ])('refuses a favorite with %s, as it throws no dice', (_name, fields) => {
    expect(issuesOf(favoriting, fields)).toEqual([
      ['dice', 'A favorite throws no dice'],
    ])
  })

  it('refuses one saying whose it is', () => {
    expect(parseKind(favoriting, { by: 'gm' }).success).toBe(false)
    expect(parseKind(favoriting, { actorId: 'actorVex0001' }).success).toBe(
      false,
    )
  })
})

describe("schemas/roll-request, a player's own effects, from module 0.39.0", () => {
  /** Bless turned off on Thorin, as its row's control sends it. */
  const changing = {
    kind: 'effect',
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
    effect: { op: 'disable', id: 'a8LkT3wPz0QcN5vB' },
  }
  /** An effect as given, the rest as `changing` has it. */
  const effect = (fields: unknown) => parseKind(changing, { effect: fields })

  it.each([
    ['one turned off', { op: 'disable', id: 'a8LkT3wPz0QcN5vB' }],
    ['one turned on', { op: 'enable', id: 'a8LkT3wPz0QcN5vB' }],
    ['one deleted', { op: 'delete', id: 'a8LkT3wPz0QcN5vB' }],
    [
      "an item's, by its dotted id",
      { op: 'disable', id: 'rageFeature0001.rageEffect00001' },
    ],
  ])('takes %s', (_name, fields) => {
    const parsed = effect(fields)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual({ ...changing, effect: fields })
  })

  it.each([
    ['no op', { id: 'a8LkT3wPz0QcN5vB' }],
    ['a toggle', { op: 'toggle', id: 'a8LkT3wPz0QcN5vB' }],
    ['no id', { op: 'disable' }],
    ['an id of two dots', { op: 'disable', id: 'a.b.c' }],
    ['an id with a space', { op: 'disable', id: 'a8Lk T3' }],
    ['an empty id', { op: 'delete', id: '' }],
    ['an id too long', { op: 'delete', id: 'x'.repeat(65) }],
    ['an item part too long', { op: 'delete', id: `a.${'x'.repeat(65)}` }],
    ['a key more', { op: 'disable', id: 'a8LkT3wPz0QcN5vB', by: 'gm' }],
    ['not an object', 'a8LkT3wPz0QcN5vB'],
  ])('refuses %s', (_name, fields) => {
    expect(effect(fields).success).toBe(false)
  })

  it('takes an effect changed only as one, and one only naming the effect', () => {
    const message =
      'An effect turned off, on or deleted, and only that, names the effect'
    expect(issuesOf(perception, { effect: changing.effect })).toEqual([
      ['effect', message],
    ])
    expect(issuesOf(removing, { effect: changing.effect })).toEqual([
      ['effect', message],
    ])
    expect(issuesOf(changing, { effect: undefined })).toEqual([
      ['effect', message],
    ])
  })

  it.each([
    [
      'a favorite',
      { favorite: { op: 'add', type: 'effect', id: 'a8LkT3wPz0QcN5vB' } },
      ['favorite', 'A favorite added or removed, and only that, names what'],
    ],
    [
      'a removal',
      { remove: removing.remove },
      ['remove', 'A removal, and only that, names what it removes'],
    ],
    [
      'a concentration',
      { concentration: { effect: 'a8LkT3wPz0QcN5vB' } },
      [
        'concentration',
        'A concentration ended, and only that, names the concentration',
      ],
    ],
    [
      'an item',
      { item: 'ropeThorin01' },
      [
        'activity',
        'An attack, a use, a formula or damage on its own, and only those or a check an activity asks for, is made with an item; a recharge, with its item',
      ],
    ],
    ['a key', { key: 'prc' }, ['key', 'Nothing to name']],
  ])(
    'refuses an effect changed naming %s, another kind’s field',
    (_n, fields, issue) => {
      expect(issuesOf(changing, fields)).toContainEqual(issue)
    },
  )

  it.each([
    ['advantage', { mode: 1 }],
    ['how it was rolled chosen', { explicit: true }],
    ['a term added', { extras: [{ sign: 1, flat: 2 }] }],
    ['a die', { dice: [{ faces: 20, results: [14] }] }],
  ])(
    'refuses an effect changed with %s, as it throws no dice',
    (_name, fields) => {
      expect(issuesOf(changing, fields)).toEqual([
        ['dice', 'Changing an effect throws no dice'],
      ])
    },
  )

  it('refuses one saying whose it is, or of whom', () => {
    expect(parseKind(changing, { by: 'gm' }).success).toBe(false)
    expect(parseKind(changing, { of: 'actorThorin1' }).success).toBe(false)
    expect(parseKind(changing, { actorId: 'actorVex0001' }).success).toBe(false)
  })

  it('takes what the page calls it, which the server strips', () => {
    expect(parseKind(changing, { label: 'Bless' }).success).toBe(true)
  })
})

describe('schemas/roll-request, Wild Shape, from module 0.40.0', () => {
  /** Elowen changing into her known Wolf, as the picker sends it. */
  const shaping = {
    kind: 'wildShape',
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
    wildShape: { op: 'transform', form: 'Kp3vQ8mZr2LdW0aB' },
  }
  /** Wild Shape as given, the rest as `shaping` has it. */
  const wildShape = (fields: unknown) =>
    parseKind(shaping, { wildShape: fields })
  const WOLF = 'Compendium.dnd5e.actors24.Actor.mmWolf0000000000'

  it.each([
    [
      'a change into a known form',
      { op: 'transform', form: 'Kp3vQ8mZr2LdW0aB' },
    ],
    ['a return', { op: 'revert' }],
    [
      'a Beast learned into an empty place',
      { op: 'learn', uuid: WOLF, replace: null },
    ],
    [
      'a Beast learned in place of a known form',
      { op: 'learn', uuid: WOLF, replace: 'Pn5xS0oBt4NfY2dD' },
    ],
    [
      'a Beast of another pack, a module’s',
      {
        op: 'learn',
        uuid: 'Compendium.my-beasts_2.beasts-of-the-north.Actor.abcdEFGH01234567',
        replace: null,
      },
    ],
    ['the Beasts to learn listed', { op: 'forms' }],
  ])('takes %s', (_name, fields) => {
    const parsed = wildShape(fields)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual({ ...shaping, wildShape: fields })
  })

  it.each([
    ['no op', { form: 'Kp3vQ8mZr2LdW0aB' }],
    [
      'an op the module has none of',
      { op: 'forget', form: 'Kp3vQ8mZr2LdW0aB' },
    ],
    ['a change with no form', { op: 'transform' }],
    [
      'a change into a form id too short',
      { op: 'transform', form: 'Kp3vQ8mZr2LdW0a' },
    ],
    [
      'a change into a form id too long',
      { op: 'transform', form: 'Kp3vQ8mZr2LdW0aBc' },
    ],
    [
      'a change into a form id with a dot',
      { op: 'transform', form: 'Kp3vQ8mZr2.dW0aB' },
    ],
    ['a change by uuid', { op: 'transform', form: WOLF }],
    ['a return naming a form', { op: 'revert', form: 'Kp3vQ8mZr2LdW0aB' }],
    ['a Beast learned with no uuid', { op: 'learn', replace: null }],
    ['a Beast learned with replace left out', { op: 'learn', uuid: WOLF }],
    [
      'a world actor learned',
      { op: 'learn', uuid: 'Actor.hiddenOgre000000', replace: null },
    ],
    [
      'a world actor learned by a compendium-like uuid',
      {
        op: 'learn',
        uuid: 'Compendium.world.secrets.Item.abcdEFGH01234567',
        replace: null,
      },
    ],
    [
      'an actor id too short',
      {
        op: 'learn',
        uuid: 'Compendium.dnd5e.actors24.Actor.mmWolf',
        replace: null,
      },
    ],
    [
      'a uuid with more to it',
      { op: 'learn', uuid: `${WOLF}.Item.biteWolf00000000`, replace: null },
    ],
    [
      'a replace that isn’t a profile id',
      { op: 'learn', uuid: WOLF, replace: 'wolf' },
    ],
    ['a list naming a form', { op: 'forms', form: 'Kp3vQ8mZr2LdW0aB' }],
    ['a key more', { op: 'revert', by: 'gm' }],
    ['not an object', 'transform'],
    ['null', null],
  ])('refuses %s', (_name, fields) => {
    expect(wildShape(fields).success).toBe(false)
  })

  it('takes Wild Shape only as itself, and Wild Shape only naming its op', () => {
    const message = 'Wild Shape, and only that, names its op and form'
    expect(issuesOf(perception, { wildShape: shaping.wildShape })).toEqual([
      ['wildShape', message],
    ])
    expect(issuesOf(removing, { wildShape: shaping.wildShape })).toEqual([
      ['wildShape', message],
    ])
    expect(issuesOf(shaping, { wildShape: undefined })).toEqual([
      ['wildShape', message],
    ])
  })

  it.each([
    [
      'an effect',
      { effect: { op: 'disable', id: 'blessed' } },
      [
        'effect',
        'An effect turned off, on or deleted, and only that, names the effect',
      ],
    ],
    [
      'a favorite',
      { favorite: { op: 'add', type: 'item', id: 'quarterstaff' } },
      ['favorite', 'A favorite added or removed, and only that, names what'],
    ],
    [
      'a removal',
      { remove: removing.remove },
      ['remove', 'A removal, and only that, names what it removes'],
    ],
    [
      'an item',
      { item: 'wildShapeItem01' },
      [
        'activity',
        'An attack, a use, a formula or damage on its own, and only those or a check an activity asks for, is made with an item; a recharge, with its item',
      ],
    ],
    ['a key', { key: 'prc' }, ['key', 'Nothing to name']],
  ])(
    'refuses Wild Shape naming %s, another kind’s field',
    (_n, fields, issue) => {
      expect(issuesOf(shaping, fields)).toContainEqual(issue)
    },
  )

  it.each([
    ['advantage', { mode: 1 }],
    ['how it was rolled chosen', { explicit: true }],
    ['a term added', { extras: [{ sign: 1, flat: 2 }] }],
    ['a die', { dice: [{ faces: 20, results: [14] }] }],
  ])('refuses Wild Shape with %s, as it throws no dice', (_name, fields) => {
    expect(issuesOf(shaping, fields)).toEqual([
      ['dice', 'Wild Shape throws no dice'],
    ])
  })

  it('refuses one saying whose it is, or of whom', () => {
    expect(parseKind(shaping, { by: 'gm' }).success).toBe(false)
    expect(parseKind(shaping, { of: 'owlFamiliar1' }).success).toBe(false)
    expect(parseKind(shaping, { actorId: 'actorThorin1' }).success).toBe(false)
  })

  it('takes what the page calls it, which the server strips', () => {
    expect(parseKind(shaping, { label: 'Wild Shape' }).success).toBe(true)
  })
})

describe('the dice effects add, and rerolls kept, from module 0.42.0', () => {
  /** A Dexterity save typed in, with Bless's d4 typed too. */
  const save = {
    kind: 'save',
    key: 'dex',
    mode: 0,
    explicit: false,
    extras: [],
    dice: [{ faces: 20, results: [12] }],
    typed: true,
  }
  const bless = { faces: 4, sign: 1, results: [3] }
  const bane = { faces: 4, sign: -1, results: [1] }

  it.each([
    ['a skill check', perception],
    ['a tool check', { ...perception, kind: 'tool', key: 'thief' }],
    ['an ability check', { ...perception, kind: 'ability', key: 'str' }],
    ['a saving throw', save],
    ['a death saving throw', { ...save, kind: 'death', key: undefined }],
    [
      'initiative',
      { ...perception, kind: 'initiative', key: undefined, combatId: 'cmbt1' },
    ],
    ['an attack', attack],
  ])('takes the dice effects add to %s typed in', (_name, base) => {
    const parsed = parseKind(base, { typed: true, effectDice: [bless, bane] })
    expect(parsed.success).toBe(true)
    expect(parsed.data).toMatchObject({ effectDice: [bless, bane] })
  })

  it('takes two dice of one effect, of any size but a d20', () => {
    for (const faces of [4, 6, 8, 10, 12, 100]) {
      expect(
        parseKind(save, {
          effectDice: [{ faces, sign: 1, results: [1, faces] }],
        }).success,
      ).toBe(true)
    }
  })

  it.each([
    ['damage', damage],
    ['hit dice', hitDice],
    ['a hit die', hitDie],
    ['a formula', formula],
    ['a use', use],
  ])('refuses the dice effects add to %s', (_name, base) => {
    expect(issuesOf(base, { typed: true, effectDice: [bless] })).toContainEqual(
      ['effectDice', 'Only a typed d20 roll names the dice its effects add'],
    )
  })

  it('refuses them on a roll not typed in', () => {
    expect(issuesOf(save, { typed: undefined, effectDice: [bless] })).toEqual([
      ['effectDice', 'Only a typed d20 roll names the dice its effects add'],
    ])
  })

  it.each([
    ['a d20', { faces: 20, sign: 1, results: [12] }],
    ['a result of 0', { faces: 4, sign: 1, results: [0] }],
    ['a result past its faces', { faces: 4, sign: -1, results: [5] }],
  ])('refuses %s among them', (_name, effect) => {
    expect(issuesOf(save, { effectDice: [bless, effect] })).toEqual([
      ['effectDice', 'The dice are not those the roll throws'],
    ])
  })

  it.each([
    ['not a list', bless],
    ['a d3', [{ faces: 3, sign: 1, results: [2] }]],
    ['a sign of 0', [{ faces: 4, sign: 0, results: [2] }]],
    ['no results', [{ faces: 4, sign: 1, results: [] }]],
    [
      '21 results',
      [{ faces: 4, sign: 1, results: Array.from({ length: 21 }, () => 1) }],
    ],
    ['a result not whole', [{ faces: 4, sign: 1, results: [2.5] }]],
    ['a field more', [{ ...bless, name: 'Bless' }]],
    ['11 of them', Array.from({ length: 11 }, () => bless)],
  ])('refuses them as %s', (_name, effectDice) => {
    expect(parseKind(save, { effectDice }).success).toBe(false)
  })

  it('takes rerolls kept on any roll typed in, damage among them', () => {
    for (const base of [perception, attack, damage, hitDice, formula]) {
      const parsed = parseKind(base, { typed: true, rerolls: 'kept' })
      expect(parsed.success).toBe(true)
      expect(parsed.data).toMatchObject({ rerolls: 'kept' })
    }
  })

  it('refuses rerolls kept on a roll not typed in', () => {
    expect(issuesOf(damage, { rerolls: 'kept' })).toEqual([
      ['rerolls', 'Only a typed roll keeps its rerolls'],
    ])
  })

  it.each(['other', true, null, 1])('refuses rerolls: %p', rerolls => {
    expect(parseKind(damage, { typed: true, rerolls }).success).toBe(false)
  })
})

describe('schemas/roll-request, a spell slot spent or restored, from module 0.42.1', () => {
  /** One of Thorin's 1st-level slots spent, at 3 of 4, as a filled dot's confirm sends it. */
  const slotting = {
    kind: 'spellSlot',
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
    spellSlot: { op: 'spend', id: 'spell1', from: 3 },
  }
  /** A spell slot as given, the rest as `slotting` has it. */
  const slot = (fields: unknown) => parseKind(slotting, { spellSlot: fields })
  const message =
    'A spell slot spent or restored, and only that, names the pool, which, and the count it was made from'

  it.each([
    ['a 1st-level slot spent', { op: 'spend', id: 'spell1', from: 3 }],
    ['a 9th-level slot restored', { op: 'restore', id: 'spell9', from: 0 }],
    ['a pact slot spent', { op: 'spend', id: 'pact', from: 2 }],
    ['a pact slot restored', { op: 'restore', id: 'pact', from: 0 }],
    [
      'one from the most a count may be',
      { op: 'spend', id: 'spell1', from: 999 },
    ],
  ])('takes %s, as it is', (_name, fields) => {
    const parsed = slot(fields)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual({ ...slotting, spellSlot: fields })
  })

  it('takes what the Gamemaster’s page calls it, which the server keeps apart', () => {
    expect(parseKind(slotting, { label: '1st-level spell slot' }).success).toBe(
      true,
    )
  })

  it.each([
    ['no op', { id: 'spell1', from: 3 }],
    ['an op of its own', { op: 'set', id: 'spell1', from: 3 }],
    ['a toggle', { op: 'toggle', id: 'spell1', from: 3 }],
    ['no pool', { op: 'spend', from: 3 }],
    ['an empty pool', { op: 'spend', id: '', from: 3 }],
    ['cantrips', { op: 'spend', id: 'spell0', from: 3 }],
    ['a 10th level', { op: 'spend', id: 'spell10', from: 3 }],
    ['a level by its name', { op: 'spend', id: '1st', from: 3 }],
    ['a pool a module adds', { op: 'spend', id: 'arcane1', from: 3 }],
    ['an own key of every object', { op: 'spend', id: 'constructor', from: 3 }],
    ['a pool as a number', { op: 'spend', id: 7, from: 3 }],
    ['no count', { op: 'spend', id: 'spell1' }],
    ['a count below 0', { op: 'spend', id: 'spell1', from: -1 }],
    ['a count of a part', { op: 'spend', id: 'spell1', from: 1.5 }],
    ['a count over 999', { op: 'restore', id: 'spell1', from: 1000 }],
    ['a count as text', { op: 'spend', id: 'spell1', from: '2' }],
    ['a key more', { op: 'spend', id: 'spell1', from: 3, count: 1 }],
    ['who sent it', { op: 'spend', id: 'spell1', from: 3, by: 'gm' }],
    ['not an object', 'spell1'],
    ['null', null],
  ])('refuses %s', (_name, fields) => {
    expect(slot(fields).success).toBe(false)
  })

  it('takes a spell slot only as one, and one only naming its slot', () => {
    expect(issuesOf(perception, { spellSlot: slotting.spellSlot })).toEqual([
      ['spellSlot', message],
    ])
    expect(issuesOf(spending, { spellSlot: slotting.spellSlot })).toEqual([
      ['spellSlot', message],
    ])
    expect(issuesOf(inspiring, { spellSlot: slotting.spellSlot })).toEqual([
      ['spellSlot', message],
    ])
    expect(issuesOf(slotting, { spellSlot: undefined })).toEqual([
      ['spellSlot', message],
    ])
  })

  it.each([
    [
      'charges',
      { counter: { item: 'sorcery' }, count: 1 },
      ['counter', 'Charges spent, and only those, name their counter'],
    ],
    [
      'Heroic Inspiration',
      { inspiration: 'use' },
      [
        'inspiration',
        'Heroic Inspiration, and only that, says whether it’s used',
      ],
    ],
    [
      'a cast’s slot',
      { slot: 'spell1' },
      ['slot', 'Only an attack, a use or damage on its own casts at a slot'],
    ],
    [
      'spending what a use would',
      { consume: true },
      ['consume', 'Only damage on its own spends what it uses'],
    ],
    [
      'an item',
      { item: 'bless', activity: 'cast' },
      [
        'activity',
        'An attack, a use, a formula or damage on its own, and only those or a check an activity asks for, is made with an item; a recharge, with its item',
      ],
    ],
    ['a key', { key: 'prc' }, ['key', 'Nothing to name']],
  ])(
    'refuses a spell slot naming %s, another kind’s field',
    (_n, fields, issue) => {
      expect(issuesOf(slotting, fields)).toContainEqual(issue)
    },
  )

  it.each([
    ['advantage', { mode: 1 }],
    ['how it was rolled chosen', { explicit: true }],
    ['a term added', { extras: [{ sign: 1, flat: 2 }] }],
    ['a die', { dice: [{ faces: 20, results: [14] }] }],
  ])('refuses a spell slot with %s, as it throws no dice', (_name, fields) => {
    expect(issuesOf(slotting, fields)).toEqual([
      ['dice', 'A spell slot spent or restored throws no dice'],
    ])
  })

  it('refuses one saying whose it is, or of whom', () => {
    expect(parseKind(slotting, { by: 'gm' }).success).toBe(false)
    expect(parseKind(slotting, { of: 'actorThorin1' }).success).toBe(false)
    expect(parseKind(slotting, { actorId: 'actorVex0001' }).success).toBe(false)
  })
})

describe('schemas/roll-request, a spell prepared or unprepared, from module 0.42.1', () => {
  /** Witch Bolt prepared, as its row's menu sends it. */
  const preparing = {
    kind: 'prepare',
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
    prepare: { op: 'prepare', id: 'witch' },
  }
  /** A preparation as given, the rest as `preparing` has it. */
  const prepare = (fields: unknown) => parseKind(preparing, { prepare: fields })
  const message =
    'A spell prepared or unprepared, and only that, names the spell and which'

  it.each([
    ['a spell prepared', { op: 'prepare', id: 'witch' }],
    ['a spell unprepared', { op: 'unprepare', id: 'bless' }],
    ['an id of 64 letters and digits', { op: 'prepare', id: 'a1'.repeat(32) }],
  ])('takes %s, as it is', (_name, fields) => {
    const parsed = prepare(fields)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual({ ...preparing, prepare: fields })
  })

  it.each([
    ['no op', { id: 'witch' }],
    ['a toggle', { op: 'toggle', id: 'witch' }],
    ['always prepared', { op: 'always', id: 'witch' }],
    ['no spell', { op: 'prepare' }],
    ['an empty id', { op: 'prepare', id: '' }],
    ['an id with a dot', { op: 'prepare', id: 'a.b' }],
    ['an id of 65 letters', { op: 'prepare', id: 'x'.repeat(65) }],
    ['an id as a number', { op: 'prepare', id: 7 }],
    ['a key more', { op: 'prepare', id: 'witch', from: 0 }],
    ['who sent it', { op: 'prepare', id: 'witch', by: 'gm' }],
    ['not an object', 'witch'],
    ['null', null],
  ])('refuses %s', (_name, fields) => {
    expect(prepare(fields).success).toBe(false)
  })

  it('takes a preparation only as one, and one only naming its spell', () => {
    expect(issuesOf(perception, { prepare: preparing.prepare })).toEqual([
      ['prepare', message],
    ])
    expect(issuesOf(spending, { prepare: preparing.prepare })).toEqual([
      ['prepare', message],
    ])
    expect(issuesOf(inspiring, { prepare: preparing.prepare })).toEqual([
      ['prepare', message],
    ])
    expect(issuesOf(preparing, { prepare: undefined })).toEqual([
      ['prepare', message],
    ])
  })

  it.each([
    [
      'an effect',
      { effect: { op: 'disable', id: 'blessed' } },
      [
        'effect',
        'An effect turned off, on or deleted, and only that, names the effect',
      ],
    ],
    [
      'a favorite',
      { favorite: { op: 'add', type: 'item', id: 'witch' } },
      ['favorite', 'A favorite added or removed, and only that, names what'],
    ],
    [
      'a move',
      { transfer: moving.transfer },
      ['transfer', 'A move, and only that, names what moves'],
    ],
    [
      'charges',
      { counter: { item: 'sorcery' }, count: 1 },
      ['counter', 'Charges spent, and only those, name their counter'],
    ],
    [
      'a cast’s slot',
      { slot: 'spell1' },
      ['slot', 'Only an attack, a use or damage on its own casts at a slot'],
    ],
    [
      'an item',
      { item: 'witch', activity: 'cast' },
      [
        'activity',
        'An attack, a use, a formula or damage on its own, and only those or a check an activity asks for, is made with an item; a recharge, with its item',
      ],
    ],
    ['a key', { key: 'prc' }, ['key', 'Nothing to name']],
  ])(
    'refuses a preparation naming %s, another kind’s field',
    (_n, fields, issue) => {
      expect(issuesOf(preparing, fields)).toContainEqual(issue)
    },
  )

  it.each([
    ['advantage', { mode: 1 }],
    ['how it was rolled chosen', { explicit: true }],
    ['a term added', { extras: [{ sign: 1, flat: 2 }] }],
    ['a die', { dice: [{ faces: 20, results: [14] }] }],
  ])('refuses a preparation with %s, as it throws no dice', (_name, fields) => {
    expect(issuesOf(preparing, fields)).toEqual([
      ['dice', 'Preparing a spell throws no dice'],
    ])
  })

  it('refuses one saying whose it is, or of whom', () => {
    expect(parseKind(preparing, { by: 'gm' }).success).toBe(false)
    expect(parseKind(preparing, { of: 'actorThorin1' }).success).toBe(false)
    expect(parseKind(preparing, { actorId: 'actorVex0001' }).success).toBe(
      false,
    )
  })
})
