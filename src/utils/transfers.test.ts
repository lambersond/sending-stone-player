/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import {
  checkAmong,
  checkEnds,
  checkHoldings,
  transfersAvailable,
} from './transfers'
import { ironCompany, partyStash, sheetItem } from '@/mocks/sending-stone'

const THORIN = 'actorThorin1'
const VEX = 'actorVex0001'
const BALIN = 'actorBalin01'
const COMPANY = 'groupIronCo01'
/** A second party, which Vex's player owns and Thorin's can't see. */
const ORDER = 'groupOrder01'

const roster = [{ id: THORIN }, { id: VEX }, { id: BALIN }]
const groups = [
  ironCompany(),
  ironCompany({
    id: ORDER,
    name: 'The Silent Order',
    access: { [VEX]: 'owner' },
  }),
]
const player = (actorId: string | null = THORIN) => ({
  role: 'player' as const,
  actorId,
})
const gm = (actorId: string | null = THORIN) => ({
  role: 'gm' as const,
  actorId,
})
const ends = (
  seat: ReturnType<typeof player> | ReturnType<typeof gm>,
  from: string,
  to: string,
) => checkEnds(seat, { from, to }, roster, groups)

/** The same end, but a party never listed for The Silent Order. */
const madeUp = (id: string) => (id === ORDER ? 'groupMadeUp1' : id)

/** A move of so many of one item. */
const items = (id: string, quantity: number) => ({
  items: [{ id, quantity }],
})

