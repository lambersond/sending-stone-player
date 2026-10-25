/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  checkFavorite,
  favoritesAvailable,
  isFavorite,
  targetKey,
} from './favorite-commands'
import { fullerSheet, sheetFavorites } from '@/mocks/sending-stone'
import type { FavoriteInput, FavoriteTarget } from '@/types/roll'
import type { SheetFavorite } from '@/types/sending-stone'

const NOW = Date.parse('2026-10-26T12:00:00Z')

/** One of an item's activities made a favorite, by its own id and its item's. */
const activityFavorite = (itemId: string, id: string): SheetFavorite => ({
  type: 'activity',
  id,
  itemId,
  itemType: 'weapon',
  itemName: itemId,
  name: id,
  img: null,
  activation: null,
  range: null,
  target: null,
  toHit: null,
  save: null,
  damage: [],
  uses: null,
})

const add = (target: FavoriteTarget): FavoriteInput => ({
  ...target,
  op: 'add',
})

describe('utils/favorite-commands, from module 0.37.0', () => {
  describe('favoritesAvailable', () => {
    it('is so while the module takes favorites and is fetching', () => {
      const polled = new Date(NOW - 5000)
      expect(
        favoritesAvailable(
          { favoritesEnabled: true, bridgePolledAt: polled },
          NOW,
        ),
      ).toBe(true)
      expect(
        favoritesAvailable(
          { favoritesEnabled: false, bridgePolledAt: polled },
          NOW,
        ),
      ).toBe(false)
      expect(
        favoritesAvailable(
          { favoritesEnabled: true, bridgePolledAt: new Date(NOW - 46_000) },
          NOW,
        ),
      ).toBe(false)
      expect(
        favoritesAvailable({ favoritesEnabled: true, bridgePolledAt: null }),
      ).toBe(false)
    })
  })

  describe('targetKey', () => {
    it('keys an activity by its item and its own id, as the favorites’ entries do', () => {
      const wandA = targetKey({ type: 'activity', id: 'same', item: 'wandA' })
      const wandB = targetKey({ type: 'activity', id: 'same', item: 'wandB' })
      expect(wandA).toBe('activity:wandA.same')
      expect(wandB).toBe('activity:wandB.same')
      expect(wandA).not.toBe(wandB)
    })

    it.each([
      [{ type: 'item', id: 'rope' }, 'item:rope'],
      [{ type: 'effect', id: 'cloak.protect' }, 'effect:cloak.protect'],
      [{ type: 'skill', id: 'prc' }, 'skill:prc'],
      [{ type: 'tool', id: 'thief' }, 'tool:thief'],
      [{ type: 'slots', id: 'spell1' }, 'slots:spell1'],
    ] as [FavoriteTarget, string][])('keys %j as %s', (target, key) => {
      expect(targetKey(target)).toBe(key)
    })
  })

  describe('isFavorite', () => {
    const favorites = [...sheetFavorites(), activityFavorite('wandA', 'same')]

    it.each([
      [{ type: 'item', id: 'warhammer' }, true],
      [{ type: 'item', id: 'handaxe' }, false],
      // An effect of the same id isn't an item, nor the other way about.
      [{ type: 'effect', id: 'warhammer' }, false],
      [{ type: 'effect', id: 'blessed' }, true],
      [{ type: 'skill', id: 'prc' }, true],
      [{ type: 'tool', id: 'thief' }, true],
      [{ type: 'slots', id: 'spell1' }, true],
      [{ type: 'activity', id: 'cast-fireball', item: 'staff' }, true],
      [{ type: 'activity', id: 'same', item: 'wandA' }, true],
      // The same activity id, on another item.
      [{ type: 'activity', id: 'same', item: 'wandB' }, false],
      [{ type: 'activity', id: 'cast-fireball', item: 'wandA' }, false],
      // An item whose activity is a favorite isn't one itself.
      [{ type: 'item', id: 'staff' }, false],
    ] as [FavoriteTarget, boolean][])('says of %j: %s', (target, expected) => {
      expect(isFavorite(target, favorites)).toBe(expected)
    })

    it('says none of a resource’s, which the app never offers', () => {
      expect(isFavorite({ type: 'item', id: 'primary' }, favorites)).toBe(false)
    })
  })

  describe('checkFavorite', () => {
    const sheet = fullerSheet()

    it.each([
      ['an action', add({ type: 'item', id: 'warhammer' })],
      ['a spell', add({ type: 'item', id: 'shield' })],
      ['something carried, in a container', add({ type: 'item', id: 'rope' })],
      ['something in a pouch in a backpack', add({ type: 'item', id: 'coin' })],
      ['a feature', add({ type: 'item', id: 'darkvision' })],
      ['a class', add({ type: 'item', id: 'fighter' })],
      [
        'an activity, by its item',
        add({ type: 'activity', id: 'zap', item: 'warhammer' }),
      ],
      ['an effect', add({ type: 'effect', id: 'blessed' })],
      ['a skill', add({ type: 'skill', id: 'prc' })],
      ['a tool, for the game to check', add({ type: 'tool', id: 'nope' })],
      ['spell slots, for the game to check', add({ type: 'slots', id: 'x' })],
    ])('takes an Add of %s', (_name, favorite) => {
      expect(checkFavorite(favorite, sheet)).toBeUndefined()
    })

    it.each([
      ['an item', add({ type: 'item', id: 'gone' })],
      [
        "an activity of an item's gone",
        add({ type: 'activity', id: 'zap', item: 'gone' }),
      ],
      ['an effect', add({ type: 'effect', id: 'gone' })],
      ['a skill', add({ type: 'skill', id: 'xyz' })],
    ])('refuses an Add of %s the sheet lacks as gone', (_name, favorite) => {
      expect(checkFavorite(favorite, sheet)).toBe('gone')
    })

    it('refuses any Add with no sheet held, and never a Remove', () => {
      expect(checkFavorite(add({ type: 'tool', id: 'thief' }))).toBe('gone')
      expect(
        checkFavorite({ op: 'remove', type: 'item', id: 'gone' }),
      ).toBeUndefined()
      expect(
        checkFavorite({ op: 'remove', type: 'effect', id: 'gone' }, sheet),
      ).toBeUndefined()
    })
  })
})
