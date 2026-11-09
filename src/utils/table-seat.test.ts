import {
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
      effectsEnabled: true,
      wildShapeEnabled: true,
      hitPointsEnabled: true,
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

    it("lets the Gamemaster only move and remove, as a player's own are theirs", () => {
      expect(Object.keys(allows(gm))).toEqual(['moves', 'removes'])
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
