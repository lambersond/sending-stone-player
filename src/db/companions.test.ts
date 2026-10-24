/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { prismaMock } from '../../jest.setup'
import {
  companionRollSeat,
  companionRoster,
  companionSeat,
  getCompanionStatus,
  getCompanionText,
  getCompanionView,
} from './companions'
import { playerSeat } from './seats'
import {
  combat,
  combatant,
  mockCompanionEntry,
  mockCompanionSheet,
  mockSummonedEntry,
  PARTY,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import type { SheetSeat } from '@/types/character'
import type { CompanionEntry } from '@/types/sending-stone'

// A character's companions, from module 0.36.0: the seat at one, its view, its status and its
// descriptions.

const ORIGIN = 'https://my-game.forge-vtt.com'

/** Thorin's player at his sheet. */
const thorin = playerSeat(
  {
    id: 'char-1',
    name: 'Thorin',
    gameUrl: ORIGIN,
    campaignTitle: 'The Frost Road',
    campaignId: 'c1',
    actorId: PARTY.thorin,
  },
  'user-1',
)
/** Vex's player at hers. */
const vex = playerSeat(
  {
    id: 'char-2',
    name: 'Vex',
    gameUrl: ORIGIN,
    campaignTitle: 'The Frost Road',
    campaignId: 'c1',
    actorId: PARTY.vex,
  },
  'user-2',
)
/** The campaign's Gamemaster at Thorin's sheet. */
const gm: SheetSeat = {
  name: 'Thorin',
  gameUrl: ORIGIN,
  campaignTitle: 'The Frost Road',
  campaignId: 'c1',
  actorId: PARTY.thorin,
  role: 'gm',
  userId: 'gm-1',
  characterId: null,
}

const wolf = mockCompanionEntry()
const imp = mockSummonedEntry()
/** A wolf Thorin's and Vex's players both own, Vex's listed first. */
const shared = mockCompanionEntry({
  key: 'wolfShared',
  actorId: 'wolfShared',
  name: 'Grey',
  of: [PARTY.vex, PARTY.thorin],
})

/** The campaign as held, its companions listed. */
const listing = (companions: unknown[] = [wolf, imp]) =>
  prismaMock.campaign.findUnique.mockResolvedValue({ companions } as any)

/** The seat at a companion, as its route resolves it. */
const seatAt = async (seat: SheetSeat, key: string) => {
  listing([wolf, imp, shared])
  const at = await companionSeat(seat, key)
  prismaMock.campaign.findUnique.mockReset()
  return at!
}

const UPDATED = new Date('2026-10-23T12:00:00.000Z')
const recently = () => new Date(Date.now() - 5000)

/** The campaign as a companion's view reads it. */
const held = (fields: object = {}) =>
  prismaMock.campaign.findUnique.mockResolvedValue({
    version: 7,
    lastSeenAt: recently(),
    origin: ORIGIN,
    characters: [
      { id: PARTY.thorin, name: 'Thorin', manualDice: true },
      { id: PARTY.vex, name: 'Vex' },
    ],
    companions: [wolf, imp, shared],
    companionKinds: ['attack', 'damage', 'use', 'initiative', 'itemDamage'],
    companionInitiative: 'own',
    rollsEnabled: true,
    rollKinds: [
      'skill',
      'attack',
      'damage',
      'use',
      'initiative',
      'inspiration',
    ],
    rollFeatures: ['modifiers', 'prompts', 'manualDice'],
    bridgePolledAt: recently(),
    transfersEnabled: false,
    removalsEnabled: false,
    ...fields,
  } as any)

/** A fight with Thorin, the wolf, the imp and a goblin. */
const fight = (fields: object = {}) =>
  combat({
    combatants: [
      combatant({
        id: 'c-thorin',
        name: 'Thorin',
        character: PARTY.thorin,
        initiative: 18,
        hp: { value: 30, max: 44, temp: 0 },
      }),
      combatant({
        id: 'c-wolf',
        name: 'Wolf',
        companion: 'wolfBrakka',
        playerOwned: true,
        initiative: null,
        hp: { value: 11, max: 11, temp: 0 },
      }),
      combatant({
        id: 'c-imp',
        name: 'Imp',
        companion: 'sceneFrost-tokenImp',
        initiative: 12,
        hp: { value: 10, max: 10, temp: 0 },
      }),
      combatant({
        id: 'c-goblin',
        name: 'Goblin',
        initiative: 9,
        hp: { value: 7, max: 7, temp: 0 },
      }),
    ],
    ...fields,
  })

beforeEach(() => {
  prismaMock.campaign.findUnique.mockReset()
  prismaMock.combat.findMany.mockResolvedValue([])
  prismaMock.companionSheet.findUnique.mockResolvedValue(null)
  prismaMock.rollRequest.findMany.mockResolvedValue([])
})

const described = (entry: CompanionEntry = wolf) =>
  mockCompanionSheet({
    details: {
      about: [],
      personality: [],
      appearance: null,
      xp: null,
      biography: entry === wolf ? 'b17e0000000001' : '1a90000000000f',
    },
  })

describe('db/companions', () => {
  describe('companionRoster', () => {
    it('reads the companions held, dropping what it can’t', () => {
      expect(
        companionRoster([
          wolf,
          { ...wolf, key: 'a.b' },
          { ...wolf, of: [] },
          { ...wolf, of: [7] },
          { ...wolf, kind: 'pet' },
          { ...wolf, name: null },
          null,
          'wolf',
          imp,
        ]),
      ).toEqual([wolf, imp])
      // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
      expect(companionRoster(undefined)).toEqual([])
      expect(companionRoster({ wolf })).toEqual([])
    })
  })

  describe('companionSeat', () => {
    it("seats the player at their character's companion, as the companion, their character's player", async () => {
      listing()

      await expect(companionSeat(thorin, 'wolfBrakka')).resolves.toEqual({
        ...thorin,
        actorId: 'wolfBrakka',
        name: 'Wolf',
        companion: { of: PARTY.thorin, entry: wolf },
      })
      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'c1' },
        select: { companions: true },
      })
      // A token's creature, by its key.
      await expect(
        companionSeat(thorin, 'sceneFrost-tokenImp'),
      ).resolves.toMatchObject({
        actorId: 'sceneFrost-tokenImp',
        characterId: 'char-1',
        companion: { of: PARTY.thorin, entry: imp },
      })
    })

    it("seats no one at another player's character's companion", async () => {
      listing()

      await expect(companionSeat(vex, 'wolfBrakka')).resolves.toBeUndefined()
    })

    it('seats no one at a companion not listed, or by a key that can’t be one, without looking', async () => {
      listing([imp])
      await expect(companionSeat(thorin, 'wolfBrakka')).resolves.toBeUndefined()

      prismaMock.campaign.findUnique.mockClear()
      for (const key of ['wolf.brakka', 'a-b-c', '', 'w'.repeat(65)]) {
        await expect(companionSeat(thorin, key)).resolves.toBeUndefined()
      }
      expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    })

    it("seats the Gamemaster at a character's companion, as theirs, with no character of their own", async () => {
      listing()

      await expect(companionSeat(gm, 'wolfBrakka')).resolves.toEqual({
        ...gm,
        actorId: 'wolfBrakka',
        name: 'Wolf',
        companion: { of: PARTY.thorin, entry: wolf },
      })
    })

    it('never nests a seat at a companion', async () => {
      listing()
      const at = await companionSeat(thorin, 'wolfBrakka')
      prismaMock.campaign.findUnique.mockClear()

      await expect(companionSeat(at!, 'wolfBrakka')).resolves.toBeUndefined()
      expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    })

    it('seats each player owning a shared one at it, as their own character’s', async () => {
      listing([shared])

      await expect(companionSeat(vex, 'wolfShared')).resolves.toMatchObject({
        companion: { of: PARTY.vex },
      })
      await expect(companionSeat(thorin, 'wolfShared')).resolves.toMatchObject({
        companion: { of: PARTY.thorin },
      })
    })
  })

  describe('companionRollSeat', () => {
    it('follows the rolls sent for a companion from the character’s seat, listed now or not', () => {
      expect(companionRollSeat(thorin, 'wolfBrakka')).toEqual({
        role: 'player',
        userId: 'user-1',
        campaignId: 'c1',
        actorId: 'wolfBrakka',
        characterId: 'char-1',
        companion: { of: PARTY.thorin },
      })
      expect(companionRollSeat(gm, 'sceneFrost-tokenImp')).toEqual({
        role: 'gm',
        userId: 'gm-1',
        campaignId: 'c1',
        actorId: 'sceneFrost-tokenImp',
        characterId: null,
        companion: { of: PARTY.thorin },
      })
      // The stored list isn't read: what's served at it is the seat's own rolls for that key.
      expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    })

    it('is nothing for a key that can’t be a companion’s, or a seat at a companion already', async () => {
      expect(companionRollSeat(thorin, 'wolf.brakka')).toBeUndefined()
      expect(companionRollSeat(thorin, '')).toBeUndefined()
      expect(
        companionRollSeat({ ...thorin, actorId: null }, 'wolfBrakka'),
      ).toBeUndefined()
      const at = await seatAt(thorin, 'wolfBrakka')
      expect(companionRollSeat(at, 'wolfBrakka')).toBeUndefined()
    })
  })

  describe('getCompanionView', () => {
    it('gives the companion’s sheet, its kinds of roll as its campaign takes them, and no asks', async () => {
      const seat = await seatAt(thorin, 'wolfBrakka')
      held()
      prismaMock.companionSheet.findUnique.mockResolvedValue({
        data: mockCompanionSheet(),
        updatedAt: UPDATED,
      } as any)

      const view = await getCompanionView(seat)

      expect(view).toMatchObject({
        version: 7,
        live: true,
        connected: true,
        companion: {
          key: 'wolfBrakka',
          name: 'Wolf',
          kind: 'owned',
          portrait: `${ORIGIN}/worlds/frost-road/wolf.webp`,
        },
        sheet: toTableSheet(mockCompanionSheet(), ORIGIN),
        sheetVersion: UPDATED.toISOString(),
        // Of those the game takes from the character's player, only a companion's.
        rollsToTable: ['initiative', 'attack', 'use', 'damage'],
        // What the game asks is never asked of a companion.
        rollFeatures: ['modifiers', 'manualDice'],
        initiative: { mode: 'own' },
      })
      expect(prismaMock.companionSheet.findUnique).toHaveBeenCalledWith({
        where: { campaignCompanion: { campaignId: 'c1', key: 'wolfBrakka' } },
        select: { data: true, updatedAt: true },
      })
      expect(prismaMock.actorSheet.findUnique).not.toHaveBeenCalled()
      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'c1' },
        select: {
          version: true,
          lastSeenAt: true,
          origin: true,
          characters: true,
          companions: true,
          companionKinds: true,
          companionInitiative: true,
          rollsEnabled: true,
          rollKinds: true,
          rollFeatures: true,
          bridgePolledAt: true,
          transfersEnabled: true,
          removalsEnabled: true,
        },
      })
    })

    it('leaves out a sheet the pane has', async () => {
      const seat = await seatAt(thorin, 'wolfBrakka')
      held()
      prismaMock.companionSheet.findUnique.mockResolvedValue({
        data: mockCompanionSheet(),
        updatedAt: UPDATED,
      } as any)

      const view = await getCompanionView(seat, {
        sheetVersion: UPDATED.toISOString(),
      })
      expect(view).not.toHaveProperty('sheet')
      expect(view.sheetVersion).toBe(UPDATED.toISOString())
    })

    it('says why its sheet was held back', async () => {
      const big = {
        ...wolf,
        sheetWithheld: {
          reason: 'tooLarge',
          bytes: 5_000_000,
          limit: 4_000_000,
        },
      }
      const seat = await seatAt(thorin, 'wolfBrakka')
      held({ companions: [big] })

      await expect(getCompanionView(seat)).resolves.toMatchObject({
        sheetWithheld: {
          reason: 'tooLarge',
          bytes: 5_000_000,
          limit: 4_000_000,
        },
      })
    })

    it('offers nothing to roll once the module no longer lists it as the character’s', async () => {
      const seat = await seatAt(thorin, 'wolfBrakka')
      held({ companions: [imp] })

      const view = await getCompanionView(seat)
      expect(view.connected).toBe(false)
      expect(view.rollsToTable).toEqual([])
      expect(view.rollFeatures).toEqual([])
      // Its last entry still names it.
      expect(view.companion?.name).toBe('Wolf')
    })

    it('shows the fight from the companion: its own combatant the seat’s, its character the party’s and the player’s', async () => {
      const seat = await seatAt(thorin, 'wolfBrakka')
      held()
      prismaMock.combat.findMany.mockResolvedValue([{ data: fight() }] as any)

      const { combat: shown } = await getCompanionView(seat)
      const byId = new Map(shown?.combatants.map(each => [each.id, each]))
      expect(byId.get('c-wolf')).toMatchObject({
        side: 'me',
        companion: 'wolfBrakka',
        hp: { value: 11, max: 11, temp: 0 },
      })
      expect(byId.get('c-wolf')).not.toHaveProperty('yours')
      expect(byId.get('c-thorin')).toMatchObject({
        side: 'party',
        yours: true,
        hp: { value: 30, max: 44, temp: 0 },
      })
      expect(byId.get('c-imp')).toMatchObject({
        side: 'party',
        yours: true,
        companion: 'sceneFrost-tokenImp',
      })
      expect(byId.get('c-goblin')).toMatchObject({ side: 'other' })
      expect(byId.get('c-goblin')?.hp).toBeUndefined()
    })

    it('shows the player the Gamemaster’s rolls as the companion, never as the character', async () => {
      const seat = await seatAt(thorin, 'wolfBrakka')
      held()

      await getCompanionView(seat)

      expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            campaignId: 'c1',
            actorId: 'wolfBrakka',
            role: 'gm',
          }),
        }),
      )
    })

    it("types in the companion's dice as its character's are, for its player only", async () => {
      const seat = await seatAt({ ...thorin, manualDice: true }, 'wolfBrakka')
      held()
      await expect(getCompanionView(seat)).resolves.toMatchObject({
        manualDice: { offered: true, on: true },
      })

      // Vex's character may not type hers.
      const hers = await seatAt(vex, 'wolfShared')
      held()
      await expect(getCompanionView(hers)).resolves.toMatchObject({
        manualDice: { offered: false, on: false },
      })

      const gmAt = await seatAt(gm, 'wolfBrakka')
      held()
      const view = await getCompanionView(gmAt)
      expect(view).not.toHaveProperty('manualDice')
      // The game makes no Gamemaster's rolls as a character: theirs stay here until it's updated.
      expect(view.gm).toEqual({ rolls: 'update' })
    })

    describe('how it enters initiative', () => {
      it('rolls its own, as its campaign has it by default', async () => {
        const seat = await seatAt(thorin, 'wolfBrakka')
        held()
        prismaMock.combat.findMany.mockResolvedValue([{ data: fight() }] as any)

        await expect(getCompanionView(seat)).resolves.toMatchObject({
          initiative: { mode: 'own' },
        })
      })

      it('acts right after its character, named, while the character is in the fight', async () => {
        const seat = await seatAt(thorin, 'wolfBrakka')
        held({ companionInitiative: 'after' })
        prismaMock.combat.findMany.mockResolvedValue([{ data: fight() }] as any)

        await expect(getCompanionView(seat)).resolves.toMatchObject({
          initiative: { mode: 'after', after: 'Thorin' },
        })
      })

      it('names no one while its character isn’t in the fight', async () => {
        const seat = await seatAt(thorin, 'wolfBrakka')
        held({ companionInitiative: 'after' })
        const without = fight()
        without.combatants = without.combatants.filter(
          ({ character }) => character !== PARTY.thorin,
        )
        prismaMock.combat.findMany.mockResolvedValue([{ data: without }] as any)

        const { initiative } = await getCompanionView(seat)
        expect(initiative).toEqual({ mode: 'after' })
      })

      it('follows the first of a shared one’s characters that has an initiative, else the first in the fight', async () => {
        const both = combat({
          combatants: [
            combatant({ id: 'c-vex', character: PARTY.vex, initiative: null }),
            combatant({
              id: 'c-thorin',
              character: PARTY.thorin,
              initiative: 15,
            }),
            combatant({ id: 'c-grey', companion: 'wolfShared' }),
          ],
        })
        const seat = await seatAt(vex, 'wolfShared')
        held({ companionInitiative: 'after' })
        prismaMock.combat.findMany.mockResolvedValue([{ data: both }] as any)
        await expect(getCompanionView(seat)).resolves.toMatchObject({
          initiative: { mode: 'after', after: 'Thorin' },
        })

        // Neither has rolled: the first of them in the fight.
        both.combatants[1].initiative = null
        held({ companionInitiative: 'after' })
        await expect(getCompanionView(seat)).resolves.toMatchObject({
          initiative: { mode: 'after', after: 'Vex' },
        })
      })
    })
  })

  describe('getCompanionStatus', () => {
    it('gives what tells its pane nothing changed: the version, liveness, its rolls, and typed dice', async () => {
      const seat = await seatAt({ ...thorin, manualDice: true }, 'wolfBrakka')
      held()

      await expect(getCompanionStatus(seat)).resolves.toEqual({
        version: 7,
        live: true,
        rollsToTable: ['initiative', 'attack', 'use', 'damage'],
        rollFeatures: ['modifiers', 'manualDice'],
        typed: true,
      })
    })

    it('says where the Gamemaster’s rolls go at their seat, and nothing to roll once it’s no longer listed', async () => {
      const gmAt = await seatAt(gm, 'wolfBrakka')
      held({ rollFeatures: ['gmRolls'] })
      await expect(getCompanionStatus(gmAt)).resolves.toMatchObject({
        gm: { rolls: 'made' },
        rollsToTable: ['initiative', 'attack', 'use', 'damage'],
        typed: false,
      })

      const seat = await seatAt(thorin, 'wolfBrakka')
      held({ companions: [imp] })
      await expect(getCompanionStatus(seat)).resolves.toMatchObject({
        rollsToTable: [],
        rollFeatures: [],
      })
    })

    it('changes with the Gamemaster’s rolls as it', async () => {
      const seat = await seatAt(thorin, 'wolfBrakka')
      held()
      prismaMock.rollRequest.findMany.mockResolvedValue([
        {
          id: 'gm-1',
          status: 'done',
          createdAt: new Date(),
          claimedAt: new Date(),
          completedAt: new Date(),
        },
      ] as any)

      const status = await getCompanionStatus(seat)
      expect(status.gmRollsKey).toEqual(expect.any(String))
    })

    it('is version 0 for a campaign gone', async () => {
      const seat = await seatAt(thorin, 'wolfBrakka')
      prismaMock.campaign.findUnique.mockResolvedValue(null)

      await expect(getCompanionStatus(seat)).resolves.toEqual({
        version: 0,
        live: false,
        rollsToTable: [],
        rollFeatures: [],
        typed: false,
      })
    })
  })

  describe('getCompanionText', () => {
    it('serves a description its own sheet refers to, and nothing else', async () => {
      const seat = await seatAt(thorin, 'wolfBrakka')
      prismaMock.companionSheet.findUnique.mockResolvedValue({
        data: described(),
      } as any)
      prismaMock.sheetText.findUnique.mockResolvedValue({
        html: '<p>A grey wolf.</p>',
      } as any)

      await expect(getCompanionText(seat, 'b17e0000000001')).resolves.toBe(
        '<p>A grey wolf.</p>',
      )
      expect(prismaMock.companionSheet.findUnique).toHaveBeenCalledWith({
        where: { campaignCompanion: { campaignId: 'c1', key: 'wolfBrakka' } },
        select: { data: true },
      })
      prismaMock.sheetText.findUnique.mockClear()
      await expect(
        getCompanionText(seat, '1a90000000000f'),
      ).resolves.toBeUndefined()
      expect(prismaMock.sheetText.findUnique).not.toHaveBeenCalled()
    })

    it('serves nothing at a character’s own seat', async () => {
      await expect(
        getCompanionText(thorin, 'b17e0000000001'),
      ).resolves.toBeUndefined()
      expect(prismaMock.companionSheet.findUnique).not.toHaveBeenCalled()
    })
  })
})
