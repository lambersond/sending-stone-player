/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- Prisma uses null for an absent value */
import { prismaMock } from '../../jest.setup'
import { createRemoveRequest } from './removals'
import { createRollRequest } from './roll-requests'
import { playerSeat } from './seats'
import { characterSheet, removalInventory } from '@/mocks/sending-stone'
import type { SheetSeat } from '@/types/character'
import type { RemoveInput, RollRequestInput, TransferInput } from '@/types/roll'

const NOW = Date.parse('2026-10-22T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)

const THORIN = 'actorThorin1'
const VEX = 'actorVex0001'

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
/** The campaign's Gamemaster at Thorin's sheet. */
const gm: SheetSeat = {
  ...thorin,
  role: 'gm',
  userId: 'gm-1',
  characterId: null,
}

/** A removal of so many of an item, the page having shown so many, as its page sends it. */
const removal = (
  item: string,
  quantity: number,
  held = quantity,
  fields: Partial<RollRequestInput> = {},
): RollRequestInput => ({
  kind: 'remove',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  remove: { item, quantity, held },
  ...fields,
})

/** A row of the seat's on its way: a removal or a move, the player's unless said. */
type Held = {
  seat?: 'player' | 'gm'
  remove?: RemoveInput
  transfer?: TransferInput
}

/**
 * The campaign, removing items unless said, with Thorin and Vex; Thorin's sheet as held; and the
 * rows on their way, as `held` has them, found by the query's own seat.
 */
const given = ({
  removalsEnabled = true,
  bridgePolledAt = ago(5000) as Date | null,
  inFlight = 0,
  lastMinute = 0,
  held = [] as Held[],
  inventory = removalInventory(),
} = {}) => {
  prismaMock.campaign.findUnique.mockResolvedValue({
    removalsEnabled,
    bridgePolledAt,
    // Moves are off, and nothing reads them.
    transfersEnabled: false,
    characters: [
      { id: THORIN, name: 'Thorin' },
      { id: VEX, name: 'Vex' },
    ],
  } as any)
  prismaMock.actorSheet.findUnique.mockResolvedValue({
    data: characterSheet({ inventory }),
  } as any)
  prismaMock.rollRequest.count.mockImplementation((({ where }: any) =>
    Promise.resolve(where.OR ? inFlight : lastMinute)) as any)
  prismaMock.rollRequest.findMany.mockImplementation((({ where }: any) =>
    Promise.resolve(
      held
        .filter(row =>
          (row.seat ?? 'player') === 'gm'
            ? where.role === 'gm'
            : where.characterId === 'char-1',
        )
        .map(row =>
          row.remove
            ? {
                kind: 'remove',
                payload: { ...removal('', 0), remove: row.remove },
              }
            : {
                kind: 'transfer',
                payload: {
                  kind: 'transfer',
                  mode: 0,
                  explicit: false,
                  extras: [],
                  dice: [],
                  transfer: row.transfer,
                },
              },
        ),
    )) as any)
  prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-remove' } as any)
}
/** The player's removal of all of an item, on its way. */
const remove = (item: string, quantity = 1): Held => ({
  remove: { item, quantity, held: quantity },
})
/** The player's give of one of an item, on its way. */
const give = (id: string, from = THORIN): Held => ({
  transfer: { from, to: VEX, items: [{ id, quantity: 1 }] },
})
/** What was stored for the module to fetch. */
const created = () => prismaMock.rollRequest.create.mock.calls[0][0].data

describe('db/removals, createRemoveRequest', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    for (const mock of [
      prismaMock.campaign.findUnique,
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

  it('takes a removal of part of a stack, with moves off, for the module to make', async () => {
    given()
    await expect(
      createRemoveRequest(thorin, removal('potionThorin', 2, 3)),
    ).resolves.toEqual({ id: 'req-remove' })
    expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      select: { removalsEnabled: true, bridgePolledAt: true, characters: true },
    })
    expect(prismaMock.actorSheet.findUnique).toHaveBeenCalledWith({
      where: { campaignActor: { campaignId: 'c1', actorId: THORIN } },
      select: { data: true },
    })
    expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
      where: {
        characterId: 'char-1',
        kind: { in: ['transfer', 'remove'] },
        OR: [
          { status: 'pending', createdAt: { gt: ago(30_000) } },
          { status: 'claimed', claimedAt: { gt: ago(75_000) } },
        ],
      },
      select: { kind: true, payload: true },
      take: 3,
    })
    expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
      data: {
        campaignId: 'c1',
        characterId: 'char-1',
        role: 'player',
        requestedById: 'user-1',
        actorId: THORIN,
        kind: 'remove',
        payload: removal('potionThorin', 2, 3),
        createdAt: new Date(NOW),
      },
      select: { id: true },
    })
    // The seat's older rows go, as a move's do.
    expect(prismaMock.rollRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        characterId: 'char-1',
        createdAt: { lt: ago(86_400_000) },
      },
    })
  })

  it('is what createRollRequest does with a removal', async () => {
    given()
    await expect(
      createRollRequest(thorin, removal('ropeThorin01', 1)),
    ).resolves.toEqual({ id: 'req-remove' })
    expect(created()).toMatchObject({ kind: 'remove', actorId: THORIN })
  })

  it.each([
    ['none of a stack of none', removal('arrowsThorin', 0)],
    ['a container, with all it holds', removal('backpackThor', 1)],
    ['one whose contents are secret', removal('chestThorin1', 1)],
    ['an item in a container in a container', removal('gemThorin001', 1)],
    ['an unidentified item', removal('vialThorin01', 1)],
  ])('takes %s', async (_name, input) => {
    given()
    await expect(createRemoveRequest(thorin, input)).resolves.toEqual({
      id: 'req-remove',
    })
  })

  it('stores neither what the page calls it nor that it was typed in, a player’s or anyone’s', async () => {
    given()
    await createRemoveRequest(
      thorin,
      removal('ropeThorin01', 1, 1, { typed: true, label: 'Remove 1 Rope' }),
    )
    expect(created().payload).toEqual(removal('ropeThorin01', 1))
    expect(created().payload).not.toHaveProperty('typed')
    expect(created()).not.toHaveProperty('label')
  })

  it('keeps the Gamemaster’s label, for the player to be shown it by', async () => {
    given()
    await expect(
      createRemoveRequest(
        gm,
        removal('ropeThorin01', 1, 1, { typed: true, label: 'Remove 1 Rope' }),
      ),
    ).resolves.toEqual({ id: 'req-remove' })
    expect(created()).toMatchObject({
      role: 'gm',
      characterId: null,
      requestedById: 'gm-1',
      actorId: THORIN,
      kind: 'remove',
      label: 'Remove 1 Rope',
    })
    expect(created().payload).toEqual(removal('ropeThorin01', 1))
  })

  it.each([
    ['the module removes none', { removalsEnabled: false }],
    ['the module isn’t fetching', { bridgePolledAt: ago(46_000) }],
    ['the module never fetched', { bridgePolledAt: null }],
  ])('refuses a removal while %s', async (_name, campaign) => {
    given(campaign)
    await expect(
      createRemoveRequest(thorin, removal('ropeThorin01', 1)),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a removal from a seat with no campaign or character, or of a campaign gone', async () => {
    given()
    for (const seat of [
      { ...thorin, campaignId: null },
      { ...thorin, actorId: null },
    ]) {
      await expect(
        createRemoveRequest(seat, removal('ropeThorin01', 1)),
      ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    }
    await expect(
      createRemoveRequest(thorin, {
        ...removal('ropeThorin01', 1),
        remove: undefined,
      }),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    prismaMock.campaign.findUnique.mockResolvedValue(null)
    await expect(
      createRemoveRequest(thorin, removal('ropeThorin01', 1)),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a seat sending too many, of rolls and moves together', async () => {
    given({ inFlight: 3 })
    await expect(
      createRemoveRequest(thorin, removal('ropeThorin01', 1)),
    ).resolves.toEqual({ status: 429, reason: 'busy' })
    given({ lastMinute: 20 })
    await expect(
      createRemoveRequest(thorin, removal('ropeThorin01', 1)),
    ).resolves.toEqual({ status: 429, reason: 'busy' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a character no longer in the roster as unknown', async () => {
    given()
    await expect(
      createRemoveRequest(
        { ...thorin, actorId: 'actorGone001' },
        removal('ropeThorin01', 1),
      ),
    ).resolves.toEqual({ status: 422, reason: 'unknown' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it.each([
    ['an item not on the sheet', removal('wandOfMagic1', 1), 'gone'],
    ['more than the sheet holds', removal('potionThorin', 4), 'short'],
    // The page showed 2, which the sheet holds 3 of now: part of it, never all.
    [
      'a stack not as many as the page showed',
      removal('potionThorin', 2, 2),
      'changed',
    ],
    ['none of a stack of one', removal('ropeThorin01', 0, 0), 'changed'],
  ])('refuses %s, as its checks say', async (_name, input, reason) => {
    given()
    await expect(createRemoveRequest(thorin, input)).resolves.toEqual({
      status: 422,
      reason,
    })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a removal of a character without a sheet as gone', async () => {
    given()
    prismaMock.actorSheet.findUnique.mockResolvedValue(null)
    await expect(
      createRemoveRequest(thorin, removal('ropeThorin01', 1)),
    ).resolves.toEqual({ status: 422, reason: 'gone' })
  })

  describe('one already on its way from the seat, as from a retry, a second tap or a give', () => {
    it.each([
      [
        'the same item’s removal',
        [remove('potionThorin', 3)],
        'potionThorin',
        3,
      ],
      [
        'the same item’s give from the character',
        [give('ropeThorin01')],
        'ropeThorin01',
        1,
      ],
      [
        'the container’s removal, removing what it holds',
        [remove('backpackThor')],
        'gemThorin001',
        1,
      ],
      [
        'a give of something inside, removing the container',
        [give('gemThorin001')],
        'backpackThor',
        1,
      ],
      [
        'a removal of something inside, removing the container',
        [remove('bedrollThorn')],
        'backpackThor',
        1,
      ],
    ])(
      'refuses a removal beside %s as moving',
      async (_name, held, item, quantity) => {
        given({ held })
        await expect(
          createRemoveRequest(thorin, removal(item, quantity)),
        ).resolves.toEqual({ status: 409, reason: 'moving' })
        expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
      },
    )

    it('takes a removal beside another item’s, or a give to the character, or another seat’s', async () => {
      given({
        held: [
          remove('potionThorin', 3),
          remove('chestThorin1'),
          // Into Thorin, from Vex: not of Thorin's things.
          give('ropeThorin01', VEX),
          // The Gamemaster's, at Thorin's page: the module orders the two seats'.
          {
            seat: 'gm',
            remove: { item: 'ropeThorin01', quantity: 1, held: 1 },
          },
        ],
      })
      await expect(
        createRemoveRequest(thorin, removal('ropeThorin01', 1)),
      ).resolves.toEqual({ id: 'req-remove' })
    })

    it('refuses the Gamemaster’s beside their own, but not the player’s', async () => {
      given({ held: [remove('ropeThorin01')] })
      await expect(
        createRemoveRequest(gm, removal('ropeThorin01', 1)),
      ).resolves.toEqual({ id: 'req-remove' })
      given({
        held: [
          {
            seat: 'gm',
            remove: { item: 'ropeThorin01', quantity: 1, held: 1 },
          },
        ],
      })
      await expect(
        createRemoveRequest(gm, removal('ropeThorin01', 1)),
      ).resolves.toEqual({ status: 409, reason: 'moving' })
    })
  })
})
