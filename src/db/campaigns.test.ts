/* eslint-disable unicorn/no-null -- what Prisma returns for an absent value */
import { prismaMock } from '../../jest.setup'
import {
  changeCampaignSecret,
  checkGameSecret,
  findEventCampaign,
  findInvite,
  getCampaignChoice,
  isLive,
  listOwnedCampaigns,
  markSeen,
  removeCampaign,
  removePlayer,
  resetInviteCode,
  setUpCampaign,
} from './campaigns'
import { roster } from '@/mocks/sending-stone'

jest.mock('@/lib/campaign-secret', () => ({
  generateInviteCode: () => 'fresh-invite-code',
  hashSecret: async (secret: string) => `hash:${secret}`,
  verifySecret: async (secret: string, hash: string) =>
    hash === `hash:${secret}`,
}))

const ORIGIN = 'https://my-game.forge-vtt.com'
const ref = { id: 'camp-a', title: 'The Lonely Mountain' }

describe('db/campaigns', () => {
  describe('isLive', () => {
    const now = Date.parse('2026-10-04T20:00:00Z')

    it('is live for two minutes after anything arrives', () => {
      expect(isLive(new Date(now - 119_000), now)).toBe(true)
      expect(isLive(new Date(now - 120_000), now)).toBe(false)
      expect(isLive(null, now)).toBe(false)
      expect(isLive(undefined, now)).toBe(false)
    })
  })

  describe('for Gamemasters', () => {
    it('lists their campaigns, with who plays each character', async () => {
      const seen = new Date()
      prismaMock.campaign.findMany.mockResolvedValue([
        {
          id: 'c1',
          title: 'The Lonely Mountain',
          origin: ORIGIN,
          worldTitle: 'Return to Erebor',
          inviteCode: 'code-1',
          foundryId: 'camp-a',
          lastSeenAt: seen,
          helloSession: 'session-1',
          characters: roster,
          rollsEnabled: true,
          rollKinds: ['skill', 'save'],
          bridgePolledAt: seen,
          players: [
            { id: 'char-1', actorId: 'actor-thorin', user: { name: 'Alice' } },
            { id: 'char-2', actorId: null, user: { name: 'Bob' } },
          ],
        },
        {
          id: 'c2',
          title: 'Shadows of Mirkwood',
          origin: ORIGIN,
          worldTitle: null,
          inviteCode: null,
          foundryId: null,
          lastSeenAt: null,
          helloSession: null,
          characters: [],
          rollsEnabled: false,
          rollKinds: [],
          bridgePolledAt: null,
          players: [],
        },
      ] as any)

      await expect(listOwnedCampaigns('gm-1')).resolves.toEqual([
        {
          id: 'c1',
          title: 'The Lonely Mountain',
          gameUrl: ORIGIN,
          worldTitle: 'Return to Erebor',
          inviteCode: 'code-1',
          connected: true,
          rosterReceived: true,
          live: true,
          lastSeenAt: seen.toISOString(),
          rolls: { enabled: true, reaching: true },
          characters: [
            {
              id: 'actor-thorin',
              name: 'Thorin Oakenshield',
              player: 'Alice',
              characterId: 'char-1',
            },
            {
              id: 'actor-vex',
              name: 'Vex',
              player: undefined,
              characterId: undefined,
            },
          ],
        },
        {
          id: 'c2',
          title: 'Shadows of Mirkwood',
          gameUrl: ORIGIN,
          worldTitle: undefined,
          inviteCode: '',
          connected: false,
          rosterReceived: false,
          live: false,
          lastSeenAt: undefined,
          rolls: { enabled: false, reaching: false },
          characters: [],
        },
      ])
      expect(prismaMock.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'gm-1' } }),
      )
    })

    it('sets up a campaign, keeping only a hash of its secret', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(null)
      prismaMock.campaign.create.mockResolvedValue({ id: 'c1' } as any)

      await expect(
        setUpCampaign('gm-1', {
          title: '100% Mountain',
          gameUrl: ORIGIN,
          secret: 'hunter2-hunter2',
        }),
      ).resolves.toEqual({ id: 'c1' })
      expect(prismaMock.campaign.findFirst).toHaveBeenCalledWith({
        where: {
          ownerId: 'gm-1',
          origin: ORIGIN,
          title: { equals: String.raw`100\% Mountain`, mode: 'insensitive' },
        },
        select: { id: true },
      })
      expect(prismaMock.campaign.create).toHaveBeenCalledWith({
        data: {
          origin: ORIGIN,
          title: '100% Mountain',
          ownerId: 'gm-1',
          secretHash: 'hash:hunter2-hunter2',
          inviteCode: 'fresh-invite-code',
        },
        select: { id: true },
      })
    })

    it('refuses a second campaign with the same title in the same game', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue({ id: 'c1' } as any)

      await expect(
        setUpCampaign('gm-1', { title: 'x', gameUrl: ORIGIN, secret: 'y' }),
      ).resolves.toBe('duplicate')
      expect(prismaMock.campaign.create).not.toHaveBeenCalled()
    })

    it.each([
      [
        'changes a secret',
        () => changeCampaignSecret('gm-1', 'c1', 'new-secret-123'),
        'updateMany',
        { secretHash: 'hash:new-secret-123' },
      ],
      [
        'resets an invite link',
        () => resetInviteCode('gm-1', 'c1'),
        'updateMany',
        { inviteCode: 'fresh-invite-code' },
      ],
      [
        'removes a campaign',
        () => removeCampaign('gm-1', 'c1'),
        'deleteMany',
        null,
      ],
    ] as const)(
      '%s only for its owner',
      async (_, act, method, data: object | null) => {
        prismaMock.campaign[method].mockResolvedValue({ count: 1 })
        await expect(act()).resolves.toBe(true)
        expect(prismaMock.campaign[method]).toHaveBeenCalledWith({
          where: { id: 'c1', ownerId: 'gm-1' },
          ...(data && { data }),
        })

        prismaMock.campaign[method].mockResolvedValue({ count: 0 })
        await expect(act()).resolves.toBe(false)
      },
    )
  })

  describe('removePlayer', () => {
    it("removes a player's character only from the Gamemaster's own campaign", async () => {
      prismaMock.character.deleteMany.mockResolvedValue({ count: 1 })
      await expect(removePlayer('gm-1', 'c1', 'char-1')).resolves.toBe(true)
      expect(prismaMock.character.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'char-1',
          campaignId: 'c1',
          campaign: { is: { ownerId: 'gm-1' } },
        },
      })

      prismaMock.character.deleteMany.mockResolvedValue({ count: 0 })
      await expect(removePlayer('gm-2', 'c1', 'char-1')).resolves.toBe(false)
    })
  })

  describe('for the module', () => {
    it('finds a bound campaign by its id, if the secret is its', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        id: 'c1',
        secretHash: 'hash:right',
        helloSession: 'session-1',
      } as any)

      await expect(findEventCampaign(ORIGIN, ref, 'right')).resolves.toEqual({
        id: 'c1',
        helloSession: 'session-1',
      })
      await expect(findEventCampaign(ORIGIN, ref, 'wrong')).resolves.toBe(
        'refused',
      )
      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { originCampaign: { origin: ORIGIN, foundryId: 'camp-a' } },
        select: { id: true, secretHash: true, helloSession: true },
      })
      expect(prismaMock.campaign.findMany).not.toHaveBeenCalled()
    })

    it('binds the campaign set up with its title on its first event', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(null)
      prismaMock.campaign.findMany.mockResolvedValue([
        { id: 'someone-elses', secretHash: 'hash:theirs' },
        { id: 'c1', secretHash: 'hash:right' },
      ] as any)

      await expect(findEventCampaign(ORIGIN, ref, 'right')).resolves.toEqual({
        id: 'c1',
      })
      expect(prismaMock.campaign.findMany).toHaveBeenCalledWith({
        where: {
          origin: ORIGIN,
          foundryId: null,
          secretHash: { not: null },
          title: { equals: 'The Lonely Mountain', mode: 'insensitive' },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, secretHash: true },
      })
      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { foundryId: 'camp-a' },
      })
    })

    it('moves the set-up onto a campaign followed before Gamemasters set them up', async () => {
      prismaMock.$transaction.mockImplementation((run: any) => run(prismaMock))
      prismaMock.campaign.findUnique.mockResolvedValue({
        id: 'earlier',
        secretHash: null,
      } as any)
      prismaMock.campaign.findMany.mockResolvedValue([
        { id: 'c1', secretHash: 'hash:right' },
      ] as any)
      const setUp = {
        title: 'The Lonely Mountain',
        ownerId: 'gm-1',
        secretHash: 'hash:right',
        inviteCode: 'code-1',
      }
      prismaMock.campaign.delete.mockResolvedValue(setUp as any)

      await expect(findEventCampaign(ORIGIN, ref, 'right')).resolves.toEqual({
        id: 'earlier',
      })
      expect(prismaMock.campaign.delete).toHaveBeenCalledWith({
        where: { id: 'c1' },
        select: {
          title: true,
          ownerId: true,
          secretHash: true,
          inviteCode: true,
        },
      })
      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'earlier' },
        data: setUp,
      })
    })

    it('knows no campaign that was never set up, and refuses the wrong secret', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(null)
      prismaMock.campaign.findMany.mockResolvedValue([])
      await expect(findEventCampaign(ORIGIN, ref, 'right')).resolves.toBe(
        'unknown',
      )

      prismaMock.campaign.findMany.mockResolvedValue([
        { id: 'c1', secretHash: 'hash:right' },
      ] as any)
      await expect(findEventCampaign(ORIGIN, ref, 'wrong')).resolves.toBe(
        'refused',
      )
      expect(prismaMock.campaign.update).not.toHaveBeenCalled()
    })

    it("tests a connection against any of the game's campaigns", async () => {
      prismaMock.campaign.findMany.mockResolvedValue([
        { secretHash: 'hash:one' },
        { secretHash: 'hash:two' },
      ] as any)
      await expect(checkGameSecret(ORIGIN, 'two')).resolves.toBe('ok')
      await expect(checkGameSecret(ORIGIN, 'three')).resolves.toBe('refused')

      prismaMock.campaign.findMany.mockResolvedValue([])
      await expect(checkGameSecret(ORIGIN, 'two')).resolves.toBe('unknown')
    })

    it('notes when the game was last heard from', async () => {
      await markSeen('c1')

      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { lastSeenAt: expect.any(Date) },
      })
    })
  })

  describe('for players', () => {
    const campaign = {
      id: 'c1',
      title: 'The Lonely Mountain',
      worldTitle: null,
      origin: ORIGIN,
      characters: [...roster, { id: 'actor-bard', name: 'Bard' }],
      owner: { name: 'Gandalf' },
      players: [
        { id: 'char-1', actorId: 'actor-thorin', userId: 'user-1' },
        { id: 'char-2', actorId: 'actor-vex', userId: 'user-2' },
        { id: 'char-3', actorId: null, userId: 'user-1' },
      ],
    }

    it("offers an invite's characters, showing which are taken", async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)

      await expect(findInvite('code-1', 'user-1')).resolves.toEqual({
        id: 'c1',
        title: 'The Lonely Mountain',
        worldTitle: undefined,
        gameUrl: ORIGIN,
        gamemaster: 'Gandalf',
        characters: [
          {
            id: 'actor-thorin',
            name: 'Thorin Oakenshield',
            claimedBy: 'you',
            characterId: 'char-1',
          },
          { id: 'actor-vex', name: 'Vex', claimedBy: 'someone' },
          { id: 'actor-bard', name: 'Bard' },
        ],
      })
      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { inviteCode: 'code-1' } }),
      )
    })

    it('knows no invite that was reset', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(null)
      await expect(findInvite('old-code', 'user-1')).resolves.toBeUndefined()
      await expect(findInvite('', 'user-1')).resolves.toBeUndefined()
    })

    it("doesn't count a character's own choice against it when it chooses again", async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        ...campaign,
        owner: null,
      } as any)

      const choice = await getCampaignChoice('c1', 'user-1', 'char-1')

      expect(choice?.gamemaster).toBeUndefined()
      expect(choice?.characters[0]).toEqual({
        id: 'actor-thorin',
        name: 'Thorin Oakenshield',
      })
      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'c1' } }),
      )

      prismaMock.campaign.findUnique.mockResolvedValue(null)
      await expect(
        getCampaignChoice('gone', 'user-1', 'char-1'),
      ).resolves.toBeUndefined()
    })
  })
})
