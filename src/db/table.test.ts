/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { prismaMock } from '../../jest.setup'
import { playerSeat } from './seats'
import { getCampaignStatus, getTableView, MESSAGE_LIMIT } from './table'
import {
  characterSheet,
  chatMessage,
  combat,
  combatant,
  groupEntry,
  mockCompanionEntry,
  mockSummonedEntry,
  PARTY,
  roster,
  shapedSheet,
  wildShapeBlock,
  wolfForm,
} from '@/mocks/sending-stone'

/** Thorin's player at his sheet. */
const character = playerSeat(
  {
    id: 'char-1',
    name: 'Thorin Oakenshield',
    gameUrl: 'https://my-game.forge-vtt.com',
    campaignTitle: 'The Lonely Mountain',
    campaignId: 'c1',
    actorId: 'actor-thorin',
  },
  'user-1',
)
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

beforeEach(() => {
  // The Gamemaster has rolled as no one, unless a test says otherwise (#156).
  prismaMock.rollRequest.findMany.mockResolvedValue([])
})

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
        rollsToTable: [],
        rollFeatures: [],
        moves: false,
        typed: false,
        removes: false,
        // Changed on purpose (round 0.37.0 §7.15): whether the player may change its favorites.
        favorites: false,
        // Changed on purpose (round 0.39.0 §1.10): whether the player may change its effects.
        effects: false,
        // Changed on purpose (round 0.40.0 §10.3): whether the player may use Wild Shape.
        wildShape: false,
      })
      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'c1' },
        select: {
          version: true,
          lastSeenAt: true,
          rollsEnabled: true,
          rollKinds: true,
          rollFeatures: true,
          bridgePolledAt: true,
          transfersEnabled: true,
          removalsEnabled: true,
          // Changed on purpose (round 0.37.0 §7.15): whether its game takes favorites.
          favoritesEnabled: true,
          // Changed on purpose (round 0.39.0 §1.10): whether the campaign lets its players change
          // their effects.
          effectsEnabled: true,
          // Changed on purpose (round 0.40.0 §10.3): whether the campaign lets its players use Wild
          // Shape.
          wildShapeEnabled: true,
        },
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
        rollsToTable: [],
        rollFeatures: [],
        moves: false,
        typed: false,
        removes: false,
        // Changed on purpose (round 0.37.0 §7.15): whether the player may change its favorites.
        favorites: false,
        // Changed on purpose (round 0.39.0 §1.10): whether the player may change its effects.
        effects: false,
        // Changed on purpose (round 0.40.0 §10.3): whether the player may use Wild Shape.
        wildShape: false,
      })
    })

    it('is version 0, without looking, for a character in no campaign', async () => {
      await expect(
        getCampaignStatus({ ...character, campaignId: null }),
      ).resolves.toEqual({
        version: 0,
        live: false,
        rollsToTable: [],
        rollFeatures: [],
        moves: false,
        typed: false,
        removes: false,
        // Changed on purpose (round 0.37.0 §7.15): whether the player may change its favorites.
        favorites: false,
        // Changed on purpose (round 0.39.0 §1.10): whether the player may change its effects.
        effects: false,
        // Changed on purpose (round 0.40.0 §10.3): whether the player may use Wild Shape.
        wildShape: false,
      })
      expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()

      prismaMock.campaign.findUnique.mockResolvedValue(null)
      await expect(getCampaignStatus(character)).resolves.toEqual({
        version: 0,
        live: false,
        rollsToTable: [],
        rollFeatures: [],
        moves: false,
        typed: false,
        removes: false,
        // Changed on purpose (round 0.37.0 §7.15): whether the player may change its favorites.
        favorites: false,
        // Changed on purpose (round 0.39.0 §1.10): whether the player may change its effects.
        effects: false,
        // Changed on purpose (round 0.40.0 §10.3): whether the player may use Wild Shape.
        wildShape: false,
      })
    })

    it('tells which rolls the game takes from the player, while its module fetches them', async () => {
      const takingRolls = {
        version: 7,
        lastSeenAt: recently(),
        rollsEnabled: true,
        rollKinds: ['save', 'skill', 'damage'],
        rollFeatures: ['modifiers', 'later'],
        bridgePolledAt: new Date(Date.now() - 5000),
      }
      prismaMock.campaign.findUnique.mockResolvedValue(takingRolls as any)
      await expect(getCampaignStatus(character)).resolves.toMatchObject({
        rollsToTable: ['skill', 'save', 'damage'],
        // What else it does with them, that this app knows.
        rollFeatures: ['modifiers'],
      })

      // None for a character without an actor to make them.
      await expect(
        getCampaignStatus({ ...character, actorId: null }),
      ).resolves.toMatchObject({ rollsToTable: [], rollFeatures: [] })

      prismaMock.campaign.findUnique.mockResolvedValue({
        ...takingRolls,
        bridgePolledAt: new Date(Date.now() - 60_000),
      } as any)
      await expect(getCampaignStatus(character)).resolves.toMatchObject({
        rollsToTable: [],
        rollFeatures: [],
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
          groups: true,
          // Changed on purpose (round 0.36.0 §7.12): the character's companions.
          companions: true,
          rollsEnabled: true,
          rollKinds: true,
          rollFeatures: true,
          bridgePolledAt: true,
          transfersEnabled: true,
          removalsEnabled: true,
          // Changed on purpose (round 0.37.0 §7.15): whether its game takes favorites.
          favoritesEnabled: true,
          // Changed on purpose (round 0.39.0 §1.10): whether the campaign lets its players change
          // their effects.
          effectsEnabled: true,
          // Changed on purpose (round 0.40.0 §10.3): whether the campaign lets its players use Wild
          // Shape.
          wildShapeEnabled: true,
        },
      })
      expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          OR: [{ public: true }, { readers: { has: 'actor-thorin' } }],
        },
        orderBy: { sentAt: 'desc' },
        take: MESSAGE_LIMIT,
        select: { messageId: true, data: true, byGm: true },
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
        updatedAt: new Date('2026-10-05T12:00:00Z'),
      } as any)

      const view = await getTableView(character)

      expect(prismaMock.actorSheet.findUnique).toHaveBeenCalledWith({
        where: { campaignActor: { campaignId: 'c1', actorId: 'actor-thorin' } },
        select: { data: true, updatedAt: true },
      })
      expect(view.sheet).toMatchObject({
        portrait: 'https://my-game.forge-vtt.com/worlds/erebor/thorin.webp',
        ac: 18,
        abilities: expect.arrayContaining([
          expect.objectContaining({ id: 'str', save: 7 }),
        ]),
      })
      expect(view.sheet).not.toHaveProperty('img')
      expect(view.sheetVersion).toBe('2026-10-05T12:00:00.000Z')
    })

    it('leaves out a sheet the viewer already has, saving sending it again', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([])
      prismaMock.combat.findMany.mockResolvedValue([])
      prismaMock.actorSheet.findUnique.mockResolvedValue({
        data: characterSheet(),
        updatedAt: new Date('2026-10-05T12:00:00Z'),
      } as any)

      const same = await getTableView(character, {
        sheetVersion: '2026-10-05T12:00:00.000Z',
      })
      const older = await getTableView(character, {
        sheetVersion: '2026-10-05T11:00:00.000Z',
      })

      expect(same.sheet).toBeUndefined()
      expect(same.sheetVersion).toBe('2026-10-05T12:00:00.000Z')
      expect(older.sheet).toMatchObject({ ac: 18 })
    })

    it("tells the player why the module held their character's sheet back, from module 0.22.0, and only theirs", async () => {
      const tooLarge = {
        reason: 'tooLarge',
        bytes: 5_200_000,
        limit: 4_000_000,
      }
      prismaMock.campaign.findUnique.mockResolvedValue({
        ...campaign,
        characters: [
          { ...roster[0], sheetWithheld: { ...tooLarge, later: true } },
          { ...roster[1], sheetWithheld: { ...tooLarge, bytes: 9_000_000 } },
        ],
      } as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([])
      prismaMock.combat.findMany.mockResolvedValue([])
      prismaMock.actorSheet.findUnique.mockResolvedValue(null)

      const view = await getTableView(character)

      expect(view.sheet).toBeUndefined()
      expect(view.sheetWithheld).toEqual(tooLarge)

      prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)
      const sent = await getTableView(character)
      expect(sent.sheetWithheld).toBeUndefined()
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

    it('shows the saves the game asks of the character, oldest first, while the game takes them', async () => {
      jest.useFakeTimers({ now: Date.parse('2026-10-08T12:05:00Z') })
      const asking = {
        ...campaign,
        rollsEnabled: true,
        rollKinds: ['save'],
        rollFeatures: ['prompts'],
        bridgePolledAt: new Date(Date.now() - 5000),
      }
      prismaMock.campaign.findUnique.mockResolvedValue(asking as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([])
      prismaMock.combat.findMany.mockResolvedValue([])
      prismaMock.rollPrompt.findMany.mockResolvedValue([
        {
          promptId: 'msg1-thorin',
          data: {
            type: 'concentration',
            abilities: ['con'],
            dc: null,
            label: 'Bless',
            messageId: 'msg1',
          },
          expiresAt: new Date('2026-10-08T12:10:00Z'),
        },
        {
          promptId: 'msg2-thorin',
          data: {
            type: 'save',
            abilities: ['dex'],
            dc: 15,
            label: null,
            messageId: 'msg2',
          },
          expiresAt: new Date('2026-10-08T12:11:00Z'),
        },
      ] as any)

      const view = await getTableView(character)

      // With those Midi-QOL asks whose time ran out in the last fifteen seconds, and those that
      // closed in the last six, as rolled in Foundry or by Midi-QOL (module 0.27.0).
      expect(prismaMock.rollPrompt.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          actorId: 'actor-thorin',
          OR: [
            {
              closedAt: null,
              expiresAt: { gt: new Date('2026-10-08T12:04:45Z') },
            },
            {
              closedAt: { gt: new Date('2026-10-08T12:04:54Z') },
              closedReason: { in: ['rolled', 'expired'] },
            },
          ],
        },
        orderBy: { openedAt: 'asc' },
        select: {
          promptId: true,
          data: true,
          expiresAt: true,
          closedAt: true,
          closedReason: true,
        },
      })
      expect(view.prompts).toEqual([
        {
          id: 'msg1-thorin',
          type: 'concentration',
          abilities: ['con'],
          label: 'Bless',
          expiresAt: '2026-10-08T12:10:00.000Z',
        },
        {
          id: 'msg2-thorin',
          type: 'save',
          abilities: ['dex'],
          dc: 15,
          expiresAt: '2026-10-08T12:11:00.000Z',
        },
      ])

      // Once the game stops taking them, there's none to answer.
      prismaMock.rollPrompt.findMany.mockClear()
      prismaMock.campaign.findUnique.mockResolvedValue({
        ...asking,
        bridgePolledAt: new Date(Date.now() - 600_000),
      } as any)
      await expect(getTableView(character)).resolves.toMatchObject({
        prompts: [],
      })
      expect(prismaMock.rollPrompt.findMany).not.toHaveBeenCalled()
      jest.useRealTimers()
    })

    it('shows what Midi-QOL asks a while after its time runs out, and says a moment how it closed, but only of its own', async () => {
      jest.useFakeTimers({ now: Date.parse('2026-10-08T12:05:00Z') })
      prismaMock.campaign.findUnique.mockResolvedValue({
        ...campaign,
        rollsEnabled: true,
        rollKinds: ['save', 'skill'],
        rollFeatures: ['prompts'],
        bridgePolledAt: new Date(Date.now() - 5000),
      } as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([])
      prismaMock.combat.findMany.mockResolvedValue([])
      const midi = {
        type: 'skill',
        abilities: [],
        skills: ['ath', 'acr'],
        dc: 12,
        label: 'Web',
        messageId: 'k1',
        source: 'overtime',
        advantage: { ath: 'adv' },
        askedInFoundry: true,
      }
      const card = {
        type: 'save',
        abilities: ['dex'],
        dc: 15,
        label: null,
        messageId: 'msg2',
      }
      const at = (iso: string) => new Date(`2026-10-08T${iso}Z`)
      prismaMock.rollPrompt.findMany.mockResolvedValue([
        // Midi-QOL's, its time up ten seconds ago, which the game hasn't closed yet.
        {
          promptId: 'k1-thorin',
          data: midi,
          expiresAt: at('12:04:50'),
          closedAt: null,
          closedReason: null,
        },
        // A card's, its time up as long ago: the game no longer waits for it.
        {
          promptId: 'msg2-thorin',
          data: card,
          expiresAt: at('12:04:50'),
          closedAt: null,
          closedReason: null,
        },
        // Midi-QOL's, rolled in Foundry three seconds ago, and left to it five seconds ago.
        {
          promptId: 'k2-thorin',
          data: { ...midi, askedInFoundry: false },
          expiresAt: at('12:05:30'),
          closedAt: at('12:04:57'),
          closedReason: 'rolled',
        },
        {
          promptId: 'k3-thorin',
          data: {
            ...midi,
            type: 'save',
            abilities: ['wis'],
            skills: undefined,
          },
          expiresAt: at('12:04:55'),
          closedAt: at('12:04:55'),
          closedReason: 'expired',
        },
        // Closed too long ago, or a card's, which closes quietly.
        {
          promptId: 'k4-thorin',
          data: midi,
          expiresAt: at('12:04:53'),
          closedAt: at('12:04:53'),
          closedReason: 'rolled',
        },
        {
          promptId: 'msg5-thorin',
          data: card,
          expiresAt: at('12:15:00'),
          closedAt: at('12:04:59'),
          closedReason: 'rolled',
        },
      ] as any)

      const view = await getTableView(character)

      expect(view.prompts).toEqual([
        {
          id: 'k1-thorin',
          type: 'skill',
          abilities: [],
          skills: ['ath', 'acr'],
          dc: 12,
          label: 'Web',
          expiresAt: '2026-10-08T12:04:50.000Z',
          source: 'overtime',
          advantage: { ath: 'adv' },
          askedInFoundry: true,
        },
        expect.objectContaining({ id: 'k2-thorin', closed: 'rolled' }),
        expect.objectContaining({
          id: 'k3-thorin',
          type: 'save',
          abilities: ['wis'],
          closed: 'expired',
        }),
      ])
      expect(view.prompts?.[1]).not.toHaveProperty('askedInFoundry')
      jest.useRealTimers()
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
        rollsToTable: [],
        rollFeatures: [],
        prompts: [],
        // The player's own choice of typing in their dice, from module 0.32.0: offered nowhere.
        manualDice: { offered: false, on: false },
      })
      expect(prismaMock.actorSheet.findUnique).not.toHaveBeenCalled()
      expect(prismaMock.rollPrompt.findMany).not.toHaveBeenCalled()

      const removed = await getTableView({
        ...character,
        actorId: 'actor-gone',
      })
      expect(removed.connected).toBe(false)
    })
  })
})

