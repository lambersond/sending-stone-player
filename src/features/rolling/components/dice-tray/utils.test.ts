/**
 * @jest-environment node
 */
import {
  canStep,
  focusOnRemoving,
  iconSides,
  roomFor,
  rollName,
  toPlainRoll,
  trayDice,
} from './utils'
import type { TrayDie } from './types'

const d = (sides: TrayDie['sides'], count: number): TrayDie => ({
  sides,
  count,
})

describe('features/rolling/components/dice-tray/utils', () => {
  it('lists the dice smallest first, however they were added', () => {
    expect(trayDice([d(20, 1), d(6, 2), d(100, 1), d(4, 3)])).toEqual([
      d(4, 3),
      d(6, 2),
      d(20, 1),
      d(100, 1),
    ])
  })

  it.each([
    ['no dice', [], true],
    ['19 dice of two sizes', [d(6, 10), d(8, 9)], true],
    ['20 dice of two sizes', [d(6, 10), d(8, 10)], false],
  ])('has room for one more die with %s: %s', (_name, dice, room) => {
    expect(roomFor(dice)).toBe(room)
  })

  it.each([
    [0, 1, true],
    [99, 1, true],
    [100, 1, false],
    [-100, -1, false],
    [-100, 1, true],
  ] as const)('steps %i by %i: %s', (bonus, by, may) => {
    expect(canStep(bonus, by)).toBe(may)
  })

  it.each([
    [
      'a middle size: the next chip',
      [d(6, 1), d(8, 1), d(20, 1)],
      8,
      { button: 'fewer', sides: 20 },
    ],
    [
      'the last chip: the one before',
      [d(6, 1), d(8, 1)],
      8,
      { button: 'fewer', sides: 6 },
    ],
    [
      'the only chip: its size’s add',
      [d(6, 1)],
      6,
      { button: 'add', sides: 6 },
    ],
    ['a size keeping a die: nowhere', [d(6, 2), d(8, 1)], 6, undefined],
  ] as const)(
    'moves focus, taking away the last die of %s',
    (_name, dice, sides, to) => {
      expect(focusOnRemoving(dice, sides)).toEqual(to)
    },
  )

  it('draws a d100 as a d10, every other die as itself', () => {
    expect(
      [4, 6, 8, 10, 12, 20, 100].map(sides =>
        iconSides(sides as TrayDie['sides']),
      ),
    ).toEqual([4, 6, 8, 10, 12, 20, 10])
  })

  it.each([
    ['dice and a number added', [d(6, 2), d(8, 1)], 2, 'Roll 2d6 + 1d8 + 2'],
    ['a number taken away', [d(20, 1)], -1, 'Roll 1d20 − 1'],
    ['a d100, nothing added', [d(100, 1)], 0, 'Roll 1d100'],
    ['no dice yet', [], 3, 'Pick dice to roll'],
  ])('names Roll with %s', (_name, dice, bonus, name) => {
    expect(rollName(dice, bonus)).toBe(name)
  })

  it('rolls as a sheet’s formula, for the game to make as a plain roll', () => {
    expect(toPlainRoll([d(6, 2), d(8, 1)], -2)).toEqual({
      label: 'Dice (2d6 + 1d8 − 2)',
      terms: [
        { sign: 1, count: 2, sides: 6 },
        { sign: 1, count: 1, sides: 8 },
        { sign: -1, flat: 2 },
      ],
      source: {
        kind: 'plainRoll',
        plainRoll: {
          terms: [
            { faces: 6, count: 2 },
            { faces: 8, count: 1 },
          ],
          bonus: -2,
        },
      },
    })
    // Nothing added is no term, and no bonus sent.
    expect(toPlainRoll([d(20, 1)], 0)).toEqual({
      label: 'Dice (1d20)',
      terms: [{ sign: 1, count: 1, sides: 20 }],
      source: {
        kind: 'plainRoll',
        plainRoll: { terms: [{ faces: 20, count: 1 }] },
      },
    })
  })
})
