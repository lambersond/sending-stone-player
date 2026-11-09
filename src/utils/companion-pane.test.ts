import {
  companionRolls,
  hitPointsFlag,
  initiativeOf,
  setsHitPoints,
} from './companion-pane'
import {
  combat,
  combatant,
  mockCompanionEntry,
  PARTY,
} from '@/mocks/sending-stone'
import type { SheetSeat } from '@/types/character'

const NOW = Date.parse('2026-11-09T12:00:00Z')

/** Thorin's player at his wolf's sheet. */
const atWolf: SheetSeat = {
  name: 'Wolf',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'wolfBrakka',
  role: 'player',
  userId: 'user-1',
  characterId: 'char-1',
  companion: { of: PARTY.thorin, entry: mockCompanionEntry() },
}
const gmAtWolf: SheetSeat = {
  ...atWolf,
  role: 'gm',
  userId: 'gm-1',
  characterId: null,
}

/** A campaign whose game fetched just now, taking these rolls, and these for companions. */
const rolling = (features: string[] = [], companionKinds = ['save']) => ({
  rollsEnabled: true,
  rollKinds: ['skill', 'save'],
  rollFeatures: features,
  bridgePolledAt: new Date(NOW - 5000),
  companionKinds,
})

/** A combat of these characters' combatants, in this order. */
const fight = (
  ...fighters: { character: string; initiative: number | null }[]
) =>
  combat({
    combatants: fighters.map(({ character, initiative }) =>
      combatant({ id: `c-${character}`, character, initiative }),
    ),
  })

describe('utils/companion-pane', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('companionRolls', () => {
    it('gives a companion the kinds the game takes for companions, while it is listed as its character’s', () => {
      expect(companionRolls(atWolf, rolling(['modifiers']), true)).toEqual({
        rollsToTable: ['save'],
        rollFeatures: ['modifiers'],
      })
      expect(companionRolls(atWolf, rolling(['modifiers']), false)).toEqual({
        rollsToTable: [],
        rollFeatures: [],
      })
      expect(companionRolls(atWolf, rolling(['modifiers'], []), true)).toEqual({
        rollsToTable: [],
        rollFeatures: [],
      })
    })

    it('answers what the game asks of it only where the game asks companions', () => {
      expect(
        companionRolls(atWolf, rolling(['prompts']), true).rollFeatures,
      ).toEqual([])
      expect(
        companionRolls(atWolf, rolling(['prompts', 'companionPrompts']), true)
          .rollFeatures,
      ).toEqual(['prompts', 'companionPrompts'])
    })

    it("says where the Gamemaster's rolls go at their seat", () => {
      expect(companionRolls(gmAtWolf, rolling(['gmRolls']), true)).toEqual({
        rollsToTable: ['save'],
        rollFeatures: [],
        gm: { rolls: 'made' },
      })
    })
  })

  describe('setsHitPoints and hitPointsFlag', () => {
    const on = { hitPointsEnabled: true, bridgePolledAt: new Date(NOW - 5000) }

    it.each([
      ["its character's player, while it's listed", atWolf, on, true, true],
      ['the Gamemaster', gmAtWolf, on, true, false],
      ['its player, once it is no longer listed', atWolf, on, false, false],
      [
        'its player, with the switch off',
        atWolf,
        { ...on, hitPointsEnabled: false },
        true,
        false,
      ],
    ])(
      'lets %s set its hit points: %s',
      (_, seat, campaign, connected, sets) => {
        expect(setsHitPoints(seat, campaign, connected, NOW)).toBe(sets)
        expect(hitPointsFlag(seat, campaign, connected, NOW)).toEqual(
          sets ? { hitPoints: true } : {},
        )
      },
    )
  })

  describe('initiativeOf', () => {
    const roster = [
      { id: PARTY.thorin, name: 'Thorin' },
      { id: PARTY.vex, name: 'Vex' },
    ]
    it('rolls its own where its Gamemaster says so', () => {
      expect(initiativeOf('own', [PARTY.thorin], fight(), roster)).toEqual({
        mode: 'own',
      })
    })

    it('follows the first of its characters in the combat with an initiative, else the first in it', () => {
      const both = [PARTY.thorin, PARTY.vex]
      expect(
        initiativeOf(
          'after',
          both,
          fight(
            { character: PARTY.thorin, initiative: null },
            { character: PARTY.vex, initiative: 12 },
          ),
          roster,
        ),
      ).toEqual({ mode: 'after', after: 'Vex' })
      expect(
        initiativeOf(
          'after',
          both,
          fight(
            { character: PARTY.vex, initiative: null },
            { character: PARTY.thorin, initiative: null },
          ),
          roster,
        ),
      ).toEqual({ mode: 'after', after: 'Thorin' })
    })

    it('names none where none of its characters is in the combat shown, or there is none', () => {
      expect(initiativeOf('after', [PARTY.thorin], fight(), roster)).toEqual({
        mode: 'after',
      })
      expect(initiativeOf('after', [PARTY.thorin], undefined, roster)).toEqual({
        mode: 'after',
      })
    })
  })
})
