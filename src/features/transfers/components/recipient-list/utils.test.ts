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

describe('features/transfers/recipient-list/utils, everyone ticked together, from module 0.51.0', () => {
  const ORDER: MoveEnd[] = [
    { id: PARTY, name: 'The Iron Company' },
    ...CHARACTERS,
  ]

  it.each<[string, string[], string, string[]]>([
    ['a party ticked with a character', ['bram'], PARTY, [PARTY, 'bram']],
    ['a character ticked, the party kept', [PARTY], 'lia', [PARTY, 'lia']],
    ['the party unticked', [PARTY, 'vex'], PARTY, ['vex']],
  ])('ticks or unticks one: %s', (_name, value, id, picked) => {
    expect(tickedAfter(value, id, ORDER)).toEqual(picked)
  })

  it.each<[string, string[], readonly MoveEnd[], string[]]>([
    [
      'a party ticked, kept where the order holds it',
      [PARTY],
      ORDER,
      [PARTY, 'vex', 'bram', 'lia'],
    ],
    [
      'all ticked with the party: the party alone',
      [PARTY, 'vex', 'bram', 'lia'],
      ORDER,
      [PARTY],
    ],
    [
      'a party ticked, let go where the order is the characters alone',
      [PARTY],
      CHARACTERS,
      ['vex', 'bram', 'lia'],
    ],
  ])('selects all: %s', (_name, value, order, picked) => {
    expect(allTicked(value, CHARACTERS, order)).toEqual(picked)
  })
})