/** A campaign whose game takes these rolls, and does what else is given with them. */
const taking = (
  features: string[],
  kinds = ['skill', 'save', 'use', 'endEnchantment'],
) => ({
  ...campaign,
  rollsEnabled: true,
  rollKinds: kinds,
  rollFeatures: features,
  bridgePolledAt: new Date(Date.now() - 5000),
})
/** That campaign, with nothing in its chat, combats or prompts unless given after. */
const givenCampaign = (found: object) => {
  prismaMock.campaign.findUnique.mockResolvedValue(found as any)
  prismaMock.chatMessage.findMany.mockResolvedValue([])
  prismaMock.combat.findMany.mockResolvedValue([])
  prismaMock.rollPrompt.findMany.mockResolvedValue([])
}

describe("db/table, the Gamemaster at a character's sheet (#156)", () => {
  /** The campaign's Gamemaster at Thorin's sheet, with no character of their own. */
  const gm = {
    name: 'Thorin Oakenshield',
    gameUrl: 'https://my-game.forge-vtt.com',
    campaignTitle: 'The Lonely Mountain',
    campaignId: 'c1',
    actorId: 'actor-thorin',
    role: 'gm' as const,
    userId: 'gm-1',
    characterId: null,
  }

  it("never tells a player of the Gamemaster's rolls, in their view or what tells it apart", async () => {
    givenCampaign(taking(['prompts', 'gmRolls']))
    await expect(getTableView(character)).resolves.toMatchObject({
      rollsToTable: ['skill', 'save', 'use', 'endEnchantment'],
      rollFeatures: ['prompts'],
    })
    const status = await getCampaignStatus(character)
    expect(status.rollFeatures).toEqual(['prompts'])
    expect(status).not.toHaveProperty('gm')
    expect(await getTableView(character)).not.toHaveProperty('gm')
  })

  it("rolls what the player may, but ending an enchantment, while the game makes the Gamemaster's rolls", async () => {
    givenCampaign(taking(['prompts', 'gmRolls']))
    await expect(getTableView(gm)).resolves.toMatchObject({
      rollsToTable: ['skill', 'save', 'use'],
      rollFeatures: ['prompts'],
      gm: { rolls: 'made' },
    })
    await expect(getCampaignStatus(gm)).resolves.toEqual({
      version: 7,
      live: true,
      rollsToTable: ['skill', 'save', 'use'],
      rollFeatures: ['prompts'],
      gm: { rolls: 'made' },
      moves: false,
      typed: false,
      removes: false,
      // Changed on purpose (round 0.37.0 §7.15): never the Gamemaster's.
      favorites: false,
      // Changed on purpose (round 0.39.0 §1.10): never the Gamemaster's either.
      effects: false,
      // Changed on purpose (round 0.40.0 §10.3): nor Wild Shape.
      wildShape: false,
    })
  })

  it('offers the Gamemaster charges spent and Heroic Inspiration, from module 0.29.0, but never a concentration ended', async () => {
    const kinds = ['skill', 'endConcentration', 'spend', 'inspiration']
    givenCampaign(taking(['gmRolls'], kinds))
    await expect(getTableView(character)).resolves.toMatchObject({
      rollsToTable: kinds,
    })
    await expect(getTableView(gm)).resolves.toMatchObject({
      rollsToTable: ['skill', 'spend', 'inspiration'],
    })
    await expect(getCampaignStatus(gm)).resolves.toMatchObject({
      rollsToTable: ['skill', 'spend', 'inspiration'],
    })
  })

  it('offers the player End Turn, from module 0.36.0, but never the Gamemaster, who ends turns in Foundry', async () => {
    const kinds = ['skill', 'endConcentration', 'endTurn', 'spend']
    givenCampaign(taking(['gmRolls'], kinds))
    await expect(getTableView(character)).resolves.toMatchObject({
      rollsToTable: kinds,
    })
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      rollsToTable: kinds,
    })
    await expect(getTableView(gm)).resolves.toMatchObject({
      rollsToTable: ['skill', 'spend'],
    })
    await expect(getCampaignStatus(gm)).resolves.toMatchObject({
      rollsToTable: ['skill', 'spend'],
    })
  })

  it('offers the player Undo of an End Turn, from module 0.36.0, but never the Gamemaster', async () => {
    const kinds = ['skill', 'endTurn', 'undoEndTurn', 'spend']
    givenCampaign(taking(['gmRolls'], kinds))
    await expect(getTableView(character)).resolves.toMatchObject({
      rollsToTable: kinds,
    })
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      rollsToTable: kinds,
    })
    await expect(getTableView(gm)).resolves.toMatchObject({
      rollsToTable: ['skill', 'spend'],
    })
    await expect(getCampaignStatus(gm)).resolves.toMatchObject({
      rollsToTable: ['skill', 'spend'],
    })
  })

  it('tells the player and the Gamemaster at the sheet that players may enter their dice results, from module 0.26.0, while the game takes rolls', async () => {
    givenCampaign(taking(['gmRolls', 'manualDice']))
    await expect(getTableView(character)).resolves.toMatchObject({
      rollFeatures: ['manualDice'],
    })
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      rollFeatures: ['manualDice'],
    })
    await expect(getTableView(gm)).resolves.toMatchObject({
      rollFeatures: ['manualDice'],
      gm: { rolls: 'made' },
    })

    // Not while the game takes no rolls from here, nor from an older module.
    givenCampaign({ ...taking(['gmRolls', 'manualDice']), rollsEnabled: false })
    await expect(getTableView(character)).resolves.toMatchObject({
      rollFeatures: [],
    })
    givenCampaign(taking(['gmRolls']))
    await expect(getTableView(character)).resolves.toMatchObject({
      rollFeatures: [],
    })
  })

  it("rolls nothing to the table while the game doesn't make the Gamemaster's, saying whether to update it", async () => {
    // A module before 0.23.0: it takes the player's rolls, not the Gamemaster's.
    givenCampaign(taking(['prompts']))
    await expect(getTableView(gm)).resolves.toMatchObject({
      rollsToTable: [],
      rollFeatures: [],
      prompts: [],
      gm: { rolls: 'update' },
    })
    expect(prismaMock.rollPrompt.findMany).not.toHaveBeenCalled()

    // A game taking no rolls.
    givenCampaign({ ...taking(['gmRolls']), rollsEnabled: false })
    await expect(getTableView(gm)).resolves.toMatchObject({
      rollsToTable: [],
      gm: { rolls: 'off' },
    })
    await expect(getCampaignStatus(gm)).resolves.toMatchObject({
      gm: { rolls: 'off' },
    })
  })

  it("shows the Gamemaster the character's prompts and chat as its player reads them, but never the player's place in it", async () => {
    givenCampaign(taking(['prompts', 'gmRolls']))
    prismaMock.chatMessage.findMany.mockResolvedValue([
      {
        messageId: 'm2',
        data: chatMessage({ id: 'm2', gmRoll: 'req-forged' }),
        byGm: false,
      },
      { messageId: 'm1', data: chatMessage({ id: 'm1' }), byGm: true },
    ] as any)
    prismaMock.rollPrompt.findMany.mockResolvedValue([
      {
        promptId: 'msg1-thorin',
        data: { type: 'save', abilities: ['dex'], dc: 15, messageId: 'msg1' },
        expiresAt: new Date(Date.now() + 60_000),
      },
    ] as any)

    const view = await getTableView({
      ...gm,
      chatReadAt: '2026-10-04T19:00:00.000Z',
    })

    // As the player's: a whisper to another character is left out.
    expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId: 'c1',
          OR: [{ public: true }, { readers: { has: 'actor-thorin' } }],
        },
      }),
    )
    expect(prismaMock.rollPrompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ actorId: 'actor-thorin' }),
      }),
    )
    expect(view.prompts).toEqual([
      expect.objectContaining({ id: 'msg1-thorin', abilities: ['dex'] }),
    ])
    expect(view.chatReadAt).toBeUndefined()
    // Marked as the Gamemaster's from the app's own record, never the message's claim.
    expect(view.messages.map(({ id, byGm }) => [id, byGm])).toEqual([
      ['m1', true],
      ['m2', undefined],
    ])
  })
})

