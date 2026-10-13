import {
  formulaUnmaximizable,
  MOST_THROWN,
  readModifier,
  splitModifiers,
  throwTerm,
  unmaximizableDie,
} from './dice-modifiers'

/** Throws these dice, one after another, as `throwTerm` asks for more. */
const dice = (values: number[]) => {
  const left = [...values]
  return jest.fn((count: number) => left.splice(0, count))
}

/** A d6 with these modifiers, its first throw, and the dice thrown after it, worked out. */
const thrown = (
  modifiers: string[],
  first: number[],
  more: number[] = [],
  sides: 4 | 6 | 8 | 10 | 12 | 20 = 6,
) => throwTerm({ sides, modifiers }, first, dice(more))

describe('utils/dice-modifiers', () => {
  describe('splitModifiers', () => {
    it('splits them as Foundry does, a command and what follows it', () => {
      expect(splitModifiers('r<=2')).toEqual(['r<=2'])
      expect(splitModifiers('r1kh3')).toEqual(['r1', 'kh3'])
      expect(splitModifiers('xo>=5min2')).toEqual(['xo>=5', 'min2'])
    })

    it('splits none out of what has more than commands, or upper-case ones', () => {
      expect(splitModifiers('X')).toBeUndefined()
      expect(splitModifiers('2r')).toBeUndefined()
      expect(splitModifiers('r!2')).toEqual(['r!2'])
    })
  })

  describe('readModifier', () => {
    it.each([
      ['r', { kind: 'reroll', recursive: false, comparison: '=', target: 1 }],
      ['r2', { kind: 'reroll', recursive: false, comparison: '=', target: 2 }],
      [
        'r<=2',
        { kind: 'reroll', recursive: false, comparison: '<=', target: 2 },
      ],
      [
        'r1=1',
        {
          kind: 'reroll',
          recursive: false,
          most: 1,
          comparison: '=',
          target: 1,
        },
      ],
      ['rr<3', { kind: 'reroll', recursive: true, comparison: '<', target: 3 }],
      ['x', { kind: 'explode', recursive: true, comparison: '=', target: 6 }],
      ['x>4', { kind: 'explode', recursive: true, comparison: '>', target: 4 }],
      ['xo', { kind: 'explode', recursive: false, comparison: '=', target: 6 }],
      ['k', { kind: 'keep', highest: true, count: 1 }],
      ['kh3', { kind: 'keep', highest: true, count: 3 }],
      ['kl', { kind: 'keep', highest: false, count: 1 }],
      ['d', { kind: 'drop', highest: false, count: 1 }],
      ['dh2', { kind: 'drop', highest: true, count: 2 }],
      ['dl', { kind: 'drop', highest: false, count: 1 }],
      ['min3', { kind: 'min', value: 3 }],
      ['min9', { kind: 'min', value: 6 }],
      ['max4', { kind: 'max', value: 4 }],
      ['cs>=5', { kind: 'count', success: true, comparison: '>=', target: 5 }],
      ['cf<3', { kind: 'count', success: false, comparison: '<', target: 3 }],
      ['cs==6', { kind: 'count', success: true, comparison: '=', target: 6 }],
    ])('reads %s of a d6 as Foundry does', (text, read) => {
      expect(readModifier(text, 6)).toEqual(read)
    })

    it.each([
      'ro',
      'sf<3',
      'df<2',
      'ms>=10',
      'even',
      'odd',
      'adv',
      'dis',
      'cs',
      'cf',
      'x>=1',
      'xo<7',
      'rr<=6',
      'kh0',
      'dl0',
      'min',
      'max0',
      'r=<2',
      'r<>2',
    ])('reads no %s', text => {
      expect(readModifier(text, 6)).toBeUndefined()
    })

    it('reads a reroll once that every face meets, which ends', () => {
      expect(readModifier('r<=6', 6)).toMatchObject({ kind: 'reroll' })
    })
  })

  describe('throwTerm', () => {
    it.each<[string, string[], number[], number[], number]>([
      ['a reroll of those at most 2', ['r<=2'], [1, 5], [4], 9],
      ['a reroll of one 1', ['r1=1'], [1, 1], [3], 4],
      ['a reroll again and again', ['rr<3'], [1], [2, 5], 5],
      ['an explosion', ['x'], [6, 3], [6, 2], 17],
      ['an explosion once', ['xo'], [6], [6], 12],
      ['the highest three kept', ['kh3'], [1, 2, 3, 4], [], 9],
      ['the lowest dropped', ['dl'], [4, 1, 4], [], 8],
      ['the lowest kept', ['kl'], [5, 2], [], 2],
      ['each at least 3', ['min3'], [1, 5], [], 8],
      ['each at most 4', ['max4'], [6, 2], [], 6],
      ['successes of 5 or more', ['cs>=5'], [5, 6, 1, 2, 3, 4], [], 2],
      ['failures under 3', ['cf<3'], [1, 2, 6], [], 2],
    ])(
      'works out %s as Foundry does',
      (_name, modifiers, first, more, total) => {
        expect(thrown(modifiers, first, more).total).toBe(total)
      },
    )

    it('rerolls a die once, the one thrown after it in its place, checking only the first throw', () => {
      const once = thrown(['r<=2'], [1, 5], [2])
      expect(once.dice).toEqual([
        { value: 1, active: false, rerolled: true },
        { value: 5, active: true },
        { value: 2, active: true },
      ])
      expect(once.total).toBe(7)
      expect(once.rethrown).toBe(true)
    })

    // More dice to hand than it should take, each matching again: once means once.
    it.each<[string, string[], number[], number[], number, number]>([
      ['a reroll of those at most 2', ['r<=2'], [1, 5], [2, 6], 3, 7],
      ['a reroll of a 1', ['r'], [1], [1, 4], 2, 1],
      ['an explosion', ['xo'], [6], [6, 6], 2, 12],
    ])(
      'throws again only once for %s, though the die thrown again matches too',
      (_name, modifiers, first, more, count, total) => {
        const again = dice(more)
        const once = throwTerm({ sides: 6, modifiers }, first, again)
        expect(once.dice).toHaveLength(count)
        expect(once.total).toBe(total)
        expect(again).toHaveBeenCalledTimes(1)
      },
    )

    it('explodes each die again for one that explodes, keeping both', () => {
      const exploded = thrown(['x'], [6, 3], [6, 2])
      expect(exploded.dice).toEqual([
        { value: 6, active: true, exploded: true },
        { value: 3, active: true },
        { value: 6, active: true, exploded: true },
        { value: 2, active: true },
      ])
      expect(exploded.rethrown).toBe(true)
    })

    it('marks dice dropped, ties in order, and rethrows none', () => {
      // The 1 below the cut, then the first of the 4s tied with it.
      const kept = thrown(['kh2'], [4, 1, 4, 4], [])
      expect(kept.dice.map(({ active }) => active)).toEqual([
        false,
        false,
        true,
        true,
      ])
      expect(kept.dice[0]).toEqual({ value: 4, active: false, discarded: true })
      expect(kept.total).toBe(8)
      const dropped = thrown(['dl'], [4, 1, 4], [])
      expect(dropped.dice[1]).toEqual({
        value: 1,
        active: false,
        discarded: true,
      })
      expect(dropped.rethrown).toBe(false)
    })

    it('drops none where more are to be dropped than there are, as Foundry', () => {
      expect(thrown(['dl5'], [4, 1, 4, 2], []).total).toBe(11)
      expect(thrown(['kh5'], [4, 1], []).total).toBe(5)
    })

    it('works out modifiers in the order written', () => {
      // The 1 is rerolled to a 6, then the highest two kept.
      expect(thrown(['r1', 'kh2'], [1, 3, 2], [6]).total).toBe(9)
      // The highest two kept, then the 1 among them rerolled.
      expect(thrown(['kh2', 'r1'], [1, 1, 2], [6]).total).toBe(8)
    })

    it('counts what a modifier says a die counts, inactive dice none', () => {
      const counted = thrown(['min3'], [1, 5])
      expect(counted.dice).toEqual([
        { value: 1, active: true, counts: 3 },
        { value: 5, active: true },
      ])
    })

    it('rethrows no more than the most a reroll says, nor any after the most a term throws', () => {
      expect(thrown(['r2<=2'], [1, 2, 1], [5, 6]).total).toBe(12)
      const more = dice(Array.from({ length: MOST_THROWN }, () => 6))
      const endless = throwTerm({ sides: 6, modifiers: ['x'] }, [6], more)
      expect(endless.dice).toHaveLength(MOST_THROWN)
      expect(endless.rethrown).toBe(true)
    })

    it('throws nothing more for dice with no modifiers', () => {
      const more = dice([6])
      const plain = throwTerm({ sides: 8 }, [3, 4], more)
      expect(plain).toEqual({
        dice: [
          { value: 3, active: true },
          { value: 4, active: true },
        ],
        total: 7,
        rethrown: false,
      })
      expect(more).not.toHaveBeenCalled()
    })
  })

  describe('unmaximizableDie', () => {
    it.each<[string[], number, boolean]>([
      [['x'], 6, true],
      [['xo>=5'], 6, true],
      [['r6'], 6, true],
      [['r>=5'], 6, true],
      [['r<=2'], 6, false],
      [['rr<3'], 6, false],
      [['kh3'], 6, false],
      [['min3'], 6, false],
      [[], 6, false],
    ])('%j on a d%i: %s', (modifiers, sides, can) => {
      expect(unmaximizableDie({ sides: sides as 6, modifiers })).toBe(can)
    })
  })

  describe('formulaUnmaximizable', () => {
    it.each([
      ['an explosion', '1d6x + 2', true],
      ['an explosion once', '1d6xo', true],
      ['an explosion on every face', '1d6x>=1', true],
      ['an explosion in capitals', '1d6X', true],
      ['an explosion after a keep, run together', '4d6kx', true],
      ['an explosion within brackets', '(1d6x>4) * 2', true],
      ['an explosion among a function’s arguments', 'max(1d6x, 3)', true],
      ['a reroll on the highest face', '2d6r6', true],
      ['a reroll again and again on every face', '1d6rr<=6', true],
      ['a reroll of 1s', '2d6r', false],
      ['a reroll at most 2', '2d6r<=2 + 7', false],
      ['a reroll that may be done no times', '2d6r0<=6', false],
      ['a reroll of one on the highest face', '2d6r1=6', true],
      ['a keep', '4d6kh3', false],
      ['a minimum', '2d6min3', false],
      ['an explosion only in its flavor', '1d6[1d6x]', false],
      ['no dice', '7', false],
    ])('reads %s, %s, as the game does: %s', (_name, formula, refused) => {
      expect(formulaUnmaximizable(formula)).toBe(refused)
    })
  })
})
