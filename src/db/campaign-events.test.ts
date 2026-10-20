/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { prismaMock } from '../../jest.setup'
import { applyCampaignEvent, sortTurnOrder } from './campaign-events'
import { recordCommandResult } from './roll-requests'
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
import type { CommandResult, GameEvent } from '@/types/sending-stone'

const world = { id: 'erebor', title: 'Return to Erebor' }
const campaign = { id: 'camp-a', title: 'The Lonely Mountain' }

/** The combat as last saved. */
const saved = () => prismaMock.combat.upsert.mock.calls[0][0].update.data as any

/** When the module sent an event, by the game's clock: as each prompt here opened, unless said. */
const SENT = '2026-10-08T12:00:00.000Z'

const apply = (event: GameEvent, sentAt = SENT) =>
  applyCampaignEvent('c1', world, campaign, event, 'session-1', sentAt)

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

/**
 * A message naming the Gamemaster's roll `req-gm` (#156), spoken by Balin: its own, or one a player
 * forged.
 */
const post = (id: string, session = 'session-1') =>
  applyCampaignEvent(
    'c1',
    world,
    campaign,
    {
      type: 'chat.message.created',
      data: {
        message: chatMessage({
          id,
          gmRoll: 'req-gm',
          speaker: { alias: 'Balin', actorId: 'actor-balin' },
        }),
      },
    },
    session,
    SENT,
  )