/** Whether a roll held is one Prisma finds by this filter. */
const finds = (row: Record<string, any>, where: Record<string, any>) =>
  Object.entries(where).every(([field, test]) => {
    if (field === 'createdAt') return row.createdAt > test.gt
    if (Array.isArray(test?.in)) return test.in.includes(row[field])
    return row[field] === test
  })

describe("db/table, the Gamemaster's rolls as the player's character (#156)", () => {
  const now = Date.now()
  const ago = (ms: number) => new Date(now - ms)
  /** A roll held: Thorin's, of this campaign, by its Gamemaster, made a minute ago. */
  const held = (fields: Record<string, unknown>) => ({
    id: 'req-gm',
    campaignId: 'c1',
    actorId: 'actor-thorin',
    role: 'gm',
    kind: 'skill',
    label: 'Perception check',
    payload: { kind: 'skill', key: 'prc' },
    status: 'done',
    createdAt: ago(60_000),
    claimedAt: ago(58_000),
    completedAt: ago(55_000),
    result: {
      id: 'req-gm',
      status: 'done',
      reason: null,
      error: null,
      messageId: 'm-roll',
      visible: true,
      rolls: [
        {
          formula: '1d20 + 3',
          total: 23,
          dice: [{ faces: 20, results: [{ result: 20, active: true }] }],
          critical: true,
        },
      ],
    },
    ...fields,
  })
  /** Every roll the database holds, which a query finds by its filter, as Prisma would. */
  const rolls = [
    held({ id: 'req-gm' }),
    held({ id: 'req-gm-older', createdAt: ago(3_600_000), label: null }),
    held({ id: 'req-player', role: 'player' }),
    held({ id: 'req-vex', actorId: 'actor-vex' }),
    held({ id: 'req-other-campaign', campaignId: 'c2' }),
    held({ id: 'req-gone', createdAt: ago(86_400_000 + 60_000) }),
  ]

  beforeEach(() => {
    givenCampaign(taking(['gmRolls']))
    prismaMock.rollRequest.findMany.mockImplementation((async ({
      where,
      orderBy,
      take,
    }: any) => {
      // Those shown, newest first; else those looked up by their ids.
      if (!where.id) expect(orderBy).toEqual({ createdAt: 'desc' })
      return rolls
        .filter(row => finds(row, where))
        .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, take)
    }) as any)
  })

  it("shows the player only their character's, of their campaign, newest first, of those kept", async () => {
    const view = await getTableView(character)

    expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId: 'c1',
          actorId: 'actor-thorin',
          role: 'gm',
          createdAt: { gt: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    )
    expect(view.gmRolls).toEqual([
      {
        id: 'req-gm',
        kind: 'skill',
        label: 'Perception check',
        at: ago(60_000).toISOString(),
        status: 'done',
        visible: true,
        total: 23,
        d20: 'critical',
      },
      // Sent before the Gamemaster's page said what it's called: called by its kind.
      expect.objectContaining({ id: 'req-gm-older', label: 'A check' }),
    ])
    expect(view.gmRollsKey).toEqual(expect.any(String))
  })

  it('shows at most ten', async () => {
    rolls.push(
      ...Array.from({ length: 12 }, (_, index) =>
        held({ id: `req-many-${index}`, createdAt: ago(1000 * (index + 1)) }),
      ),
    )
    const view = await getTableView(character)
    rolls.splice(-12)

    expect(view.gmRolls).toHaveLength(10)
    expect(view.gmRolls?.map(({ id }) => id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `req-many-${index}`),
    )
  })

  it('shows one the game hid as hidden, as the player’s own, with nothing of what it came to', async () => {
    // Even where what it came to was sent along with it.
    rolls[0] = held({
      result: {
        ...held({}).result,
        visible: false,
        attack: { critical: true, fumble: false, outcome: 'hit' },
        outcome: 'success',
        healed: 4,
      },
      kind: 'attack',
      label: 'Longsword attack',
    })
    const { gmRolls: [hidden] = [] } = await getTableView(character)
    rolls[0] = held({})

    expect(hidden).toEqual({
      id: 'req-gm',
      kind: 'attack',
      label: 'Longsword attack',
      at: ago(60_000).toISOString(),
      status: 'done',
      visible: false,
    })
  })

  it("tells damage, a description's too, the game called a critical hit's as such, where the player may see it; never a d20 roll's, nor hidden damage's", async () => {
    const result = held({}).result
    const damage = (critical: boolean, visible = true) => ({
      ...result,
      visible,
      rolls: [
        {
          formula: '2d8 + 4',
          total: 13,
          dice: [{ faces: 8, results: [{ result: 4, active: true }] }],
          damageType: 'slashing',
          critical,
        },
      ],
    })
    rolls.splice(
      0,
      1,
      held({
        id: 'crit',
        kind: 'damage',
        label: 'Longsword damage',
        result: damage(true),
      }),
      held({
        id: 'plain',
        kind: 'damage',
        createdAt: ago(61_000),
        result: damage(false),
      }),
      held({
        id: 'blind',
        kind: 'damage',
        createdAt: ago(62_000),
        result: damage(true, false),
      }),
      // A description's damage, rolled as a critical hit's (module 0.19.0).
      held({
        id: 'link',
        kind: 'textDamage',
        label: 'Divine Smite damage',
        createdAt: ago(63_000),
        result: damage(true),
      }),
    )
    const { gmRolls = [] } = await getTableView(character)
    rolls.splice(0, 4, held({}))

    const byId = new Map(gmRolls.map(roll => [roll.id, roll]))
    expect(byId.get('crit')).toMatchObject({ total: 13, critical: true })
    expect(byId.get('crit')).not.toHaveProperty('d20')
    expect(byId.get('link')).toMatchObject({
      kind: 'textDamage',
      total: 13,
      critical: true,
    })
    expect(byId.get('plain')).not.toHaveProperty('critical')
    expect(byId.get('blind')).not.toHaveProperty('critical')
    // A d20 roll's says so as a d20's, as before.
    expect(byId.get('req-gm-older')).toMatchObject({ d20: 'critical' })
    expect(byId.get('req-gm-older')).not.toHaveProperty('critical')
  })

  it("never names an area attack's targets: the player's page names them from its own view of the combat, which leaves out one hidden from players", async () => {
    rolls[0] = held({
      kind: 'attack',
      label: 'Breath Weapon attack',
      result: {
        ...held({}).result,
        attack: {
          critical: false,
          fumble: false,
          outcome: null,
          targets: [
            { combatId: 'cmbt1', combatantId: 'c-boss', outcome: 'hit' },
            { combatId: 'cmbt1', combatantId: 'c-hidden', outcome: 'hit' },
          ],
        },
      },
    })
    prismaMock.combat.findMany.mockResolvedValue([
      {
        data: combat({
          combatants: [
            combatant({ id: 'c-boss', name: 'Goblin Boss', initiative: 19 }),
            combatant({
              id: 'c-hidden',
              name: 'Hidden Assassin',
              initiative: 18,
              hidden: true,
            }),
          ],
        }),
      },
    ] as any)
    const view = await getTableView(character)
    rolls[0] = held({})

    expect(view.gmRolls?.[0].attack?.targets).toEqual([
      { combatId: 'cmbt1', combatantId: 'c-boss', outcome: 'hit' },
      { combatId: 'cmbt1', combatantId: 'c-hidden', outcome: 'hit' },
    ])
    expect(view.combat?.combatants.map(({ name }) => name)).toEqual([
      'Goblin Boss',
    ])
    expect(JSON.stringify(view)).not.toContain('Hidden Assassin')
  })

  it('tells what the game made of an attack, but never the damage that follows it', async () => {
    rolls[0] = held({
      kind: 'attack',
      label: 'Longsword attack',
      result: {
        ...held({}).result,
        attack: { critical: false, fumble: false, outcome: 'hit' },
        damage: { critical: false, plannable: true, rolls: [] },
      },
    })
    const { gmRolls: [attack] = [] } = await getTableView(character)
    rolls[0] = held({})

    expect(attack).toMatchObject({
      status: 'done',
      total: 23,
      attack: { outcome: 'hit' },
    })
    expect(attack).not.toHaveProperty('damage')
    expect(attack).not.toHaveProperty('rolls')
  })

  it("tells healing as healing, as the game said of the attack or use it follows, or else of every roll it made of it, as the player's own", async () => {
    const result = held({}).result
    /** Damage the game rolled, of this kind. */
    const rolled = (damageType?: string) => ({
      ...result,
      rolls: [
        {
          formula: '2d8 + 3',
          total: 9,
          dice: [{ faces: 8, results: [{ result: 4, active: true }] }],
          ...(damageType && { damageType }),
        },
      ],
    })
    const preview = (healing?: boolean) => ({
      ...result,
      rolls: [],
      damage: { critical: false, plannable: true, rolls: [], healing },
    })
    const KEPT = 86_400_000
    const added = [
      held({
        id: 'cure',
        kind: 'use',
        createdAt: ago(9000),
        result: preview(true),
      }),
      // Of no kind of damage the game named: healing as the use said.
      held({
        id: 'heal',
        kind: 'damage',
        useId: 'cure',
        createdAt: ago(8000),
        result: rolled(),
      }),
      held({
        id: 'hit',
        kind: 'attack',
        createdAt: ago(7000),
        result: preview(),
      }),
      held({
        id: 'cut',
        kind: 'damage',
        useId: 'hit',
        createdAt: ago(6000),
        result: rolled('slashing'),
      }),
      held({
        id: 'link',
        kind: 'textDamage',
        createdAt: ago(5000),
        result: rolled('healing'),
      }),
      held({
        id: 'burn',
        kind: 'textDamage',
        createdAt: ago(4000),
        result: rolled('fire'),
      }),
      // Damage whose use is no longer among those kept: looked up.
      held({
        id: 'old-cure',
        kind: 'use',
        createdAt: ago(KEPT + 5000),
        result: preview(true),
      }),
      held({
        id: 'late',
        kind: 'damage',
        useId: 'old-cure',
        createdAt: ago(KEPT - 5000),
        result: rolled(),
      }),
      // Damage naming another character's use, which the app never takes, isn't healing by it.
      held({
        id: 'vex-cure',
        actorId: 'actor-vex',
        kind: 'use',
        result: preview(true),
      }),
      held({
        id: 'stray',
        kind: 'damage',
        useId: 'vex-cure',
        createdAt: ago(3000),
        result: rolled(),
      }),
    ]
    rolls.push(...added)
    const view = await getTableView(character)
    rolls.splice(-added.length)

    const healing = Object.fromEntries(
      (view.gmRolls ?? []).map(({ id, healing }) => [id, healing ?? false]),
    )
    expect(healing).toMatchObject({
      cure: false,
      heal: true,
      hit: false,
      cut: false,
      link: true,
      burn: false,
      late: true,
      stray: false,
    })
    // Looked up once, only those not shown, of this character's, by the Gamemaster.
    expect(prismaMock.rollRequest.findMany).toHaveBeenCalledTimes(2)
    expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['vex-cure', 'old-cure'] },
        campaignId: 'c1',
        actorId: 'actor-thorin',
        role: 'gm',
      },
      select: { id: true, result: true },
    })
  })

  it('never shows them to the Gamemaster, whose page has them, nor looks', async () => {
    const gm = {
      ...character,
      role: 'gm' as const,
      userId: 'gm-1',
      characterId: null,
      chatReadAt: undefined,
    }

    expect(await getTableView(gm)).not.toHaveProperty('gmRolls')
    expect(await getCampaignStatus(gm)).not.toHaveProperty('gmRollsKey')
    expect(prismaMock.rollRequest.findMany).not.toHaveBeenCalled()
  })

  it('says what tells them apart as the view does, changing as one moves on, by time too', async () => {
    rolls[0] = held({
      status: 'pending',
      claimedAt: null,
      completedAt: null,
      createdAt: ago(5000),
    })
    const view = await getTableView(character)
    const status = await getCampaignStatus(character)

    expect(status.gmRollsKey).toBe(view.gmRollsKey)
    expect(prismaMock.rollRequest.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          status: true,
          createdAt: true,
          claimedAt: true,
          completedAt: true,
        },
      }),
    )

    // Not fetched in time: it no longer goes to the game, though nothing was written.
    rolls[0] = held({
      status: 'pending',
      claimedAt: null,
      completedAt: null,
      createdAt: ago(31_000),
    })
    const expired = await getCampaignStatus(character)
    expect(expired.gmRollsKey).not.toBe(view.gmRollsKey)

    // Made after all, late: what the game said changed.
    rolls[0] = held({})
    const made = await getCampaignStatus(character)
    rolls[0] = held({ completedAt: ago(1000) })
    const late = await getCampaignStatus(character)
    expect(late.gmRollsKey).not.toBe(made.gmRollsKey)
  })

  it('says nothing of them where there are none', async () => {
    prismaMock.rollRequest.findMany.mockResolvedValue([])

    expect(await getTableView(character)).not.toHaveProperty('gmRolls')
    expect(await getCampaignStatus(character)).not.toHaveProperty('gmRollsKey')
  })
})

