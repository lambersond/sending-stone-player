import {
  labelAt,
  offeredSummons,
  placingOf,
  summonAria,
  summonLabels,
} from './summons'
import { summonProfile, summonUse } from '@/mocks/sending-stone'

const cr = (value: string) => `Challenge Rating of ${value} or lower`

/** Conjure Animals' first two creatures, as the module sends them: twice as many at the 5th. */
const animals = [
  summonProfile('caCr2', cr('2'), {
    count: '1',
    higher: [{ level: 5, name: cr('2'), count: '2' }],
  }),
  summonProfile('caCr1', cr('1'), {
    count: '2',
    higher: [{ level: 5, name: cr('1'), count: '4' }],
  }),
]

describe('utils/summons', () => {
  it.each<[string, number | null, number | null, number | null, boolean]>([
    ['within its limits', 3, 5, 4, true],
    ['below its lowest', 3, 5, 2, false],
    ['above its highest', 3, 5, 6, false],
    ['from a level on', 3, null, 9, true],
    ['up to a level', null, 3, 1, true],
    ['with no limits, at any level', null, null, 7, true],
    ['with no limits, at a level not known', null, null, null, true],
    ['with limits, at a level not known', 3, null, null, false],
  ])('offers a creature %s', (_name, min, max, level, offered) => {
    const summon = summonUse('s', {
      profiles: [summonProfile('p', 'Air', { min, max })],
    }).summon!
    expect(offeredSummons(summon, level).length > 0).toBe(offered)
  })

  it('writes a creature as dnd5e does at a level above its own where it says so, else at its own', () => {
    expect(labelAt(animals[0], 5)).toEqual({ name: cr('2'), count: '2' })
    expect(labelAt(animals[0], 4)).toEqual({ name: cr('2'), count: '1' })
    expect(labelAt(animals[0], 3)).toEqual({ name: cr('2'), count: '1' })
  })

  it.each<[string, Parameters<typeof summonLabels>, string[]]>([
    [
      'names alone where none has a number',
      [[summonProfile('b', 'Bat'), summonProfile('o', 'Owl')], 1],
      ['Bat', 'Owl'],
    ],
    [
      'numbers kept where they differ',
      [
        [
          summonProfile('w', 'Wolf', { count: '2' }),
          summonProfile('o', 'Owl', { count: '1' }),
        ],
        1,
      ],
      ['2 × Wolf', '1 × Owl'],
    ],
    [
      '"1 × " dropped where every one is one',
      [
        [
          summonProfile('w', 'Wolf', { count: '1' }),
          summonProfile('o', 'Owl', { count: '1' }),
        ],
        1,
      ],
      ['Wolf', 'Owl'],
    ],
    [
      'a number dnd5e works out on the table',
      [[summonProfile('w', 'Wolf', { count: '1d4' })], 1],
      ['1d4 × Wolf'],
    ],
    [
      'Conjure Animals at the 3rd',
      [animals, 3],
      [`1 × ${cr('2')}`, `2 × ${cr('1')}`],
    ],
    [
      'Conjure Animals at the 5th',
      [animals, 5],
      [`2 × ${cr('2')}`, `4 × ${cr('1')}`],
    ],
  ])('labels creatures: %s', (_name, args, labels) => {
    expect(summonLabels(...args)).toEqual(labels)
  })

  it.each<[Parameters<typeof summonAria>[0], string]>([
    [{ name: 'Owl', count: null }, 'Owl'],
    [{ name: 'Owl', count: '1' }, 'Owl'],
    [{ name: 'Wolf', count: '2' }, 'Wolf, 2 of them'],
    [{ name: 'Wolf', count: '1d4' }, 'Wolf, 1d4 of them'],
  ])('tells a screen reader %j as %s', (label, aria) => {
    expect(summonAria(label)).toBe(aria)
  })

  it.each<[string | null, 'one' | 'many']>([
    ['1', 'one'],
    [null, 'one'],
    ['2', 'many'],
    ['1d4', 'many'],
  ])('places a creature of count %s as %s', (count, placing) => {
    expect(placingOf(summonProfile('w', 'Wolf', { count }), 1)).toBe(placing)
  })

  it('places as many as the level cast at summons', () => {
    expect(placingOf(animals[0], 3)).toBe('one')
    expect(placingOf(animals[0], 5)).toBe('many')
  })
})