describe('utils/transfers', () => {
  describe('transfersAvailable', () => {
    const now = Date.parse('2026-10-20T12:00:00Z')
    const polled = (ago: number) => new Date(now - ago)

    it('is so while the campaign lets moves be made and its module is fetching them', () => {
      expect(
        transfersAvailable(
          { transfersEnabled: true, bridgePolledAt: polled(5000) },
          now,
        ),
      ).toBe(true)
    })

    it.each([
      ['turned off', { transfersEnabled: false, bridgePolledAt: polled(5000) }],
      ['never fetched', { transfersEnabled: true, bridgePolledAt: null }],
      [
        'not fetched for 45 seconds',
        { transfersEnabled: true, bridgePolledAt: polled(45_000) },
      ],
    ])('is not so %s', (_name, campaign) => {
      expect(transfersAvailable(campaign, now)).toBe(false)
    })
  })

  describe('checkEnds, for a player', () => {
    it('takes a take into their own character from a party they own', () => {
      expect(ends(player(), COMPANY, THORIN)).toBeUndefined()
    })

    it('takes a give from their own character to a party they own', () => {
      expect(ends(player(), THORIN, COMPANY)).toBeUndefined()
    })

    it('takes a send to another character, who needs nothing', () => {
      expect(ends(player(), THORIN, VEX)).toBeUndefined()
      expect(ends(player(), THORIN, BALIN)).toBeUndefined()
    })

    it.each([
      ['an end not in the campaign', 'actorStranger', THORIN],
      ['a party not listed', THORIN, 'groupUnknown'],
    ])('refuses %s as unknown', (_name, from, to) => {
      expect(ends(player(), from, to)).toBe('unknown')
    })

    it('refuses a move their character is no end of', () => {
      expect(ends(player(), VEX, BALIN)).toBe('not-yours')
      expect(ends(player(), COMPANY, VEX)).toBe('not-yours')
      expect(ends(player(null), VEX, THORIN)).toBe('not-yours')
      // A seat without a character sees no party at all.
      expect(ends(player(null), COMPANY, THORIN)).toBe('unknown')
    })

    it('refuses party to party', () => {
      // Vex's player sees both: The Iron Company as Observer, The Silent Order as Owner.
      expect(ends(player(VEX), COMPANY, ORDER)).toBe('not-yours')
      expect(ends(player(VEX), ORDER, COMPANY)).toBe('not-yours')
    })

    it("never says a party their character can't see is there, whatever the other end", () => {
      // Thorin's player can't see The Silent Order: it's answered as a made-up id is.
      for (const [from, to] of [
        [ORDER, VEX],
        [VEX, ORDER],
        [COMPANY, ORDER],
        [ORDER, COMPANY],
        [ORDER, THORIN],
        [THORIN, ORDER],
      ]) {
        expect(ends(player(), from, to)).toBe('unknown')
        expect(ends(player(), madeUp(from), madeUp(to))).toBe('unknown')
      }
    })

    it('refuses a take from their own character, or a send from another', () => {
      // A take is made into the seat's character.
      expect(ends(player(VEX), VEX, THORIN)).toBeUndefined()
      expect(ends(player(THORIN), VEX, THORIN)).toBe('not-yours')
    })

    it("refuses a party their character can't see as unknown, as one that isn't there", () => {
      expect(ends(player(), ORDER, THORIN)).toBe('unknown')
      expect(ends(player(), THORIN, ORDER)).toBe('unknown')
      expect(ends(player(BALIN), COMPANY, BALIN)).toBe('unknown')
    })

    it('refuses one they only observe as needing Owner', () => {
      expect(ends(player(VEX), COMPANY, VEX)).toBe('not-owner')
      expect(ends(player(VEX), VEX, COMPANY)).toBe('not-owner')
    })

    it("reads a level it doesn't know, or an access it can't read, as no access", () => {
      const odd = [
        ironCompany({ access: { [THORIN]: 'limited' as never } }),
        ironCompany({ id: ORDER, access: undefined as never }),
      ]
      expect(
        checkEnds(player(), { from: COMPANY, to: THORIN }, roster, odd),
      ).toBe('unknown')
      expect(
        checkEnds(player(), { from: ORDER, to: THORIN }, roster, odd),
      ).toBe('unknown')
      expect(
        checkEnds(
          player('toString'),
          { from: COMPANY, to: 'toString' },
          [{ id: 'toString' }],
          odd,
        ),
      ).toBe('unknown')
    })
  })

  describe('checkEnds, for the Gamemaster', () => {
    it("moves anything between the campaign's characters and parties, as one of them", () => {
      expect(ends(gm(), ORDER, THORIN)).toBeUndefined()
      expect(ends(gm(VEX), COMPANY, VEX)).toBeUndefined()
      expect(ends(gm(BALIN), BALIN, ORDER)).toBeUndefined()
      expect(ends(gm(), THORIN, VEX)).toBeUndefined()
    })

    it("refuses an end not in the campaign, a move the seat's character is no end of, and party to party", () => {
      expect(ends(gm(), 'groupUnknown', THORIN)).toBe('unknown')
      expect(ends(gm(), VEX, BALIN)).toBe('not-yours')
      expect(ends(gm(), COMPANY, ORDER)).toBe('not-yours')
    })
  })

  describe('checkHoldings', () => {
    const stash = { inventory: partyStash() }

    it('takes what the sheet holds: part of a stack, all of it, a contained item, an empty container split, and whole coins', () => {
      expect(checkHoldings(items('potionHeal01', 2), stash)).toBeUndefined()
      expect(checkHoldings(items('potionHeal01', 3), stash)).toBeUndefined()
      expect(checkHoldings(items('bedroll00001', 1), stash)).toBeUndefined()
      expect(checkHoldings(items('backpack0001', 1), stash)).toBeUndefined()
      expect(checkHoldings(items('coffer000001', 1), stash)).toBeUndefined()
      expect(
        checkHoldings({ currency: { gp: 120, sp: 7 } }, stash),
      ).toBeUndefined()
      const empty = {
        inventory: {
          ...partyStash(),
          containers: [
            {
              ...sheetItem({
                id: 'sacks',
                name: 'Sack',
                type: 'container',
                quantity: 4,
              }),
              capacity: null,
              contents: [],
            },
          ],
        },
      }
      expect(checkHoldings(items('sacks', 2), empty)).toBeUndefined()
    })

    it.each([
      ['no sheet', items('potionHeal01', 1), undefined],
      ['an item not held', items('wand', 1), stash],
      ['a coin not on the sheet', { currency: { ep: 1 } }, stash],
    ])('refuses %s as gone', (_name, transfer, sheet) => {
      expect(checkHoldings(transfer, sheet)).toBe('gone')
    })

    it('refuses an item inside a container whose contents are secret as gone, as none of it is known', () => {
      expect(checkHoldings(items('hiddenThing1', 1), stash)).toBe('gone')
    })

    it('refuses more than held as short', () => {
      expect(checkHoldings(items('potionHeal01', 4), stash)).toBe('short')
      expect(checkHoldings({ currency: { gp: 121 } }, stash)).toBe('short')
    })

    it('reads coins as whole, as dnd5e 6 shows them: 10 of 10.5 gp, never 11', () => {
      const fractional = {
        inventory: {
          ...partyStash(),
          currency: [
            { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 10.5 },
          ],
        },
      }
      expect(
        checkHoldings({ currency: { gp: 10 } }, fractional),
      ).toBeUndefined()
      expect(checkHoldings({ currency: { gp: 11 } }, fractional)).toBe('short')
    })

    it('refuses part of a container that holds anything, or may, as it moves whole', () => {
      const stacked = {
        inventory: {
          ...partyStash(),
          containers: partyStash().containers.map(container => ({
            ...container,
            quantity: 2,
          })),
        },
      }
      expect(checkHoldings(items('backpack0001', 1), stacked)).toBe('container')
      // Its contents are secret: it may hold anything.
      expect(checkHoldings(items('coffer000001', 1), stacked)).toBe('container')
      expect(checkHoldings(items('backpack0001', 2), stacked)).toBeUndefined()
    })

    it('refuses an item with the container it is in, at any depth, as it moves with it already', () => {
      expect(
        checkHoldings(
          {
            items: [
              { id: 'backpack0001', quantity: 1 },
              { id: 'bedroll00001', quantity: 1 },
            ],
          },
          stash,
        ),
      ).toBe('nested')
      const deep = {
        inventory: {
          ...partyStash(),
          containers: [
            {
              ...sheetItem({ id: 'chest', name: 'Chest', type: 'container' }),
              capacity: null,
              contents: [
                {
                  ...sheetItem({
                    id: 'pouch',
                    name: 'Pouch',
                    type: 'container',
                  }),
                  capacity: null,
                  contents: [sheetItem({ id: 'gem', name: 'Gem' })],
                },
              ],
            },
          ],
        },
      }
      expect(
        checkHoldings(
          {
            items: [
              { id: 'gem', quantity: 1 },
              { id: 'chest', quantity: 1 },
            ],
          },
          deep,
        ),
      ).toBe('nested')
      expect(
        checkHoldings(
          {
            items: [
              { id: 'gem', quantity: 1 },
              { id: 'potionHeal01', quantity: 1 },
            ],
          },
          { inventory: { ...deep.inventory, sections: partyStash().sections } },
        ),
      ).toBeUndefined()
    })

    it('checks what is gone before what is short, short before part of a container, and that before what is nested', () => {
      expect(
        checkHoldings(
          {
            items: [
              { id: 'potionHeal01', quantity: 9 },
              { id: 'wand', quantity: 1 },
            ],
          },
          stash,
        ),
      ).toBe('gone')
      expect(
        checkHoldings(
          {
            items: [
              { id: 'backpack0001', quantity: 1 },
              { id: 'bedroll00001', quantity: 2 },
            ],
          },
          stash,
        ),
      ).toBe('short')
    })
  })
})