describe('db/table, moving items and coins, from module 0.31.0', () => {
  /** The Gamemaster at Thorin's sheet. */
  const gm = {
    ...character,
    role: 'gm' as const,
    userId: 'gm-1',
    characterId: null,
  }
  /**
   * The Company, which Thorin's player owns and Vex's observes; a second, which Vex's owns; and a
   * third, which Thorin's observes. The primary is listed last, so only the view puts it first.
   */
  const groups = [
    groupEntry({
      id: 'order',
      name: 'The Silent Order',
      img: null,
      primary: false,
      access: { 'actor-vex': 'owner' },
    }),
    groupEntry({
      id: 'watch',
      name: 'The Night Watch',
      img: null,
      primary: false,
      access: { 'actor-thorin': 'observer' },
    }),
    groupEntry({
      id: 'company',
      access: { 'actor-thorin': 'owner', 'actor-vex': 'observer' },
    }),
  ]
  /** The campaign, its game taking moves as given, and fetching them as lately as given. */
  const moving = (
    transfersEnabled = true,
    bridgePolledAt: Date | null = new Date(Date.now() - 5000),
  ) =>
    givenCampaign({
      ...campaign,
      characters: [
        { id: 'actor-thorin', name: 'Thorin', img: 'thorin.webp' },
        { id: 'actor-vex', name: 'Vex', img: null },
        { id: 'actor-balin', name: 'Balin', img: 'https://cdn.example/b.png' },
      ],
      groups,
      rollsEnabled: false,
      rollKinds: [],
      rollFeatures: [],
      transfersEnabled,
      bridgePolledAt,
    })

  it("lists where a player may give: the parties they own, and the campaign's other characters, naming no one's access", async () => {
    moving()
    const view = await getTableView(character)

    expect(view.moves).toEqual({
      parties: [
        {
          id: 'company',
          name: 'The Company',
          primary: true,
          portrait: expect.any(String),
        },
      ],
      characters: [
        { id: 'actor-vex', name: 'Vex' },
        {
          id: 'actor-balin',
          name: 'Balin',
          portrait: 'https://cdn.example/b.png',
        },
      ],
    })
    expect(JSON.stringify(view.moves)).not.toContain('owner')
    expect(JSON.stringify(view.moves)).not.toContain('access')
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      moves: true,
    })
  })

  it('lists every listed party for the Gamemaster, the primary first', async () => {
    moving()
    const view = await getTableView(gm)

    expect(view.moves?.parties.map(({ id }) => id)).toEqual([
      'company',
      'order',
      'watch',
    ])
    expect(view.moves?.characters.map(({ id }) => id)).toEqual([
      'actor-vex',
      'actor-balin',
    ])
    await expect(getCampaignStatus(gm)).resolves.toMatchObject({
      moves: true,
    })
  })

  it.each([
    ['the campaign lets none be moved', () => moving(false)],
    [
      'its module has fetched none lately',
      () => moving(true, new Date(Date.now() - 46_000)),
    ],
    ['its module never fetched', () => moving(true, null)],
  ])('lists nowhere to move to while %s', async (_name, arrange) => {
    arrange()

    expect(await getTableView(character)).not.toHaveProperty('moves')
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      moves: false,
    })
  })

  it('lists nowhere for a character no longer in the roster, nor a seat without one', async () => {
    moving()

    const removed = await getTableView({ ...character, actorId: 'actor-gone' })
    expect(removed).not.toHaveProperty('moves')
    const none = await getTableView({ ...character, actorId: null })
    expect(none).not.toHaveProperty('moves')
    await expect(
      getCampaignStatus({ ...character, actorId: null }),
    ).resolves.toMatchObject({ moves: false })
  })
})

