/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { prismaMock } from '../../jest.setup'
import { getCampaignVersion, getTableView, MESSAGE_LIMIT } from './table'
import { chatMessage, combat, roster } from '@/mocks/sending-stone'

const character = {
  id: 'char-1',
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: ' the lonely mountain ',
}
const campaign = {
  id: 'c1',
  title: 'The Lonely Mountain',
  version: 7,
  worldTitle: 'Return to Erebor',
  lastEventAt: new Date('2026-10-04T19:10:00Z'),
  characters: roster,
}

/** How a character's campaign is looked up: by game and title, ignoring case. */
const lookup = (select: object) => ({
  where: {
    origin: character.gameUrl,
    title: { equals: 'the lonely mountain', mode: 'insensitive' },
  },
  orderBy: { lastEventAt: { sort: 'desc', nulls: 'last' } },
  select,
})

describe('db/table', () => {
  describe('getCampaignVersion', () => {
    it("reads the version of the character's campaign", async () => {
      prismaMock.campaign.findFirst.mockResolvedValue({ version: 7 } as any)

      await expect(getCampaignVersion(character)).resolves.toBe(7)
      expect(prismaMock.campaign.findFirst).toHaveBeenCalledWith(
        lookup({ version: true }),
      )
    })

    it('is 0 for a campaign that has been sent nothing', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(null)

      await expect(getCampaignVersion(character)).resolves.toBe(0)
    })

    it('matches the title literally, not as a pattern', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(null)

      await getCampaignVersion({
        ...character,
        campaignTitle: String.raw`100% \_`,
      })

      expect(prismaMock.campaign.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            title: { equals: String.raw`100\% \\\_`, mode: 'insensitive' },
          }),
        }),
      )
    })

    it('is 0, without looking, for a character with no campaign title', async () => {
      await expect(
        getCampaignVersion({ ...character, campaignTitle: '' }),
      ).resolves.toBe(0)
      expect(prismaMock.campaign.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('getTableView', () => {
    it('is empty until the campaign has been sent anything', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(null)

      await expect(getTableView(character)).resolves.toEqual({
        version: 0,
        connected: false,
        messages: [],
      })
    })

    it('shows the chat the player may read, oldest first, and the encounter', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(campaign as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([
        { data: chatMessage({ id: 'm2', text: 'second' }) },
        { data: chatMessage({ id: 'm1', text: 'first' }) },
      ] as any)
      prismaMock.combat.findMany.mockResolvedValue([
        { data: combat({ id: 'old', active: false }) },
        { data: combat() },
      ] as any)

      const view = await getTableView(character)

      expect(prismaMock.campaign.findFirst).toHaveBeenCalledWith(
        lookup({
          id: true,
          title: true,
          version: true,
          worldTitle: true,
          lastEventAt: true,
          characters: true,
        }),
      )
      expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          OR: [{ public: true }, { readers: { has: 'actor-thorin' } }],
        },
        orderBy: { sentAt: 'desc' },
        take: MESSAGE_LIMIT,
        select: { data: true },
      })
      expect(prismaMock.combat.findMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1' },
        orderBy: { updatedAt: 'desc' },
        select: { data: true },
      })
      expect(view).toMatchObject({
        version: 7,
        campaign: {
          title: 'The Lonely Mountain',
          worldTitle: 'Return to Erebor',
          lastEventAt: '2026-10-04T19:10:00.000Z',
        },
        connected: true,
        messages: [{ id: 'm1' }, { id: 'm2' }],
        combat: { id: 'cmbt1', currentId: 'c-boss' },
      })
    })

    it("shows only public chat to a character that isn't one of the campaign's", async () => {
      prismaMock.campaign.findFirst.mockResolvedValue({
        ...campaign,
        lastEventAt: null,
      } as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([])
      prismaMock.combat.findMany.mockResolvedValue([])

      const view = await getTableView({ ...character, name: 'Bilbo' })

      expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { campaignId: 'c1', OR: [{ public: true }] },
        }),
      )
      expect(view).toEqual({
        version: 7,
        campaign: {
          title: 'The Lonely Mountain',
          worldTitle: 'Return to Erebor',
          lastEventAt: undefined,
        },
        connected: false,
        messages: [],
        combat: undefined,
      })
    })
  })
})