/** What a hello, read as the listener reads it, stores of the campaign. */
const stored = async (features: unknown) => {
  prismaMock.campaign.update.mockClear()
  await apply(
    parseGameEvent('bridge.hello', {
      characters: roster,
      combats: [],
      features,
    }) as GameEvent,
  )
  return prismaMock.campaign.update.mock.calls[0][0].data as any
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
        groups: [],
        rollsEnabled: false,
        rollKinds: [],
        rollFeatures: [],
        transfersEnabled: false,
        transferFeatures: [],
        foundry: { receivedAt: SENT },
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
        groups: [],
        rollsEnabled: false,
        rollKinds: [],
        rollFeatures: [],
        transfersEnabled: false,
        transferFeatures: [],
        foundry: { receivedAt: SENT },
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
        groups: [],
        rollsEnabled: true,
        rollKinds: ['skill', 'save', 'attack', 'initiative'],
        // From module 0.13.0: it takes damage the player changed, and asks players for the saves
        // their game asks of them.
        rollFeatures: ['modifiers', 'prompts'],
        transfersEnabled: false,
        transferFeatures: [],
        foundry: { receivedAt: SENT },
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
        groups: [],
        rollsEnabled: false,
        rollKinds: [],
        rollFeatures: [],
        transfersEnabled: false,
        transferFeatures: [],
        foundry: { receivedAt: SENT },
      },
    })
  })

  describe('moves of items and coins, from module 0.31.0', () => {
    const rolls = { enabled: true, kinds: ['skill'], reason: null }
    const on = { enabled: true, kinds: ['transfer'], reason: null }

    it('keeps the switch from features.transfers, apart from the rolls', async () => {
      await expect(stored({ rolls, transfers: on })).resolves.toMatchObject({
        rollsEnabled: true,
        rollKinds: ['skill'],
        transfersEnabled: true,
      })
      // With rolls off, as the module sends them while the campaign's rolls are.
      await expect(
        stored({
          rolls: { enabled: false, kinds: [], reason: 'off' },
          transfers: on,
        }),
      ).resolves.toMatchObject({
        rollsEnabled: false,
        rollFeatures: [],
        transfersEnabled: true,
      })
    })

    it('is off when the module says so, or names no transfer among its kinds', async () => {
      await expect(
        stored({
          rolls,
          transfers: { enabled: false, kinds: [], reason: 'off' },
        }),
      ).resolves.toMatchObject({ transfersEnabled: false })
      await expect(
        stored({
          rolls,
          transfers: { enabled: false, kinds: [], reason: 'system' },
        }),
      ).resolves.toMatchObject({ transfersEnabled: false })
      await expect(
        stored({
          rolls,
          transfers: { enabled: true, kinds: [], reason: null },
        }),
      ).resolves.toMatchObject({ transfersEnabled: false })
      await expect(
        stored({ rolls, transfers: { ...on, enabled: 'yes' } }),
      ).resolves.toMatchObject({ transfersEnabled: false })
    })

    it('is cleared by a hello from a module before 0.31.0, which says nothing of them', async () => {
      await stored({ rolls, transfers: on })
      await expect(stored({ rolls })).resolves.toMatchObject({
        transfersEnabled: false,
      })
      await expect(stored(null)).resolves.toMatchObject({
        transfersEnabled: false,
      })
    })

    it("never takes a transfer as one of the rolls, even where the module's rolls name it", async () => {
      await expect(
        stored({
          rolls: { ...rolls, kinds: ['skill', 'transfer', 'spend'] },
          transfers: on,
        }),
      ).resolves.toMatchObject({
        rollKinds: ['skill', 'spend'],
        transfersEnabled: true,
      })
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
        groups: [],
        rollsEnabled: true,
        rollKinds: ['attack', 'hitDie', 'formula'],
        rollFeatures: ['prompts', 'areaAttacks'],
        transfersEnabled: false,
        transferFeatures: [],
        foundry: { receivedAt: SENT },
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
        groups: [],
        rollsEnabled: true,
        rollKinds: ['attack', 'hitDie', 'formula'],
        rollFeatures: ['modifiers'],
        transfersEnabled: false,
        transferFeatures: [],
        foundry: { receivedAt: SENT },
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
        groups: [],
        rollsEnabled: true,
        rollKinds: ['skill', 'tool', 'ability', 'use'],
        rollFeatures: ['modifiers', 'activityChecks'],
        transfersEnabled: false,
        transferFeatures: [],
        foundry: { receivedAt: SENT },
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
        groups: [],
        rollsEnabled: true,
        rollKinds: ['skill', 'tool', 'ability', 'use'],
        rollFeatures: [],
        transfersEnabled: false,
        transferFeatures: [],
        foundry: { receivedAt: SENT },
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
        groups: [],
        rollsEnabled: true,
        rollKinds: ['damage', 'textDamage'],
        rollFeatures: ['modifiers', 'activityChecks', 'signedDice'],
        transfersEnabled: false,
        transferFeatures: [],
        foundry: { receivedAt: SENT },
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
          groups: [],
          rollsEnabled: true,
          rollKinds: ['damage', 'textDamage'],
          rollFeatures: ['modifiers'],
          transfersEnabled: false,
          transferFeatures: [],
          foundry: { receivedAt: SENT },
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
        groups: [],
        rollsEnabled: true,
        rollKinds: ['use'],
        rollFeatures: ['signedDice', 'selfTargets'],
        transfersEnabled: false,
        transferFeatures: [],
        foundry: { receivedAt: SENT },
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

  it("bridge.hello keeps whether the game lists the messages each of the Gamemaster's rolls made, from module 0.25.0, last", async () => {
    const rolls = { enabled: true, kinds: ['skill'], reason: null }
    for (const [gmRollMessages, rollFeatures] of [
      [true, ['gmRolls', 'gmRollMessages']],
      ['yes', ['gmRolls']],
      [undefined, ['gmRolls']],
    ] as const) {
      prismaMock.campaign.update.mockClear()
      await apply(
        parseGameEvent('bridge.hello', {
          characters: roster,
          combats: [],
          features: { rolls: { ...rolls, gmRolls: true, gmRollMessages } },
        }) as GameEvent,
      )
      expect(prismaMock.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rollFeatures }),
        }),
      )
    }
  })

  it('bridge.hello keeps whether the game asks here what Midi-QOL asks, from module 0.27.0', async () => {
    const rolls = { enabled: true, kinds: ['save'], reason: null }
    for (const [midiPrompts, rollFeatures] of [
      [true, ['prompts', 'midiPrompts']],
      [1, ['prompts']],
      [undefined, ['prompts']],
    ] as const) {
      prismaMock.campaign.update.mockClear()
      await apply(
        parseGameEvent('bridge.hello', {
          characters: roster,
          combats: [],
          features: { rolls: { ...rolls, prompts: true, midiPrompts } },
        }) as GameEvent,
      )
      expect(prismaMock.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ rollFeatures }),
        }),
      )
    }
  })

  it('bridge.hello keeps whether players may enter their own dice results, from module 0.26.0, and whether each character does, in its roster', async () => {
    const rolls = { enabled: true, kinds: ['skill'], reason: null }
    for (const [manualDice, rollFeatures] of [
      [true, ['manualDice']],
      [false, []],
      ['yes', []],
      [undefined, []],
    ] as const) {
      prismaMock.campaign.update.mockClear()
      await apply(
        parseGameEvent('bridge.hello', {
          characters: [
            { ...roster[0], manualDice: false },
            { ...roster[1], manualDice: 'on' },
            { id: 'actor-balin', name: 'Balin' },
          ],
          combats: [],
          features: { rolls: { ...rolls, manualDice } },
        }) as GameEvent,
      )
      expect(prismaMock.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rollFeatures,
            // As said; false where it can't be read; left out by an older module.
            characters: [
              { ...roster[0], manualDice: false },
              { ...roster[1], manualDice: false },
              { id: 'actor-balin', name: 'Balin' },
            ],
          }),
        }),
      )
    }
  })

  it("character.updated keeps what the hello said of whether the character enters its own dice results, where it doesn't say, from module 0.26.0", async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      characters: [{ ...roster[0], manualDice: true }, roster[1]],
    } as any)

    await apply({
      type: 'character.updated',
      data: { character: { ...roster[0], sheet: null } },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { characters: [{ ...roster[0], manualDice: true }, roster[1]] },
    })

    // One that says, says.
    prismaMock.campaign.update.mockClear()
    await apply({
      type: 'character.updated',
      data: { character: { ...roster[0], sheet: null, manualDice: false } },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { characters: [{ ...roster[0], manualDice: false }, roster[1]] },
    })

    // Nothing said of a character the hello said nothing of.
    prismaMock.campaign.update.mockClear()
    await apply({
      type: 'character.updated',
      data: { character: { ...roster[1], sheet: null } },
    })
    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { characters: [{ ...roster[0], manualDice: true }, roster[1]] },
    })
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
        groups: [],
        rollsEnabled: true,
        rollKinds: ['skill', 'initiative', 'hitDie', 'hitDice', 'formula'],
        rollFeatures: [],
        transfersEnabled: false,
        transferFeatures: [],
        foundry: { receivedAt: SENT },
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
        groups: [],
        rollsEnabled: true,
        rollKinds: ['attack', 'use', 'damage', 'endEnchantment'],
        rollFeatures: [],
        transfersEnabled: false,
        transferFeatures: [],
        foundry: { receivedAt: SENT },
      },
    })
  })

  describe('sheets apart, from module 0.22.0', () => {
    beforeEach(() => {
      // It holds no group's sheet, unless a test says otherwise (module 0.30.0).
      prismaMock.groupSheet.findMany.mockResolvedValue([])
    })

    it("bridge.hello keeps the sheets held for its characters, and those sheets' descriptions, until theirs follow", async () => {
      prismaMock.actorSheet.findMany.mockResolvedValue([
        { data: fullerSheet() },
      ] as any)

      const result = await apartHello()

      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: {
          characters: roster,
          groups: [],
          rollsEnabled: false,
          rollKinds: [],
          rollFeatures: [],
          transfersEnabled: false,
          transferFeatures: [],
          foundry: { receivedAt: SENT },
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

    describe('what Midi-QOL asks (module 0.27.0)', () => {
      const NOW = Date.parse('2026-10-08T15:00:00.000Z')
      /** Midi-QOL asks Thorin for Athletics or Acrobatics to escape a web, by the game's clock. */
      const web = {
        id: 'k3y-thorin',
        actorId: 'actor-thorin',
        messageId: 'k3y',
        type: 'skill' as const,
        abilities: [],
        skills: ['ath', 'acr'],
        dc: 12,
        label: 'Web',
        openedAt: '2026-10-08T12:00:00.000Z',
        expiresAt: '2026-10-08T12:00:42.000Z',
        source: 'overtime' as const,
        advantage: { ath: 'adv' as const },
        askedInFoundry: true,
      }
      const data = {
        type: 'skill',
        abilities: [],
        skills: ['ath', 'acr'],
        dc: 12,
        label: 'Web',
        messageId: 'k3y',
        source: 'overtime',
        advantage: { ath: 'adv' },
        askedInFoundry: true,
      }

      beforeEach(() => {
        jest.useFakeTimers({ now: NOW })
      })

      afterEach(() => {
        jest.useRealTimers()
      })

      it('keeps it waiting as long from when it came, by this clock, and never moves it after', async () => {
        await apply({ type: 'roll.prompt.opened', data: { prompt: web } })

        expect(prismaMock.rollPrompt.upsert).toHaveBeenCalledWith({
          where: {
            campaignPrompt: { campaignId: 'c1', promptId: 'k3y-thorin' },
          },
          create: {
            campaignId: 'c1',
            promptId: 'k3y-thorin',
            actorId: 'actor-thorin',
            data,
            openedAt: new Date('2026-10-08T12:00:00.000Z'),
            expiresAt: new Date(NOW + 42_000),
          },
          // A later copy, as a hello's, leaves when it runs out as it was.
          update: {
            actorId: 'actor-thorin',
            data,
            openedAt: new Date('2026-10-08T12:00:00.000Z'),
          },
        })
      })

      it.each([
        ['a minute at most', '2026-10-08T12:05:00.000Z', NOW + 60_000],
        ['none, said to have run out already', '2026-10-08T11:59:00.000Z', NOW],
      ])('waits %s', async (_, expiresAt, kept) => {
        await apply({
          type: 'roll.prompt.opened',
          data: { prompt: { ...web, expiresAt } },
        })

        expect(prismaMock.rollPrompt.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({ expiresAt: new Date(kept) }),
          }),
        )
      })

      it("waits only what's left, where a hello is the first to carry it, its own post lost", async () => {
        const hold = {
          ...web,
          id: 'h0ld-thorin',
          type: 'save' as const,
          abilities: ['wis'],
          skills: undefined,
          source: 'midi' as const,
          expiresAt: '2026-10-08T12:01:00.000Z',
        }

        // Sent 40 seconds after it opened, of the minute it waits.
        await apply(
          {
            type: 'bridge.hello',
            data: { characters: roster, combats: [], prompts: [hold] },
          },
          '2026-10-08T12:00:40.000Z',
        )

        expect(prismaMock.rollPrompt.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              expiresAt: new Date(NOW + 20_000),
            }),
          }),
        )
      })

      it.each([
        ['when it was sent is unreadable', 'soon'],
        ['it was sent before it opened', '2026-10-08T11:59:30.000Z'],
      ])(
        'waits as long as it was given, from when it came, where %s',
        async (_, sentAt) => {
          await apply(
            { type: 'roll.prompt.opened', data: { prompt: web } },
            sentAt,
          )

          expect(prismaMock.rollPrompt.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
              create: expect.objectContaining({
                expiresAt: new Date(NOW + 42_000),
              }),
            }),
          )
        },
      )
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

  describe("from module 0.25.0, only the messages the Gamemaster's roll lists as its own", () => {
    /** One of the Gamemaster's rolls as Balin, being made: fetched a moment ago. */
    let roll: {
      id: string
      role: 'gm' | 'player'
      status: string
      completedAt: Date | null
      result: CommandResult | null
    }
    /** The campaign's latest hello: its session, and what it said. */
    let hello: { helloSession: string; rollFeatures: string[] }
    /** The campaign's chat, by message id: whether each is marked as the Gamemaster's. */
    let chat: Map<string, boolean>
    /** What the roll made: its card, and dnd5e 5.3's death save outcome, apart. */
    const made = ['m-roll', 'm-outcome']
    const result: CommandResult = {
      id: 'req-gm',
      status: 'done',
      reason: null,
      error: null,
      messageId: 'm-roll',
      visible: true,
      rolls: [],
      messages: made,
    }

    /** The roll's result, as the listener records it. */
    const answer = (sent: object = result) =>
      recordCommandResult(
        'c1',
        parseGameEvent('command.result', sent)?.data as CommandResult,
      )
    const pills = () => [...chat].filter(([, byGm]) => byGm).map(([id]) => id)

    beforeEach(() => {
      roll = {
        id: 'req-gm',
        role: 'gm',
        status: 'claimed',
        completedAt: null,
        result: null,
      }
      hello = {
        helloSession: 'session-1',
        rollFeatures: ['gmRolls', 'gmRollMessages'],
      }
      chat = new Map()
      prismaMock.campaign.findUnique.mockImplementation(
        (async () => hello) as any,
      )
      prismaMock.rollRequest.findFirst.mockImplementation((async ({
        where,
      }: any) =>
        where.id === roll.id &&
        where.campaignId === 'c1' &&
        (where.role === undefined || where.role === roll.role)
          ? { result: roll.result, role: roll.role, payload: { kind: 'skill' } }
          : null) as any)
      // Today's rule, from an older module: Balin's, while it's being made or just after.
      prismaMock.rollRequest.count.mockImplementation((async ({
        where,
      }: any) =>
        where.id === roll.id &&
        where.role === roll.role &&
        where.actorId === 'actor-balin' &&
        (roll.status === 'claimed' ||
          (!!roll.completedAt && roll.completedAt > where.OR[1].completedAt.gt))
          ? 1
          : 0) as any)
      prismaMock.rollRequest.updateMany.mockImplementation((async ({
        where,
        data,
      }: any) => {
        if (where.id !== roll.id || roll.status !== 'claimed')
          return { count: 0 }
        roll.status = data.status
        roll.completedAt = data.completedAt
        roll.result = data.result
        return { count: 1 }
      }) as any)
      prismaMock.chatMessage.upsert.mockImplementation((async ({
        where,
        create,
        update,
      }: any) => {
        const id = where.campaignMessage.messageId
        chat.set(
          id,
          chat.has(id) ? chat.get(id) || update.byGm === true : create.byGm,
        )
      }) as any)
      prismaMock.chatMessage.updateMany.mockImplementation((async ({
        where,
      }: any) => {
        let count = 0
        for (const id of where.messageId.in) {
          if (chat.get(id) === false) {
            chat.set(id, true)
            count += 1
          }
        }
        return { count }
      }) as any)
    })

    afterEach(() => {
      for (const mock of [
        prismaMock.campaign.findUnique,
        prismaMock.rollRequest.findFirst,
        prismaMock.rollRequest.count,
        prismaMock.rollRequest.updateMany,
        prismaMock.chatMessage.upsert,
        prismaMock.chatMessage.updateMany,
      ]) {
        mock.mockReset()
      }
    })

    it("gives a forged message carrying a real roll's id, within 75 seconds, no pill", async () => {
      // A player's own message, its claim copied from the Gamemaster's card, as the roll is made.
      await post('m-forged')
      await post('m-roll')
      await answer()
      // And again just after, when an older module's rule would have taken it.
      await post('m-forged-after')

      expect(pills()).toEqual(['m-roll'])
      expect(prismaMock.rollRequest.count).not.toHaveBeenCalled()
    })

    it('marks the messages it lists whichever comes first, the message or the result', async () => {
      // dnd5e posts the card before the result; the outcome comes after, as a retried post would.
      await post('m-roll')
      expect(pills()).toEqual([])

      await answer()
      expect(pills()).toEqual(['m-roll'])
      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { version: { increment: 1 } },
      })

      await post('m-outcome')
      expect(pills()).toEqual(['m-roll', 'm-outcome'])
    })

    it("marks none of a player's roll's, whatever its result lists", async () => {
      roll.role = 'player'

      await post('m-roll')
      await answer()
      await post('m-outcome')

      expect(pills()).toEqual([])
    })

    it('keeps the rule before it for an older module, whose hello says nothing of it', async () => {
      hello.rollFeatures = ['gmRolls']
      const older = { ...result }
      delete older.messages

      // Balin's, while it's made and just after: the forged one too, as before.
      await post('m-forged')
      await post('m-roll')
      await answer(older)
      await post('m-outcome')

      expect(pills()).toEqual(['m-forged', 'm-roll', 'm-outcome'])
      expect(prismaMock.rollRequest.count).toHaveBeenCalledTimes(3)
    })

    it("keeps the rule before it for a session whose hello hasn't come, until the result lists them", async () => {
      await post('m-roll', 'session-2')

      expect(pills()).toEqual(['m-roll'])
      expect(prismaMock.rollRequest.count).toHaveBeenCalledTimes(1)
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

describe('db/campaign-events, what else the module does with moves, from module 0.32.0', () => {
  const rolls = { enabled: true, kinds: ['skill'], reason: null }
  const on = { enabled: true, kinds: ['transfer'], reason: null }

  beforeEach(() => {
    prismaMock.$transaction.mockImplementation((run: any) => run(prismaMock))
  })

  it('keeps a party’s sends and distributions from the hello, in their order', async () => {
    await expect(
      stored({
        rolls,
        transfers: { ...on, partySends: true, distribute: true },
      }),
    ).resolves.toMatchObject({
      transfersEnabled: true,
      transferFeatures: ['partySends', 'distribute'],
    })
  })

  it.each([
    ['sends alone', { partySends: true }, ['partySends']],
    ['distributions alone', { distribute: true }, ['distribute']],
    ['neither', { partySends: false, distribute: false }, []],
  ])('keeps %s', async (_name, features, kept) => {
    await expect(
      stored({ rolls, transfers: { ...on, ...features } }),
    ).resolves.toMatchObject({ transferFeatures: kept })
  })

  it('keeps none while moves are off, whatever the hello says of them', async () => {
    await expect(
      stored({
        rolls,
        transfers: {
          enabled: false,
          kinds: [],
          reason: 'off',
          partySends: true,
          distribute: true,
        },
      }),
    ).resolves.toMatchObject({ transfersEnabled: false, transferFeatures: [] })
  })

  it('is cleared by a hello from module 0.31.0, which says nothing of them', async () => {
    await stored({
      rolls,
      transfers: { ...on, partySends: true, distribute: true },
    })
    await expect(stored({ rolls, transfers: on })).resolves.toMatchObject({
      transfersEnabled: true,
      transferFeatures: [],
    })
    await expect(stored(null)).resolves.toMatchObject({ transferFeatures: [] })
  })

  it('reads anything but true as false', async () => {
    await expect(
      stored({
        rolls,
        transfers: { ...on, partySends: 'yes', distribute: 1 },
      }),
    ).resolves.toMatchObject({ transfersEnabled: true, transferFeatures: [] })
  })
})