describe('db/table, typing in their own dice, from module 0.32.0', () => {
  /** Thorin, as the game said last of whether his player may type in his dice. */
  const listed = (manualDice?: boolean) => [
    { ...roster[0], ...(manualDice !== undefined && { manualDice }) },
    roster[1],
  ]
  /** A game that let players type in theirs, as stored, though its module last polled long ago. */
  const stored = (features: string[], manualDice?: boolean) => ({
    ...taking(features),
    characters: listed(manualDice),
    bridgePolledAt: new Date(Date.now() - 3_600_000),
  })
  const thorin = { ...character, actorId: roster[0].id }

  it('offers it to the player where the game lets players and says theirs may, as it said last, however long ago it polled', async () => {
    givenCampaign(stored(['manualDice'], true))
    const view = await getTableView(thorin)
    expect(view.manualDice).toEqual({ offered: true, on: false })
    // Its rolls, though, wait for its module.
    expect(view.rollFeatures).toEqual([])
  })

  it.each([
    ["the game doesn't let players", stored([], true)],
    ['the game says this player may not', stored(['manualDice'], false)],
    ['the game says nothing of this player', stored(['manualDice'])],
  ])('offers it nowhere where %s', async (_name, found) => {
    givenCampaign(found)
    await expect(getTableView(thorin)).resolves.toMatchObject({
      manualDice: { offered: false, on: false },
    })
  })

  it("says whether the player chose to, from their character's row, offered or not", async () => {
    givenCampaign(stored([], true))
    await expect(
      getTableView({ ...thorin, manualDice: true }),
    ).resolves.toMatchObject({ manualDice: { offered: false, on: true } })
    givenCampaign(stored(['manualDice'], true))
    await expect(
      getTableView({ ...thorin, manualDice: true }),
    ).resolves.toMatchObject({ manualDice: { offered: true, on: true } })
  })

  it("never offers it at the Gamemaster's seat, which has nowhere to keep it", async () => {
    givenCampaign(stored(['manualDice', 'gmRolls'], true))
    const view = await getTableView({
      ...thorin,
      role: 'gm',
      userId: 'gm-1',
      characterId: null,
    })
    expect(view).not.toHaveProperty('manualDice')
  })

  it("tells, cheaply, whether the player's choice is on, for another of their devices to see it change", async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      version: 7,
      lastSeenAt: recently(),
    } as any)
    await expect(getCampaignStatus(thorin)).resolves.toMatchObject({
      typed: false,
    })
    await expect(
      getCampaignStatus({ ...thorin, manualDice: true }),
    ).resolves.toMatchObject({ typed: true })
    await expect(
      getCampaignStatus({
        ...thorin,
        manualDice: true,
        role: 'gm',
        characterId: null,
      }),
    ).resolves.toMatchObject({ typed: false })
  })

  // A campaign removed leaves its characters, and their players' choices, stored. Each row as long
  // as the rest: jest takes a last parameter a row lacks for `done`.
  it.each<[string, { campaignId?: null }, object | null | undefined]>([
    [
      'in no campaign, as once its campaign is removed',
      { campaignId: null },
      undefined,
    ],
    ['whose campaign is gone', {}, null],
    ['in its campaign', {}, stored(['manualDice'], true)],
  ])(
    'tells the poll that nothing changed as the view it had says, for a character %s',
    async (_name, fields, found) => {
      givenCampaign(found as object)
      const seat = { ...thorin, manualDice: true, ...fields }
      const view = await getTableView(seat)

      // What the page sends back of the view it has, as `typed=1`.
      const seen = view.manualDice?.on === true
      await expect(getCampaignStatus(seat)).resolves.toMatchObject({
        typed: seen,
      })
    },
  )
})

