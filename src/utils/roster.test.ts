import {
  characterRoster,
  groupRoster,
  inRoster,
  listedCompanion,
  listedIn,
  seatListed,
} from './roster'
import { groupEntry, mockCompanionEntry, PARTY } from '@/mocks/sending-stone'

const wolf = mockCompanionEntry()
/** Thorin's wolf's seat, from his own. */
const atWolf = {
  actorId: wolf.key,
  companion: { of: PARTY.thorin, entry: wolf },
}

describe('utils/roster', () => {
  describe('inRoster', () => {
    it('finds a character in the roster its module last listed, and in nothing else', () => {
      const characters = [{ id: PARTY.thorin }, { id: PARTY.vex }]
      expect(inRoster(characters, PARTY.vex)).toBe(true)
      expect(inRoster(characters, PARTY.balin)).toBe(false)
      expect(inRoster(null, PARTY.vex)).toBe(false)
      expect(inRoster({ id: PARTY.vex }, PARTY.vex)).toBe(false)
    })
  })

  describe('seatListed', () => {
    const campaign = {
      characters: [{ id: PARTY.thorin }],
      companions: [wolf],
    }

    it("lists a character's seat while its character is in the roster", () => {
      expect(seatListed({ actorId: PARTY.thorin }, campaign)).toBe(true)
      expect(seatListed({ actorId: PARTY.vex }, campaign)).toBe(false)
      expect(seatListed({ actorId: null }, campaign)).toBe(false)
    })

    it("lists a companion's seat while the companion is listed as its character's", () => {
      expect(seatListed(atWolf, campaign)).toBe(true)
      expect(seatListed(atWolf, { ...campaign, companions: [] })).toBe(false)
      expect(
        seatListed(atWolf, {
          ...campaign,
          companions: [{ ...wolf, of: [PARTY.vex] }],
        }),
      ).toBe(false)
      // A companion's key is never a character's.
      expect(
        seatListed(atWolf, {
          characters: [{ id: wolf.key }],
          companions: [],
        }),
      ).toBe(false)
    })
  })

  describe('listedCompanion', () => {
    it('finds the companion a seat is at while it is still its character’s', () => {
      expect(listedCompanion(atWolf, [wolf])).toEqual(wolf)
      expect(
        listedCompanion(atWolf, [{ ...wolf, of: [PARTY.vex] }]),
      ).toBeUndefined()
      expect(listedCompanion({ actorId: PARTY.thorin }, [wolf])).toBeUndefined()
    })
  })

  describe('groupRoster', () => {
    it('keeps only the groups it can read', () => {
      expect(groupRoster([null, groupEntry(), { name: 'x' }])).toEqual([
        groupEntry(),
      ])
      expect(groupRoster('company')).toEqual([])
    })
  })

  describe('characterRoster', () => {
    it('keeps only the characters it can read', () => {
      const thorin = { id: PARTY.thorin, name: 'Thorin', img: null }
      expect(characterRoster([null, thorin, { name: 'x' }, 7])).toEqual([
        thorin,
      ])
      expect(characterRoster(undefined)).toEqual([])
    })
  })

  describe('listedIn', () => {
    const campaign = {
      characters: [{ id: PARTY.thorin }],
      groups: [groupEntry(), null],
    }

    it("finds a personal book's character among the characters, a party's group among the groups", () => {
      expect(
        listedIn(campaign, { kind: 'personal', actorId: PARTY.thorin }),
      ).toBe(true)
      expect(listedIn(campaign, { kind: 'party', actorId: 'company' })).toBe(
        true,
      )
      expect(listedIn(campaign, { kind: 'party', actorId: PARTY.thorin })).toBe(
        false,
      )
      expect(listedIn(campaign, { kind: 'personal', actorId: 'company' })).toBe(
        false,
      )
      expect(
        listedIn(
          { characters: 'thorin', groups: null },
          { kind: 'personal', actorId: PARTY.thorin },
        ),
      ).toBe(false)
    })
  })
})