describe('utils/transfers, from module 0.32.0', () => {
  /** Thorin's player owns The Iron Company and the Wardens, and only observes the Watch. */
  const WARDENS = 'groupWarden1'
  const WATCH = 'groupWatch01'
  const sending = [
    ...groups,
    ironCompany({
      id: WARDENS,
      name: 'Wardens of the Vale',
      primary: false,
      access: { [THORIN]: 'owner', [VEX]: 'owner' },
    }),
    ironCompany({
      id: WATCH,
      name: 'The Night Watch',
      primary: false,
      access: { [THORIN]: 'observer' },
    }),
  ]
  const ON = ['partySends', 'distribute'] as const
  const move = (
    seat: ReturnType<typeof player> | ReturnType<typeof gm>,
    transfer: { from: string; to?: string; among?: string[] },
    features: readonly string[] = ON,
  ) => checkEnds(seat, transfer, roster, sending, features)

  describe('checkEnds', () => {
    it('lets an Owner send a party’s things to another character with partySends, as 0.31.0 never did', () => {
      expect(move(player(), { from: COMPANY, to: VEX })).toBeUndefined()
      expect(move(player(), { from: COMPANY, to: BALIN })).toBeUndefined()
      expect(move(player(), { from: COMPANY, to: VEX }, [])).toBe('not-yours')
    })

    it('lets an Owner of both send party to party with partySends, and refuses it without', () => {
      expect(move(player(), { from: COMPANY, to: WARDENS })).toBeUndefined()
      expect(move(player(), { from: WARDENS, to: COMPANY })).toBeUndefined()
      expect(move(player(), { from: COMPANY, to: WARDENS }, [])).toBe(
        'not-yours',
      )
    })

    it('needs Owner on the party it goes to as on the one it comes from', () => {
      // Row 9: the Watch, which Thorin's player only observes.
      expect(move(player(), { from: COMPANY, to: WATCH })).toBe('not-owner')
      expect(move(player(), { from: THORIN, to: WATCH })).toBe('not-owner')
      // Row 8: from one they only observe.
      expect(move(player(), { from: WATCH, to: THORIN })).toBe('not-owner')
      expect(move(player(VEX), { from: COMPANY, to: VEX })).toBe('not-owner')
    })

    it("says a party the player can't see isn't there, as an end or among, whatever else", () => {
      expect(move(player(), { from: COMPANY, to: ORDER })).toBe('unknown')
      expect(move(player(), { from: ORDER, to: THORIN })).toBe('unknown')
      expect(move(player(), { from: COMPANY, to: madeUp(ORDER) })).toBe(
        'unknown',
      )
    })

    it('takes a distribution from a party the player owns, among characters alone', () => {
      expect(
        move(player(), { from: COMPANY, among: [THORIN, VEX, BALIN] }),
      ).toBeUndefined()
      expect(move(player(), { from: WATCH, among: [THORIN] })).toBe('not-owner')
      expect(move(player(VEX), { from: COMPANY, among: [THORIN] })).toBe(
        'not-owner',
      )
    })

    it('answers a party, seen or not, or an NPC, among those shared among as unknown alike, for every seat', () => {
      for (const seat of [player(), gm(VEX)]) {
        for (const odd of [WARDENS, ORDER, madeUp(ORDER), 'actorGrumble']) {
          expect(move(seat, { from: COMPANY, among: [THORIN, odd] })).toBe(
            'unknown',
          )
        }
      }
    })

    it('shares only from a party', () => {
      expect(move(player(), { from: THORIN, among: [VEX] })).toBe('not-yours')
      expect(move(gm(), { from: THORIN, among: [VEX] })).toBe('not-yours')
    })

    it('makes a move only as one of the campaign’s characters', () => {
      expect(move(player(COMPANY), { from: THORIN, to: VEX })).toBe('not-yours')
      expect(move(gm(COMPANY), { from: COMPANY, to: THORIN })).toBe('not-yours')
      expect(move(gm('actorStranger'), { from: COMPANY, to: THORIN })).toBe(
        'not-yours',
      )
      expect(move(player(null), { from: THORIN, to: VEX })).toBe('not-yours')
    })

    it('moves a character’s things only as one of its ends, the Gamemaster’s too, with or without partySends', () => {
      // Row 4: the Gamemaster on Vex's page, moving Thorin's coins to Balin.
      for (const features of [ON, []]) {
        expect(move(gm(VEX), { from: THORIN, to: BALIN }, features)).toBe(
          'not-yours',
        )
        expect(move(player(VEX), { from: THORIN, to: BALIN }, features)).toBe(
          'not-yours',
        )
      }
      // Row 7: a player's from their own alone, even into it.
      expect(move(player(), { from: VEX, to: THORIN })).toBe('not-yours')
    })

    it('lets the Gamemaster send a party’s things anywhere, as any character, with partySends', () => {
      expect(move(gm(VEX), { from: COMPANY, to: ORDER })).toBeUndefined()
      expect(move(gm(VEX), { from: COMPANY, to: THORIN })).toBeUndefined()
      expect(move(gm(VEX), { from: ORDER, among: [THORIN] })).toBeUndefined()
      // 0.31.0's rules without it.
      expect(move(gm(VEX), { from: COMPANY, to: ORDER }, [])).toBe('not-yours')
      expect(move(gm(VEX), { from: COMPANY, to: THORIN }, [])).toBe('not-yours')
      expect(move(gm(VEX), { from: COMPANY, to: VEX }, [])).toBeUndefined()
    })

    it('answers every move as 0.31.0 did without partySends', () => {
      for (const seat of [player(), player(VEX), gm(), gm(VEX)]) {
        for (const [from, to] of [
          [COMPANY, THORIN],
          [THORIN, COMPANY],
          [THORIN, VEX],
          [VEX, BALIN],
          [COMPANY, VEX],
          [COMPANY, ORDER],
          [ORDER, THORIN],
        ]) {
          expect(checkEnds(seat, { from, to }, roster, groups, [])).toBe(
            checkEnds(seat, { from, to }, roster, groups),
          )
        }
      }
    })
  })

  describe('checkAmong', () => {
    const sheet = {
      members: [
        { id: VEX, character: true },
        { id: THORIN, character: true },
        { id: 'grumble', character: false },
      ],
    }

    it('takes the party’s members that are the campaign’s characters, in any order', () => {
      expect(checkAmong({ among: [THORIN, VEX] }, sheet)).toBeUndefined()
      expect(checkAmong({ among: [VEX, THORIN] }, sheet)).toBeUndefined()
    })

    it.each([
      ['missing one', [THORIN]],
      ['with one more', [THORIN, VEX, BALIN]],
      ['with a member that is no campaign character', [THORIN, VEX, 'grumble']],
      ['one in place of another', [THORIN, BALIN]],
    ])('refuses them %s as members', (_name, among) => {
      expect(checkAmong({ among }, sheet)).toBe('members')
    })

    it('refuses any without the party’s sheet', () => {
      // eslint-disable-next-line unicorn/no-useless-undefined -- no sheet, as the module sent none
      expect(checkAmong({ among: [THORIN] }, undefined)).toBe('members')
      expect(checkAmong({ among: [THORIN] }, {})).toBe('members')
    })
  })

  describe('checkHoldings, a distribution', () => {
    const stash = {
      inventory: {
        ...partyStash(),
        currency: [
          { id: 'gp', label: 'Gold', abbreviation: 'gp', value: 103 },
          { id: 'cp', label: 'Copper', abbreviation: 'cp', value: 3 },
        ],
      },
    }
    const four = [THORIN, VEX, BALIN, 'actorBram001']

    it('takes a whole coin or more for each', () => {
      expect(
        checkHoldings({ among: four, currency: { gp: 103 } }, stash),
      ).toBeUndefined()
      expect(
        checkHoldings({ among: four.slice(0, 3), currency: { cp: 3 } }, stash),
      ).toBeUndefined()
    })

    it('refuses fewer coins than those it’s shared among as split, after short', () => {
      expect(checkHoldings({ among: four, currency: { cp: 3 } }, stash)).toBe(
        'split',
      )
      expect(checkHoldings({ among: four, currency: { gp: 104 } }, stash)).toBe(
        'short',
      )
      expect(checkHoldings({ among: four, currency: { cp: 4 } }, stash)).toBe(
        'short',
      )
    })
  })
})
