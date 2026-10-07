/* eslint-disable unicorn/no-null -- Prisma uses null for an absent value */
import { prismaMock } from '../../jest.setup'
import {
  claimRollRequests,
  createRollRequest,
  getRollRequestView,
  markBridgePolled,
  notePlayersSeen,
  recordCommandResult,
} from './roll-requests'
import {
  characterSheet,
  combat,
  combatant,
  fullerSheet,
} from '@/mocks/sending-stone'
import type { RollRequestInput } from '@/types/roll'

const NOW = Date.parse('2026-10-09T20:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)

const character = {
  id: 'char-1',
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

const perception: RollRequestInput = {
  kind: 'skill',
  key: 'prc',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
}

const initiative: RollRequestInput = {
  kind: 'initiative',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [9] }],
  combatId: 'cmbt1',
}

/** A campaign whose game takes skill checks and initiative, its module fetching them. */
const takingRolls = {
  rollsEnabled: true,
  rollKinds: ['skill', 'initiative'],
  bridgePolledAt: ago(5000),
}

/** A held roll, as read back. */
const held = (id: string, fields: object = {}) => ({
  id,
  actorId: 'actor-thorin',
  kind: 'skill',
  payload: perception,
  status: 'claimed',
  result: null,
  createdAt: ago(3000),
  claimedAt: new Date(NOW),
  ...fields,
})

