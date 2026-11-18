import {
  othersHealth,
  ownCompanions,
  seatAllows,
  seatRolls,
  viewerOf,
  withheld,
} from './table-seat'
import {
  groupEntry,
  mockCompanionEntry,
  mockSummonedEntry,
  PARTY,
} from '@/mocks/sending-stone'
import type { SheetSeat } from '@/types/character'

const ORIGIN = 'https://my-game.forge-vtt.com'
const NOW = Date.parse('2026-11-09T12:00:00Z')

/** Thorin's player at his sheet. */
const thorin: SheetSeat = {
  name: 'Thorin',
  gameUrl: ORIGIN,
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: PARTY.thorin,
  role: 'player',
  userId: 'user-1',
  characterId: 'char-1',
}
const gm: SheetSeat = {
  ...thorin,
  role: 'gm',
  userId: 'gm-1',
  characterId: null,
}

/** A campaign whose game fetched just now, taking these rolls, doing these with them. */
const rolling = (kinds: string[], features: string[] = []) => ({
  rollsEnabled: true,
  rollKinds: kinds,
  rollFeatures: features,
  bridgePolledAt: new Date(NOW - 5000),
})

const roster = [
  { id: PARTY.thorin, name: 'Thorin', img: 'worlds/erebor/thorin.webp' },
  { id: PARTY.vex, name: 'Vex', img: null },
]
const wolf = mockCompanionEntry()
const imp = mockSummonedEntry()
const hound = mockCompanionEntry({
  key: 'houndVex',
  actorId: 'houndVex',
  name: 'Hound',
  of: [PARTY.vex],
})

