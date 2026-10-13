/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { prismaMock } from '../../jest.setup'
import { applyCampaignEvent, sortTurnOrder } from './campaign-events'
import {
  characterSheet,
  chatMessage,
  combat,
  combatant,
  fullerSheet,
  roster,
  TEXTS,
} from '@/mocks/sending-stone'
import { parseGameEvent } from '@/schemas/sending-stone'
import { sheetTextRefs } from '@/utils/sheet-texts'
import type { GameEvent } from '@/types/sending-stone'

const world = { id: 'erebor', title: 'Return to Erebor' }
const campaign = { id: 'camp-a', title: 'The Lonely Mountain' }

/** The combat as last saved. */
const saved = () => prismaMock.combat.upsert.mock.calls[0][0].update.data as any

const apply = (event: GameEvent) =>
  applyCampaignEvent('c1', world, campaign, event, 'session-1')

/** A hello from module 0.22.0: the roster and state, each sheet to follow in a post of its own. */
const apartHello = (characters = roster) =>
  apply(
    parseGameEvent('bridge.hello', {
      sheetsApart: true,
      characters,
      combats: [combat()],
    }) as GameEvent,
  )

/** What a public message to the party is stored as. */
const chatFields = (message: ReturnType<typeof chatMessage>) => ({
  sentAt: new Date(message.timestamp),
  public: true,
  readers: ['actor-thorin', 'actor-vex'],
  data: message,
})

/** A message naming one of the Gamemaster's rolls (#156), as the character that speaks it. */
const said = (gmRoll: string, actorId: string | null = 'actor-balin') =>
  chatMessage({ gmRoll, speaker: { alias: 'Balin', actorId } })

/** What a message is stored as, from a created or updated event. */
const saving = async (
  type: 'chat.message.created' | 'chat.message.updated',
  message: ReturnType<typeof chatMessage>,
) => {
  prismaMock.chatMessage.upsert.mockClear()
  await apply({ type, data: { message } })
  return prismaMock.chatMessage.upsert.mock.calls.at(-1)?.[0]
}