describe('db/roll-requests', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('createRollRequest', () => {
    /** The sheet, combats and roll counts the request is checked against. */
    const given = ({
      sheet = fullerSheet() as object | null,
      combats = [] as object[],
      inFlight = 0,
      lastMinute = 0,
    } = {}) => {
      prismaMock.campaign.findUnique.mockResolvedValue(takingRolls as any)
      prismaMock.actorSheet.findUnique.mockResolvedValue(
        sheet ? ({ data: sheet } as any) : null,
      )
      prismaMock.combat.findMany.mockResolvedValue(
        combats.map(data => ({ data })) as any,
      )
      prismaMock.rollRequest.count
        .mockResolvedValueOnce(inFlight)
        .mockResolvedValueOnce(lastMinute)
      prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-1' } as any)
    }

    it("takes a roll the game takes and the character's sheet allows", async () => {
      given()

      await expect(createRollRequest(character, perception)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'c1' },
        select: { rollsEnabled: true, rollKinds: true, bridgePolledAt: true },
      })
      expect(prismaMock.actorSheet.findUnique).toHaveBeenCalledWith({
        where: { campaignActor: { campaignId: 'c1', actorId: 'actor-thorin' } },
        select: { data: true },
      })
      expect(prismaMock.combat.findMany).not.toHaveBeenCalled()
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
        data: {
          campaignId: 'c1',
          characterId: 'char-1',
          actorId: 'actor-thorin',
          kind: 'skill',
          payload: perception,
          createdAt: new Date(NOW),
        },
        select: { id: true },
      })
      // Only the latest rolls are kept.
      expect(prismaMock.rollRequest.deleteMany).toHaveBeenCalledWith({
        where: { characterId: 'char-1', createdAt: { lt: ago(86_400_000) } },
      })
    })

    it('counts the rolls the character has on their way, and made in the last minute', async () => {
      given()
      await createRollRequest(character, perception)

      expect(prismaMock.rollRequest.count).toHaveBeenCalledWith({
        where: {
          characterId: 'char-1',
          OR: [
            { status: 'pending', createdAt: { gt: ago(30_000) } },
            { status: 'claimed', claimedAt: { gt: ago(75_000) } },
          ],
        },
      })
      expect(prismaMock.rollRequest.count).toHaveBeenCalledWith({
        where: { characterId: 'char-1', createdAt: { gt: ago(60_000) } },
      })
    })

    it.each([
      ['in no campaign', { campaignId: null }],
      ['without an actor', { actorId: null }],
    ])('refuses, without looking, a character %s', async (_name, fields) => {
      await expect(
        createRollRequest({ ...character, ...fields }, perception),
      ).resolves.toEqual({ status: 409, reason: 'unavailable' })
      expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    })

    it.each([
      ['its campaign is gone', null],
      ['the Gamemaster has rolls off', { ...takingRolls, rollsEnabled: false }],
      [
        'the module has stopped fetching',
        { ...takingRolls, bridgePolledAt: ago(60_000) },
      ],
      [
        'the game does not take the kind',
        { ...takingRolls, rollKinds: ['save'] },
      ],
    ])('refuses a roll when %s', async (_name, campaign) => {
      prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)

      await expect(createRollRequest(character, perception)).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it.each([
      ['three rolls on their way', { inFlight: 3 }],
      ['twenty rolls in the last minute', { lastMinute: 20 }],
    ])('refuses a character with %s', async (_name, counts) => {
      given(counts)

      await expect(createRollRequest(character, perception)).resolves.toEqual({
        status: 429,
        reason: 'busy',
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it('refuses what the sheet lacks, or a roll for a character without one', async () => {
      given()
      await expect(
        createRollRequest(character, { ...perception, key: 'xyz' }),
      ).resolves.toEqual({ status: 422, reason: 'unknown' })

      given({ sheet: null })
      await expect(createRollRequest(character, perception)).resolves.toEqual({
        status: 422,
        reason: 'unknown',
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it('takes initiative in the combat the character waits in, and only there', async () => {
      const waiting = combat({
        combatants: [
          combatant({
            id: 'c-thorin',
            character: 'actor-thorin',
            initiative: null,
          }),
        ],
      })
      given({ sheet: characterSheet(), combats: [waiting] })

      await expect(createRollRequest(character, initiative)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.combat.findMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', combatId: 'cmbt1' },
        select: { data: true },
      })

      given({ sheet: characterSheet(), combats: [] })
      await expect(createRollRequest(character, initiative)).resolves.toEqual({
        status: 422,
        reason: 'not-in-combat',
      })
    })
  })

  describe('getRollRequestView', () => {
    it("reads a roll of the character's, and where it stands", async () => {
      prismaMock.rollRequest.findFirst.mockResolvedValue(
        held('req-1', { status: 'pending', claimedAt: null }) as any,
      )

      await expect(getRollRequestView('char-1', 'req-1')).resolves.toEqual({
        id: 'req-1',
        status: 'sending',
      })
      expect(prismaMock.rollRequest.findFirst).toHaveBeenCalledWith({
        where: { id: 'req-1', characterId: 'char-1' },
        select: expect.objectContaining({ status: true, result: true }),
      })
    })

    it("is nothing for a roll that isn't the character's", async () => {
      prismaMock.rollRequest.findFirst.mockResolvedValue(null)

      await expect(
        getRollRequestView('char-1', 'req-9'),
      ).resolves.toBeUndefined()
    })
  })

  describe('claimRollRequests', () => {
    it('hands over nothing, and marks nothing, when no roll waits', async () => {
      prismaMock.rollRequest.findMany.mockResolvedValue([])

      await expect(claimRollRequests('c1', 'session-1')).resolves.toEqual([])
      expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          status: 'pending',
          createdAt: { gt: ago(30_000) },
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
        select: { id: true },
      })
      expect(prismaMock.rollRequest.updateMany).not.toHaveBeenCalled()
    })

    it('marks the waiting rolls fetched, and hands over only those it marked', async () => {
      prismaMock.rollRequest.findMany
        .mockResolvedValueOnce([{ id: 'req-1' }, { id: 'req-2' }] as any)
        // Another fetch marked req-2 first.
        .mockResolvedValueOnce([held('req-1')] as any)

      await expect(claimRollRequests('c1', 'session-1')).resolves.toEqual([
        { ...perception, id: 'req-1', actorId: 'actor-thorin' },
      ])
      expect(prismaMock.rollRequest.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['req-1', 'req-2'] }, status: 'pending' },
        data: {
          status: 'claimed',
          claimToken: expect.any(String),
          claimSession: 'session-1',
          claimedAt: new Date(NOW),
        },
      })
      const { claimToken } =
        prismaMock.rollRequest.updateMany.mock.calls[0][0].data
      expect(prismaMock.rollRequest.findMany).toHaveBeenLastCalledWith({
        where: { id: { in: ['req-1', 'req-2'] }, claimToken },
        orderBy: { createdAt: 'asc' },
        select: expect.objectContaining({ payload: true, actorId: true }),
      })
    })

    it('marks each fetch apart', async () => {
      prismaMock.rollRequest.findMany.mockResolvedValue([
        { id: 'req-1' },
      ] as any)
      await claimRollRequests('c1', 'session-1')
      await claimRollRequests('c1', 'session-1')

      const [first, second] = prismaMock.rollRequest.updateMany.mock.calls.map(
        ([update]) => update.data.claimToken,
      )
      expect(first).not.toEqual(second)
    })
  })

  describe('recordCommandResult', () => {
    it("records what became of a fetched roll of the campaign's", async () => {
      const result = {
        id: 'req-1',
        status: 'done' as const,
        reason: null,
        error: null,
        messageId: 'msg-1',
        visible: true,
        rolls: [],
      }
      await recordCommandResult('c1', result)

      expect(prismaMock.rollRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'req-1', campaignId: 'c1', status: 'claimed' },
        data: { status: 'done', result, completedAt: new Date(NOW) },
      })
    })
  })

  describe('markBridgePolled', () => {
    it('notes the fetch, and tells whether players are about', async () => {
      prismaMock.campaign.update.mockResolvedValue({
        rollsEnabled: true,
        playersSeenAt: ago(60_000),
      } as any)

      await expect(markBridgePolled('c1')).resolves.toEqual({
        rollsEnabled: true,
        playersPresent: true,
      })
      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { bridgePolledAt: new Date(NOW), lastSeenAt: new Date(NOW) },
        select: { rollsEnabled: true, playersSeenAt: true },
      })
    })

    it.each([
      ['none has been', null],
      ['none has been for two minutes', ago(120_000)],
    ])('tells players are away when %s', async (_name, playersSeenAt) => {
      prismaMock.campaign.update.mockResolvedValue({
        rollsEnabled: false,
        playersSeenAt,
      } as any)

      await expect(markBridgePolled('c1')).resolves.toEqual({
        rollsEnabled: false,
        playersPresent: false,
      })
    })
  })

  describe('notePlayersSeen', () => {
    it('notes players present at most once every half minute', async () => {
      await notePlayersSeen('c-seen')
      expect(prismaMock.campaign.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'c-seen',
          OR: [{ playersSeenAt: null }, { playersSeenAt: { lt: ago(30_000) } }],
        },
        data: { playersSeenAt: new Date(NOW) },
      })

      jest.setSystemTime(NOW + 29_000)
      await notePlayersSeen('c-seen')
      expect(prismaMock.campaign.updateMany).toHaveBeenCalledTimes(1)

      await notePlayersSeen('c-other')
      expect(prismaMock.campaign.updateMany).toHaveBeenCalledTimes(2)

      jest.setSystemTime(NOW + 30_000)
      await notePlayersSeen('c-seen')
      expect(prismaMock.campaign.updateMany).toHaveBeenCalledTimes(3)
    })
  })
})
