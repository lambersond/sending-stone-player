/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { prismaMock } from '../../jest.setup'
import { playerSeat } from './seats'
import { getCampaignStatus, getTableView, MESSAGE_LIMIT } from './table'
import {
  characterSheet,
  chatMessage,
  combat,
  roster,
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
      })
      expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()

      prismaMock.campaign.findUnique.mockResolvedValue(null)
      await expect(getCampaignStatus(character)).resolves.toEqual({
        version: 0,
        live: false,
        rollsToTable: [],
        rollFeatures: [],
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
          rollsEnabled: true,
          rollKinds: true,
          rollFeatures: true,
          bridgePolledAt: true,
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

      expect(prismaMock.rollPrompt.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          actorId: 'actor-thorin',
          closedAt: null,
          expiresAt: { gt: new Date('2026-10-08T12:05:00Z') },
        },
        orderBy: { openedAt: 'asc' },
        select: { promptId: true, data: true, expiresAt: true },
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
