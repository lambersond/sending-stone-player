import { toFormulaRequest } from './request-bodies'
import type {
  LocalFormula,
  PlainRollInput,
  SheetFormulaRoll,
} from '@/types/roll'

// A plain roll (module 0.44.0) as the game is asked to make it: its dice by size and the number
// added, then each size's dice as thrown, in the same order; the number throws none.

const plainRoll: PlainRollInput = {
  terms: [
    { faces: 6, count: 2 },
    { faces: 8, count: 1 },
  ],
  bonus: 2,
}
const roll: SheetFormulaRoll = {
  label: 'Dice (2d6 + 1d8 + 2)',
  terms: [
    { sign: 1, count: 2, sides: 6 },
    { sign: 1, count: 1, sides: 8 },
    { sign: 1, flat: 2 },
  ],
  source: { kind: 'plainRoll', plainRoll },
}
const rolled = (fields: Partial<LocalFormula> = {}): LocalFormula => ({
  kind: 'formula',
  id: 'f-1',
  label: roll.label,
  total: 17,
  healing: false,
  terms: [
    { text: '2d6', values: [3, 5], value: 8 },
    { text: '+1d8', values: [7], value: 7 },
    { text: '+2', values: [], value: 2 },
  ],
  at: 0,
  ...fields,
})

describe('features/rolling/utils/request-bodies, a plain roll', () => {
  it('asks the game for the dice picked, as thrown, in their order', () => {
    expect(
      toFormulaRequest(roll, { kind: 'plainRoll', plainRoll }, rolled()),
    ).toEqual({
      kind: 'plainRoll',
      plainRoll,
      mode: 0,
      explicit: false,
      extras: [],
      dice: [
        { faces: 6, results: [3, 5] },
        { faces: 8, results: [7] },
      ],
    })
  })

  it('says its dice were typed in, and their rerolls kept, as any roll', () => {
    expect(
      toFormulaRequest(
        roll,
        { kind: 'plainRoll', plainRoll },
        rolled({ typed: true, rerolls: 'kept' }),
      ),
    ).toMatchObject({ typed: true, rerolls: 'kept' })
  })
})
