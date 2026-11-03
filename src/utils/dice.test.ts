/**
 * @jest-environment node
 */
import { isDieSides } from './dice'

describe('utils/dice', () => {
  it.each([
    [4, true],
    [6, true],
    [8, true],
    [10, true],
    [12, true],
    [20, true],
    [100, true],
    [0, false],
    [1, false],
    [3, false],
    [7, false],
    [16, false],
    [-4, false],
    [4.5, false],
    [Number.NaN, false],
  ])('takes a die of %p faces as one the dice throw: %p', (faces, is) => {
    expect(isDieSides(faces)).toBe(is)
  })
})
