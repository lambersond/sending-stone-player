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
    ['a kind it does not know', { kind: 'attack' }],
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
