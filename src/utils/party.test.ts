import {
  canSee,
  characterEnds,
  distributeAmong,
  partySheetView,
  partyTooLarge,
  sendParties,
  tableGroup,
  tableGroups,
  tableMoves,
  takesFromParty,
} from './party'
import { MOST_AMONG } from '@/constants/sending-stone'
import { groupEntry, groupSheet, PARTY } from '@/mocks/sending-stone'
import { inventoryView } from '@/utils/table-view'
import type { SheetSeat } from '@/types/character'
import type { PartySeat } from '@/types/party'
import type { GroupSheet } from '@/types/sending-stone'

const ORIGIN = 'https://my-game.forge-vtt.com'
const NOW = Date.parse('2026-11-09T12:00:00Z')

/** A seat at a character's sheet in the campaign, of this actor. */
const seat = (role: 'player' | 'gm', actorId: string): SheetSeat => ({
  name: 'Vex',
  gameUrl: ORIGIN,
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId,
  role,
  userId: 'user-1',
  characterId: role === 'gm' ? null : 'char-2',
})

/** A player at their character, at its party's sheet. */
const player = (actorId: string | null = PARTY.thorin): PartySeat => ({
  role: 'player',
  campaignId: 'c1',
  actorId,
  characterId: 'char-1',
  name: 'Thorin Oakenshield',
})
const gm: PartySeat = { role: 'gm', campaignId: 'c1', userId: 'gm-1' }

const scouts = groupEntry({
  id: 'scouts',
  name: 'Scouts',
  primary: false,
  img: null,
  access: { [PARTY.vex]: 'owner' },
})
const hidden = groupEntry({
  id: 'hidden',
  name: 'The Hidden Hand',
  primary: false,
  access: {},
})
/** A member of a party that is one of the campaign's characters. */
const member = (n: number) => ({
  id: `m${n}`,
  name: `M${n}`,
  img: null,
  type: 'character' as const,
  character: true,
})

const COMPANY = {
  id: 'company',
  name: 'The Company',
  portrait: `${ORIGIN}/worlds/erebor/company.webp`,
  primary: true,
}

