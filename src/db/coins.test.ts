/**
 * @jest-environment node
 */
import { createCoinsRequest } from './coins'
import { createRollRequest } from './roll-requests'
import { playerSeat } from './seats'
import {
  fullerSheet,
  mockCompanionEntry,
  purse,
  shapedSheet,
} from '@/mocks/sending-stone'
import { prismaMock } from '@/utils/test-utils-node'
import type { SheetSeat } from '@/types/character'
import type { CoinsInput, RollRequestInput } from '@/types/roll'

const NOW = Date.parse('2026-11-17T12:00:00Z')
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
/** Thorin's player at his wolf's pane. */
const atWolf: SheetSeat = {
  ...thorin,
  actorId: 'wolfBrakka',
  name: 'Wolf',
  companion: { of: THORIN, entry: mockCompanionEntry({ of: [THORIN] }) },
}

/** 5 gp taken away, as the dialog sends it. */
const FIVE: CoinsInput = { op: 'remove', currency: { gp: 5 } }

/** Coins added or taken away, as the page sends them. */
const changing = (
  coins: CoinsInput = FIVE,
  fields: Partial<RollRequestInput> = {},
): RollRequestInput => ({
  kind: 'coins',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  coins,
  ...fields,
})

/** What Thorin holds unless said: 5 gp of it is paid only by breaking a platinum. */
const HELD: Parameters<typeof purse>[0] = { pp: 2, gp: 3 }

/** Thorin's sheet, holding 2 pp and 3 gp unless said. */
const holding = (held = HELD) => {
  const sheet = fullerSheet()
  return {
    ...sheet,
    inventory: { ...sheet.inventory, currency: purse(held) },
  }
}

/**
 * The campaign, letting its players change coins and paying with other coins unless said, with
 * Thorin and Vex; Thorin's sheet as held; and the seat's rows on their way, as given.
 */
const given = ({
  coinsEnabled = true,
  coinFeatures = ['change'],
  bridgePolledAt = ago(5000) as Date | null,
  inFlight = 0,
  sheet = holding() as object | null,
  held = [] as { kind: string; actorId: string; payload: object }[],
} = {}) => {
  prismaMock.campaign.findUnique.mockResolvedValue({
    coinsEnabled,
    coinFeatures,
    bridgePolledAt,
    characters: [
      { id: THORIN, name: 'Thorin' },
      { id: VEX, name: 'Vex' },
    ],
  } as any)
  prismaMock.actorSheet.findUnique.mockResolvedValue(
    sheet && ({ data: sheet } as any),
  )
  prismaMock.actorSheet.findMany.mockResolvedValue(
    sheet ? [{ data: sheet } as any] : [],
  )
  prismaMock.rollRequest.count.mockImplementation((({ where }: any) =>
    Promise.resolve(where.OR ? inFlight : 0)) as any)
  prismaMock.rollRequest.findMany.mockResolvedValue(held as any)
  prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-coins' } as any)
}
/** What was stored for the module to fetch. */
const created = () => prismaMock.rollRequest.create.mock.calls[0][0].data

