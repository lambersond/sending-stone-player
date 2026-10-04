/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { prismaMock } from '../../jest.setup'
import { applyCampaignEvent, sortTurnOrder } from './campaign-events'
import { chatMessage, combat, combatant, roster } from '@/mocks/sending-stone'
import type { GameEvent } from '@/types/sending-stone'

const world = { id: 'erebor', title: 'Return to Erebor' }
const campaign = { id: 'camp-a', title: 'The Lonely Mountain' }

/** The combat as last saved. */
const saved = () => prismaMock.combat.upsert.mock.calls[0][0].update.data as any

const apply = (event: GameEvent) =>
  applyCampaignEvent('c1', world, campaign, event, 'session-1')

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
      data: { characters: roster },
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
        create: { campaignId: 'c1', messageId: 'm1', ...fields },
        update: fields,
      })
    },
  )

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
