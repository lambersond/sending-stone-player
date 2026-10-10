/* eslint-disable unicorn/no-null -- the sheet uses null for a count it doesn't know */
import {
  atFullHitPoints,
  formulaDice,
  formulaTerms,
  hitDicePools,
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
    ])("reads no terms of a formula that's %s", (_name, formula) => {
      expect(formulaTerms(formula)).toBeUndefined()
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

  describe('atFullHitPoints', () => {
    it.each([
      [{ value: 44, max: 44, temp: 0 }, true],
      // Above it, where a temporary change raised it, which the sheet leaves out: some may be
      // missing, such as at 42 of 40 raised by 5 to 45.
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
