/**
 * @jest-environment node
 */
import {
  clampDraft,
  editorLine,
  hitPointsEdit,
  mostOf,
  movedFrom,
  tileName,
} from './utils'
import type { HitPointsNow } from '@/types/sending-stone'

/** Thorin before the GM's fall: 22 of 30, 3 temporary. */
const THORIN: HitPointsNow = { value: 22, max: 30, temp: 3 }

describe('features/sheet/components/hit-points-editor/utils', () => {
  it.each([
    ['hit points, to their maximum', 'value', THORIN, 30],
    [
      'hit points with no maximum, to 9999',
      'value',
      { ...THORIN, max: null },
      9999,
    ],
    [
      'hit points above their maximum, to what they are',
      'value',
      { ...THORIN, value: 34 },
      34,
    ],
    ['temporary ones, to 9999', 'temp', THORIN, 9999],
  ] as const)('takes %s', (_name, key, hp, most) => {
    expect(mostOf(key, hp)).toBe(most)
  })

  it.each([
    ['a number within', '21', 21],
    ['0', '0', 0],
    ['one above the most, as the most', '35', 30],
    ['nothing typed, as it was', '', 22],
  ])('reads %s', (_name, text, number) => {
    expect(clampDraft(text, 22, 30)).toBe(number)
  })

  it.each([
    ['nothing changed', { value: 22, temp: 3 }, undefined],
    [
      'hit points alone',
      { value: 18, temp: 3 },
      { op: 'set', value: 18, from: { value: 22 } },
    ],
    [
      'temporary ones alone',
      { value: 22, temp: 0 },
      { op: 'set', temp: 0, from: { temp: 3 } },
    ],
    [
      'both, the GM’s fall of 4',
      { value: 21, temp: 0 },
      { op: 'set', value: 21, temp: 0, from: { value: 22, temp: 3 } },
    ],
  ])('sends %s', (_name, wanted, change) => {
    expect(hitPointsEdit(THORIN, wanted)).toEqual(change)
  })

  const NO_MAX: HitPointsNow = { ...THORIN, max: null }
  it.each([
    ['as they are', THORIN, undefined, false, 'Now 22 / 30 · 3 temporary'],
    ['with no maximum', NO_MAX, undefined, false, 'Now 22 · 3 temporary'],
    [
      'reset, as the game changed them',
      THORIN,
      undefined,
      true,
      'Changed in the game: now 22 / 30 · 3 temporary',
    ],
    [
      'both changed',
      THORIN,
      { op: 'set', value: 21, temp: 0, from: { value: 22, temp: 3 } },
      true,
      '22 → 21 · temporary 3 → 0',
    ],
    [
      'hit points changed',
      THORIN,
      { op: 'set', value: 18, from: { value: 22 } },
      false,
      '22 → 18',
    ],
    [
      'temporary ones changed',
      THORIN,
      { op: 'set', temp: 5, from: { temp: 3 } },
      false,
      'Temporary 3 → 5',
    ],
  ] as const)('says them %s', (_name, hp, change, rebased, line) => {
    expect(editorLine(hp, change, rebased)).toBe(line)
  })

  it.each([
    [THORIN, 'Hit points: 22 of 30, 3 temporary. Change hit points'],
    [{ ...THORIN, temp: 0 }, 'Hit points: 22 of 30. Change hit points'],
    [
      { ...THORIN, max: null },
      'Hit points: 22, 3 temporary. Change hit points',
    ],
  ])('names the tile of %j "%s"', (hp, name) => {
    expect(tileName(hp)).toBe(name)
  })

  it.each([
    [THORIN, false],
    [{ ...THORIN, value: 15 }, true],
    [{ ...THORIN, temp: 0 }, true],
    [{ ...THORIN, max: 32 }, true],
  ])('tells %j moved: %s', (hp, moved) => {
    expect(movedFrom(hp, THORIN)).toBe(moved)
  })
})