describe('db/campaign-events', () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation((run: any) => run(prismaMock))
  })

  it('applies the event to its campaign, keeping its title current, and bumps its version', async () => {
    await apply({ type: 'chat.cleared', data: {} })

    expect(prismaMock.campaign.update).toHaveBeenLastCalledWith({
      where: { id: 'c1' },
      data: {
        title: 'The Lonely Mountain',
        worldId: 'erebor',
        worldTitle: 'Return to Erebor',
        version: { increment: 1 },
        lastEventAt: expect.any(Date),
        lastSeenAt: expect.any(Date),
      },
    })
  })

  it('bridge.hello replaces the roster and combats but keeps the chat', async () => {
    const snapshot = combat()
    await apply({
      type: 'bridge.hello',
      data: { characters: roster, combats: [snapshot] },
    })

    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: roster,
        rollsEnabled: false,
        rollKinds: [],
        rollFeatures: [],
      },
    })
    expect(prismaMock.combat.deleteMany).toHaveBeenCalledWith({
      where: { campaignId: 'c1' },
    })
    expect(prismaMock.combat.createMany).toHaveBeenCalledWith({
      data: [{ campaignId: 'c1', combatId: 'cmbt1', data: snapshot }],
    })
    expect(prismaMock.chatMessage.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.campaign.update).toHaveBeenLastCalledWith({
      where: { id: 'c1' },
      data: expect.objectContaining({ helloSession: 'session-1' }),
    })
  })

  it("bridge.hello keeps each character's sheet apart from the roster", async () => {
    const sheet = characterSheet()
    await apply({
      type: 'bridge.hello',
      data: {
        characters: [
          { ...roster[0], sheet },
          { ...roster[1], sheet: null },
        ],
        combats: [],
      },
    })

    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: roster,
        rollsEnabled: false,
        rollKinds: [],
        rollFeatures: [],
      },
    })
    expect(prismaMock.actorSheet.deleteMany).toHaveBeenCalledWith({
      where: { campaignId: 'c1' },
    })
    expect(prismaMock.actorSheet.createMany).toHaveBeenCalledWith({
      data: [{ campaignId: 'c1', actorId: 'actor-thorin', data: sheet }],
    })
  })

  it("bridge.hello keeps whether the game takes players' rolls, and which it knows", async () => {
    await apply({
      type: 'bridge.hello',
      data: {
        characters: roster,
        combats: [],
        features: {
          rolls: {
            enabled: true,
            kinds: ['skill', 'save', 'attack', 'heal', 'initiative'],
            reason: null,
            modifiers: true,
            prompts: true,
          },
        },
      },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: roster,
        rollsEnabled: true,
        rollKinds: ['skill', 'save', 'attack', 'initiative'],
        // From module 0.13.0: it takes damage the player changed, and asks players for the saves
        // their game asks of them.
        rollFeatures: ['modifiers', 'prompts'],
      },
    })

    await apply({
      type: 'bridge.hello',
      data: {
        characters: roster,
        combats: [],
        features: {
          rolls: { enabled: false, kinds: [], reason: 'self-test' },
        },
      },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: roster,
        rollsEnabled: false,
        rollKinds: [],
        rollFeatures: [],
      },
    })
  })

  it('bridge.hello keeps whether the game makes area attacks at the combatants players pick, and takes their hit dice and formulas, from module 0.16.0', async () => {
    const rolls = {
      enabled: true,
      kinds: ['attack', 'hitDie', 'formula', 'rest'],
      reason: null,
    }
    await apply({
      type: 'bridge.hello',
      data: {
        characters: roster,
        combats: [],
        features: { rolls: { ...rolls, prompts: true, areaAttacks: true } },
      },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: roster,
        rollsEnabled: true,
        rollKinds: ['attack', 'hitDie', 'formula'],
        rollFeatures: ['prompts', 'areaAttacks'],
      },
    })

    prismaMock.campaign.update.mockClear()
    await apply({
      type: 'bridge.hello',
      data: {
        characters: roster,
        combats: [],
        features: { rolls: { ...rolls, modifiers: true, areaAttacks: false } },
      },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: roster,
        rollsEnabled: true,
        rollKinds: ['attack', 'hitDie', 'formula'],
        rollFeatures: ['modifiers'],
      },
    })
  })

  it('bridge.hello keeps whether the game makes a check an activity asks for against it, from module 0.21.0', async () => {
    const rolls = {
      enabled: true,
      kinds: ['skill', 'tool', 'ability', 'use'],
      reason: null,
    }
    await apply({
      type: 'bridge.hello',
      data: {
        characters: roster,
        combats: [],
        features: {
          rolls: { ...rolls, modifiers: true, activityChecks: true },
        },
      },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: roster,
        rollsEnabled: true,
        rollKinds: ['skill', 'tool', 'ability', 'use'],
        rollFeatures: ['modifiers', 'activityChecks'],
      },
    })

    prismaMock.campaign.update.mockClear()
    await apply({
      type: 'bridge.hello',
      data: {
        characters: roster,
        combats: [],
        features: { rolls: { ...rolls, activityChecks: false } },
      },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: roster,
        rollsEnabled: true,
        rollKinds: ['skill', 'tool', 'ability', 'use'],
        rollFeatures: [],
      },
    })
  })

  it('bridge.hello keeps whether the game changes only a die damage adds, from module 0.21.0, last', async () => {
    const rolls = {
      enabled: true,
      kinds: ['damage', 'textDamage'],
      reason: null,
    }
    await apply({
      type: 'bridge.hello',
      data: {
        characters: roster,
        combats: [],
        features: {
          rolls: {
            ...rolls,
            signedDice: true,
            modifiers: true,
            activityChecks: true,
          },
        },
      },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: roster,
        rollsEnabled: true,
        rollKinds: ['damage', 'textDamage'],
        rollFeatures: ['modifiers', 'activityChecks', 'signedDice'],
      },
    })

    // Not from a module before, which says nothing of it, nor where it says what it can't, read
    // as the hello is read.
    for (const signedDice of [undefined, 'yes']) {
      prismaMock.campaign.update.mockClear()
      await apply(
        parseGameEvent('bridge.hello', {
          characters: roster,
          combats: [],
          features: { rolls: { ...rolls, modifiers: true, signedDice } },
        }) as GameEvent,
      )
      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          characters: roster,
          rollsEnabled: true,
          rollKinds: ['damage', 'textDamage'],
          rollFeatures: ['modifiers'],
        },
      })
    }
  })

  it('bridge.hello keeps whether the game makes a use at its user, from module 0.22.0, last', async () => {
    const rolls = { enabled: true, kinds: ['use'], reason: null }
    await apply({
      type: 'bridge.hello',
      data: {
        characters: roster,
        combats: [],
        features: {
          rolls: { ...rolls, selfTargets: true, signedDice: true },
        },
      },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: roster,
        rollsEnabled: true,
        rollKinds: ['use'],
        rollFeatures: ['signedDice', 'selfTargets'],
      },
    })

    prismaMock.campaign.update.mockClear()
    await apply({
      type: 'bridge.hello',
      data: { characters: roster, combats: [], features: { rolls } },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rollFeatures: [] }),
      }),
    )
  })

  it("bridge.hello keeps whether the game makes the Gamemaster's rolls as a character, from module 0.23.0, last; none where it says nothing or what it can't (#156)", async () => {
    const rolls = { enabled: true, kinds: ['skill'], reason: null }
    for (const [gmRolls, rollFeatures] of [
      [true, ['selfTargets', 'gmRolls']],
      ['yes', ['selfTargets']],
      [undefined, ['selfTargets']],
    ] as const) {
      prismaMock.campaign.update.mockClear()
      await apply({
        type: 'bridge.hello',
        data: {
          characters: roster,
          combats: [],
          features: {
            rolls: { ...rolls, selfTargets: true, gmRolls: gmRolls as any },
          },
        },
      })
      expect(prismaMock.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rollFeatures }),
        }),
      )
    }
  })

  it("bridge.hello keeps whether the game spends several hit dice at once, from module 0.20.0, in the module's order", async () => {
    await apply({
      type: 'bridge.hello',
      data: {
        characters: roster,
        combats: [],
        features: {
          rolls: {
            enabled: true,
            // The module's order.
            kinds: ['skill', 'initiative', 'hitDie', 'hitDice', 'formula'],
            reason: null,
          },
        },
      },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: roster,
        rollsEnabled: true,
        rollKinds: ['skill', 'initiative', 'hitDie', 'hitDice', 'formula'],
        rollFeatures: [],
      },
    })
  })

  it('bridge.hello keeps whether the game ends enchantments, from module 0.21.0', async () => {
    await apply({
      type: 'bridge.hello',
      data: {
        characters: roster,
        combats: [],
        features: {
          rolls: {
            enabled: true,
            kinds: ['attack', 'use', 'damage', 'endEnchantment'],
            reason: null,
          },
        },
      },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: roster,
        rollsEnabled: true,
        rollKinds: ['attack', 'use', 'damage', 'endEnchantment'],
        rollFeatures: [],
      },
    })
  })

  describe('sheets apart, from module 0.22.0', () => {
    it("bridge.hello keeps the sheets held for its characters, and those sheets' descriptions, until theirs follow", async () => {
      prismaMock.actorSheet.findMany.mockResolvedValue([
        { data: fullerSheet() },
      ] as any)

      const result = await apartHello()

      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          characters: roster,
          rollsEnabled: false,
          rollKinds: [],
          rollFeatures: [],
        },
      })
      expect(prismaMock.combat.createMany).toHaveBeenCalledWith({
        data: [{ campaignId: 'c1', combatId: 'cmbt1', data: combat() }],
      })
      // A character it no longer names has left, and its sheet goes.
      expect(prismaMock.actorSheet.deleteMany).toHaveBeenCalledTimes(1)
      expect(prismaMock.actorSheet.deleteMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          actorId: { notIn: ['actor-thorin', 'actor-vex'] },
        },
      })
      expect(prismaMock.actorSheet.createMany).not.toHaveBeenCalled()
      expect(prismaMock.actorSheet.findMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1' },
        select: { data: true },
      })
      expect(prismaMock.sheetText.deleteMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          hash: { notIn: sheetTextRefs(fullerSheet()) },
        },
      })
      // Their descriptions follow it too: none is missing yet.
      expect(prismaMock.sheetText.count).not.toHaveBeenCalled()
      expect(result).toEqual({ lacksTexts: false })
      expect(prismaMock.campaign.update).toHaveBeenLastCalledWith({
        where: { id: 'c1' },
        data: expect.objectContaining({ helloSession: 'session-1' }),
      })
    })

    it('bridge.hello without its characters drops every sheet, keeping no description', async () => {
      prismaMock.actorSheet.findMany.mockResolvedValue([])

      await expect(apartHello([])).resolves.toEqual({ lacksTexts: false })

      expect(prismaMock.actorSheet.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', actorId: { notIn: [] } },
      })
      expect(prismaMock.sheetText.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', hash: { notIn: [] } },
      })
    })

    it('bridge.hello from an earlier module, its sheets in it, replaces them as before', async () => {
      const sheet = characterSheet()
      prismaMock.sheetText.count.mockResolvedValue(0)

      await apply(
        parseGameEvent('bridge.hello', {
          characters: [
            { ...roster[0], sheet },
            { ...roster[1], sheet: null },
          ],
          combats: [],
        }) as GameEvent,
      )

      expect(prismaMock.actorSheet.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1' },
      })
      expect(prismaMock.actorSheet.createMany).toHaveBeenCalledWith({
        data: [{ campaignId: 'c1', actorId: 'actor-thorin', data: sheet }],
      })
      expect(prismaMock.actorSheet.findMany).not.toHaveBeenCalled()
    })

    it('character.updated keeps why a sheet was held back in the roster, until an update without it', async () => {
      const withheld = {
        ...roster[0],
        sheet: null,
        sheetWithheld: {
          reason: 'tooLarge',
          bytes: 5_200_000,
          limit: 4_000_000,
        },
      }
      prismaMock.campaign.findUnique.mockResolvedValue({
        characters: roster,
      } as any)

      await apply({ type: 'character.updated', data: { character: withheld } })

      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          characters: [
            { ...roster[0], sheetWithheld: withheld.sheetWithheld },
            roster[1],
          ],
        },
      })
      expect(prismaMock.actorSheet.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', actorId: 'actor-thorin' },
      })

      prismaMock.campaign.findUnique.mockResolvedValue({
        characters: [
          { ...roster[0], sheetWithheld: withheld.sheetWithheld },
          roster[1],
        ],
      } as any)
      prismaMock.campaign.update.mockClear()
      const sheet = characterSheet()

      await apply({
        type: 'character.updated',
        data: { character: { ...roster[0], sheet } },
      })

      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { characters: roster },
      })
      expect(prismaMock.actorSheet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { data: sheet } }),
      )
    })
  })

  describe('saves the game asks for', () => {
    const prompt = {
      id: 'msg1-thorin',
      actorId: 'actor-thorin',
      messageId: 'msg1',
      type: 'save' as const,
      abilities: ['dex'],
      dc: 15,
      label: 'Burning Hands',
      openedAt: '2026-10-08T12:00:00.000Z',
      expiresAt: '2026-10-08T12:10:00.000Z',
    }
    /** What a prompt is kept as, created or updated. */
    const kept = {
      actorId: 'actor-thorin',
      data: {
        type: 'save',
        abilities: ['dex'],
        dc: 15,
        label: 'Burning Hands',
        messageId: 'msg1',
      },
      openedAt: new Date('2026-10-08T12:00:00.000Z'),
      expiresAt: new Date('2026-10-08T12:10:00.000Z'),
    }

    it('roll.prompt.opened keeps it, for its character’s player to answer', async () => {
      await apply({ type: 'roll.prompt.opened', data: { prompt } })

      expect(prismaMock.rollPrompt.upsert).toHaveBeenCalledWith({
        where: {
          campaignPrompt: { campaignId: 'c1', promptId: 'msg1-thorin' },
        },
        create: { campaignId: 'c1', promptId: 'msg1-thorin', ...kept },
        update: kept,
      })
      expect(prismaMock.campaign.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: { increment: 1 } }),
        }),
      )
    })

    it('roll.prompt.closed closes it, saying why, unless it closed already', async () => {
      prismaMock.rollPrompt.updateMany.mockResolvedValue({ count: 1 })
      await apply({
        type: 'roll.prompt.closed',
        data: { id: 'msg1-thorin', reason: 'rolled' },
      })

      expect(prismaMock.rollPrompt.updateMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', promptId: 'msg1-thorin', closedAt: null },
        data: { closedAt: expect.any(Date), closedReason: 'rolled' },
      })
    })

    it('bridge.hello keeps those it says are open, and closes any other', async () => {
      await apply({
        type: 'bridge.hello',
        data: { characters: roster, combats: [], prompts: [prompt] },
      })

      expect(prismaMock.rollPrompt.updateMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          closedAt: null,
          promptId: { notIn: ['msg1-thorin'] },
        },
        data: { closedAt: expect.any(Date), closedReason: 'gone' },
      })
      expect(prismaMock.rollPrompt.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: kept }),
      )

      // A module before 0.13.0 asks none.
      jest.clearAllMocks()
      prismaMock.$transaction.mockImplementation((run: any) => run(prismaMock))
      await apply({
        type: 'bridge.hello',
        data: { characters: roster, combats: [] },
      })
      expect(prismaMock.rollPrompt.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { campaignId: 'c1', closedAt: null, promptId: { notIn: [] } },
        }),
      )
      expect(prismaMock.rollPrompt.upsert).not.toHaveBeenCalled()
    })
  })

  describe('descriptions', () => {
    const refs = sheetTextRefs(fullerSheet())

    it('character.texts keeps them sanitised, pointing at the game, without bumping the version', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        origin: 'https://my-game.forge-vtt.com',
      } as any)
      const html =
        '<p>Regain hit points.</p><img src="https://my-game.forge-vtt.com/worlds/erebor/wind.webp" />'

      const result = await apply({
        type: 'character.texts',
        data: {
          texts: {
            [TEXTS.secondWind]:
              '<p onclick="steal()">Regain hit points.</p><img src="worlds/erebor/wind.webp"><script>steal()</script>',
          },
        },
      })

      expect(prismaMock.sheetText.upsert).toHaveBeenCalledWith({
        where: { campaignHash: { campaignId: 'c1', hash: TEXTS.secondWind } },
        create: { campaignId: 'c1', hash: TEXTS.secondWind, html },
        update: { html },
      })
      expect(prismaMock.campaign.update).toHaveBeenLastCalledWith({
        where: { id: 'c1' },
        data: {
          title: 'The Lonely Mountain',
          worldId: 'erebor',
          worldTitle: 'Return to Erebor',
          lastEventAt: expect.any(Date),
          lastSeenAt: expect.any(Date),
        },
      })
      expect(result).toEqual({ lacksTexts: false })
    })

    it('character.texts for a campaign since deleted keeps nothing', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(null)

      await apply({
        type: 'character.texts',
        data: { texts: { [TEXTS.bless]: '<p>Bless</p>' } },
      })

      expect(prismaMock.sheetText.upsert).not.toHaveBeenCalled()
    })

    it.each([
      [11, false],
      [10, true],
    ])(
      'bridge.hello drops those no sheet refers to, and with %i of 11 held, lacks some: %s',
      async (held, lacksTexts) => {
        prismaMock.sheetText.count.mockResolvedValue(held)

        const result = await apply({
          type: 'bridge.hello',
          data: {
            characters: [{ ...roster[0], sheet: fullerSheet() }, roster[1]],
            combats: [],
          },
        })

        expect(prismaMock.sheetText.deleteMany).toHaveBeenCalledWith({
          where: { campaignId: 'c1', hash: { notIn: refs } },
        })
        expect(prismaMock.sheetText.count).toHaveBeenCalledWith({
          where: { campaignId: 'c1', hash: { in: refs } },
        })
        expect(result).toEqual({ lacksTexts })
      },
    )

    it('character.updated says whether its sheet refers to one not held', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        characters: roster,
      } as any)
      prismaMock.sheetText.count.mockResolvedValue(4)

      const result = await apply({
        type: 'character.updated',
        data: { character: { ...roster[0], sheet: fullerSheet() } },
      })

      expect(result).toEqual({ lacksTexts: true })
    })

    it('a sheet that refers to none, or no sheet, lacks none', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        characters: roster,
      } as any)

      const plain = await apply({
        type: 'character.updated',
        data: { character: { ...roster[0], sheet: characterSheet() } },
      })
      const none = await apply({
        type: 'character.updated',
        data: { character: { ...roster[0], sheet: null } },
      })

      expect([plain, none]).toEqual([
        { lacksTexts: false },
        { lacksTexts: false },
      ])
      expect(prismaMock.sheetText.count).not.toHaveBeenCalled()
    })
  })

  it('character.updated replaces the character in the roster and saves its sheet', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      characters: roster,
    } as any)
    const sheet = characterSheet()
    await apply({
      type: 'character.updated',
      data: { character: { id: 'actor-thorin', name: 'Thorin II', sheet } },
    })

    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        characters: [{ id: 'actor-thorin', name: 'Thorin II' }, roster[1]],
      },
    })
    const where = {
      campaignActor: { campaignId: 'c1', actorId: 'actor-thorin' },
    }
    expect(prismaMock.actorSheet.upsert).toHaveBeenCalledWith({
      where,
      create: { campaignId: 'c1', actorId: 'actor-thorin', data: sheet },
      update: { data: sheet },
    })
  })

  it('character.updated adds a character the roster lacks, and without a sheet drops any held', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      characters: [roster[0]],
    } as any)
    await apply({
      type: 'character.updated',
      data: { character: { ...roster[1], sheet: null } },
    })

    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { characters: roster },
    })
    expect(prismaMock.actorSheet.deleteMany).toHaveBeenCalledWith({
      where: { campaignId: 'c1', actorId: 'actor-vex' },
    })
    expect(prismaMock.actorSheet.upsert).not.toHaveBeenCalled()
  })

  it('character.updated starts a roster for a campaign holding none', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(undefined as any)
    await apply({ type: 'character.updated', data: { character: roster[1] } })

    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { characters: [roster[1]] },
    })
  })

  it.each(['chat.message.created', 'chat.message.updated'] as const)(
    '%s upserts the message with who may read it',
    async type => {
      const message = chatMessage({
        audience: { public: false, characters: ['actor-thorin'] },
      })
      await apply({ type, data: { message } })

      const fields = {
        sentAt: new Date(message.timestamp),
        public: false,
        readers: ['actor-thorin'],
        data: message,
      }
      expect(prismaMock.chatMessage.upsert).toHaveBeenCalledWith({
        where: { campaignMessage: { campaignId: 'c1', messageId: 'm1' } },
        create: { campaignId: 'c1', messageId: 'm1', ...fields, byGm: false },
        update: fields,
      })
    },
  )

  describe("a message made for the Gamemaster's roll as a character (#156)", () => {
    type Roll = {
      id: string
      campaignId: string
      role: 'player' | 'gm'
      actorId: string
      status: 'claimed' | 'done' | 'failed'
      completedAt?: Date
      result?: { reason: string }
    }
    const ago = (seconds: number) => new Date(Date.now() - seconds * 1000)
    /** One of this campaign's Gamemaster's rolls as Balin. */
    const gm = (
      id: string,
      status: Roll['status'],
      completedAt?: Date,
      reason?: string,
    ): Roll => ({
      id,
      campaignId: 'c1',
      role: 'gm',
      actorId: 'actor-balin',
      status,
      completedAt,
      ...(reason && { result: { reason } }),
    })
    /** The rolls handed over, as the database holds them. */
    const rolls: Roll[] = [
      gm('req-gm', 'claimed'),
      gm('req-gm-done', 'done', ago(10)),
      // The module said it took too long, and it may yet be made.
      gm('req-gm-late', 'failed', ago(300), 'timeout'),
      gm('req-gm-old', 'done', ago(20 * 3600)),
      gm('req-gm-failed', 'failed', ago(300), 'error'),
      { ...gm('req-player', 'claimed'), role: 'player' },
      { ...gm('req-other', 'claimed'), campaignId: 'c2' },
    ]
    /** Whether a count's filter, as the listener writes it, finds a roll. */
    const finds = (roll: Roll, where: Record<string, any>): boolean =>
      Object.entries(where).every(([field, test]) => {
        if (field === 'OR') return test.some((one: any) => finds(roll, one))
        if (field === 'completedAt') {
          return !!roll.completedAt && roll.completedAt > test.gt
        }
        if (field === 'result') {
          return (roll.result as any)?.[test.path[0]] === test.equals
        }
        return (roll as Record<string, unknown>)[field] === test
      })

    beforeEach(() => {
      prismaMock.rollRequest.count.mockImplementation(
        (async ({ where }: any) =>
          rolls.filter(roll => finds(roll, where)).length) as any,
      )
    })

    afterEach(() => {
      prismaMock.rollRequest.count.mockReset()
    })

    it.each(['chat.message.created', 'chat.message.updated'] as const)(
      "%s marks it the Gamemaster's where it names one of this campaign's Gamemaster's rolls as its character, being made or just made",
      async type => {
        for (const id of ['req-gm', 'req-gm-done', 'req-gm-late']) {
          const message = said(id)
          await expect(saving(type, message)).resolves.toEqual({
            where: { campaignMessage: { campaignId: 'c1', messageId: 'm1' } },
            create: {
              campaignId: 'c1',
              messageId: 'm1',
              ...chatFields(message),
              byGm: true,
            },
            update: { ...chatFields(message), byGm: true },
          })
        }

        // Checked against the rolls handed over, never taken from the message.
        expect(prismaMock.rollRequest.count).toHaveBeenCalledWith({
          where: {
            id: 'req-gm',
            campaignId: 'c1',
            role: 'gm',
            actorId: 'actor-balin',
            OR: [
              { status: 'claimed' },
              { completedAt: { gt: expect.any(Date) } },
              {
                status: 'failed',
                result: { path: ['reason'], equals: 'timeout' },
              },
            ],
          },
        })
      },
    )

    it.each([
      ["a player's roll", said('req-player')],
      ["another campaign's Gamemaster's", said('req-other')],
      ['one never handed over', said('req-unknown')],
      // Its id copied from the Gamemaster's card, of which the player is the author.
      ['one made long ago', said('req-gm-old')],
      ['one that failed', said('req-gm-failed')],
      ["another character's", said('req-gm', 'actor-thorin')],
      ['one no character speaks', said('req-gm', null)],
    ])(
      'leaves it unmarked where the roll it names is %s, and never unmarks it',
      async (_, message) => {
        for (const type of [
          'chat.message.created',
          'chat.message.updated',
        ] as const) {
          await expect(saving(type, message)).resolves.toEqual({
            where: { campaignMessage: { campaignId: 'c1', messageId: 'm1' } },
            create: {
              campaignId: 'c1',
              messageId: 'm1',
              ...chatFields(message),
              byGm: false,
            },
            // An edit that drops or changes the claim leaves the mark as it was.
            update: chatFields(message),
          })
        }
      },
    )

    it("doesn't look up a message that claims nothing, nor unmark it", async () => {
      const stored = await saving('chat.message.updated', chatMessage())

      expect(prismaMock.rollRequest.count).not.toHaveBeenCalled()
      expect(stored?.update).not.toHaveProperty('byGm')
    })
  })

  it('chat.message.deleted removes the message', async () => {
    await apply({ type: 'chat.message.deleted', data: { id: 'm1' } })

    expect(prismaMock.chatMessage.deleteMany).toHaveBeenCalledWith({
      where: { campaignId: 'c1', messageId: 'm1' },
    })
  })

  it('chat.cleared removes every message', async () => {
    await apply({ type: 'chat.cleared', data: {} })

    expect(prismaMock.chatMessage.deleteMany).toHaveBeenCalledWith({
      where: { campaignId: 'c1' },
    })
  })

  it.each([
    'combat.created',
    'combat.started',
    'combat.turn',
    'combat.updated',
  ] as const)('%s saves the combat snapshot', async type => {
    const snapshot = combat()
    await apply({ type, data: { combat: snapshot } })

    expect(prismaMock.combat.upsert).toHaveBeenCalledWith({
      where: { campaignCombat: { campaignId: 'c1', combatId: 'cmbt1' } },
      create: { campaignId: 'c1', combatId: 'cmbt1', data: snapshot },
      update: { data: snapshot },
    })
  })

  it('combat.ended removes the combat', async () => {
    await apply({ type: 'combat.ended', data: { combat: combat() } })

    expect(prismaMock.combat.deleteMany).toHaveBeenCalledWith({
      where: { campaignId: 'c1', combatId: 'cmbt1' },
    })
  })

  describe('combatant events', () => {
    const held = combat()

    beforeEach(() => {
      prismaMock.combat.findUnique.mockResolvedValue({ data: held } as any)
    })

    it('combat.combatant.added puts the newcomer in turn order', async () => {
      const newcomer = combatant({ id: 'c-vex', name: 'Vex', initiative: 18 })
      await apply({
        type: 'combat.combatant.added',
        data: { combatId: 'cmbt1', combatant: newcomer },
      })

      expect(saved().combatants.map(({ id }: any) => id)).toEqual([
        'c-boss',
        'c-vex',
        'c-thorin',
      ])
      expect(saved().round).toBe(held.round)
    })

    it('combat.combatant.updated replaces the combatant and re-sorts', async () => {
      const thorin = { ...held.combatants[1], initiative: 20, defeated: true }
      await apply({
        type: 'combat.combatant.updated',
        data: { combatId: 'cmbt1', combatant: thorin },
      })

      expect(saved().combatants).toEqual([thorin, held.combatants[0]])
    })

    it('combat.combatant.removed takes the combatant out', async () => {
      await apply({
        type: 'combat.combatant.removed',
        data: { combatId: 'cmbt1', combatantId: 'c-boss' },
      })

      expect(saved().combatants.map(({ id }: any) => id)).toEqual(['c-thorin'])
    })

    it('leaves a combat it does not hold for the next snapshot to bring', async () => {
      prismaMock.combat.findUnique.mockResolvedValue(null)

      await apply({
        type: 'combat.combatant.removed',
        data: { combatId: 'unknown', combatantId: 'c-boss' },
      })

      expect(prismaMock.combat.upsert).not.toHaveBeenCalled()
    })
  })

  describe('sortTurnOrder', () => {
    it('sorts by initiative, those yet to roll last, then by name', () => {
      const order = sortTurnOrder([
        combatant({ id: 'a', name: 'Zed', initiative: null }),
        combatant({ id: 'b', name: 'Bree', initiative: 12 }),
        combatant({ id: 'c', name: 'Ann', initiative: 12 }),
        combatant({ id: 'd', name: 'Ann', initiative: 12 }),
        combatant({ id: 'e', name: 'Abe', initiative: null }),
        combatant({ id: 'f', name: 'Kip', initiative: 20 }),
      ])

      expect(order.map(({ id }) => id)).toEqual(['f', 'c', 'd', 'b', 'e', 'a'])
    })
  })
})
