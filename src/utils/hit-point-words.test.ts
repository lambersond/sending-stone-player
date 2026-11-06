/**
 * @jest-environment node
 */
import {
  hitPointsLine,
  hitPointsNowWords,
  hitPointsReasons,
  hitPointsWords,
} from './hit-point-words'

describe('utils/hit-point-words', () => {
  it.each([
    [
      'both',
      { value: 21, temp: 0, from: { value: 22, temp: 3 } },
      'Hit points 22 → 21 · temporary 3 → 0',
    ],
    [
      'hit points alone',
      { value: 18, from: { value: 22 } },
      'Hit points 22 → 18',
    ],
    [
      'temporary ones alone',
      { temp: 5, from: { temp: 0 } },
      'Temporary hit points 0 → 5',
    ],
  ])('says the change asked of %s', (_name, logged, line) => {
    expect(hitPointsLine(logged)).toBe(line)
  })

  it.each([
    [{ value: 21, temp: 0, max: 30 }, undefined, 'Hit points now 21 / 30'],
    [
      { value: 21, temp: 3, max: 30 },
      undefined,
      'Hit points now 21 / 30 · 3 temporary',
    ],
    [{ value: 7, temp: 0, max: 11 }, 'Wolf', 'Wolf’s hit points now 7 / 11'],
    [{ value: 12, temp: 0, max: null }, undefined, 'Hit points now 12'],
    [undefined, undefined, 'Hit points set'],
    [undefined, 'Wolf', 'Wolf’s hit points set'],
  ])('says %j, of %s, as %s', (now, name, words) => {
    expect(hitPointsNowWords(now, name)).toBe(words)
  })

  it('words the way: setting, made as the game says, and not, the character’s or a companion’s', () => {
    expect(hitPointsWords({ value: 21, temp: 0, max: 30 })).toEqual({
      doing: 'Setting it',
      done: 'Hit points now 21 / 30',
      not: 'Couldn’t set your hit points',
    })
    expect(hitPointsWords(undefined, 'Wolf').not).toBe(
      'Couldn’t set Wolf’s hit points',
    )
  })

  it('says why they weren’t set where it differs from a roll, leaving a companion gone to its own words', () => {
    expect(hitPointsReasons('player')).toEqual({
      off: 'your Gamemaster’s game doesn’t take hit points from here now',
      unavailable:
        'your Gamemaster’s game doesn’t take hit points from here now',
      changed: 'they changed in Foundry; look again',
      cancelled: 'a module in Foundry stopped it',
      moving: 'a change to these hit points is still on its way',
    })
    expect(hitPointsReasons('player')).not.toHaveProperty('unknown')
  })
})
