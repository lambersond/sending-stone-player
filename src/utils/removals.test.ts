/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { checkRemoval, relatedItems, removalsAvailable } from './removals'
import { removalInventory } from '@/mocks/sending-stone'

/** Thorin's sheet, as last sent. */
const sheet = { inventory: removalInventory() }
/** A removal of so many of an item, the page having shown so many. */
const removal = (item: string, quantity: number, held = quantity) => ({
  item,
  quantity,
  held,
})

describe('utils/removals', () => {
  describe('removalsAvailable', () => {
    const now = Date.parse('2026-10-22T12:00:00Z')
    const polled = (ago: number) => new Date(now - ago)

    it('is so while the module removes items and is fetching', () => {
      expect(
        removalsAvailable(
          { removalsEnabled: true, bridgePolledAt: polled(5000) },
          now,
        ),
      ).toBe(true)
    })

    it.each([
      ['the module removes none', false, polled(5000)],
      ['the module stopped fetching', true, polled(46_000)],
      ['the module never fetched', true, null],
    ])('is not so where %s', (_name, removalsEnabled, bridgePolledAt) => {
      expect(removalsAvailable({ removalsEnabled, bridgePolledAt }, now)).toBe(
        false,
      )
    })
  })

  describe('checkRemoval', () => {
    it.each([
      ['an item at the top', removal('ropeThorin01', 1)],
      ['part of a stack', removal('potionThorin', 2, 3)],
      ['all of a stack', removal('potionThorin', 3)],
      ['an item in a container', removal('bedrollThorn', 1)],
      ['an item in a container in a container', removal('gemThorin001', 1)],
      ['a container', removal('backpackThor', 1)],
      ['a container whose contents are secret', removal('chestThorin1', 1)],
      ['none of a stack of none', removal('arrowsThorin', 0)],
    ])('takes %s', (_name, remove) => {
      expect(checkRemoval(remove, sheet)).toBeUndefined()
    })

    it('refuses an item not on the sheet, or no sheet at all, as gone', () => {
      expect(checkRemoval(removal('wandOfMagic1', 1), sheet)).toBe('gone')
      // eslint-disable-next-line unicorn/no-useless-undefined -- a character with no sheet yet
      expect(checkRemoval(removal('ropeThorin01', 1), undefined)).toBe('gone')
      expect(checkRemoval(removal('ropeThorin01', 1), {})).toBe('gone')
    })

    it('refuses more than the sheet holds as short, before anything else', () => {
      expect(checkRemoval(removal('potionThorin', 4), sheet)).toBe('short')
      expect(checkRemoval(removal('potionThorin', 4, 5), sheet)).toBe('short')
    })

    it('refuses a stack that isn’t as many as the page showed as changed', () => {
      // Part of it as the page had it, all of it now: never all of it.
      const fewer = {
        inventory: {
          ...removalInventory(),
          sections: removalInventory().sections.map(section => ({
            ...section,
            items: section.items.map(item =>
              item.id === 'potionThorin' ? { ...item, quantity: 2 } : item,
            ),
          })),
        },
      }
      expect(checkRemoval(removal('potionThorin', 2, 3), fewer)).toBe('changed')
      // None of a stack of none, which holds one now.
      expect(checkRemoval(removal('ropeThorin01', 0, 0), sheet)).toBe('changed')
      // Fewer than the page showed of a stack that holds more now.
      expect(checkRemoval(removal('potionThorin', 1, 2), sheet)).toBe('changed')
    })
  })

  describe('relatedItems', () => {
    it('is the item alone, at the top', () => {
      expect([...relatedItems(sheet, 'ropeThorin01')]).toEqual(['ropeThorin01'])
    })

    it('is a contained item and every container it’s in', () => {
      expect([...relatedItems(sheet, 'gemThorin001')].toSorted()).toEqual(
        ['backpackThor', 'gemThorin001', 'pouchThorin1'].toSorted(),
      )
    })

    it('is a container and everything in it, however deep', () => {
      expect([...relatedItems(sheet, 'backpackThor')].toSorted()).toEqual(
        [
          'backpackThor',
          'bedrollThorn',
          'gemThorin001',
          'pouchThorin1',
        ].toSorted(),
      )
      expect([...relatedItems(sheet, 'pouchThorin1')].toSorted()).toEqual(
        ['backpackThor', 'gemThorin001', 'pouchThorin1'].toSorted(),
      )
    })

    it('is a container whose contents are secret alone', () => {
      expect([...relatedItems(sheet, 'chestThorin1')]).toEqual(['chestThorin1'])
    })

    it('is nothing for an item not on the sheet, or no sheet', () => {
      expect(relatedItems(sheet, 'wandOfMagic1').size).toBe(0)
      expect(relatedItems(undefined, 'ropeThorin01').size).toBe(0)
    })
  })
})
