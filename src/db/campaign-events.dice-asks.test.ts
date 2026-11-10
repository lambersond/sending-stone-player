import { applyCampaignEvent } from './campaign-events'
import { PRUNE_EVERY } from './constants'
import { iceKnifeAsk } from '@/mocks/dice-asks'
import { combat, roster } from '@/mocks/sending-stone'
import { parseGameEvent } from '@/schemas/sending-stone'
import { prismaMock } from '@/utils/test-utils-node'
import type { GameEvent } from '@/types/sending-stone'

// The dice of later rolls in typed rolls' runs, which the game asks of their players (module
// 0.45.0): kept as asked, closed as the module says, closed as gone where a hello leaves them out,
// and pruned a day after, with the saves the game asked (ROADMAP item 20).

const world = { id: 'erebor', title: 'Return to Erebor' }
const campaign = { id: 'camp-a', title: 'The Lonely Mountain' }
/** When the module sent the ask, by the game's clock: 20 s after it asked. */
const SENT = '2026-11-10T12:00:20.000Z'

const apply = (type: string, data: unknown, campaignId = 'c1') =>
  applyCampaignEvent(
    campaignId,
    world,
    campaign,
    parseGameEvent(type, data) as GameEvent,
    'session-1',
    SENT,
  )

const hello = (fields: object) =>
  apply('bridge.hello', {
    sheetsApart: true,
    characters: roster,
    combats: [combat()],
    ...fields,
  })

/** What every ask is kept as, its times aside. */
const kept = {
  actorId: 'actor-thorin',
  ofActorId: null,
  commandId: 'roll-thorin-1',
  data: {
    label: 'Ice Knife: Shard Explosion',
    purpose: 'damage',
    critical: false,
    rolls: iceKnifeAsk().rolls,
  },
}

/** This server's clock: an hour on for each test, so each may prune again. */
let now = Date.parse('2026-11-10T13:00:00.000Z')

/** What's a day old or more of the second campaign: closed or out of time then. */
const old = () => ({
  campaignId: 'c2',
  OR: [
    { closedAt: { lt: new Date(now - 86_400_000) } },
    { expiresAt: { lt: new Date(now - 86_400_000) } },
  ],
})

describe('db/campaign-events, dice asks (module 0.45.0)', () => {
  beforeEach(() => {
    now += 3_600_000
    jest.useFakeTimers({ now })
    prismaMock.$transaction.mockImplementation((run: any) => run(prismaMock))
    prismaMock.actorSheet.findMany.mockResolvedValue([])
    prismaMock.groupSheet.findMany.mockResolvedValue([])
    prismaMock.companionSheet.findMany.mockResolvedValue([])
  })
  afterEach(() => jest.useRealTimers())

  it('roll.dice.asked keeps it, waiting what was left of its minute when it was sent, and the campaign’s pages see it', async () => {
    await apply('roll.dice.asked', { ask: iceKnifeAsk() })

    // One closed as gone, as a hello that left it out closes it, is open again.
    expect(prismaMock.diceAsk.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 'c1', askId: 'ask1', closedReason: 'gone' },
      data: { closedAt: null, closedReason: null },
    })
    expect(prismaMock.diceAsk.upsert).toHaveBeenCalledWith({
      where: { campaignAsk: { campaignId: 'c1', askId: 'ask1' } },
      create: {
        campaignId: 'c1',
        askId: 'ask1',
        ...kept,
        askedAt: new Date(now - 20_000),
        expiresAt: new Date(now + 40_000),
      },
      update: kept,
    })
    expect(prismaMock.campaign.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    )
  })

  it('keeps a companion’s with its character', async () => {
    await apply('roll.dice.asked', {
      ask: iceKnifeAsk({ actorId: 'scene1-wolf', of: 'thorin1' }),
    })

    expect(prismaMock.diceAsk.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { ...kept, actorId: 'scene1-wolf', ofActorId: 'thorin1' },
      }),
    )
  })

  it('roll.dice.closed closes it, saying why, unless it closed already', async () => {
    await apply('roll.dice.closed', { id: 'ask1', reason: 'skipped' })

    expect(prismaMock.diceAsk.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 'c1', askId: 'ask1', closedAt: null },
      data: { closedAt: new Date(now), closedReason: 'skipped' },
    })
  })

  it('a hello closes as gone only the asks it doesn’t list, and keeps those it does, as when a setting changes', async () => {
    await hello({ diceAsks: [iceKnifeAsk()] })

    expect(prismaMock.diceAsk.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 'c1', closedAt: null, askId: { notIn: ['ask1'] } },
      data: { closedAt: new Date(now), closedReason: 'gone' },
    })
    expect(prismaMock.diceAsk.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: kept }),
    )
  })

  it('a hello from a module before 0.45.0, or after the Gamemaster reloads, closes every one', async () => {
    await hello({})

    expect(prismaMock.diceAsk.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 'c1', closedAt: null, askId: { notIn: [] } },
      data: { closedAt: new Date(now), closedReason: 'gone' },
    })
    expect(prismaMock.diceAsk.upsert).not.toHaveBeenCalled()
  })

  describe('pruning', () => {
    it.each([
      ['an ask', 'roll.dice.asked', { ask: iceKnifeAsk() }],
      [
        'a save',
        'roll.prompt.opened',
        {
          prompt: {
            id: 'msg1-thorin',
            actorId: 'actor-thorin',
            messageId: 'msg1',
            type: 'save',
            abilities: ['dex'],
            dc: 15,
            label: 'Burning Hands',
            openedAt: SENT,
            expiresAt: '2026-11-10T12:10:20.000Z',
          },
        },
      ],
    ])(
      'deletes the asks and saves a day old as %s is asked, at most once every while',
      async (_, type, data) => {
        await apply(type, data, 'c2')
        expect(prismaMock.diceAsk.deleteMany).toHaveBeenCalledWith({
          where: old(),
        })
        expect(prismaMock.rollPrompt.deleteMany).toHaveBeenCalledWith({
          where: old(),
        })

        prismaMock.diceAsk.deleteMany.mockClear()
        prismaMock.rollPrompt.deleteMany.mockClear()
        jest.setSystemTime(now + PRUNE_EVERY - 1)
        await apply(type, data, 'c2')
        expect(prismaMock.diceAsk.deleteMany).not.toHaveBeenCalled()
        expect(prismaMock.rollPrompt.deleteMany).not.toHaveBeenCalled()
      },
    )
  })
})
