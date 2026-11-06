/**
 * @jest-environment node
 */
import { seenQuery } from './seen-query'

describe('utils/seen-query', () => {
  it.each([
    ['nothing held', {}, ''],
    ['a cookbook card: its version alone', { version: 'v7' }, 'version=v7'],
    [
      'a book of notes: its version and whether it was live',
      { version: 3, live: false },
      'version=3&live=0',
    ],
    [
      'a party sheet: moves and its sheet after them',
      { version: 2, live: true, moves: true, sheet: 's9' },
      'version=2&live=1&moves=1&sheet=s9',
    ],
    [
      'a companion: unset ones left out',
      {
        version: 4,
        live: true,
        rolls: '',
        gm: undefined,
        gmrolls: 'g1',
        typed: false,
        sheet: undefined,
      },
      'version=4&live=1&gmrolls=g1',
    ],
    [
      'every one, given in another order, sent in the table’s',
      {
        sheet: 's1',
        hitpoints: true,
        wildshape: true,
        effects: true,
        favorites: true,
        removes: true,
        typed: true,
        moves: true,
        gmrolls: 'g2',
        gm: 'made',
        rolls: 'r3',
        live: true,
        version: 12,
      },
      // Changed on purpose (v0.44): hit points, from module 0.44.0, after Wild Shape.
      'version=12&live=1&rolls=r3&gm=made&gmrolls=g2&moves=1&typed=1&removes=1&favorites=1&effects=1&wildshape=1&hitpoints=1&sheet=s1',
    ],
  ])('%s', (_, seen, query) => {
    expect(seenQuery(seen).toString()).toBe(query)
  })
})
