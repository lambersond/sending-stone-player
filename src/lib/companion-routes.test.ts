/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../jest.setup'
import {
  companionTableResponse,
  companionTextResponse,
  gmCompanionRollSeat,
  gmCompanionSeat,
  playerCompanionRollSeat,
  playerCompanionSeat,
} from './companion-routes'
import { getCharacter } from '@/db/characters'
import { notePlayersSeen, noteTableOpen } from '@/db/roll-requests'
import {
  FROST_THORIN,
  mockCompanionCampaign,
  mockCompanionEntry,
  mockCompanionSheet,
  PARTY,
} from '@/mocks/sending-stone'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/roll-requests', () => ({
  notePlayersSeen: jest.fn(),
  noteTableOpen: jest.fn(),
}))

const UPDATED = new Date('2026-10-23T12:00:00.000Z')
const wolf = mockCompanionEntry()

/** The Frost Road as held, and Thorin's player's Character in it. */
const held = (fields: object = {}) => {
  prismaMock.campaign.findUnique.mockResolvedValue(
    mockCompanionCampaign(fields) as any,
  )
  prismaMock.campaign.findFirst.mockResolvedValue(
    mockCompanionCampaign(fields) as any,
  )
}

const request = (query = '') =>
  new NextRequest(
    `https://player.example/api/characters/char-1/companions/wolfBrakka/table${query}`,
  )

beforeEach(() => {
  jest.mocked(getCharacter).mockResolvedValue(FROST_THORIN)
  prismaMock.combat.findMany.mockResolvedValue([])
  prismaMock.rollRequest.findMany.mockResolvedValue([])
  prismaMock.companionSheet.findUnique.mockResolvedValue({
    data: mockCompanionSheet(),
    updatedAt: UPDATED,
  } as any)
})

const seatNow = async () => {
  held()
  return (await playerCompanionSeat('user-1', 'char-1', 'wolfBrakka'))!
}

