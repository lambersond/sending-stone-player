/**
 * @jest-environment node
 */
import {
  checkCoins,
  coinsAvailable,
  coinsCovered,
  coinTotals,
  wholeCoins,
} from './coins'
import { purse } from '@/mocks/sending-stone'
import type { SheetCurrency } from '@/types/sending-stone'

/** A sheet holding these coins, as `checkCoins` reads it. */
const sheet = (currency: SheetCurrency[]) => ({
  inventory: {
    sections: [],
    containers: [],
    currency,
    encumbrance: null,
    attunement: null,
  },
})

/** A world's own coins, by their rates: none for a coin with no rate. */
const coins = (
  rates: Record<string, number | null>,
  held: Record<string, number>,
): SheetCurrency[] =>
  Object.entries(rates).map(([id, conversion]) => ({
    id,
    label: id,
    abbreviation: id,
    value: held[id] ?? 0,
    conversion,
  }))

describe('utils/coins', () => {
  // The module's own table (PROTOCOL.md, Short of a coin): wherever it pays with other coins the
  // app says so beforehand, and wherever it refuses, that the coins are worth too little.
  it.each([
    [{ pp: 2, gp: 3 }, { gp: 5 }, 'other', 'gp'],
    [{ gp: 12 }, { sp: 5 }, 'other', 'sp'],
    [{ gp: 12 }, { cp: 3 }, 'other', 'cp'],
    [{ pp: 1 }, { cp: 1 }, 'other', 'cp'],
    [{ gp: 1, ep: 1 }, { sp: 7 }, 'other', 'sp'],
    [{ ep: 3 }, { sp: 7 }, 'other', 'sp'],
    [{ gp: 1 }, { ep: 1 }, 'other', 'ep'],
    [{ pp: 1, gp: 1 }, { gp: 1, sp: 1 }, 'other', 'sp'],
    [{ pp: 1 }, { gp: 1, sp: 1 }, 'other', 'gp'],
    [{ pp: 3, gp: 4, cp: 2 }, { gp: 4, sp: 3, cp: 5 }, 'other', 'sp'],
    [{ pp: 1 }, { ep: 1, sp: 1 }, 'other', 'ep'],
    [{ pp: 8, gp: 3, ep: 1, cp: 7 }, { ep: 3, sp: 7, cp: 5 }, 'other', 'ep'],
    [{ pp: 700, gp: 20 }, { pp: 600, gp: 150 }, 'other', 'gp'],
    [{ pp: 2, gp: 3, sp: 500 }, { gp: 5 }, 'other', 'gp'],
    [{ gp: 2, sp: 40 }, { gp: 5 }, 'other', 'gp'],
    [{ sp: 20 }, { gp: 1 }, 'other', 'gp'],
    [{ pp: 1, gp: 2, sp: 400 }, { gp: 20 }, 'other', 'gp'],
    [{ ep: 1, sp: 6 }, { gp: 1 }, 'other', 'gp'],
    [{ gp: 10_000 }, { pp: 600 }, 'other', 'pp'],
    [{ pp: 2, gp: 3 }, { gp: 25 }, 'short', 'gp'],
    [{ sp: 9, cp: 5 }, { gp: 1 }, 'short', 'gp'],
    [{ gp: 1, sp: 14 }, { gp: 1, sp: 15 }, 'short', 'sp'],
  ])('holding %j, paying %j is %s, of %s', (held, pay, state, coin) => {
    expect(coinsCovered(purse(held), pay)).toEqual({ state, coin })
  })

  it('says a payment each coin’s own coins cover is held, naming no coin', () => {
    expect(coinsCovered(purse({ pp: 2, gp: 5 }), { pp: 2, gp: 5 })).toEqual({
      state: 'held',
    })
  })

  it('counts only whole coins, as dnd5e 6 may show part of one', () => {
    expect(wholeCoins({ value: 10.9 })).toBe(10)
    expect(wholeCoins({ value: -3 })).toBe(0)
    // 0.9 pp isn't broken, and 4.9 gp is 4.
    const held = purse({ pp: 0.9, gp: 4.9 })
    expect(coinsCovered(held, { gp: 4 })).toEqual({ state: 'held' })
    expect(coinsCovered(held, { gp: 5 })).toEqual({
      state: 'short',
      coin: 'gp',
    })
  })

  describe('a world’s own coins', () => {
    const tokens = { pp: 0.1, gp: 1, token: null, sp: 10 }

    it('leaves a coin with no rate there are too few of to the game, as only its own coins pay it', () => {
      expect(
        coinsCovered(coins(tokens, { gp: 50, token: 1 }), { token: 2 }),
      ).toEqual({ state: 'unknown', coin: 'token' })
      // One the sheet doesn't list at all, too.
      expect(coinsCovered(purse({ gp: 50 }), { crown: 1 })).toEqual({
        state: 'unknown',
        coin: 'crown',
      })
    })

    it('counts a coin with no rate there’s enough of for nothing else', () => {
      const held = coins(tokens, { pp: 1, gp: 3, token: 9 })
      expect(coinsCovered(held, { gp: 5, token: 2 })).toEqual({
        state: 'other',
        coin: 'gp',
      })
      expect(coinsCovered(held, { gp: 14, token: 2 })).toEqual({
        state: 'short',
        coin: 'gp',
      })
    })

    it('lets a coin worth the same as another pay for it, as the game does', () => {
      const crowns = { pp: 0.1, gp: 1, crown: 1, sp: 10 }
      expect(coinsCovered(coins(crowns, { crown: 5 }), { gp: 1 })).toEqual({
        state: 'other',
        coin: 'gp',
      })
    })

    it('leaves rates that don’t divide one another to the game, which may refuse what the coins are worth', () => {
      // The module's own case: coins of 1, 4 and 6 to the gp, 3 gp from 1 gp and 26 of the coin
      // of 4, worth 7.5 gp, is refused.
      const odd = { gp: 1, four: 4, six: 6 }
      expect(coinsCovered(coins(odd, { gp: 1, four: 26 }), { gp: 3 })).toEqual({
        state: 'unknown',
        coin: 'gp',
      })
    })

    it('takes rates that divide only nearly, as fractions do, as dividing', () => {
      // 0.3 ÷ 0.1 is 2.9999999999999996.
      const thirds = { big: 0.1, mid: 0.3, small: 0.9 }
      expect(coinsCovered(coins(thirds, { big: 1 }), { mid: 2 })).toEqual({
        state: 'other',
        coin: 'mid',
      })
      expect(coinsCovered(coins(thirds, { big: 1 }), { mid: 4 })).toEqual({
        state: 'short',
        coin: 'mid',
      })
    })

    it('leaves counts past what a number holds exactly to the game', () => {
      const far = { big: 1e-9, small: 1e9 }
      expect(
        coinsCovered(coins(far, { big: 9_000_000_000 }), { small: 1 }),
      ).toEqual({ state: 'unknown', coin: 'small' })
    })
  })

  it('totals what a hand-out takes: each coin for every character picked', () => {
    expect(coinTotals({ pp: 200, gp: 50 }, 3)).toEqual({ pp: 600, gp: 150 })
  })

  describe('checkCoins', () => {
    const held = sheet(purse({ pp: 2, gp: 3 }))

    it.each([
      ['adds whatever the sheet holds', 'add', { gp: 10_000_000 }, true],
      ['takes away what the coin’s own coins cover', 'remove', { gp: 3 }, true],
      ['takes away with other coins paying', 'remove', { gp: 5 }, true],
      [
        'takes away what its own coins cover, other coins not paying',
        'remove',
        { pp: 2, gp: 3 },
        false,
      ],
    ] as const)('%s', (_, op, currency, change) => {
      expect(checkCoins({ op, currency }, held, change)).toBeUndefined()
    })

    it.each([
      ['more than the coins are worth', { gp: 25 }, true, 'short'],
      [
        'more of a coin than is held, other coins not paying',
        { gp: 5 },
        false,
        'short',
      ],
      ['a coin the sheet doesn’t list', { crown: 1 }, true, 'gone'],
    ] as const)('refuses taking away %s', (_, currency, change, refusal) => {
      expect(checkCoins({ op: 'remove', currency }, held, change)).toBe(refusal)
    })

    it('refuses a coin the sheet doesn’t list for an add too, and anything of no sheet', () => {
      const adding = { op: 'add', currency: { crown: 1 } } as const
      expect(checkCoins(adding, held, true)).toBe('gone')
      expect(
        checkCoins({ op: 'add', currency: { gp: 1 } }, undefined, true),
      ).toBe('gone')
    })

    it('leaves what the app can’t tell to the game, but not where other coins never pay', () => {
      const odd = sheet(coins({ gp: 1, four: 4, six: 6 }, { gp: 1, four: 26 }))
      const taking = { op: 'remove', currency: { gp: 3 } } as const
      expect(checkCoins(taking, odd, true)).toBeUndefined()
      expect(checkCoins(taking, odd, false)).toBe('short')
    })
  })

  it('takes coins only while the campaign lets them and its module is fetching', () => {
    const now = Date.now()
    const polled = new Date(now - 5000)
    expect(
      coinsAvailable({ coinsEnabled: true, bridgePolledAt: polled }, now),
    ).toBe(true)
    expect(
      coinsAvailable({ coinsEnabled: false, bridgePolledAt: polled }, now),
    ).toBe(false)
    expect(
      coinsAvailable({ coinsEnabled: true, bridgePolledAt: null }, now),
    ).toBe(false)
  })
})