/** The campaign, its game removing items as given, and fetching as lately as given. */
const removing = (
  removalsEnabled = true,
  bridgePolledAt: Date | null = new Date(Date.now() - 5000),
) =>
  givenCampaign({
    ...campaign,
    groups: [],
    rollsEnabled: false,
    rollKinds: [],
    rollFeatures: [],
    transfersEnabled: false,
    removalsEnabled,
    bridgePolledAt,
  })

describe('db/table, removing items, from module 0.33.0', () => {
  /** The Gamemaster at Thorin's sheet. */
  const gm = {
    ...character,
    role: 'gm' as const,
    userId: 'gm-1',
    characterId: null,
  }
  it('lets the seat remove the character’s items while its game removes them, rolls and moves off, the Gamemaster’s seat too', async () => {
    removing()

    const view = await getTableView(character)
    expect(view.removes).toBe(true)
    expect(view).not.toHaveProperty('moves')
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      moves: false,
      removes: true,
    })
    await expect(getTableView(gm)).resolves.toMatchObject({ removes: true })
    await expect(getCampaignStatus(gm)).resolves.toMatchObject({
      removes: true,
    })
  })

  it.each([
    ['its game removes none, as before module 0.33.0', () => removing(false)],
    [
      'its module stopped fetching',
      () => removing(true, new Date(Date.now() - 46_000)),
    ],
    ['its module never fetched', () => removing(true, null)],
  ])('lets no one remove while %s', async (_name, arrange) => {
    arrange()

    expect(await getTableView(character)).not.toHaveProperty('removes')
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      removes: false,
    })
  })

  it('lets no one remove from a character no longer in the roster, nor from a seat without one', async () => {
    removing()

    const gone = await getTableView({ ...character, actorId: 'actor-gone' })
    expect(gone).not.toHaveProperty('removes')
    const none = await getTableView({ ...character, actorId: null })
    expect(none).not.toHaveProperty('removes')
    await expect(
      getCampaignStatus({ ...character, actorId: null }),
    ).resolves.toMatchObject({ removes: false })
    await expect(
      getCampaignStatus({ ...character, campaignId: null }),
    ).resolves.toMatchObject({ removes: false })
  })
})

