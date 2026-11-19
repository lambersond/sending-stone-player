import { allTicked, everyTicked, tickedAfter } from './utils'
import type { MoveEnd } from '@/features/transfers/types'

const PARTY = 'groupIronCo01'
/** The campaign's other characters, in its roster's order. */
const CHARACTERS: MoveEnd[] = ['vex', 'bram', 'lia'].map(id => ({
  id,
  name: id,
}))

describe('features/transfers/recipient-list/utils, from module 0.49.0', () => {
  it.each<[string, string[], string, string[]]>([
    ['the first ticked', [], 'lia', ['lia']],
    [
      'in the list’s order, whatever order they’re ticked in',
      ['lia'],
      'vex',
      ['vex', 'lia'],
    ],
    ['one unticked', ['vex', 'bram', 'lia'], 'bram', ['vex', 'lia']],
    ['the last unticked', ['bram'], 'bram', []],
    ['a party chosen let go', [PARTY], 'bram', ['bram']],
  ])('ticks or unticks a character: %s', (_name, value, id, picked) => {
    expect(tickedAfter(value, id, CHARACTERS)).toEqual(picked)
  })

  it.each<[string, string[], string[]]>([
    ['none ticked: all of them', [], ['vex', 'bram', 'lia']],
    ['some ticked: all of them', ['lia'], ['vex', 'bram', 'lia']],
    [
      'a party chosen: all of them, the party let go',
      [PARTY],
      ['vex', 'bram', 'lia'],
    ],
    ['all ticked: none', ['vex', 'bram', 'lia'], []],
  ])('selects all: %s', (_name, value, picked) => {
    expect(allTicked(value, CHARACTERS)).toEqual(picked)
    expect(everyTicked(picked, CHARACTERS)).toBe(picked.length > 0)
  })

  it('never has every one of none ticked', () => {
    expect(everyTicked([], [])).toBe(false)
  })
})
