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
  recordRefusal,
  removeCampaign,
  removePlayer,
  resetInviteCode,
  setUpCampaign,
} from './campaigns'
import { WAITING_SECRET_CHECKS } from '@/constants/sending-stone'
import { verifySecret } from '@/lib/campaign-secret'
import { groupEntry, roster } from '@/mocks/sending-stone'

jest.mock('@/lib/campaign-secret', () => ({
  generateInviteCode: () => 'fresh-invite-code',
  hashSecret: async (secret: string) => `hash:${secret}`,
  verifySecret: jest.fn(
    async (secret: string, hash: string) => hash === `hash:${secret}`,
  ),
}))

const ORIGIN = 'https://my-game.forge-vtt.com'
const ref = { id: 'camp-a', title: 'The Lonely Mountain' }

/** What clears a campaign's recorded refusal. */
const NO_REFUSAL = {
  refusedAt: null,
  refusalReason: null,
  refusalStatus: null,
  refusalDetail: null,
}

/** Written once a minute, at most, unless the reason changes. */
const recently = (reason: string) => ({
  OR: [
    { refusedAt: null },
    { refusedAt: { lt: expect.any(Date) } },
    { refusalReason: { not: reason } },
  ],
})

/** A Gamemaster's one campaign, as listed, stored with these fields. */
const listed = async (fields: object) => {
  prismaMock.campaign.findMany.mockResolvedValue([
    {
      id: 'c1',
      title: 'Mirkwood Forest',
      origin: ORIGIN,
      worldTitle: null,
      inviteCode: 'code-1',
      foundryId: null,
      lastSeenAt: null,
      helloSession: null,
      characters: [],
      rollsEnabled: false,
      rollKinds: [],
      rollFeatures: [],
      bridgePolledAt: null,
      refusedAt: null,
      refusalReason: null,
      refusalStatus: null,
      refusalDetail: null,
      players: [],
      ...fields,
    },
  ] as any)
  const [campaign] = await listOwnedCampaigns('gm-1')
  return campaign
}

/**
 * A game with seven campaigns waiting for Foundry, w1 set up first and w7 last, each with its own
 * secret but those given ours, and none with the title posted; found as Prisma finds them, ordered
 * and limited as asked.
 */
