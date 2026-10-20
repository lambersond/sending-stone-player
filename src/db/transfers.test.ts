/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- Prisma uses null for an absent value */
import { prismaMock } from '../../jest.setup'
import { createRollRequest } from './roll-requests'
import { playerSeat } from './seats'
import { createTransferRequest } from './transfers'
import {
  characterSheet,
  ironCompany,
  partyStash,
  sheetItem,
} from '@/mocks/sending-stone'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput, TransferInput } from '@/types/roll'

const NOW = Date.parse('2026-10-20T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)

const THORIN = 'actorThorin1'
const VEX = 'actorVex0001'
const COMPANY = 'groupIronCo01'

/** Thorin's player at his sheet. */
const thorin = playerSeat(
  {
    id: 'char-1',
    name: 'Thorin',
    gameUrl: 'https://my-game.forge-vtt.com',
    campaignTitle: 'The Lonely Mountain',
    campaignId: 'c1',
    actorId: THORIN,
  },
  'user-1',
)
/** The campaign's Gamemaster at a character's sheet. */
const gm = (actorId = THORIN): SheetSeat => ({
  ...thorin,
  actorId,
  role: 'gm',
  userId: 'gm-1',
  characterId: null,
})

/** A move of these, as its page sends it. */
const move = (transfer: TransferInput, label?: string): RollRequestInput => ({
  kind: 'transfer',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  transfer,
  ...(label && { label }),
})
const take = (quantity = 2, id = 'potionHeal01') =>
  move({ from: COMPANY, to: THORIN, items: [{ id, quantity }] })
const takeCoins = (gp = 50) =>
  move({ from: COMPANY, to: THORIN, currency: { gp } })

/** A move already held: one of the seat's, as it stands. */
type Held = {
  status: 'pending' | 'claimed' | 'done' | 'failed'
  createdAt: Date
  claimedAt?: Date | null
  transfer: TransferInput
}

/**
 * The campaign, taking moves unless said, with Thorin, Vex and The Iron Company; the party's
 * stash and Thorin's sheet as held; and the seat's moves on their way, as `held` has them, found
 * by the query's own where.
 */
const given = ({
  transfersEnabled = true,
  bridgePolledAt = ago(5000) as Date | null,
  rollFeatures = [] as string[],
  inFlight = 0,
  lastMinute = 0,
  held = [] as Held[],
  groups = [ironCompany()],
} = {}) => {
  prismaMock.campaign.findUnique.mockResolvedValue({
    transfersEnabled,
    bridgePolledAt,
    rollsEnabled: false,
    rollKinds: [],
    rollFeatures,
    characters: [
      { id: THORIN, name: 'Thorin' },
      { id: VEX, name: 'Vex' },
    ],
    groups,
  } as any)
  prismaMock.groupSheet.findUnique.mockResolvedValue({
    data: { members: [], inventory: partyStash() },
  } as any)
  prismaMock.actorSheet.findUnique.mockResolvedValue({
    data: characterSheet({
      inventory: {
        ...partyStash(),
        sections: [
          {
            id: 'consumable',
            label: 'Consumables',
            items: [
              sheetItem({
                id: 'potionThorin',
                name: 'Potion of Healing',
                quantity: 1,
              }),
            ],
          },
        ],
        containers: [],
        currency: [{ id: 'gp', label: 'Gold', abbreviation: 'gp', value: 15 }],
      },
    }),
  } as any)
  prismaMock.rollRequest.count.mockImplementation((({ where }: any) =>
    Promise.resolve(where.OR ? inFlight : lastMinute)) as any)
  prismaMock.rollRequest.findMany.mockImplementation((({ where }: any) =>
    Promise.resolve(
      held
        .filter(row =>
          where.OR.some(
            (on: any) =>
              row.status === on.status &&
              (on.createdAt
                ? row.createdAt > on.createdAt.gt
                : (row.claimedAt ?? row.createdAt) > on.claimedAt.gt),
          ),
        )
        .map(row => ({ payload: move(row.transfer) })),
    )) as any)
  prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-move' } as any)
}

/** The same end, but a party never listed for one the player can't see. */
const madeUp = (id: string) => (id === 'groupHidden1' ? 'groupNone' : id)

/** A move of the seat's waiting to be fetched, sent this long ago. */
const pending = (transfer: TransferInput, ms = 1000): Held => ({
  status: 'pending',
  createdAt: ago(ms),
  transfer,
})

describe('db/transfers, createTransferRequest', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    for (const mock of [
      prismaMock.campaign.findUnique,
      prismaMock.groupSheet.findUnique,
      prismaMock.actorSheet.findUnique,
      prismaMock.rollRequest.count,
      prismaMock.rollRequest.findMany,
      prismaMock.rollRequest.create,
      prismaMock.rollRequest.deleteMany,
    ]) {
      mock.mockReset()
    }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('takes a move for the seat’s character, keeping no label of a player’s', async () => {
    given()

    await expect(
      createTransferRequest(thorin, { ...take(), label: 'Take 2' }),
    ).resolves.toEqual({ id: 'req-move' })
    expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
      data: {
        campaignId: 'c1',
        characterId: 'char-1',
        role: 'player',
        requestedById: 'user-1',
        actorId: THORIN,
        kind: 'transfer',
        payload: take(),
        createdAt: new Date(NOW),
      },
      select: { id: true },
    })
    expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      select: {
        transfersEnabled: true,
        bridgePolledAt: true,
        characters: true,
        groups: true,
      },
    })
    // Moved from the party, as its sheet is held.
    expect(prismaMock.groupSheet.findUnique).toHaveBeenCalledWith({
      where: { campaignGroup: { campaignId: 'c1', actorId: COMPANY } },
      select: { data: true },
    })
    // The seat's older ones go, as for rolls.
    expect(prismaMock.rollRequest.deleteMany).toHaveBeenCalledWith({
      where: { characterId: 'char-1', createdAt: { lt: ago(86_400_000) } },
    })
  })

  it("keeps the Gamemaster's label, and needs no gmRolls of theirs, which the module sends only with rolls on", async () => {
    given({ rollFeatures: [] })
    const label = 'Give 5 gp to Vex'

    await expect(
      createTransferRequest(gm(), {
        ...move({ from: THORIN, to: VEX, currency: { gp: 5 } }),
        label,
      }),
    ).resolves.toEqual({ id: 'req-move' })
    expect(prismaMock.rollRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: 'gm',
          characterId: null,
          requestedById: 'gm-1',
          actorId: THORIN,
          label,
          payload: move({ from: THORIN, to: VEX, currency: { gp: 5 } }),
        }),
      }),
    )
    // Moved from Thorin, as his sheet is held.
    expect(prismaMock.actorSheet.findUnique).toHaveBeenCalledWith({
      where: { campaignActor: { campaignId: 'c1', actorId: THORIN } },
      select: { data: true },
    })
  })

  it('goes there through createRollRequest, apart from the rolls and their switch', async () => {
    given({ rollFeatures: [] })

    await expect(createRollRequest(gm(), take())).resolves.toEqual({
      id: 'req-move',
    })
    await expect(createRollRequest(thorin, take())).resolves.toEqual({
      id: 'req-move',
    })
  })

  it.each([
    ['the campaign lets none be moved', { transfersEnabled: false }],
    ['its module never fetched', { bridgePolledAt: null }],
    ['its module has fetched none lately', { bridgePolledAt: ago(45_000) }],
  ])('refuses a move while %s, for either seat', async (_name, campaign) => {
    for (const seat of [thorin, gm()]) {
      given(campaign)
      await expect(createTransferRequest(seat, take())).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })
    }
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a seat with no campaign or character', async () => {
    given()
    await expect(
      createTransferRequest({ ...thorin, campaignId: null }, take()),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    await expect(
      createTransferRequest({ ...thorin, actorId: null }, take()),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
  })

  it('counts moves with rolls, against the same limits', async () => {
    given({ inFlight: 3 })
    await expect(createTransferRequest(thorin, take())).resolves.toEqual({
      status: 429,
      reason: 'busy',
    })
    given({ lastMinute: 20 })
    await expect(createTransferRequest(thorin, take())).resolves.toEqual({
      status: 429,
      reason: 'busy',
    })
    // Counted by the seat, as its rolls are: any kind, on its way or of the last minute.
    expect(prismaMock.rollRequest.count).toHaveBeenCalledWith({
      where: {
        characterId: 'char-1',
        OR: [
          { status: 'pending', createdAt: { gt: ago(30_000) } },
          { status: 'claimed', claimedAt: { gt: ago(75_000) } },
        ],
      },
    })
    expect(prismaMock.rollRequest.count).toHaveBeenCalledWith({
      where: { characterId: 'char-1', createdAt: { gt: ago(60_000) } },
    })
  })

  it.each([
    [
      'an end not in the campaign',
      move({ from: 'groupNone', to: THORIN, currency: { gp: 1 } }),
      'unknown',
    ],
    [
      'a take into another character',
      move({ from: COMPANY, to: VEX, currency: { gp: 1 } }),
      'not-yours',
    ],
    ['an item not on the party', take(1, 'wand'), 'gone'],
    ['more than the party holds', take(4), 'short'],
    ['more coins than the party holds', takeCoins(121), 'short'],
  ])('refuses %s, as its checks say', async (_name, input, reason) => {
    given()
    await expect(createTransferRequest(thorin, input)).resolves.toEqual({
      status: 422,
      reason,
    })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it("answers a party the player can't see as one that isn't there, whatever the other end", async () => {
    // Listed in the campaign, and none of Thorin's player's to see.
    const hidden = ironCompany({
      id: 'groupHidden1',
      name: 'Hidden',
      access: {},
    })
    given({ groups: [ironCompany(), hidden] })
    for (const [from, to] of [
      ['groupHidden1', VEX],
      [VEX, 'groupHidden1'],
      [COMPANY, 'groupHidden1'],
      ['groupHidden1', THORIN],
    ]) {
      for (const ends of [
        { from, to },
        { from: madeUp(from), to: madeUp(to) },
      ]) {
        await expect(
          createTransferRequest(thorin, move({ ...ends, currency: { gp: 1 } })),
        ).resolves.toEqual({ status: 422, reason: 'unknown' })
      }
    }
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a player who only observes the party', async () => {
    given()
    const vex = { ...thorin, actorId: VEX, characterId: 'char-2' }
    await expect(
      createTransferRequest(
        vex,
        move({ from: COMPANY, to: VEX, currency: { gp: 1 } }),
      ),
    ).resolves.toEqual({ status: 422, reason: 'not-owner' })
  })

  describe('a move already on its way, from a retry or a second tap', () => {
    const potions = {
      from: COMPANY,
      to: THORIN,
      items: [{ id: 'potionHeal01', quantity: 1 }],
    }
    const coins = { from: COMPANY, to: THORIN, currency: { sp: 2 } }

    it('refuses a second move of the same item from the same end', async () => {
      given({ held: [pending(potions)] })
      await expect(createTransferRequest(thorin, take(2))).resolves.toEqual({
        status: 409,
        reason: 'moving',
      })
      // Fetched, and not answered yet.
      given({
        held: [
          {
            ...pending(potions, 40_000),
            status: 'claimed',
            claimedAt: ago(10_000),
          },
        ],
      })
      await expect(createTransferRequest(thorin, take(2))).resolves.toEqual({
        status: 409,
        reason: 'moving',
      })
      expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
        where: {
          characterId: 'char-1',
          kind: 'transfer',
          OR: [
            { status: 'pending', createdAt: { gt: ago(30_000) } },
            { status: 'claimed', claimedAt: { gt: ago(75_000) } },
          ],
        },
        select: { payload: true },
        take: 3,
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it('refuses a second move of coins from the same end, of any coin', async () => {
      given({ held: [pending(coins)] })
      await expect(createTransferRequest(thorin, takeCoins())).resolves.toEqual(
        {
          status: 409,
          reason: 'moving',
        },
      )
    })

    it('takes a move of another item, of coins after items, from another end, or after the first is made or gone', async () => {
      given({ held: [pending(potions)] })
      await expect(
        createTransferRequest(thorin, take(1, 'rope00000001')),
      ).resolves.toEqual({ id: 'req-move' })
      await expect(createTransferRequest(thorin, takeCoins())).resolves.toEqual(
        {
          id: 'req-move',
        },
      )
      given({ held: [pending({ ...potions, from: THORIN, to: COMPANY })] })
      await expect(createTransferRequest(thorin, take(2))).resolves.toEqual({
        id: 'req-move',
      })
      for (const status of ['done', 'failed'] as const) {
        given({ held: [{ ...pending(potions), status }] })
        await expect(createTransferRequest(thorin, take(2))).resolves.toEqual({
          id: 'req-move',
        })
      }
      // Never fetched in time, so never made.
      given({ held: [pending(potions, 31_000)] })
      await expect(createTransferRequest(thorin, take(2))).resolves.toEqual({
        id: 'req-move',
      })
    })
  })
})