/** The campaign, its game taking favorites as given, and fetching as lately as given. */
const favoriting = (
  favoritesEnabled = true,
  bridgePolledAt: Date | null = new Date(Date.now() - 5000),
) =>
  givenCampaign({
    ...campaign,
    groups: [],
    rollsEnabled: false,
    rollKinds: [],
    rollFeatures: [],
    transfersEnabled: false,
    removalsEnabled: false,
    favoritesEnabled,
    bridgePolledAt,
  })

describe('db/table, favorites, from module 0.37.0', () => {
  /** The Gamemaster at Thorin's sheet. */
  const gm = {
    ...character,
    role: 'gm' as const,
    userId: 'gm-1',
    characterId: null,
  }

  it('lets the player change the character’s favorites while its game takes them, everything else off', async () => {
    favoriting()

    const view = await getTableView(character)
    expect(view.favorites).toBe(true)
    expect(view).not.toHaveProperty('removes')
    expect(view).not.toHaveProperty('moves')
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      removes: false,
      favorites: true,
    })
  })

  it('never lets the Gamemaster’s seat, which would leave no mark of theirs', async () => {
    favoriting()

    expect(await getTableView(gm)).not.toHaveProperty('favorites')
    await expect(getCampaignStatus(gm)).resolves.toMatchObject({
      favorites: false,
    })
  })

  it.each([
    ['its game takes none, as before module 0.37.0', () => favoriting(false)],
    [
      'its module stopped fetching',
      () => favoriting(true, new Date(Date.now() - 46_000)),
    ],
    ['its module never fetched', () => favoriting(true, null)],
  ])('lets no one change them while %s', async (_name, arrange) => {
    arrange()

    expect(await getTableView(character)).not.toHaveProperty('favorites')
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      favorites: false,
    })
  })

  it('lets no one change those of a character no longer in the roster, nor at a seat without one', async () => {
    favoriting()

    const gone = await getTableView({ ...character, actorId: 'actor-gone' })
    expect(gone).not.toHaveProperty('favorites')
    const none = await getTableView({ ...character, actorId: null })
    expect(none).not.toHaveProperty('favorites')
    await expect(
      getCampaignStatus({ ...character, actorId: null }),
    ).resolves.toMatchObject({ favorites: false })
    await expect(
      getCampaignStatus({ ...character, campaignId: null }),
    ).resolves.toMatchObject({ favorites: false })
  })
})

/** The campaign, letting its players change their effects as given, and fetching as lately. */
const changingEffects = (
  effectsEnabled = true,
  bridgePolledAt: Date | null = new Date(Date.now() - 5000),
) =>
  givenCampaign({
    ...campaign,
    groups: [],
    rollsEnabled: false,
    rollKinds: [],
    rollFeatures: [],
    transfersEnabled: false,
    removalsEnabled: false,
    favoritesEnabled: false,
    effectsEnabled,
    bridgePolledAt,
  })

describe("db/table, a player's own effects, from module 0.39.0", () => {
  /** The Gamemaster at Thorin's sheet. */
  const gm = {
    ...character,
    role: 'gm' as const,
    userId: 'gm-1',
    characterId: null,
  }

  it('lets the player change the character’s own effects while the campaign lets them, everything else off', async () => {
    changingEffects()

    const view = await getTableView(character)
    expect(view.effects).toBe(true)
    expect(view).not.toHaveProperty('favorites')
    expect(view).not.toHaveProperty('removes')
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      favorites: false,
      effects: true,
    })
  })

  it('never lets the Gamemaster’s seat, which would leave no mark of theirs', async () => {
    changingEffects()

    expect(await getTableView(gm)).not.toHaveProperty('effects')
    await expect(getCampaignStatus(gm)).resolves.toMatchObject({
      effects: false,
    })
  })

  it.each([
    [
      'the campaign lets none, as before module 0.39.0',
      () => changingEffects(false),
    ],
    [
      'its module stopped fetching',
      () => changingEffects(true, new Date(Date.now() - 46_000)),
    ],
    ['its module never fetched', () => changingEffects(true, null)],
  ])('lets no one change them while %s', async (_name, arrange) => {
    arrange()

    expect(await getTableView(character)).not.toHaveProperty('effects')
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      effects: false,
    })
  })

  it('lets no one change those of a character no longer in the roster, nor at a seat without one', async () => {
    changingEffects()

    const gone = await getTableView({ ...character, actorId: 'actor-gone' })
    expect(gone).not.toHaveProperty('effects')
    const none = await getTableView({ ...character, actorId: null })
    expect(none).not.toHaveProperty('effects')
    await expect(
      getCampaignStatus({ ...character, actorId: null }),
    ).resolves.toMatchObject({ effects: false })
    await expect(
      getCampaignStatus({ ...character, campaignId: null }),
    ).resolves.toMatchObject({ effects: false })
  })
})

/** The campaign, letting its players use Wild Shape as given, and fetching as lately. */
const shapingWild = (
  wildShapeEnabled = true,
  bridgePolledAt: Date | null = new Date(Date.now() - 5000),
) =>
  givenCampaign({
    ...campaign,
    groups: [],
    rollsEnabled: false,
    rollKinds: [],
    rollFeatures: [],
    transfersEnabled: false,
    removalsEnabled: false,
    favoritesEnabled: false,
    effectsEnabled: false,
    wildShapeEnabled,
    bridgePolledAt,
  })