describe('utils/party', () => {
  describe('canSee', () => {
    it.each([
      [PARTY.thorin, true],
      [PARTY.vex, true],
      // Limited or less, which the roster doesn't list.
      [PARTY.balin, false],
      [null, false],
      // Nothing an object has of its own: only the roster's access.
      ['toString', false],
    ])('lets %s see the Company: %s', (actorId, sees) => {
      expect(canSee(groupEntry(), actorId)).toBe(sees)
    })

    it('lets no one see a group whose access the roster has not', () => {
      expect(canSee(groupEntry({ access: undefined }), PARTY.thorin)).toBe(
        false,
      )
    })
  })

  describe('tableGroup', () => {
    it('names a group by its name and portrait, never who may see it', () => {
      expect(tableGroup(groupEntry(), ORIGIN)).toEqual(COMPANY)
      expect(tableGroup(scouts, ORIGIN)).toEqual({
        id: 'scouts',
        name: 'Scouts',
        primary: false,
      })
    })
  })

  describe('tableGroups', () => {
    it('lists for a player only the groups they may see, the primary party first, never who else may', () => {
      expect(
        tableGroups(
          seat('player', PARTY.vex),
          [scouts, groupEntry(), hidden],
          ORIGIN,
        ),
      ).toEqual([COMPANY, { id: 'scouts', name: 'Scouts', primary: false }])
      expect(
        tableGroups(
          seat('player', PARTY.balin),
          [scouts, groupEntry(), hidden],
          ORIGIN,
        ),
      ).toEqual([])
    })

    it('lists every group for the Gamemaster, the primary party first', () => {
      expect(
        tableGroups(
          seat('gm', PARTY.balin),
          [scouts, groupEntry(), hidden],
          ORIGIN,
        ).map(({ id }) => id),
      ).toEqual(['company', 'scouts', 'hidden'])
    })
  })

  describe('tableMoves', () => {
    const characters = [
      { id: PARTY.thorin, name: 'Thorin', img: 'worlds/erebor/thorin.webp' },
      { id: PARTY.vex, name: 'Vex', img: null },
    ]

    it('moves to the parties a player owns, the primary first, and to the other characters', () => {
      expect(
        tableMoves(
          seat('player', PARTY.vex),
          [groupEntry(), scouts, hidden],
          characters,
          ORIGIN,
        ),
      ).toEqual({
        parties: [{ id: 'scouts', name: 'Scouts', primary: false }],
        characters: [
          {
            id: PARTY.thorin,
            name: 'Thorin',
            portrait: `${ORIGIN}/worlds/erebor/thorin.webp`,
          },
        ],
      })
    })

    it('moves to every party for the Gamemaster', () => {
      expect(
        tableMoves(
          seat('gm', PARTY.thorin),
          [scouts, hidden, groupEntry()],
          characters,
          ORIGIN,
        ).parties.map(({ id }) => id),
      ).toEqual(['company', 'scouts', 'hidden'])
    })
  })

  describe('characterEnds', () => {
    it('names each character by name and portrait only', () => {
      expect(
        characterEnds(
          [
            { id: PARTY.vex, name: 'Vex', img: null },
            { id: PARTY.balin, name: 'Balin', img: 'worlds/erebor/b.webp' },
          ],
          ORIGIN,
        ),
      ).toEqual([
        { id: PARTY.vex, name: 'Vex' },
        {
          id: PARTY.balin,
          name: 'Balin',
          portrait: `${ORIGIN}/worlds/erebor/b.webp`,
        },
      ])
    })
  })

  describe('takesFromParty', () => {
    const moving = { transfersEnabled: true, bridgePolledAt: new Date(NOW) }

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('lets the Gamemaster, and a player with Owner, take while the game takes moves', () => {
      expect(takesFromParty(gm, moving, hidden)).toBe(true)
      expect(takesFromParty(player(), moving, groupEntry())).toBe(true)
      expect(takesFromParty(player(PARTY.vex), moving, groupEntry())).toBe(
        false,
      )
      expect(
        takesFromParty(
          gm,
          { ...moving, transfersEnabled: false },
          groupEntry(),
        ),
      ).toBe(false)
    })
  })

  describe('partyTooLarge', () => {
    it('says only the numbers it has', () => {
      expect(partyTooLarge({ bytes: 5_200_000, limit: 4_000_000 })).toEqual({
        reason: 'tooLarge',
        bytes: 5_200_000,
        limit: 4_000_000,
      })
      expect(partyTooLarge({ bytes: '5 MB' })).toEqual({ reason: 'tooLarge' })
    })
  })

  describe('sendParties', () => {
    it('sends to the other parties a player owns, the primary first, never the party itself', () => {
      expect(
        sendParties(
          player(PARTY.vex),
          [groupEntry(), scouts, hidden],
          hidden,
          ORIGIN,
        ),
      ).toEqual([{ id: 'scouts', name: 'Scouts', primary: false }])
      expect(
        sendParties(gm, [scouts, groupEntry(), hidden], scouts, ORIGIN).map(
          ({ id }) => id,
        ),
      ).toEqual(['company', 'hidden'])
      expect(sendParties(gm, 'groups', scouts, ORIGIN)).toEqual([])
    })
  })

  describe('distributeAmong', () => {
    it("shares a party's coin among its members that are the campaign's characters", () => {
      expect(distributeAmong(groupSheet(), ORIGIN)).toEqual([
        {
          id: PARTY.thorin,
          name: 'Thorin Oakenshield',
          portrait: `${ORIGIN}/worlds/erebor/thorin.webp`,
        },
        { id: PARTY.vex, name: 'Vex' },
      ])
    })

    it('shares it among none where it has none, or more than a distribution takes', () => {
      expect(
        distributeAmong(groupSheet({ members: [] }), ORIGIN),
      ).toBeUndefined()
      expect(
        distributeAmong(
          groupSheet({
            members: Array.from({ length: MOST_AMONG + 1 }, (_, n) =>
              member(n),
            ),
          }),
          ORIGIN,
        ),
      ).toBeUndefined()
      expect(
        distributeAmong(
          groupSheet({
            members: Array.from({ length: MOST_AMONG }, (_, n) => member(n)),
          }),
          ORIGIN,
        ),
      ).toHaveLength(MOST_AMONG)
    })
  })

  describe('partySheetView', () => {
    it("shows its members by name and portrait, the player's own marked, its stash and its full description", () => {
      const sheet = groupSheet()
      expect(partySheetView(sheet, player(), ORIGIN)).toEqual({
        members: [
          {
            id: PARTY.thorin,
            name: 'Thorin Oakenshield',
            portrait: `${ORIGIN}/worlds/erebor/thorin.webp`,
            own: true,
          },
          { id: PARTY.vex, name: 'Vex' },
          // Foundry's stand-in portrait is no portrait.
          { id: 'myrtle', name: 'Myrtle' },
        ],
        inventory: inventoryView(sheet.inventory, ORIGIN),
        description: sheet.description!.full,
      })
    })

    it("marks no one's own for the Gamemaster, and shows the summary where there is no full description", () => {
      const sheet: GroupSheet = {
        ...groupSheet(),
        description: { full: null, summary: 'hash-summary' },
      }
      const view = partySheetView(sheet, gm, ORIGIN)
      expect(view.members.some(member => 'own' in member)).toBe(false)
      expect(view.description).toBe('hash-summary')
      expect(
        partySheetView(
          { ...sheet, description: { full: null, summary: null } },
          gm,
          ORIGIN,
        ).description,
      ).toBeNull()
    })
  })
})
