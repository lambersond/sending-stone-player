import { amountsTyped } from './utils'
import { purse } from '@/mocks/sending-stone'

describe('features/transfers/coin-amounts/utils', () => {
  describe('amountsTyped', () => {
    /** A purse with 3 gp alone: what's typed isn't held to it. */
    const currency = purse({ gp: 3 })

    it.each([
      ['nothing', {}, undefined],
      ['none of any', { gp: '0', sp: '' }, undefined],
      ['one coin', { gp: '5' }, { gp: 5 }],
      [
        'several, one of a coin kept and those with none left out',
        { pp: '1', gp: '0', sp: '30' },
        { pp: 1, sp: 30 },
      ],
      ['more than is held', { gp: '500' }, { gp: 500 }],
      ['the most the game takes', { cp: '10000000' }, { cp: 10_000_000 }],
      ['more than it takes', { cp: '10000001', gp: '5' }, undefined],
      ['not a number', { gp: '5', sp: 'ten' }, undefined],
      ['a part of a coin', { gp: '1.5' }, undefined],
      ['fewer than none', { gp: '-5' }, undefined],
      ['a coin the sheet doesn’t list', { gems: '4' }, undefined],
    ])('reads %s', (_name, typed, amounts) => {
      expect(amountsTyped(currency, typed)).toEqual(amounts)
    })
  })
})