describe('db/coins, createCoinsRequest, from module 0.49.0', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    for (const mock of [
      prismaMock.campaign.findUnique,
      prismaMock.actorSheet.findUnique,
      prismaMock.actorSheet.findMany,
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

  it('takes coins taken away, with the rolls and everything else off, for the module to make', async () => {
    given()
    await expect(createCoinsRequest(thorin, changing())).resolves.toEqual({
      id: 'req-coins',
    })
    // Its own switch, and what its module does with a coin the character is short of.
    expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      select: {
        coinsEnabled: true,
        bridgePolledAt: true,
        characters: true,
        coinFeatures: true,
      },
    })
    // Checked against the seat's changes to coins and moves on their way.
    expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
      where: {
        characterId: 'char-1',
        kind: { in: ['coins', 'transfer'] },
        OR: [
          { status: 'pending', createdAt: { gt: ago(30_000) } },
          { status: 'claimed', claimedAt: { gt: ago(75_000) } },
        ],
      },
      select: { kind: true, actorId: true, payload: true },
      take: 3,
    })
    expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
      data: {
        campaignId: 'c1',
        characterId: 'char-1',
        role: 'player',
        requestedById: 'user-1',
        actorId: THORIN,
        kind: 'coins',
        payload: changing(),
        createdAt: new Date(NOW),
      },
      select: { id: true },
    })
  })

  it('is what createRollRequest does with coins, the Gamemaster’s at its page too, kept as theirs', async () => {
    given()
    await expect(
      createRollRequest(gm, changing(FIVE, { label: 'Remove 5 gp' })),
    ).resolves.toEqual({ id: 'req-coins' })
    expect(created()).toMatchObject({
      kind: 'coins',
      role: 'gm',
      requestedById: 'gm-1',
      characterId: null,
      actorId: THORIN,
      // What their page calls it, for the character's player to be shown it by.
      label: 'Remove 5 gp',
      payload: changing(),
    })
  })

  it.each([
    [
      'the campaign lets none, as before module 0.49.0',
      { coinsEnabled: false },
    ],
    ['the module isn’t fetching', { bridgePolledAt: ago(46_000) }],
    ['the module never fetched', { bridgePolledAt: null }],
  ])(
    'refuses a change while %s, whatever the rolls and moves',
    async (_name, campaign) => {
      given(campaign)
      await expect(createRollRequest(thorin, changing())).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    },
  )

  it('refuses a companion’s, which has no coins of a character’s, and a transformed character’s', async () => {
    given()
    await expect(createRollRequest(atWolf, changing())).resolves.toEqual({
      status: 409,
      reason: 'unavailable',
    })
    given({ sheet: { ...shapedSheet(), inventory: holding().inventory } })
    await expect(createRollRequest(thorin, changing())).resolves.toEqual({
      status: 422,
      reason: 'shaped',
    })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a seat sending too many, and a character no longer in the roster', async () => {
    given({ inFlight: 3 })
    await expect(createCoinsRequest(thorin, changing())).resolves.toEqual({
      status: 429,
      reason: 'busy',
    })
    given()
    await expect(
      createCoinsRequest({ ...thorin, actorId: 'actorGone001' }, changing()),
    ).resolves.toEqual({ status: 422, reason: 'unknown' })
  })

  it('pays with other coins only where the campaign’s module says it does, as its hello said last', async () => {
    // 5 gp of 3 gp and 2 pp: a platinum pays for the rest, where the game breaks one.
    given({ coinFeatures: ['change'] })
    await expect(createCoinsRequest(thorin, changing())).resolves.toEqual({
      id: 'req-coins',
    })
    given({ coinFeatures: [] })
    await expect(createCoinsRequest(thorin, changing())).resolves.toEqual({
      status: 422,
      reason: 'short',
    })
    // Worth too little, however the game pays.
    given({ sheet: holding({ gp: 3, sp: 5 }) })
    await expect(createCoinsRequest(thorin, changing())).resolves.toEqual({
      status: 422,
      reason: 'short',
    })
  })

  it('refuses a coin the sheet doesn’t list, or a character with no sheet, as gone; and adds whatever is held', async () => {
    given()
    await expect(
      createCoinsRequest(
        thorin,
        changing({ op: 'remove', currency: { gems: 1 } }),
      ),
    ).resolves.toEqual({ status: 422, reason: 'gone' })
    given({ sheet: null })
    await expect(createCoinsRequest(thorin, changing())).resolves.toEqual({
      status: 422,
      reason: 'gone',
    })
    given({ sheet: holding({}), coinFeatures: [] })
    await expect(
      createCoinsRequest(
        thorin,
        changing({ op: 'add', currency: { gp: 10_000_000 } }),
      ),
    ).resolves.toEqual({ id: 'req-coins' })
  })

  describe('something of its coins already on its way from the seat', () => {
    /** A move of Thorin's on its way: of a gold piece to Vex, but as said. */
    const move = (transfer: object = {}) => ({
      kind: 'transfer',
      actorId: THORIN,
      payload: {
        transfer: { from: THORIN, to: VEX, currency: { gp: 1 }, ...transfer },
      },
    })

    it.each([
      [
        'another change to its coins, as from a second tap',
        { kind: 'coins', actorId: THORIN, payload: changing() },
      ],
      ['a move of its coins', move()],
      ['coins of its handed out', move({ to: undefined, each: [VEX] })],
    ])('refuses it beside %s', async (_name, row) => {
      given({ held: [row] })
      await expect(createCoinsRequest(thorin, changing())).resolves.toEqual({
        status: 409,
        reason: 'moving',
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it.each([
      ['a move of its items alone', move({ currency: undefined, items: [] })],
      [
        'a move of a party’s coins the seat made',
        move({ from: 'groupCompany' }),
      ],
    ])('takes it beside %s', async (_name, row) => {
      given({ held: [row] })
      await expect(createCoinsRequest(thorin, changing())).resolves.toEqual({
        id: 'req-coins',
      })
    })
  })
})
