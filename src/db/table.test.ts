/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { prismaMock } from '../../jest.setup'
import { getCampaignStatus, getTableView, MESSAGE_LIMIT } from './table'
import {
  characterSheet,
  chatMessage,
  combat,
  roster,
} from '@/mocks/sending-stone'

const character = {
  id: 'char-1',
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}
const recently = () => new Date(Date.now() - 30_000)
const campaign = {
  id: 'c1',
  origin: 'https://my-game.forge-vtt.com',
  title: 'The Lonely Mountain',
  version: 7,
  worldTitle: 'Return to Erebor',
  lastSeenAt: recently(),
  characters: roster,
}

describe('db/table', () => {
  describe('getCampaignStatus', () => {
    it("reads the version of the character's campaign and whether it is live", async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        version: 7,
        lastSeenAt: recently(),
      } as any)

      await expect(getCampaignStatus(character)).resolves.toEqual({
        version: 7,
        live: true,
      })
      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'c1' },
        select: { version: true, lastSeenAt: true },
      })
    })

    it('is offline once the game has been quiet for two minutes', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        version: 7,
        lastSeenAt: new Date(Date.now() - 121_000),
      } as any)

      await expect(getCampaignStatus(character)).resolves.toEqual({
        version: 7,
        live: false,
      })
    })

    it('is version 0, without looking, for a character in no campaign', async () => {
      await expect(
        getCampaignStatus({ ...character, campaignId: null }),
      ).resolves.toEqual({ version: 0, live: false })
      expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()

      prismaMock.campaign.findUnique.mockResolvedValue(null)
      await expect(getCampaignStatus(character)).resolves.toEqual({
        version: 0,
        live: false,
      })
    })
  })

  describe('getTableView', () => {
    it('is empty for a character in no campaign', async () => {
      const empty = { version: 0, live: false, connected: false, messages: [] }
      await expect(
        getTableView({ ...character, campaignId: null }),
      ).resolves.toEqual(empty)

      prismaMock.campaign.findUnique.mockResolvedValue(null)
      await expect(getTableView(character)).resolves.toEqual(empty)
    })

    it('shows the chat the player may read, oldest first, and the encounter', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([
        { data: chatMessage({ id: 'm2', text: 'second' }) },
        { data: chatMessage({ id: 'm1', text: 'first' }) },
      ] as any)
      prismaMock.combat.findMany.mockResolvedValue([
        { data: combat({ id: 'old', active: false }) },
        { data: combat() },
      ] as any)

      const view = await getTableView(character)

      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'c1' },
        select: {
          id: true,
          origin: true,
          title: true,
          version: true,
          worldTitle: true,
          lastSeenAt: true,
          characters: true,
        },
      })
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
        live: true,
        campaign: {
          title: 'The Lonely Mountain',
          worldTitle: 'Return to Erebor',
          lastSeenAt: campaign.lastSeenAt.toISOString(),
        },
        connected: true,
        messages: [{ id: 'm1' }, { id: 'm2' }],
        combat: { id: 'cmbt1', currentId: 'c-boss' },
      })
    })

    it("shows a campaign character's portrait beside what they say", async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        ...campaign,
        characters: [
          { ...roster[0], img: 'worlds/erebor/thorin.webp' },
          { ...roster[1], img: 'icons/svg/mystery-man.svg' },
        ],
      } as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([
        { data: chatMessage({ id: 'm2', character: 'actor-vex' }) },
        { data: chatMessage({ id: 'm1', character: 'actor-thorin' }) },
      ] as any)
      prismaMock.combat.findMany.mockResolvedValue([])

      const view = await getTableView(character)

      expect(view.messages.map(({ avatar }) => avatar)).toEqual([
        'https://my-game.forge-vtt.com/worlds/erebor/thorin.webp',
        undefined,
      ])
    })

    it("shows the player their own character's sheet", async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([])
      prismaMock.combat.findMany.mockResolvedValue([])
      prismaMock.actorSheet.findUnique.mockResolvedValue({
        data: characterSheet(),
      } as any)

      const view = await getTableView(character)

      expect(prismaMock.actorSheet.findUnique).toHaveBeenCalledWith({
        where: { campaignActor: { campaignId: 'c1', actorId: 'actor-thorin' } },
        select: { data: true },
      })
      expect(view.sheet).toMatchObject({
        portrait: 'https://my-game.forge-vtt.com/worlds/erebor/thorin.webp',
        ac: 18,
        abilities: expect.arrayContaining([
          expect.objectContaining({ id: 'str', save: 7 }),
        ]),
      })
      expect(view.sheet).not.toHaveProperty('img')
    })

    it('shows damage against the targets of the attack it was rolled from', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)
      const dnd5e = {
        messageType: 'roll',
        item: { name: 'Orcrist', type: 'weapon' },
        activity: null,
        originatingMessage: null,
      }
      prismaMock.chatMessage.findMany.mockResolvedValue([
        {
          data: chatMessage({
            id: 'damage',
            dnd5e: {
              ...dnd5e,
              roll: { type: 'damage' },
              targets: [],
              originatingMessage: 'attack',
            },
          }),
        },
        {
          data: chatMessage({
            id: 'attack',
            dnd5e: {
              ...dnd5e,
              roll: { type: 'attack' },
              targets: [{ name: 'Goblin Boss' }],
            },
          }),
        },
      ] as any)
      prismaMock.combat.findMany.mockResolvedValue([])

      const view = await getTableView(character)

      expect(view.messages.map(({ targets }) => targets)).toEqual([
        [{ name: 'Goblin Boss' }],
        [{ name: 'Goblin Boss' }],
      ])
    })

    it("shows only public chat to a character no longer one of the campaign's", async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        ...campaign,
        worldTitle: null,
        lastSeenAt: null,
      } as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([])
      prismaMock.combat.findMany.mockResolvedValue([])

      const view = await getTableView({ ...character, actorId: null })

      expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { campaignId: 'c1', OR: [{ public: true }] },
        }),
      )
      expect(view).toEqual({
        version: 7,
        live: false,
        campaign: {
          title: 'The Lonely Mountain',
          worldTitle: undefined,
          lastSeenAt: undefined,
        },
        connected: false,
        messages: [],
        combat: undefined,
        sheet: undefined,
      })
      expect(prismaMock.actorSheet.findUnique).not.toHaveBeenCalled()

      const removed = await getTableView({
        ...character,
        actorId: 'actor-gone',
      })
      expect(removed.connected).toBe(false)
    })
  })
})
