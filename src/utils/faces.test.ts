import { faceComplete, faceOf, facePrefix, faceRule } from './faces'
import type { DiceEntrySides } from '@/types/dice-entry'

const SIDES: DiceEntrySides[] = [4, 6, 8, 10, 12, 20, 100]

describe('utils/faces', () => {
  describe('faceOf', () => {
    it.each(SIDES)('reads every face of a d%d as typed', sides => {
      for (let face = 1; face <= sides; face += 1) {
        expect(faceOf(String(face), sides)).toBe(face)
      }
    })

    it.each([
      [4, '5'],
      [6, '7'],
      [8, '9'],
      [10, '11'],
      [12, '13'],
      [20, '21'],
      [100, '101'],
    ] as const)('refuses 0 and one more than a d%d shows', (sides, over) => {
      if (sides !== 10) expect(faceOf('0', sides)).toBeUndefined()
      expect(faceOf(over, sides)).toBeUndefined()
    })

    it("reads a d10's 0 as 10, as the die marks it", () => {
      expect(faceOf('0', 10)).toBe(10)
      expect(faceOf('10', 10)).toBe(10)
      expect(faceOf('00', 10)).toBeUndefined()
      expect(faceOf('01', 10)).toBeUndefined()
    })

    it("reads a d100's 00 as 100 and a leading 0 as its ones", () => {
      expect(faceOf('00', 100)).toBe(100)
      expect(faceOf('100', 100)).toBe(100)
      expect(faceOf('05', 100)).toBe(5)
      expect(faceOf('09', 100)).toBe(9)
      expect(faceOf('0', 100)).toBeUndefined()
      expect(faceOf('000', 100)).toBeUndefined()
      expect(faceOf('010', 100)).toBeUndefined()
      expect(faceOf('101', 100)).toBeUndefined()
    })

    it('refuses a leading zero on any other die, and anything but digits', () => {
      expect(faceOf('0', 6)).toBeUndefined()
      expect(faceOf('05', 6)).toBeUndefined()
      expect(faceOf('7', 6)).toBeUndefined()
      expect(faceOf('21', 20)).toBeUndefined()
      expect(faceOf('05', 20)).toBeUndefined()
      expect(faceOf('1a', 20)).toBeUndefined()
      expect(faceOf('', 20)).toBeUndefined()
      expect(faceOf(' 5', 20)).toBeUndefined()
      expect(faceOf('-1', 20)).toBeUndefined()
      expect(faceOf('1000', 100)).toBeUndefined()
    })
  })

  // For each die, what's typed: whether some digits more could make it a face, and whether it's a
  // face no digit more could change.
  const TABLES: Record<DiceEntrySides, [string, boolean, boolean][]> = {
    4: [
      ['', true, false],
      ['0', false, false],
      ['1', false, true],
      ['4', false, true],
      ['5', false, false],
    ],
    6: [
      ['', true, false],
      ['0', false, false],
      ['1', false, true],
      ['6', false, true],
      ['7', false, false],
      ['05', false, false],
    ],
    8: [
      ['', true, false],
      ['1', false, true],
      ['8', false, true],
      ['9', false, false],
    ],
    10: [
      ['', true, false],
      ['0', false, true],
      ['1', true, false],
      ['2', false, true],
      ['9', false, true],
      ['10', false, true],
      ['11', false, false],
    ],
    12: [
      ['', true, false],
      ['0', false, false],
      ['1', true, false],
      ['2', false, true],
      ['9', false, true],
      ['10', false, true],
      ['12', false, true],
      ['13', false, false],
    ],
    20: [
      ['', true, false],
      ['0', false, false],
      ['1', true, false],
      ['2', true, false],
      ['3', false, true],
      ['9', false, true],
      ['10', false, true],
      ['19', false, true],
      ['20', false, true],
      ['21', false, false],
      ['05', false, false],
    ],
    100: [
      ['', true, false],
      ['0', true, false],
      ['00', false, true],
      ['05', false, true],
      ['1', true, false],
      ['9', true, false],
      ['10', true, false],
      ['11', false, true],
      ['99', false, true],
      ['100', false, true],
      ['101', false, false],
      ['000', false, false],
      ['1a', false, false],
    ],
  }

  describe.each(SIDES)('a d%d', sides => {
    it.each(TABLES[sides])(
      'takes %p as a start %p and complete %p',
      (text, prefix, complete) => {
        expect(facePrefix(text, sides)).toBe(prefix)
        expect(faceComplete(text, sides)).toBe(complete)
      },
    )
  })

  it.each([4, 6, 8] as const)(
    'has every face of a d%d complete at once',
    sides => {
      for (let face = 1; face <= sides; face += 1) {
        expect(faceComplete(String(face), sides)).toBe(true)
      }
    },
  )

  it("has a d100's one digits wait for a second, and every two-digit face from 11 complete", () => {
    for (let face = 1; face <= 9; face += 1) {
      expect(faceComplete(String(face), 100)).toBe(false)
      expect(faceComplete(`0${face}`, 100)).toBe(true)
    }
    for (let face = 11; face <= 99; face += 1) {
      expect(faceComplete(String(face), 100)).toBe(true)
    }
  })

  it.each([
    [4, 'A d4 shows 1 to 4.'],
    [6, 'A d6 shows 1 to 6.'],
    [8, 'A d8 shows 1 to 8.'],
    [10, 'A d10 shows 1 to 10. Type 0 for 10.'],
    [12, 'A d12 shows 1 to 12.'],
    [20, 'A d20 shows 1 to 20.'],
    [100, 'A d100 shows 1 to 100. Type 00 for 100.'],
  ] as const)('says what a d%d shows', (sides, rule) => {
    expect(faceRule(sides)).toBe(rule)
  })
})
