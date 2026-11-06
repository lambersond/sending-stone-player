/**
 * @jest-environment node
 */
import {
  plainRollFormula,
  plainRollLabel,
  plainRollReach,
} from './plain-roll-words'
import type { RollKind } from '@/types/roll'

describe('utils/plain-roll-words', () => {
  it.each([
    [
      {
        terms: [
          { faces: 6 as const, count: 2 },
          { faces: 8 as const, count: 1 },
        ],
        bonus: 2,
      },
      '2d6 + 1d8 + 2',
    ],
    [{ terms: [{ faces: 20 as const, count: 1 }], bonus: -1 }, '1d20 − 1'],
    [{ terms: [{ faces: 100 as const, count: 1 }] }, '1d100'],
    [{ terms: [{ faces: 4 as const, count: 3 }], bonus: 0 }, '3d4'],
  ])('writes %j as %s', (plainRoll, formula) => {
    expect(plainRollFormula(plainRoll)).toBe(formula)
  })

  it('calls one by its dice, as hit dice are', () => {
    expect(plainRollLabel({ terms: [{ faces: 6, count: 2 }], bonus: 1 })).toBe(
      'Dice (2d6 + 1)',
    )
  })

  it.each([
    [
      'the game takes them, and this device sends them',
      ['skill', 'plainRoll'],
      true,
      'player',
      'Made in your Gamemaster’s game too, with the same dice.',
    ],
    [
      'the game takes them, but Send to the table is off',
      ['plainRoll'],
      false,
      'player',
      'Only you see these dice: Send to the table is off in Settings.',
    ],
    [
      'a module before 0.44.0',
      ['skill', 'formula'],
      true,
      'player',
      'Your Gamemaster’s Sending Stone module makes these from version 0.44.0.',
    ],
    [
      'the Gamemaster’s own module before 0.44.0',
      ['skill'],
      true,
      'gm',
      'Your Sending Stone module makes these from version 0.44.0.',
    ],
    [
      'rolls off',
      [],
      true,
      'player',
      "Only you see these rolls for now. They aren't sent to your Gamemaster's game.",
    ],
  ] as const)(
    'says where they go with %s',
    (_name, kinds, sending, role, words) => {
      expect(plainRollReach(kinds as readonly RollKind[], sending, role)).toBe(
        words,
      )
    },
  )
})
