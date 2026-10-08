import {
  changes,
  firstDie,
  modifiedDice,
  mostExtra,
  reshapes,
  withModifiers,
} from './damage-modifiers'
import type { DamagePreview } from '@/types/sending-stone'

/** Toll the Dead's damage, 1d8 necrotic, and a second part, 1d6 + 2 fire. */
const parts = [
  {
    terms: [{ sign: 1 as const, count: 1, sides: 8 as const }],
    type: 'Necrotic',
  },
  {
    terms: [
      { sign: 1 as const, count: 1, sides: 6 as const },
      { sign: 1 as const, flat: 2 },
    ],
    type: 'Fire',
  },
]

/** The damage the game said a critical hit throws: 2d8 + 4, then 2d6. */
const critical: DamagePreview = {
  critical: true,
  plannable: true,
  rolls: [
    {
      formula: '2d8 + 4',
      type: 'Slashing',
      dice: [{ faces: 8, number: 2 }],
      perDie: 2,
    },
    {
      formula: '2d6',
      type: 'Fire',
      dice: [{ faces: 6, number: 2 }],
      perDie: 2,
    },
  ],
}

describe('utils/damage-modifiers', () => {
  it('says whether changes change anything, and whether they change the dice', () => {
    expect(changes()).toBe(false)
    expect(changes({})).toBe(false)
    expect(changes({ extra: 0, maximize: false })).toBe(false)
    expect(changes({ extra: 1 })).toBe(true)
    expect(changes({ faces: 12 })).toBe(true)
    expect(changes({ maximize: true })).toBe(true)
    expect(reshapes({ maximize: true })).toBe(false)
    expect(reshapes({ faces: 12 })).toBe(true)
  })

  it("finds the first die of damage's first part, if it adds one", () => {
    expect(firstDie(parts)).toEqual({ sign: 1, count: 1, sides: 8 })
    expect(firstDie([{ terms: [{ sign: 1, flat: 5 }] }, ...parts])).toBe(
      undefined,
    )
    expect(
      firstDie([{ terms: [{ sign: -1, count: 1, sides: 4 }] }]),
    ).toBeUndefined()
    expect(firstDie([])).toBeUndefined()
  })

  it('adds dice to the first, as many for each as the game throws, and makes it another size', () => {
    expect(withModifiers(parts, { extra: 2, faces: 12 })).toEqual([
      { terms: [{ sign: 1, count: 3, sides: 12 }], type: 'Necrotic' },
      parts[1],
    ])
    // A critical hit's dice, which the game doubled, take two for each added.
    expect(withModifiers(parts, { extra: 1 }, 2)[0].terms).toEqual([
      { sign: 1, count: 3, sides: 8 },
    ])
    // Its highest leaves the dice as they are; so does damage with no first die.
    expect(withModifiers(parts, { maximize: true })).toBe(parts)
    const flat = [{ terms: [{ sign: 1 as const, flat: 5 }] }]
    expect(withModifiers(flat, { extra: 2 })).toBe(flat)
  })

  it("changes the dice the game said its damage throws: its first roll's first die", () => {
    expect(modifiedDice(critical)).toEqual([
      { faces: 8, number: 2 },
      { faces: 6, number: 2 },
    ])
    expect(modifiedDice(critical, { extra: 1, faces: 10 })).toEqual([
      { faces: 10, number: 4 },
      { faces: 6, number: 2 },
    ])
    expect(modifiedDice(critical, { maximize: true })).toEqual([
      { faces: 8, number: 2 },
      { faces: 6, number: 2 },
    ])
    // As from a module before 0.13.0, one for each.
    const older = {
      ...critical,
      rolls: critical.rolls.map(roll => ({ ...roll, perDie: undefined })),
    }
    expect(modifiedDice(older, { extra: 1 })?.[0]).toEqual({
      faces: 8,
      number: 3,
    })
    // None for damage the game rolls itself; nothing to change without a first die.
    expect(
      modifiedDice({ ...critical, plannable: false }, { extra: 1 }),
    ).toEqual([])
    expect(
      modifiedDice(
        { ...critical, rolls: [{ ...critical.rolls[0], dice: [] }] },
        { extra: 1 },
      ),
    ).toBeUndefined()
  })

  it('adds no more dice than one roll may throw, a critical hit taking two for each', () => {
    expect(mostExtra(parts)).toBe(39)
    expect(mostExtra(parts, 2)).toBe(19)
    expect(mostExtra([{ terms: [{ sign: 1, flat: 5 }] }])).toBe(0)
  })
})