const game = (ours: string[] = []) => {
  const waiting = Array.from({ length: 7 }, (_, index) => {
    const id = `w${index + 1}`
    return {
      id,
      secretHash: ours.includes(id) ? 'hash:ours' : `hash:${id}`,
      createdAt: new Date(Date.UTC(2026, 9, 1 + index)),
    }
  })
  prismaMock.campaign.findUnique.mockResolvedValue(null)
  prismaMock.campaign.findMany
    .mockResolvedValueOnce([])
    .mockImplementationOnce((async ({ orderBy, take }: any) => {
      const sign = orderBy?.createdAt === 'desc' ? -1 : 1
      const sorted = orderBy?.createdAt
        ? waiting.toSorted(
            (a, b) => sign * (a.createdAt.getTime() - b.createdAt.getTime()),
          )
        : waiting
      return sorted
        .slice(0, take ?? sorted.length)
        .map(({ id, secretHash }) => ({ id, secretHash }))
    }) as any)
}

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
          rollKinds: ['skill', 'save', 'attack', 'damage'],
          rollFeatures: ['modifiers', 'prompts'],
          bridgePolledAt: seen,
          transfersEnabled: true,
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
          rollFeatures: [],
          bridgePolledAt: null,
          transfersEnabled: true,
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
          rolls: {
            enabled: true,
            reaching: true,
            attacks: true,
            spells: false,
            prompts: true,
          },
          // From module 0.31.0: turned on, and the game fetching moves.
          transfers: { enabled: true, reaching: true },
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
          groups: [],
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
          rolls: {
            enabled: false,
            reaching: false,
            attacks: false,
            spells: false,
            prompts: false,
          },
          // Turned on, but the game isn't fetching moves.
          transfers: { enabled: true, reaching: false },
          characters: [],
          groups: [],
        },
      ])
      expect(prismaMock.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'gm-1' } }),
      )
    })

    it('lists their party sheets, each saying whether any player may see it, never who (module 0.30.0)', async () => {
      const campaign = await listed({
        groups: [
          groupEntry(),
          groupEntry({
            id: 'hidden',
            name: 'The Hidden Hand',
            primary: false,
            access: {},
          }),
        ],
      })

      expect(campaign.groups).toEqual([
        { id: 'company', name: 'The Company', primary: true, shared: true },
        {
          id: 'hidden',
          name: 'The Hidden Hand',
          primary: false,
          shared: false,
        },
      ])
      expect(prismaMock.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ groups: true }),
        }),
      )
      // None from a campaign the module has said none of.
      await expect(listed({ groups: undefined })).resolves.toHaveProperty(
        'groups',
        [],
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
        'changes a secret, clearing what was refused for the old one',
        () => changeCampaignSecret('gm-1', 'c1', 'new-secret-123'),
        'updateMany',
        { secretHash: 'hash:new-secret-123', ...NO_REFUSAL },
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

  describe("a campaign's latest refusal", () => {
    const now = Date.parse('2026-10-13T12:00:00Z')

    beforeEach(() => {
      jest.useFakeTimers({ now })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('is selected with the campaign', async () => {
      await listed({})

      expect(prismaMock.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            refusedAt: true,
            refusalReason: true,
            refusalStatus: true,
            refusalDetail: true,
          }),
        }),
      )
    })

    it("is current while Foundry hasn't reached the app since", async () => {
      const refusedAt = new Date(now - 60_000)

      await expect(
        listed({
          refusedAt,
          refusalReason: 'notSetUp',
          refusalStatus: 404,
          refusalDetail: 'Mirkwood',
        }),
      ).resolves.toMatchObject({
        refusal: {
          reason: 'notSetUp',
          status: 404,
          detail: 'Mirkwood',
          at: refusedAt.toISOString(),
          current: true,
        },
      })
      const refusal = await listed({
        refusedAt,
        refusalReason: 'wrongSecret',
        refusalStatus: 401,
        lastSeenAt: new Date(now - 120_000),
        foundryId: 'camp-a',
      })
      expect(refusal.refusal).toEqual({
        reason: 'wrongSecret',
        status: 401,
        at: refusedAt.toISOString(),
        current: true,
      })
    })

    it('is past once Foundry has reached the app since', async () => {
      const campaign = await listed({
        refusedAt: new Date(now - 120_000),
        refusalReason: 'wrongSecret',
        refusalStatus: 401,
        lastSeenAt: new Date(now - 60_000),
        foundryId: 'camp-a',
      })

      expect(campaign.refusal?.current).toBe(false)
    })

    it.each([
      ['after a day', { refusedAt: new Date(now - 86_400_001) }],
      ['for a reason the card cannot explain', { refusalReason: 'notForge' }],
      ['when none was recorded', { refusedAt: null, refusalReason: null }],
    ])('is left out %s', async (_, fields) => {
      const campaign = await listed({
        refusedAt: new Date(now - 60_000),
        refusalReason: 'malformed',
        refusalStatus: 400,
        refusalDetail: 'chat.cleared: ✖ no',
        ...fields,
      })

      expect(campaign).not.toHaveProperty('refusal')
    })

    it('is shown for the whole day', async () => {
      const campaign = await listed({
        refusedAt: new Date(now - 86_400_000),
        refusalReason: 'malformed',
        refusalStatus: 400,
        refusalDetail: 'chat.cleared: ✖ no',
      })

      expect(campaign.refusal?.detail).toBe('chat.cleared: ✖ no')
    })
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
      expect(prismaMock.campaign.updateMany).not.toHaveBeenCalled()
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
        data: { foundryId: 'camp-a', ...NO_REFUSAL },
      })
      expect(prismaMock.campaign.updateMany).not.toHaveBeenCalled()
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
        data: { ...setUp, ...NO_REFUSAL },
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

    describe('recording what was refused, for the campaign card', () => {
      it('records the wrong secret on the campaign bound', async () => {
        prismaMock.campaign.findUnique.mockResolvedValue({
          id: 'c1',
          secretHash: 'hash:right',
          helloSession: null,
        } as any)

        await expect(findEventCampaign(ORIGIN, ref, 'wrong')).resolves.toBe(
          'refused',
        )

        expect(prismaMock.campaign.updateMany).toHaveBeenCalledTimes(1)
        expect(prismaMock.campaign.updateMany).toHaveBeenCalledWith({
          where: { AND: [{ id: { in: ['c1'] } }, recently('wrongSecret')] },
          data: {
            refusedAt: expect.any(Date),
            refusalReason: 'wrongSecret',
            refusalStatus: 401,
            refusalDetail: null,
          },
        })
      })

      it('records the wrong secret on every campaign with the title, when none was bound', async () => {
        prismaMock.campaign.findUnique.mockResolvedValue(null)
        prismaMock.campaign.findMany.mockResolvedValue([
          { id: 'c1', secretHash: 'hash:one' },
          { id: 'c2', secretHash: 'hash:two' },
        ] as any)

        await expect(findEventCampaign(ORIGIN, ref, 'three')).resolves.toBe(
          'refused',
        )

        expect(prismaMock.campaign.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              AND: [{ id: { in: ['c1', 'c2'] } }, recently('wrongSecret')],
            },
          }),
        )
      })

      it("records a title not set up, as Foundry sent it, on each of the game's campaigns waiting for Foundry whose secret it came with", async () => {
        prismaMock.campaign.findUnique.mockResolvedValue(null)
        const waiting = [
          { id: 'w1', secretHash: 'hash:ours' },
          { id: 'someone-elses', secretHash: 'hash:theirs' },
          { id: 'w2', secretHash: 'hash:ours' },
        ]
        // No campaign with the title, then the game's waiting for Foundry, for each post.
        prismaMock.campaign.findMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(waiting as any)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(waiting as any)
        const long = { id: 'camp-b', title: 'M'.repeat(300) }

        await expect(findEventCampaign(ORIGIN, ref, 'ours')).resolves.toBe(
          'unknown',
        )
        await expect(findEventCampaign(ORIGIN, long, 'ours')).resolves.toBe(
          'unknown',
        )

        expect(prismaMock.campaign.findMany).toHaveBeenNthCalledWith(2, {
          where: { origin: ORIGIN, foundryId: null, secretHash: { not: null } },
          orderBy: { createdAt: 'desc' },
          take: WAITING_SECRET_CHECKS,
          select: { id: true, secretHash: true },
        })
        expect(prismaMock.campaign.updateMany).toHaveBeenNthCalledWith(1, {
          where: { AND: [{ id: { in: ['w1', 'w2'] } }, recently('notSetUp')] },
          data: {
            refusedAt: expect.any(Date),
            refusalReason: 'notSetUp',
            refusalStatus: 404,
            refusalDetail: 'The Lonely Mountain',
          },
        })
        const { data } = prismaMock.campaign.updateMany.mock.calls[1][0]
        expect(data.refusalDetail).toBe('M'.repeat(200))
      })

      it("records nothing for a title not set up without the secret of one of the game's campaigns waiting for Foundry", async () => {
        // A post forged from the game's address, or another Gamemaster's, choosing the title.
        prismaMock.campaign.findUnique.mockResolvedValue(null)
        prismaMock.campaign.findMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'w1', secretHash: 'hash:ours' }] as any)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
        const forged = { id: 'x', title: 'Your secret was revoked: email it' }

        await expect(findEventCampaign(ORIGIN, forged, 'guess')).resolves.toBe(
          'unknown',
        )
        await expect(findEventCampaign(ORIGIN, forged, 'ours')).resolves.toBe(
          'unknown',
        )

        expect(prismaMock.campaign.findMany).toHaveBeenCalledTimes(4)
        expect(prismaMock.campaign.updateMany).not.toHaveBeenCalled()
      })

      describe("checks only the newest few of the game's campaigns waiting for Foundry", () => {
        afterEach(() => {
          prismaMock.campaign.findMany.mockReset()
        })

        it('checks a post whose title matches none against at most five, the newest first', async () => {
          game()

          await expect(findEventCampaign(ORIGIN, ref, 'ours')).resolves.toBe(
            'unknown',
          )

          expect(WAITING_SECRET_CHECKS).toBe(5)
          expect(jest.mocked(verifySecret).mock.calls).toEqual(
            ['w7', 'w6', 'w5', 'w4', 'w3'].map(id => ['ours', `hash:${id}`]),
          )
        })

        it('notes the title on the newest whose secret it came with, never on an older one', async () => {
          game(['w7', 'w1'])

          await findEventCampaign(ORIGIN, ref, 'ours')

          expect(prismaMock.campaign.updateMany).toHaveBeenCalledTimes(1)
          expect(prismaMock.campaign.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { AND: [{ id: { in: ['w7'] } }, recently('notSetUp')] },
            }),
          )
        })

        it("doesn't look for them at all for a post with no secret", async () => {
          game()

          await expect(findEventCampaign(ORIGIN, ref, '')).resolves.toBe(
            'unknown',
          )

          expect(prismaMock.campaign.findMany).toHaveBeenCalledTimes(1)
          expect(verifySecret).not.toHaveBeenCalled()
          expect(prismaMock.campaign.updateMany).not.toHaveBeenCalled()
        })
      })

      it('records nothing for a connection test', async () => {
        prismaMock.campaign.findUnique.mockResolvedValue({
          id: 'c1',
          secretHash: 'hash:right',
          helloSession: null,
        } as any)
        await expect(
          findEventCampaign(ORIGIN, ref, 'wrong', { record: false }),
        ).resolves.toBe('refused')

        prismaMock.campaign.findUnique.mockResolvedValue(null)
        prismaMock.campaign.findMany.mockResolvedValue([])
        await expect(
          findEventCampaign(ORIGIN, ref, 'any', { record: false }),
        ).resolves.toBe('unknown')

        prismaMock.campaign.findMany.mockResolvedValue([
          { id: 'c1', secretHash: 'hash:right' },
        ] as any)
        await expect(
          findEventCampaign(ORIGIN, ref, 'wrong', { record: false }),
        ).resolves.toBe('refused')

        expect(prismaMock.campaign.updateMany).not.toHaveBeenCalled()
      })

      it('answers as ever when the refusal cannot be recorded', async () => {
        const logged = jest.spyOn(console, 'error').mockImplementation(() => {})
        prismaMock.campaign.updateMany.mockRejectedValue(new Error('db down'))
        prismaMock.campaign.findUnique.mockResolvedValue({
          id: 'c1',
          secretHash: 'hash:right',
          helloSession: null,
        } as any)
        await expect(findEventCampaign(ORIGIN, ref, 'wrong')).resolves.toBe(
          'refused',
        )

        prismaMock.campaign.findUnique.mockResolvedValue(null)
        prismaMock.campaign.findMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ id: 'w1', secretHash: 'hash:ours' }] as any)
        await expect(findEventCampaign(ORIGIN, ref, 'ours')).resolves.toBe(
          'unknown',
        )

        expect(logged).toHaveBeenCalledTimes(2)
        expect(logged).toHaveBeenCalledWith(
          'Failed to record a refused post',
          expect.any(Error),
        )
        logged.mockRestore()
        prismaMock.campaign.updateMany.mockReset()
      })

      it('writes a refusal at most once a minute, unless its reason changes', async () => {
        const now = Date.parse('2026-10-13T12:00:00Z')
        jest.useFakeTimers({ now })

        await recordRefusal(
          { ids: ['c1'] },
          { reason: 'malformed', status: 400, detail: 'chat.cleared: ✖ no' },
        )

        expect(prismaMock.campaign.updateMany).toHaveBeenCalledWith({
          where: {
            AND: [
              { id: { in: ['c1'] } },
              {
                OR: [
                  { refusedAt: null },
                  { refusedAt: { lt: new Date(now - 60_000) } },
                  { refusalReason: { not: 'malformed' } },
                ],
              },
            ],
          },
          data: {
            refusedAt: new Date(now),
            refusalReason: 'malformed',
            refusalStatus: 400,
            refusalDetail: 'chat.cleared: ✖ no',
          },
        })
        jest.useRealTimers()
      })
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