describe('utils/table-seat', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('seatRolls', () => {
    it("gives a player the game's rolls and what it does with them, but the Gamemaster's", () => {
      expect(
        seatRolls(
          thorin,
          rolling(['skill', 'endTurn'], ['gmRolls', 'prompts']),
        ),
      ).toEqual({
        rollsToTable: ['skill', 'endTurn'],
        rollFeatures: ['prompts'],
      })
    })

    it('gives none to a seat with no actor, or no campaign', () => {
      expect(
        seatRolls({ ...thorin, actorId: null }, rolling(['skill'])),
      ).toEqual({ rollsToTable: [], rollFeatures: [] })
      expect(seatRolls(thorin)).toEqual({ rollsToTable: [], rollFeatures: [] })
    })

    it.each([
      ['made', ['gmRolls', 'prompts'], ['skill'], ['prompts']],
      ['update', ['prompts'], [], []],
    ])(
      "says where the Gamemaster's rolls go: %s",
      (rolls, features, kinds, others) => {
        expect(seatRolls(gm, rolling(['skill', 'endTurn'], features))).toEqual({
          rollsToTable: kinds,
          rollFeatures: others,
          gm: { rolls: rolls },
        })
      },
    )

    it("says the Gamemaster's rolls are off while the game takes none", () => {
      expect(
        seatRolls(gm, { ...rolling(['skill']), rollsEnabled: false }),
      ).toEqual({
        rollsToTable: [],
        rollFeatures: [],
        gm: { rolls: 'off' },
      })
    })
  })

  describe('withheld', () => {
    it('tells only why a sheet was held back, and its numbers', () => {
      // As the roster keeps it, with whatever else the module said of it.
      const entry = {
        sheetWithheld: {
          reason: 'tooLarge' as const,
          bytes: 5_200_000,
          limit: 4_000_000,
          at: 'kept here alone',
        },
      }
      expect(withheld(entry)).toEqual({
        reason: 'tooLarge',
        bytes: 5_200_000,
        limit: 4_000_000,
      })
      expect(withheld({})).toBeUndefined()
      expect(withheld(undefined)).toBeUndefined()
    })
  })

  describe('viewerOf', () => {
    it('words the table for the seat, its party, their portraits and their companions', () => {
      const viewer = viewerOf(thorin, roster, [wolf], ORIGIN)
      expect(viewer.actorId).toBe(PARTY.thorin)
      expect([...viewer.party]).toEqual([PARTY.thorin, PARTY.vex])
      expect(Object.fromEntries(viewer.portraits!)).toEqual({
        [PARTY.thorin]: `${ORIGIN}/worlds/erebor/thorin.webp`,
      })
      expect([...viewer.companions!.keys()]).toEqual([wolf.key])
      expect(viewerOf({ ...gm, actorId: null }, [], [], ORIGIN).actorId).toBe(
        undefined,
      )
    })

    // Module 0.50.0: what it's shown of creatures not of the party, at either seat, unset for none.
    it('carries what it is shown of other creatures, from module 0.50.0', () => {
      expect(viewerOf(thorin, roster, [], ORIGIN, 'health').health).toBe(
        'health',
      )
      expect(viewerOf(gm, roster, [], ORIGIN, 'hitPoints').health).toBe(
        'hitPoints',
      )
      expect(viewerOf(thorin, roster, [], ORIGIN)).not.toHaveProperty('health')
    })
  })

  describe('othersHealth', () => {
    it.each([
      [false, ['hitPoints'], undefined],
      [true, [], 'health'],
      [true, ['hitPoints'], 'hitPoints'],
    ] as const)(
      'with the switch %p and %j shows %p',
      (healthEnabled, healthFeatures, shown) => {
        expect(
          othersHealth({ healthEnabled, healthFeatures: [...healthFeatures] }),
        ).toBe(shown)
      },
    )
  })

  describe('ownCompanions', () => {
    it("lists the character's own companions, none at a companion's own seat", () => {
      expect(ownCompanions(thorin, [wolf, hound, imp])).toEqual([wolf, imp])
      expect(ownCompanions({ ...thorin, actorId: null }, [wolf])).toEqual([])
      expect(
        ownCompanions(
          { ...thorin, companion: { of: PARTY.thorin, entry: wolf } },
          [wolf, imp],
        ),
      ).toEqual([])
    })
  })

  describe('seatAllows', () => {
    const switches = {
      origin: ORIGIN,
      bridgePolledAt: new Date(NOW - 5000),
      transfersEnabled: true,
      removalsEnabled: true,
      favoritesEnabled: true,
      favoriteFeatures: [] as string[],
      effectsEnabled: true,
      wildShapeEnabled: true,
      hitPointsEnabled: true,
      // Coins, from module 0.49.0: off but where a case turns them on.
      coinsEnabled: false,
      coinFeatures: [] as string[],
      transferFeatures: [] as string[],
    }
    const allows = (
      at: SheetSeat,
      fields: Partial<typeof switches> = {},
      connected = true,
    ) =>
      seatAllows(
        at,
        { ...switches, ...fields },
        connected,
        [groupEntry()],
        roster,
        NOW,
      )

    it('lets a player move, remove, favorite, change effects, use Wild Shape and set hit points, each as switched on', () => {
      expect(allows(thorin)).toEqual({
        moves: {
          parties: [
            {
              id: 'company',
              name: 'The Company',
              portrait: `${ORIGIN}/worlds/erebor/company.webp`,
              primary: true,
            },
          ],
          characters: [{ id: PARTY.vex, name: 'Vex' }],
        },
        removes: true,
        favorites: true,
        effects: true,
        wildShape: true,
        hitPoints: true,
      })
      expect(
        allows(thorin, {
          transfersEnabled: false,
          favoritesEnabled: false,
          hitPointsEnabled: false,
        }),
      ).toEqual({ removes: true, effects: true, wildShape: true })
    })

    it('lets a player put favorites in order, from module 0.47.0, where its module takes orders and favorites', () => {
      expect(allows(thorin, { favoriteFeatures: ['orders'] })).toMatchObject({
        favorites: true,
        favoriteOrders: true,
      })
      for (const [at, fields] of [
        [thorin, {}],
        [thorin, { favoriteFeatures: ['orders'], favoritesEnabled: false }],
        [gm, { favoriteFeatures: ['orders'] }],
      ] as [SheetSeat, Partial<typeof switches>][]) {
        expect(allows(at, fields)).not.toHaveProperty('favoriteOrders')
      }
    })

    it("lets the Gamemaster only move and remove, as a player's own are theirs", () => {
      expect(Object.keys(allows(gm))).toEqual(['moves', 'removes'])
    })

    it('lets either seat add and take away coins, from module 0.49.0, while the campaign lets them, saying whether another coin pays', () => {
      expect(allows(thorin, { coinsEnabled: true }).coins).toEqual({
        change: false,
      })
      expect(
        allows(gm, { coinsEnabled: true, coinFeatures: ['change'] }).coins,
      ).toEqual({ change: true })
      // With moves off too: coins have a switch of their own.
      expect(
        Object.keys(
          allows(gm, { coinsEnabled: true, transfersEnabled: false }),
        ),
      ).toEqual(['removes', 'coins'])
      // Never while the campaign's switch is off, whatever its module says of other coins; nor out
      // of the roster, nor while the game isn't fetching.
      const on = { coinsEnabled: true, coinFeatures: ['change'] }
      for (const allowed of [
        allows(thorin, { coinFeatures: ['change'] }),
        allows(thorin, on, false),
        allows(thorin, { ...on, bridgePolledAt: new Date(NOW - 3_600_000) }),
      ]) {
        expect(allowed).not.toHaveProperty('coins')
      }
    })

    it('lets either seat hand its coins out with its moves, from module 0.49.0, where its module says so, saying whether another coin pays', () => {
      expect(
        allows(thorin, { transferFeatures: ['partySends', 'handOut'] }).moves
          ?.handOut,
      ).toEqual({ change: false })
      expect(
        allows(gm, { transferFeatures: ['handOut', 'change'] }).moves?.handOut,
      ).toEqual({ change: true })
      // Not from a module before it, whatever else it says; nor with moves off, with coins on.
      expect(
        allows(thorin, { transferFeatures: ['partySends', 'change'] }).moves,
      ).not.toHaveProperty('handOut')
      expect(
        allows(thorin, {
          transferFeatures: ['handOut'],
          transfersEnabled: false,
          coinsEnabled: true,
        }),
      ).not.toHaveProperty('moves')
    })

    it('allows nothing where the character is not in the roster, or the game is not fetching', () => {
      expect(allows(thorin, {}, false)).toEqual({})
      expect(allows({ ...thorin, actorId: null })).toEqual({})
      expect(
        allows(thorin, { bridgePolledAt: new Date(NOW - 3_600_000) }),
      ).toEqual({})
    })
  })
})
