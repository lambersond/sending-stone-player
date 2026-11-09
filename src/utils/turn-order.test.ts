import { sortTurnOrder } from './turn-order'
import { combatant } from '@/mocks/sending-stone'

describe('utils/turn-order', () => {
  describe('sortTurnOrder', () => {
    it('sorts by initiative, those yet to roll last, then by name', () => {
      const order = sortTurnOrder([
        combatant({ id: 'a', name: 'Zed', initiative: null }),
        combatant({ id: 'b', name: 'Bree', initiative: 12 }),
        combatant({ id: 'c', name: 'Ann', initiative: 12 }),
        combatant({ id: 'd', name: 'Ann', initiative: 12 }),
        combatant({ id: 'e', name: 'Abe', initiative: null }),
        combatant({ id: 'f', name: 'Kip', initiative: 20 }),
      ])

      expect(order.map(({ id }) => id)).toEqual(['f', 'c', 'd', 'b', 'e', 'a'])
    })
  })
})
