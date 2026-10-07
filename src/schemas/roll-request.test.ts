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

const parseAttack = (fields: object) =>
  rollRequestSchema.safeParse({ ...attack, ...fields })

const parseDamage = (fields: object) =>
  rollRequestSchema.safeParse({ ...damage, ...fields })

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
  ])('refuses damage %s', (_name, fields) => {
    expect(parseDamage(fields).success).toBe(false)
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
