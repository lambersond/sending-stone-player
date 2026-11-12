import {
  arrangeEntries,
  entryName,
  movable,
  orderTargets,
  placeShown,
} from './favorite-order'
import { fullerSheet, sheetFavorites } from '@/mocks/sending-stone'
import { favoriteEntries } from '@/utils/favorites'

/** A Fighter made a favorite, by its levels, as the order names it. */
const classNamed = (levels: number | null) =>
  entryName({
    key: 'item:fighter',
    target: { type: 'item', id: 'fighter' },
    kind: 'class',
    entry: { name: 'Fighter', levels, subclass: null },
  })

/** The sheet's favorites as its list shows them, by key. */
const shownKeys = () =>
  favoriteEntries(fullerSheet({ favorites: sheetFavorites() })).map(
    entry => entry.key,
  )

describe('utils/favorite-order, from module 0.47.0', () => {
  it('names every favorite but the old-style resources, in the sheet’s order, an activity by its item', () => {
    expect(orderTargets(sheetFavorites())).toEqual([
      { type: 'item', id: 'warhammer' },
      { type: 'activity', id: 'cast-fireball', item: 'staff' },
      { type: 'effect', id: 'blessed' },
      { type: 'skill', id: 'prc' },
      { type: 'tool', id: 'thief' },
      { type: 'slots', id: 'spell1' },
    ])
  })

  it('puts those moved in the places they held, any not shown keeping its own', () => {
    expect(placeShown(['a', 'hidden', 'b', 'c'], ['c', 'a', 'b'])).toEqual([
      'c',
      'hidden',
      'a',
      'b',
    ])
  })

  it('shows the favorites in an order on its way, the resource first and unmoved', () => {
    const entries = favoriteEntries(
      fullerSheet({ favorites: sheetFavorites() }),
    )
    const [resource, ...rest] = shownKeys()
    expect(movable(entries[0])).toBe(false)
    expect(entries.slice(1).every(entry => movable(entry))).toBe(true)
    const wanted = rest.toReversed()
    expect(arrangeEntries(entries, wanted).map(entry => entry.key)).toEqual([
      resource,
      ...wanted,
    ])
  })

  it('never moves the feature a resource stands for, which shows the resource', () => {
    const entries = favoriteEntries(
      fullerSheet({
        favorites: [
          {
            type: 'resource',
            id: 'secondary',
            name: 'Second Wind',
            uses: { value: 1, max: 1, recovery: 'Short Rest' },
            itemId: 'second-wind',
          },
          { type: 'skill', id: 'prc', name: 'Perception' },
        ],
      }),
    )
    expect(entries.map(entry => [entry.key, movable(entry)])).toEqual([
      ['item:second-wind', false],
      ['skill:prc', true],
    ])
  })

  it('names a class as its row does, by its levels where it has them', () => {
    expect([classNamed(5), classNamed(null)]).toEqual(['Fighter 5', 'Fighter'])
  })
})
