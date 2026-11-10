/**
 * @jest-environment node
 */
import { createRollRequest, getRollRequestView } from './roll-requests'
import { playerSeat } from './seats'
import { NO_DICE } from '@/constants/roll-kinds'
import { heldIceKnife } from '@/mocks/dice-asks'
import { typingRosterEntry } from '@/mocks/sending-stone'
import { prismaMock } from '@/utils/test-utils-node'
import type { RollRequestInput } from '@/types/roll'

// Dice the game asks a typing player for, from module 0.45.0: their answer, taken as its own
// command and held to its ask, never to the seat's limits; and the typed roll the asks hold, which
// isn't lost meanwhile.

const NOW = Date.parse('2026-11-10T12:00:30Z')
const ago = (ms: number) => new Date(NOW - ms)

/** Thorin's player at his sheet, typing in his dice. */
const thorin = {
  ...playerSeat(
    {
      id: 'char-1',
      name: 'Thorin Oakenshield',
      gameUrl: 'https://my-game.forge-vtt.com',
      campaignTitle: 'The Lonely Mountain',
      campaignId: 'c1',
      actorId: 'actor-thorin',
    },
    'user-1',
  ),
  manualDice: true,
}

/** His answer to Ice Knife's 2d6 cold: a 3 and a 5. */
const answer: RollRequestInput = {
  kind: 'dice',
  diceAsk: 'ask1',
  answer: [{ roll: 0, term: 0, results: [3, 5] }],
  typed: true,
  ...NO_DICE,
}

/** A game asking typing players for the dice it rolls later, as it takes their answers. */
const given = ({ inFlight = 0, lastMinute = 0, ask = heldIceKnife() } = {}) => {
  prismaMock.campaign.findUnique.mockResolvedValue({
    rollsEnabled: true,
    rollKinds: ['damage', 'dice'],
    rollFeatures: ['manualDice', 'diceAsks'],
    bridgePolledAt: ago(5000),
    characters: [typingRosterEntry()],
    companions: [],
    companionKinds: [],
    companionInitiative: 'own',
  } as any)
  prismaMock.rollRequest.count.mockImplementation((({ where }: any) =>
    Promise.resolve(where.OR ? inFlight : lastMinute)) as any)
  prismaMock.diceAsk.findUnique.mockResolvedValue(ask as any)
  prismaMock.rollRequest.findMany.mockResolvedValue([])
  prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-dice' } as any)
}

/** Thorin's typed damage, fetched 90 s ago and not yet answered. */
const fetched = (typed: boolean, kind = 'damage') =>
  prismaMock.rollRequest.findFirst.mockResolvedValue({
    id: 'roll-thorin-1',
    actorId: 'actor-thorin',
    role: 'player',
    kind,
    payload: { kind, ...(typed && { typed }) },
    status: 'claimed',
    result: null,
    createdAt: ago(91_000),
    claimedAt: ago(90_000),
  } as any)

describe('db/roll-requests, dice the game asked for (module 0.45.0)', () => {
  beforeEach(() => jest.useFakeTimers({ now: NOW }))
  afterEach(() => jest.useRealTimers())

  it('takes an answer as its own command, typed, however many of the seat’s rolls are on their way', async () => {
    given({ inFlight: 3, lastMinute: 20 })

    await expect(createRollRequest(thorin, answer)).resolves.toEqual({
      id: 'req-dice',
    })
    expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: 'dice',
        actorId: 'actor-thorin',
        payload: {
          kind: 'dice',
          diceAsk: 'ask1',
          dice: [{ roll: 0, term: 0, results: [3, 5] }],
          mode: 0,
          explicit: false,
          extras: [],
          typed: true,
        },
      }),
      select: { id: true },
    })
    // Checked against its ask, and any answer to it already, from any of the player's devices.
    expect(prismaMock.diceAsk.findUnique).toHaveBeenCalledWith({
      where: { campaignAsk: { campaignId: 'c1', askId: 'ask1' } },
      select: {
        actorId: true,
        ofActorId: true,
        data: true,
        expiresAt: true,
        closedAt: true,
        closedReason: true,
      },
    })
    expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
      where: {
        campaignId: 'c1',
        actorId: 'actor-thorin',
        kind: 'dice',
        payload: { path: ['diceAsk'], equals: 'ask1' },
      },
      select: { status: true, createdAt: true, claimedAt: true },
    })
  })

  // Each row as long as the rest: jest takes a last parameter a row lacks for `done`.
  it.each([
    [
      'one closed',
      heldIceKnife({ closedAt: ago(1000) }),
      answer.answer,
      'diceAsk',
    ],
    [
      'values that don’t fit',
      heldIceKnife(),
      [{ roll: 0, term: 0, results: [3, 7] }],
      'dice',
    ],
  ])('refuses an answer to %s', async (_, ask, values, reason) => {
    given({ ask })
    await expect(
      createRollRequest(thorin, { ...answer, answer: values }),
    ).resolves.toEqual({ status: 422, reason })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses one from the Gamemaster’s seat, as a kind never theirs', async () => {
    given()
    await expect(
      createRollRequest(
        { ...thorin, role: 'gm', userId: 'gm-1', characterId: null },
        answer,
      ),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
  })

  describe('getRollRequestView', () => {
    it('tells a typed roll waiting on its dice as rolling, the time its asks held it not counted', async () => {
      fetched(true)
      prismaMock.diceAsk.findMany.mockResolvedValue([
        heldIceKnife({ askedAt: ago(20_000), expiresAt: ago(-40_000) }),
      ] as any)

      await expect(
        getRollRequestView(thorin, 'roll-thorin-1'),
      ).resolves.toEqual({
        id: 'roll-thorin-1',
        status: 'rolling',
        diceAsked: true,
      })
      expect(prismaMock.diceAsk.findMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', commandId: 'roll-thorin-1' },
        select: { askedAt: true, expiresAt: true, closedAt: true },
      })
    })

    it.each([
      ['a roll not typed, as none opens a run', false, 'damage'],
      ['an answer to an ask, whose asks are its roll’s', true, 'dice'],
    ])('reads no asks of %s', async (_, typed, kind) => {
      fetched(typed, kind)

      await expect(
        getRollRequestView(thorin, 'roll-thorin-1'),
      ).resolves.toEqual({ id: 'roll-thorin-1', status: 'lost' })
      expect(prismaMock.diceAsk.findMany).not.toHaveBeenCalled()
    })
  })
})
