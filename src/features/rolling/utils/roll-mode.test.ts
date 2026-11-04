import { toAdvantage } from './roll-mode'

describe('utils/roll-mode', () => {
  it.each([
    [1, 'adv'],
    [2, 'adv'],
    [0, undefined],
    [-1, 'dis'],
  ])('rolls mode %d with %s', (mode, advantage) => {
    expect(toAdvantage(mode)).toBe(advantage)
  })
})