describe('lib/companion-routes', () => {
  describe('the seats', () => {
    it("seats a character's player at its companion, while it's listed as theirs", async () => {
      held()

      await expect(
        playerCompanionSeat('user-1', 'char-1', 'wolfBrakka'),
      ).resolves.toMatchObject({
        role: 'player',
        characterId: 'char-1',
        actorId: 'wolfBrakka',
        companion: { of: PARTY.thorin, entry: wolf },
      })
      expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    })

    it('seats no one at a character that isn’t theirs, or at a companion that isn’t its', async () => {
      held()
      // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
      jest.mocked(getCharacter).mockResolvedValue(undefined)
      await expect(
        playerCompanionSeat('user-2', 'char-1', 'wolfBrakka'),
      ).resolves.toBeUndefined()

      jest.mocked(getCharacter).mockResolvedValue({
        ...FROST_THORIN,
        id: 'char-2',
        actorId: PARTY.vex,
      })
      await expect(
        playerCompanionSeat('user-2', 'char-2', 'wolfBrakka'),
      ).resolves.toBeUndefined()
    })

    it("seats the campaign's Gamemaster at a character's companion, and no other Gamemaster", async () => {
      held()
      await expect(
        gmCompanionSeat('gm-1', 'c1', PARTY.thorin, 'wolfBrakka'),
      ).resolves.toMatchObject({
        role: 'gm',
        characterId: null,
        actorId: 'wolfBrakka',
        companion: { of: PARTY.thorin },
      })

      prismaMock.campaign.findFirst.mockResolvedValue(null)
      await expect(
        gmCompanionSeat('gm-2', 'c1', PARTY.thorin, 'wolfBrakka'),
      ).resolves.toBeUndefined()
      // A companion of another character.
      held()
      await expect(
        gmCompanionSeat('gm-1', 'c1', PARTY.vex, 'wolfBrakka'),
      ).resolves.toBeUndefined()
    })

    it('follows the rolls sent for a companion no longer listed, from its character’s seat alone', async () => {
      held({ companions: [] })

      await expect(
        playerCompanionRollSeat('user-1', 'char-1', 'wolfBrakka'),
      ).resolves.toEqual({
        role: 'player',
        userId: 'user-1',
        campaignId: 'c1',
        actorId: 'wolfBrakka',
        characterId: 'char-1',
        companion: { of: PARTY.thorin },
      })
      await expect(
        gmCompanionRollSeat('gm-1', 'c1', PARTY.thorin, 'wolfBrakka'),
      ).resolves.toMatchObject({
        role: 'gm',
        actorId: 'wolfBrakka',
        companion: { of: PARTY.thorin },
      })

      // Never for a character not theirs, another campaign's Gamemaster, or a bad key.
      // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
      jest.mocked(getCharacter).mockResolvedValue(undefined)
      await expect(
        playerCompanionRollSeat('user-2', 'char-1', 'wolfBrakka'),
      ).resolves.toBeUndefined()
      jest.mocked(getCharacter).mockResolvedValue(FROST_THORIN)
      await expect(
        playerCompanionRollSeat('user-1', 'char-1', 'wolf.brakka'),
      ).resolves.toBeUndefined()
      prismaMock.campaign.findFirst.mockResolvedValue(null)
      await expect(
        gmCompanionRollSeat('gm-2', 'c1', PARTY.thorin, 'wolfBrakka'),
      ).resolves.toBeUndefined()
    })
  })

  describe('companionTableResponse', () => {
    it("gives the companion's view, never cached, noting its player present but its character not open", async () => {
      const seat = await seatNow()

      const response = await companionTableResponse(request(), seat)

      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      await expect(response.json()).resolves.toMatchObject({
        version: 7,
        connected: true,
        companion: { key: 'wolfBrakka' },
        sheetVersion: UPDATED.toISOString(),
        rollsToTable: ['attack', 'damage'],
      })
      expect(notePlayersSeen).toHaveBeenCalledWith('c1')
      expect(noteTableOpen).not.toHaveBeenCalled()
    })

    it('answers 204 while nothing has changed, and the view once the version moves', async () => {
      const seat = await seatNow()
      const unchanged = '?version=7&live=1&rolls=attack,damage'

      const same = await companionTableResponse(request(unchanged), seat)
      expect(same.status).toBe(204)
      expect(same.headers.get('Cache-Control')).toBe('no-store')

      held({ version: 8 })
      const moved = await companionTableResponse(request(unchanged), seat)
      expect(moved.status).toBe(200)
    })

    it.each([
      ['its liveness', '?version=7&live=0&rolls=attack,damage'],
      ['its rolls', '?version=7&live=1&rolls=attack'],
      [
        'where the Gamemaster’s rolls go',
        '?version=7&live=1&rolls=attack,damage&gm=made',
      ],
      [
        'the Gamemaster’s rolls as it',
        '?version=7&live=1&rolls=attack,damage&gmrolls=x',
      ],
      ['typed dice', '?version=7&live=1&rolls=attack,damage&typed=1'],
    ])('sends the view, not 204, when %s changed', async (_, query) => {
      const seat = await seatNow()

      const response = await companionTableResponse(request(query), seat)
      expect(response.status).toBe(200)
    })

    it('leaves out a sheet the pane has', async () => {
      const seat = await seatNow()

      const response = await companionTableResponse(
        request(`?sheet=${encodeURIComponent(UPDATED.toISOString())}`),
        seat,
      )
      expect(await response.json()).not.toHaveProperty('sheet')
    })
  })

  describe('companionTextResponse', () => {
    it("serves its own sheet's descriptions, kept a day, and 404 for any other", async () => {
      held()
      const seat = (await playerCompanionSeat(
        'user-1',
        'char-1',
        'wolfBrakka',
      ))!
      prismaMock.companionSheet.findUnique.mockResolvedValue({
        data: mockCompanionSheet({
          details: {
            about: [],
            personality: [],
            appearance: null,
            xp: null,
            biography: 'b17e0000000001',
          },
        }),
      } as any)
      prismaMock.sheetText.findUnique.mockResolvedValue({
        html: '<p>A grey wolf.</p>',
      } as any)

      const response = await companionTextResponse(seat, 'b17e0000000001')
      expect(response.status).toBe(200)
      expect(response.headers.get('Cache-Control')).toBe(
        'private, max-age=86400',
      )
      await expect(response.json()).resolves.toEqual({
        html: '<p>A grey wolf.</p>',
      })

      const other = await companionTextResponse(seat, '1a90000000000f')
      expect(other.status).toBe(404)
      expect(other.headers.get('Cache-Control')).toBe('no-store')
      const junk = await companionTextResponse(seat, 'not-a-hash')
      expect(junk.status).toBe(404)
    })
  })
})
