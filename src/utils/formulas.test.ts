/* eslint-disable unicorn/no-null -- the sheet uses null for a count it doesn't know */
import {
  atFullHitPoints,
  formulaDice,
  formulaTerms,
  hitDiceFormula,
  hitDicePools,
  hitDiceRoll,
  hitDieRoll,
} from './formulas'
import { characterSheet } from '@/mocks/sending-stone'
import type { CharacterSheet, SheetClass } from '@/types/sending-stone'

/** A class with hit dice of this size, this many left of this many. */
const classWith = (
  name: string,
  die: string,
  value: number | null,
  max: number | null,
): SheetClass => ({
  name,
  levels: max,
  subclass: null,
  hitDice: { die, value, max },
})

/** Thorin's sheet, with this Constitution modifier, or none, under these rules. */
const sheetWith = (
  con: number | null,
  rules?: CharacterSheet['rules'],
): CharacterSheet => {
  const sheet = characterSheet({ rules })
  return {
    ...sheet,
    abilities: sheet.abilities.flatMap(ability => {
      if (ability.id !== 'con') return [ability]
      return con === null ? [] : [{ ...ability, mod: con }]
    }),
  }
}

describe('utils/formulas', () => {
  describe('formulaTerms', () => {
    it('reads a formula as the app throws it, term by term, in order', () => {
      expect(formulaTerms('1d4 + 3')).toEqual([
        { sign: 1, count: 1, sides: 4 },
        { sign: 1, flat: 3 },
      ])
      expect(formulaTerms('2d6 − 1d4 - 2')).toEqual([
        { sign: 1, count: 2, sides: 6 },
        { sign: -1, count: 1, sides: 4 },
        { sign: -1, flat: 2 },
      ])
      expect(formulaTerms('15')).toEqual([{ sign: 1, flat: 15 }])
    })

    it.each([
      ['nothing', ''],
      ['blank', ' '.repeat(3)],
      ['a reference to the sheet', '1d4 + @mod'],
      ['a multiplication', '1d4 * 2'],
      ['a die that does not exist', '1d7'],
      ['too many of a die', '21d6'],
      ['terms with nothing between them', '1d4 3'],
      ['in brackets', '(1d6 + 2)'],
      ['a function', 'max(1d6, 3)'],
      ['a d3', '1d3'],
      ['a modifier the app does not work out (ro)', '2d6ro<2'],
      ['an upper-case explosion (X)', '1d6X'],
      ['an upper-case reroll', '2d6R2'],
      ['successes taken away (sf)', '4d6sf<3'],
      ['failures taken away (df)', '4d6cs>4df<2'],
      ['a margin of success (ms)', '1d20ms>=10'],
      ['evens counted', '4d6even'],
      ['odds counted', '4d6odd'],
      ['advantage written as a modifier', '1d20adv'],
      ['disadvantage written as a modifier', '1d20dis'],
      ['successes with no target', '4d6cs'],
      ['failures with no target', '4d6cf'],
      ['an explosion every face meets', '1d6x>=1'],
      ['an explosion once every face meets', '1d6xo<=6'],
      ['a reroll again and again every face meets', '1d6rr<=6'],
      ['keeping none', '4d6kh0'],
      ['dropping none', '4d6d0'],
      ['a minimum without its number', '2d6min'],
      ['a comparison Foundry does not make', '2d6r=<2'],
      ['a modifier after a space', '2d6 r2'],
      ['modifiers run together', '4d6khx'],
    ])("reads no terms of a formula that's %s", (_name, formula) => {
      expect(formulaTerms(formula)).toBeUndefined()
    })

    it('leaves out a flavor after a term, as of fire', () => {
      expect(formulaTerms('2d6[radiant]')).toEqual([
        { sign: 1, count: 2, sides: 6 },
      ])
      expect(formulaTerms('1d8 + 3[slashing] + 1d6 [fire]')).toEqual([
        { sign: 1, count: 1, sides: 8 },
        { sign: 1, flat: 3 },
        { sign: 1, count: 1, sides: 6 },
      ])
    })

    it.each([
      ['a reroll of 1s', '2d6r', ['r']],
      ['a reroll of a number', '2d6r2', ['r2']],
      ['a reroll of those at most a number', '2d6r<=2', ['r<=2']],
      ['a reroll of one of a number', '2d6r1=1', ['r1=1']],
      ['a reroll again and again', '1d6rr<3', ['rr<3']],
      ['an explosion on the highest face', '1d6x', ['x']],
      ['an explosion on a number', '1d10x10', ['x10']],
      ['an explosion above a number', '1d6x>4', ['x>4']],
      ['an explosion once', '1d6xo', ['xo']],
      ['the highest kept', '4d6k', ['k']],
      ['the highest three kept', '4d6kh3', ['kh3']],
      ['the lowest kept', '2d20kl', ['kl']],
      ['the lowest dropped', '4d6d', ['d']],
      ['the highest dropped', '4d6dh1', ['dh1']],
      ['the lowest two dropped', '4d6dl2', ['dl2']],
      ['a minimum', '2d6min3', ['min3']],
      ['a maximum', '2d6max4', ['max4']],
      ['successes', '6d6cs>=5', ['cs>=5']],
      ['failures', '6d6cf<3', ['cf<3']],
      ['successes on a number', '6d6cs6', ['cs6']],
      ['several, in order', '4d6r1kh3', ['r1', 'kh3']],
      ['several with a flavor', '2d6r<=2min2[fire]', ['r<=2', 'min2']],
    ])(
      "reads a die's modifiers as written: %s",
      (_name, formula, modifiers) => {
        const [term] = formulaTerms(formula) ?? []
        expect(term).toMatchObject({ sign: 1, modifiers })
      },
    )

    it('reads a sheet formula with Great Weapon Fighting, its numbers and other dice', () => {
      expect(formulaTerms('2d6r<=2 + 7 + 1d8')).toEqual([
        { sign: 1, count: 2, sides: 6, modifiers: ['r<=2'] },
        { sign: 1, flat: 7 },
        { sign: 1, count: 1, sides: 8 },
      ])
      expect(formulaTerms('2D6r<=2 − 1d4')).toEqual([
        { sign: 1, count: 2, sides: 6, modifiers: ['r<=2'] },
        { sign: -1, count: 1, sides: 4 },
      ])
    })
  })

  describe('formulaDice', () => {
    it('gives the dice a formula throws, in order, and none of its numbers', () => {
      expect(formulaDice('1d4 + 3 + 2d6')).toEqual([
        { sign: 1, count: 1, sides: 4 },
        { sign: 1, count: 2, sides: 6 },
      ])
      expect(formulaDice('1d10 − 1d4')).toEqual([
        { sign: 1, count: 1, sides: 10 },
        { sign: -1, count: 1, sides: 4 },
      ])
    })

    it("counts each die's first throw, as the game is sent it, whatever is thrown again after", () => {
      expect(formulaDice('2d6r<=2 + 1d8 + 1d6x + 4d6kh3')).toEqual([
        { sign: 1, count: 2, sides: 6, modifiers: ['r<=2'] },
        { sign: 1, count: 1, sides: 8 },
        { sign: 1, count: 1, sides: 6, modifiers: ['x'] },
        { sign: 1, count: 4, sides: 6, modifiers: ['kh3'] },
      ])
    })

    it("throws no dice for a formula of numbers alone, and gives none for one it can't read", () => {
      expect(formulaDice('5 + 2')).toEqual([])
      expect(formulaDice('1d4 + @prof')).toBeUndefined()
      expect(formulaDice('')).toBeUndefined()
    })
  })

  describe('hitDicePools', () => {
    it("adds up the hit dice of every class of each size, the largest first, leaving out a class's with none", () => {
      const classes = [
        classWith('Fighter', 'd10', 2, 5),
        classWith('Wizard', 'd6', 1, 2),
        { name: 'Commoner', levels: 1, subclass: null, hitDice: null },
        { name: 'Sage', levels: 1, subclass: null },
        classWith('Paladin', 'd10', 3, 3),
        classWith('Barbarian', 'd12', 0, 1),
      ]
      expect(hitDicePools(classes)).toEqual([
        { die: 'd12', value: 0, max: 1 },
        { die: 'd10', value: 5, max: 8 },
        { die: 'd6', value: 1, max: 2 },
      ])
    })

    it('leaves out a size of hit die the game has none of, which no hit die spent could be', () => {
      expect(
        hitDicePools([
          classWith('Fighter', 'd10', 2, 5),
          classWith('Oddity', 'd3', 1, 1),
          classWith('Mystery', 'x', 1, 1),
        ]),
      ).toEqual([{ die: 'd10', value: 2, max: 5 }])
    })

    it("can't say how many there are of a size when the sheet doesn't say for one of its classes", () => {
      expect(
        hitDicePools([
          classWith('Fighter', 'd10', null, 5),
          classWith('Paladin', 'd10', 3, 3),
          classWith('Ranger', 'd8', 2, null),
          classWith('Rogue', 'd8', 1, 1),
        ]),
      ).toEqual([
        { die: 'd10', value: null, max: 8 },
        { die: 'd8', value: 3, max: null },
      ])
      expect(hitDicePools([classWith('Fighter', 'd10', null, null)])).toEqual([
        { die: 'd10', value: null, max: null },
      ])
    })

    it('has none for a character without classes, or whose classes have no hit dice', () => {
      expect(hitDicePools([])).toEqual([])
      expect(hitDicePools(characterSheet().classes)).toEqual([])
    })
  })

  describe('hitDieRoll', () => {
    it("rolls a hit die and adds the character's Constitution modifier, as healing of at least 1", () => {
      // Thorin's Constitution of 16 adds 3.
      expect(hitDieRoll(characterSheet(), 'd10')).toEqual({
        label: 'Hit die (d10)',
        terms: [
          { sign: 1, count: 1, sides: 10 },
          { sign: 1, flat: 3 },
        ],
        healing: true,
        minimum: 1,
        source: { kind: 'hitDie', denomination: 'd10' },
      })
    })

    it('takes away a negative Constitution modifier, and adds nothing for none', () => {
      expect(hitDieRoll(sheetWith(-2), 'd8').terms).toEqual([
        { sign: 1, count: 1, sides: 8 },
        { sign: -1, flat: 2 },
      ])
      expect(hitDieRoll(sheetWith(0), 'd6').terms).toEqual([
        { sign: 1, count: 1, sides: 6 },
      ])
      // A sheet without Constitution adds nothing either.
      expect(hitDieRoll(sheetWith(null), 'd12').terms).toEqual([
        { sign: 1, count: 1, sides: 12 },
      ])
    })

    it('gives back at least 1 hit point under the 2024 rules, or where the sheet does not say, and at least none under the 2014 rules', () => {
      expect(hitDieRoll(sheetWith(-1, 'modern'), 'd4').minimum).toBe(1)
      expect(hitDieRoll(sheetWith(-1, null), 'd4').minimum).toBe(1)
      expect(hitDieRoll(sheetWith(-1), 'd4').minimum).toBe(1)
      expect(hitDieRoll(sheetWith(-1, 'legacy'), 'd4')).toMatchObject({
        minimum: 0,
        healing: true,
        source: { kind: 'hitDie', denomination: 'd4' },
      })
    })
  })

  describe('hitDiceRoll', () => {
    it('throws hit dice of several sizes together, the largest first, each with Constitution, at least its least', () => {
      // Thorin's Constitution of 16 adds 3 a die.
      expect(
        hitDiceRoll(characterSheet(), [
          { die: 'd8', count: 1 },
          { die: 'd10', count: 2 },
        ]),
      ).toEqual({
        label: 'Hit dice (2d10 + 1d8)',
        terms: [],
        sets: [
          {
            terms: [
              { sign: 1, count: 1, sides: 10 },
              { sign: 1, flat: 3 },
            ],
            times: 2,
          },
          {
            terms: [
              { sign: 1, count: 1, sides: 8 },
              { sign: 1, flat: 3 },
            ],
            times: 1,
          },
        ],
        healing: true,
        minimum: 1,
        source: {
          kind: 'hitDice',
          hitDice: [
            { denomination: 'd10', count: 2 },
            { denomination: 'd8', count: 1 },
          ],
        },
      })
    })

    it('names those of one size by that size, and leaves out a size with none chosen', () => {
      expect(
        hitDiceRoll(sheetWith(-1, 'legacy'), [
          { die: 'd6', count: 0 },
          { die: 'd8', count: 3 },
        ]),
      ).toEqual({
        label: 'Hit dice (3d8)',
        terms: [],
        sets: [
          {
            terms: [
              { sign: 1, count: 1, sides: 8 },
              { sign: -1, flat: 1 },
            ],
            times: 3,
          },
        ],
        healing: true,
        minimum: 0,
        source: {
          kind: 'hitDice',
          hitDice: [{ denomination: 'd8', count: 3 }],
        },
      })
      // With no Constitution modifier, each die alone.
      expect(
        hitDiceRoll(sheetWith(0), [
          { die: 'd12', count: 1 },
          { die: 'd4', count: 1 },
        ]).sets,
      ).toEqual([
        { terms: [{ sign: 1, count: 1, sides: 12 }], times: 1 },
        { terms: [{ sign: 1, count: 1, sides: 4 }], times: 1 },
      ])
    })

    it('leaves one die alone a hit die spent', () => {
      const one = hitDieRoll(characterSheet(), 'd10')
      expect(one).not.toHaveProperty('sets')
      expect(one.source).toEqual({ kind: 'hitDie', denomination: 'd10' })
    })
  })

  describe('hitDiceFormula', () => {
    it.each([
      // Thorin's Constitution of 16 adds 3 a die.
      [characterSheet(), [{ die: 'd10', count: 1 }], '1d10 + 3'],
      [characterSheet(), [{ die: 'd10', count: 3 }], '3d10 + 9'],
      [
        characterSheet(),
        [
          { die: 'd8', count: 1 },
          { die: 'd10', count: 2 },
        ],
        '2d10 + 1d8 + 9',
      ],
      [
        sheetWith(-1),
        [
          { die: 'd6', count: 1 },
          { die: 'd10', count: 2 },
        ],
        '2d10 + 1d6 − 3',
      ],
      [sheetWith(-1), [{ die: 'd10', count: 3 }], '3d10 − 3'],
      [
        sheetWith(0),
        [
          { die: 'd10', count: 2 },
          { die: 'd8', count: 1 },
        ],
        '2d10 + 1d8',
      ],
      [sheetWith(null), [{ die: 'd10', count: 4 }], '4d10'],
      // A size with none chosen is left out; with none at all, nothing.
      [
        characterSheet(),
        [
          { die: 'd12', count: 0 },
          { die: 'd8', count: 2 },
        ],
        '2d8 + 6',
      ],
      [characterSheet(), [{ die: 'd8', count: 0 }], '0'],
    ])('says what spending them gives back: %#', (sheet, counts, formula) => {
      expect(hitDiceFormula(sheet, counts)).toBe(formula)
    })
  })

  describe('atFullHitPoints', () => {
    it.each([
      [{ value: 44, max: 44, temp: 0 }, true],
      // From module 0.17.0, its maximum with a temporary change to it, as dnd5e heals up to, such
      // as 44 lowered to 30 by a wraith's Life Drain.
      [{ value: 30, max: 30, temp: 0 }, true],
      // Above it, where a temporary change raised it, which an older module's sheet leaves out:
      // some may be missing, such as at 42 of 40 raised by 5 to 45.
      [{ value: 49, max: 44, temp: 5 }, false],
      [{ value: 42, max: 40, temp: 0 }, false],
      [{ value: 43, max: 44, temp: 10 }, false],
      [{ value: 0, max: 44, temp: 0 }, false],
      // Without their maximum, or any hit points, it can't say.
      [{ value: 44, max: null, temp: 0 }, false],
      [null, false],
      [undefined, false],
    ])('says whether hit points of %o are full: %s', (hp, full) => {
      expect(atFullHitPoints({ hp })).toBe(full)
    })
  })
})