describe('db/table, Wild Shape, from module 0.40.0', () => {
  /** The Gamemaster at Thorin's sheet. */
  const gm = {
    ...character,
    role: 'gm' as const,
    userId: 'gm-1',
    characterId: null,
  }

  it('lets the player use Wild Shape while the campaign lets them, everything else off', async () => {
    shapingWild()

    const view = await getTableView(character)
    expect(view.wildShape).toBe(true)
    expect(view).not.toHaveProperty('effects')
    expect(view).not.toHaveProperty('favorites')
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      effects: false,
      wildShape: true,
    })
  })

  it('never lets the Gamemaster’s seat, whose change would be the player’s in the game', async () => {
    shapingWild()

    expect(await getTableView(gm)).not.toHaveProperty('wildShape')
    await expect(getCampaignStatus(gm)).resolves.toMatchObject({
      wildShape: false,
    })
  })

  it.each([
    [
      'the campaign lets none, as before module 0.40.0',
      () => shapingWild(false),
    ],
    [
      'its module stopped fetching',
      () => shapingWild(true, new Date(Date.now() - 46_000)),
    ],
    ['its module never fetched', () => shapingWild(true, null)],
  ])('lets no one use it while %s', async (_name, arrange) => {
    arrange()

    expect(await getTableView(character)).not.toHaveProperty('wildShape')
    await expect(getCampaignStatus(character)).resolves.toMatchObject({
      wildShape: false,
    })
  })

  it('lets no one use it for a character no longer in the roster, nor at a seat without one', async () => {
    shapingWild()

    const gone = await getTableView({ ...character, actorId: 'actor-gone' })
    expect(gone).not.toHaveProperty('wildShape')
    const none = await getTableView({ ...character, actorId: null })
    expect(none).not.toHaveProperty('wildShape')
    await expect(
      getCampaignStatus({ ...character, actorId: null }),
    ).resolves.toMatchObject({ wildShape: false })
    await expect(
      getCampaignStatus({ ...character, campaignId: null }),
    ).resolves.toMatchObject({ wildShape: false })
  })

  it('serves a shaped sheet’s form and Wild Shape as the module sent them, under the character’s id', async () => {
    shapingWild()
    prismaMock.actorSheet.findUnique.mockResolvedValue({
      data: shapedSheet(),
      updatedAt: new Date('2026-10-29T12:00:00Z'),
    } as any)

    const view = await getTableView(character)
    expect(view.sheet?.form).toEqual(wolfForm())
    expect(view.sheet?.wildShape).toEqual(
      wildShapeBlock({ uses: { value: 1, max: 2 } }),
    )
    expect(prismaMock.actorSheet.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignActor: { campaignId: 'c1', actorId: 'actor-thorin' },
        },
      }),
    )
  })
})

describe('db/table, companions, from module 0.36.0', () => {
  const ORIGIN = 'https://my-game.forge-vtt.com'
  /** Thorin's player at his sheet, by his Foundry id, as a companion's characters name him. */
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
  const vex = { ...thorin, actorId: PARTY.vex, characterId: 'char-2' }
  const wolf = mockCompanionEntry()
  const imp = mockSummonedEntry()
  /** Vex's own hound. */
  const hound = mockCompanionEntry({
    key: 'houndVex',
    actorId: 'houndVex',
    name: 'Hound',
    img: null,
    of: [PARTY.vex],
  })

  const held = (fields: object = {}) =>
    prismaMock.campaign.findUnique.mockResolvedValue({
      ...campaign,
      origin: ORIGIN,
      characters: [
        { id: PARTY.thorin, name: 'Thorin' },
        { id: PARTY.vex, name: 'Vex' },
      ],
      companions: [wolf, imp, hound],
      ...fields,
    } as any)

  beforeEach(() => {
    prismaMock.chatMessage.findMany.mockResolvedValue([])
    prismaMock.combat.findMany.mockResolvedValue([])
    prismaMock.actorSheet.findUnique.mockResolvedValue(null)
  })

  it("lists the character's own companions, in the module's order, for their tabs, with or without a sheet", async () => {
    held()

    const view = await getTableView(thorin)
    expect(view.companions).toEqual([
      {
        key: 'wolfBrakka',
        name: 'Wolf',
        portrait: `${ORIGIN}/worlds/frost-road/wolf.webp`,
        kind: 'owned',
      },
      {
        key: 'sceneFrost-tokenImp',
        name: 'Imp',
        portrait: `${ORIGIN}/worlds/frost-road/imp.webp`,
        kind: 'summoned',
        from: 'Find Familiar',
      },
    ])
    expect(view.sheet).toBeUndefined()

    held()
    await expect(getTableView(vex)).resolves.toMatchObject({
      companions: [{ key: 'houndVex', name: 'Hound', kind: 'owned' }],
    })
  })

  it('lists none for a character with none, and none from a module before 0.36.0', async () => {
    held({ companions: [wolf, imp] })
    expect(await getTableView(vex)).not.toHaveProperty('companions')

    held({ companions: [] })
    expect(await getTableView(thorin)).not.toHaveProperty('companions')
  })

  it("never lists companions at a companion's own seat", async () => {
    held()
    const atWolf = {
      ...thorin,
      actorId: 'wolfBrakka',
      companion: { of: PARTY.thorin, entry: wolf },
    }

    expect(await getTableView(atWolf)).not.toHaveProperty('companions')
  })

  it("marks the character's companions in the fight as the player's, with their hit points; another's as the party's", async () => {
    held()
    prismaMock.combat.findMany.mockResolvedValue([
      {
        data: combat({
          combatants: [
            combatant({ id: 'c-thorin', character: PARTY.thorin }),
            combatant({
              id: 'c-wolf',
              companion: 'wolfBrakka',
              hp: { value: 11, max: 11, temp: 0 },
            }),
            combatant({
              id: 'c-hound',
              companion: 'houndVex',
              hp: { value: 9, max: 9, temp: 0 },
            }),
            combatant({
              id: 'c-stray',
              companion: 'strayGone',
              hp: { value: 4, max: 4, temp: 0 },
            }),
          ],
        }),
      },
    ] as any)

    const { combat: shown } = await getTableView(thorin)
    const [me, wolfRow, houndRow, stray] = shown!.combatants
    expect(me).toMatchObject({ side: 'me' })
    expect(me).not.toHaveProperty('yours')
    expect(wolfRow).toMatchObject({
      side: 'party',
      yours: true,
      companion: 'wolfBrakka',
      hp: { value: 11, max: 11, temp: 0 },
    })
    expect(houndRow).toMatchObject({
      side: 'party',
      hp: { value: 9, max: 9, temp: 0 },
    })
    expect(houndRow).not.toHaveProperty('yours')
    expect(houndRow).not.toHaveProperty('companion')
    // One no longer listed is no one's.
    expect(stray).toMatchObject({ side: 'other' })
    expect(stray.hp).toBeUndefined()
  })

  it("shows the character's companion's messages as the player's own, with its portrait; another's as the party's", async () => {
    held()
    prismaMock.chatMessage.findMany.mockResolvedValue([
      {
        data: chatMessage({
          id: 'm2',
          companion: 'houndVex',
          speaker: { alias: 'Hound', actorId: 'houndVex' },
        }),
      },
      {
        data: chatMessage({
          id: 'm1',
          companion: 'sceneFrost-tokenImp',
          speaker: { alias: 'Imp', actorId: 'impTemplate' },
        }),
      },
    ] as any)

    const { messages } = await getTableView(thorin)
    expect(messages[0]).toMatchObject({
      id: 'm1',
      side: 'me',
      speaker: 'Imp',
      avatar: `${ORIGIN}/worlds/frost-road/imp.webp`,
    })
    expect(messages[1]).toMatchObject({ id: 'm2', side: 'party' })
    expect(messages[1].avatar).toBeUndefined()
  })
})
