/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- Prisma and the protocol use null for an absent value */
import { Prisma, type CookbookDish } from '@prisma/client'
import { prismaMock } from '../../jest.setup'
import {
  acceptDish,
  claimDishes,
  deleteCookbookLink,
  findCookbookLink,
  getCookbookView,
  makeCookbookLink,
  recordDishDecision,
  recordDishResult,
  revokeCampaignCookbookLink,
  revokeCookbookLink,
  type CookbookLinkFound,
  type DishDecision,
} from './cookbook'
import {
  DISH_ATTEMPTS,
  DISH_CLAIM_LIMIT,
  DISHES_KEPT_FOR,
  DISHES_PER_DAY,
  DISHES_PER_MINUTE,
  DISHES_PRUNE_EVERY,
  DISHES_SHOWN,
  MOST_DISHES_WAITING,
} from '@/constants/cookbook'
import { BRIDGE_TIMEOUT, ROLL_ANSWER_WITHIN } from '@/constants/sending-stone'
import { hashCookbookCode } from '@/lib/cookbook-code'
import { fireberryBoon } from '@/mocks/cookbook'
import { dishResult } from '@/mocks/sending-stone'
import type { DishApplied, DishDismissed } from '@/types/sending-stone'

const NOW = Date.parse('2026-10-25T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

const link: CookbookLinkFound = {
  id: 'link-1',
  campaignId: 'c1',
  actorId: 'actor-thorin',
  characterId: 'char-1',
  character: { campaignId: 'c1', actorId: 'actor-thorin' },
  campaign: { dishesEnabled: true, dishVersions: [1] },
}

/** A dish as stored, for the claim and the view. */
function dish(fields: Partial<CookbookDish> = {}): CookbookDish {
  return {
    id: 'row-1',
    campaignId: 'c1',
    characterId: 'char-1',
    linkId: 'link-1',
    actorId: 'actor-thorin',
    dishId: fireberryBoon.dish.id,
    version: 1,
    recipe: 'Fireberry Glazed Skewers',
    outcome: 'boon',
    payload: fireberryBoon as unknown as Prisma.JsonValue,
    status: 'queued',
    reason: null,
    error: null,
    attempts: 0,
    claimToken: null,
    claimSession: null,
    claimedAt: null,
    messageId: null,
    appliedTo: null,
    rolled: null,
    decidedAt: null,
    queuedAt: ago(10 * MINUTE),
    createdAt: ago(10 * MINUTE),
    updatedAt: ago(10 * MINUTE),
    ...fields,
  }
}

const taken = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })

/** The link's dishes in the last minute and day, and the campaign's waiting. */
function counts(minute = 0, day = minute, waiting = 0) {
  prismaMock.cookbookDish.count.mockImplementation((({ where }: any) => {
    if (where.status) return Promise.resolve(waiting)
    const since = NOW - where.createdAt.gte.getTime()
    return Promise.resolve(since === MINUTE ? minute : day)
  }) as any)
}

/** The campaign as the claim reads it: its hello's session holds, and it takes version 1. */
const campaign = (fields = {}) =>
  prismaMock.campaign.findUnique.mockResolvedValue({
    helloSession: 'sess-1',
    dishesEnabled: true,
    dishVersions: [1],
    ...fields,
  } as any)

/** What's due: waiting, or handed over and unanswered too long, of a version the hello reads. */
const due = (versions = [1]) => ({
  campaignId: 'c1',
  version: { in: versions },
  OR: [
    { status: 'queued' },
    { status: 'claimed', claimedAt: { lt: ago(ROLL_ANSWER_WITHIN) } },
  ],
})

/** The prunes of one campaign's dishes. */
const prunes = (campaignId: string) =>
  prismaMock.cookbookDish.deleteMany.mock.calls.filter(
    ([args]) => args?.where?.campaignId === campaignId,
  )

/** Row 1 of campaign c1, in this status. */
const where = (status: unknown) => ({ id: 'row-1', campaignId: 'c1', status })

beforeEach(() => {
  jest.useFakeTimers({ now: NOW })
  prismaMock.cookbookDish.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.cookbookDish.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.cookbookLink.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.cookbookLink.deleteMany.mockResolvedValue({ count: 1 })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('links', () => {
  it('finds a link by its code’s hash alone, with its seat and campaign now', async () => {
    prismaMock.cookbookLink.findUnique.mockResolvedValue(link as any)

    await expect(findCookbookLink('hash')).resolves.toBe(link)

    expect(prismaMock.cookbookLink.findUnique).toHaveBeenCalledWith({
      where: { codeHash: 'hash' },
      select: {
        id: true,
        campaignId: true,
        actorId: true,
        characterId: true,
        character: { select: { campaignId: true, actorId: true } },
        campaign: { select: { dishesEnabled: true, dishVersions: true } },
      },
    })
  })

  it('deletes a stale link by its id, gone already or not', async () => {
    prismaMock.cookbookLink.deleteMany.mockResolvedValue({ count: 0 })

    await deleteCookbookLink('link-1')

    expect(prismaMock.cookbookLink.deleteMany).toHaveBeenCalledWith({
      where: { id: 'link-1' },
    })
  })

  it('makes a code for the player’s own playing character, keeping only its hash', async () => {
    prismaMock.character.findFirst.mockResolvedValue({
      campaignId: 'c1',
      actorId: 'actor-thorin',
    } as any)

    const made = await makeCookbookLink('user-1', 'char-1')

    if (typeof made === 'string') throw new Error(made)
    expect(made.code).toMatch(/^sscb_[\w-]{43}$/)
    expect(prismaMock.character.findFirst).toHaveBeenCalledWith({
      where: { id: 'char-1', userId: 'user-1' },
      select: { campaignId: true, actorId: true },
    })
    const kept = {
      codeHash: hashCookbookCode(made.code),
      hint: made.code.slice(-4),
      campaignId: 'c1',
      actorId: 'actor-thorin',
      createdAt: new Date(NOW),
      lastUsedAt: null,
    }
    // By its character, so a new code replaces the old in the same row, which keeps its id, and
    // clears when it was last used.
    expect(prismaMock.cookbookLink.upsert).toHaveBeenCalledWith({
      where: { characterId: 'char-1' },
      create: { characterId: 'char-1', ...kept },
      update: kept,
    })
    expect(
      JSON.stringify(prismaMock.cookbookLink.upsert.mock.calls),
    ).not.toContain(made.code)
  })

  it('makes a new code each time', async () => {
    prismaMock.character.findFirst.mockResolvedValue({
      campaignId: 'c1',
      actorId: 'actor-thorin',
    } as any)

    const first = await makeCookbookLink('user-1', 'char-1')
    const second = await makeCookbookLink('user-1', 'char-1')

    expect(first).not.toEqual(second)
    const hashes = prismaMock.cookbookLink.upsert.mock.calls.map(
      ([args]) => (args.update as { codeHash: string }).codeHash,
    )
    expect(new Set(hashes).size).toBe(2)
  })

  it.each([
    ['missing', null],
    ['missing', { campaignId: null, actorId: 'actor-thorin' }],
    ['not-playing', { campaignId: 'c1', actorId: null }],
  ] as const)('makes none, %s, for %j', async (problem, character) => {
    prismaMock.character.findFirst.mockResolvedValue(character as any)

    await expect(makeCookbookLink('user-1', 'char-1')).resolves.toBe(problem)
    expect(prismaMock.cookbookLink.upsert).not.toHaveBeenCalled()
  })

  it('revokes the player’s own link alone', async () => {
    await expect(revokeCookbookLink('user-1', 'char-1')).resolves.toBe(true)

    expect(prismaMock.cookbookLink.deleteMany).toHaveBeenCalledWith({
      where: { characterId: 'char-1', character: { userId: 'user-1' } },
    })
  })

  it('revokes a link to the Gamemaster’s own campaign alone', async () => {
    prismaMock.cookbookLink.deleteMany.mockResolvedValue({ count: 0 })

    await expect(
      revokeCampaignCookbookLink('gm-1', 'c1', 'char-1'),
    ).resolves.toBe(false)

    expect(prismaMock.cookbookLink.deleteMany).toHaveBeenCalledWith({
      where: {
        characterId: 'char-1',
        campaignId: 'c1',
        campaign: { ownerId: 'gm-1' },
      },
    })
  })
})

describe('acceptDish', () => {
  beforeEach(() => {
    prismaMock.cookbookDish.findUnique.mockResolvedValue(null)
    prismaMock.cookbookDish.create.mockResolvedValue({
      id: 'row-1',
      status: 'queued',
    } as any)
  })

  it('takes a new dish for the link’s seat, then notes the link used and prunes', async () => {
    counts()

    await expect(acceptDish(link, fireberryBoon)).resolves.toEqual({
      kind: 'new',
      id: 'row-1',
      status: 'queued',
    })

    expect(prismaMock.cookbookDish.create).toHaveBeenCalledWith({
      data: {
        campaignId: 'c1',
        characterId: 'char-1',
        linkId: 'link-1',
        actorId: 'actor-thorin',
        dishId: fireberryBoon.dish.id,
        version: 1,
        recipe: 'Fireberry Glazed Skewers',
        outcome: 'boon',
        payload: fireberryBoon,
        queuedAt: new Date(NOW),
        createdAt: new Date(NOW),
      },
      select: { id: true, status: true },
    })
    expect(prismaMock.cookbookLink.updateMany).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { lastUsedAt: new Date(NOW) },
    })
    expect(prismaMock.cookbookDish.deleteMany).toHaveBeenCalledWith({
      where: { campaignId: 'c1', updatedAt: { lt: ago(DISHES_KEPT_FOR) } },
    })
  })

  it('answers a dish the campaign holds as it stands, before any gate', async () => {
    prismaMock.cookbookDish.findUnique.mockResolvedValue({
      id: 'row-1',
      status: 'delivered',
    } as any)
    const off = {
      ...link,
      campaign: { dishesEnabled: false, dishVersions: [] },
    }

    await expect(acceptDish(off, fireberryBoon)).resolves.toEqual({
      kind: 'repeat',
      id: 'row-1',
      status: 'delivered',
    })

    expect(prismaMock.cookbookDish.findUnique).toHaveBeenCalledWith({
      where: {
        campaignDish: { campaignId: 'c1', dishId: fireberryBoon.dish.id },
      },
      select: { id: true, status: true },
    })
    expect(prismaMock.cookbookDish.count).not.toHaveBeenCalled()
    expect(prismaMock.cookbookDish.create).not.toHaveBeenCalled()
    expect(prismaMock.cookbookLink.updateMany).not.toHaveBeenCalled()
  })

  it('refuses while the campaign takes no dishes, or not this version', async () => {
    const off = {
      ...link,
      campaign: { dishesEnabled: false, dishVersions: [] },
    }
    await expect(acceptDish(off, fireberryBoon)).resolves.toEqual({
      kind: 'off',
    })

    const older = {
      ...link,
      campaign: { dishesEnabled: true, dishVersions: [2] },
    }
    await expect(acceptDish(older, fireberryBoon)).resolves.toEqual({
      kind: 'update',
    })
    expect(prismaMock.cookbookDish.create).not.toHaveBeenCalled()
  })

  it('takes at most a few a minute through one link', async () => {
    counts(DISHES_PER_MINUTE)

    await expect(acceptDish(link, fireberryBoon)).resolves.toEqual({
      kind: 'busy',
    })

    expect(prismaMock.cookbookDish.count).toHaveBeenCalledWith({
      where: { linkId: 'link-1', createdAt: { gte: ago(MINUTE) } },
    })
    expect(prismaMock.cookbookDish.create).not.toHaveBeenCalled()
  })

  it('takes at most 50 a day through one link: the 51st is refused, the 50th taken', async () => {
    expect(DISHES_PER_DAY).toBe(50)
    counts(0, DISHES_PER_DAY)

    await expect(acceptDish(link, fireberryBoon)).resolves.toEqual({
      kind: 'daily',
    })
    expect(prismaMock.cookbookDish.count).toHaveBeenNthCalledWith(2, {
      where: { linkId: 'link-1', createdAt: { gte: ago(DAY) } },
    })
    expect(prismaMock.cookbookDish.create).not.toHaveBeenCalled()

    counts(0, DISHES_PER_DAY - 1)
    await expect(acceptDish(link, fireberryBoon)).resolves.toMatchObject({
      kind: 'new',
    })
  })

  it('takes a repeat of a dish whatever the link’s day holds', async () => {
    prismaMock.cookbookDish.findUnique.mockResolvedValue({
      id: 'row-1',
      status: 'queued',
    } as any)
    counts(DISHES_PER_MINUTE, DISHES_PER_DAY, MOST_DISHES_WAITING)

    await expect(acceptDish(link, fireberryBoon)).resolves.toMatchObject({
      kind: 'repeat',
    })
  })

  it('takes at most 50 waiting for the campaign’s Foundry, queued or handed over', async () => {
    counts(0, 0, MOST_DISHES_WAITING)

    await expect(acceptDish(link, fireberryBoon)).resolves.toEqual({
      kind: 'full',
    })

    expect(prismaMock.cookbookDish.count).toHaveBeenNthCalledWith(3, {
      where: { campaignId: 'c1', status: { in: ['queued', 'claimed'] } },
    })
    expect(prismaMock.cookbookDish.create).not.toHaveBeenCalled()
  })

  it('answers the loser of two first posts as a repeat of the winner', async () => {
    counts()
    prismaMock.cookbookDish.create.mockRejectedValue(taken())
    prismaMock.cookbookDish.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'row-9', status: 'queued' } as any)

    await expect(acceptDish(link, fireberryBoon)).resolves.toEqual({
      kind: 'repeat',
      id: 'row-9',
      status: 'queued',
    })
    expect(prismaMock.cookbookLink.updateMany).not.toHaveBeenCalled()
  })

  it('throws any other failure, for a 500 the cookbook sends again', async () => {
    counts()
    prismaMock.cookbookDish.create.mockRejectedValue(new Error('down'))

    await expect(acceptDish(link, fireberryBoon)).rejects.toThrow('down')
  })
})

describe('claimDishes', () => {
  beforeEach(() => {
    campaign()
    prismaMock.cookbookDish.findMany.mockResolvedValue([])
  })

  it('hands dishes to the session whose hello is held, as dish commands, oldest first', async () => {
    prismaMock.cookbookDish.findMany
      .mockResolvedValueOnce([
        { id: 'row-1', attempts: 0 },
        { id: 'row-2', attempts: 3 },
      ] as any)
      .mockResolvedValueOnce([
        dish({ id: 'row-1' }),
        dish({ id: 'row-2', actorId: 'actor-vex', queuedAt: ago(MINUTE) }),
      ] as any)

    const commands = await claimDishes('c1', 'sess-1')

    expect(prismaMock.cookbookDish.findMany).toHaveBeenNthCalledWith(1, {
      where: due(),
      orderBy: { queuedAt: 'asc' },
      take: DISH_CLAIM_LIMIT,
      select: { id: true, attempts: true },
    })
    expect(DISH_CLAIM_LIMIT).toBe(5)
    const [{ data, where }] = prismaMock.cookbookDish.updateMany.mock.calls[0]
    expect(where).toEqual({ id: { in: ['row-1', 'row-2'] }, AND: [due()] })
    expect(data).toEqual({
      status: 'claimed',
      claimToken: expect.any(String),
      claimSession: 'sess-1',
      claimedAt: new Date(NOW),
      attempts: { increment: 1 },
    })
    expect(prismaMock.cookbookDish.findMany).toHaveBeenNthCalledWith(2, {
      where: { claimToken: (data as { claimToken: string }).claimToken },
      orderBy: { queuedAt: 'asc' },
      select: { id: true, actorId: true, queuedAt: true, payload: true },
    })
    expect(commands).toEqual([
      {
        id: 'dish-row-1',
        actorId: 'actor-thorin',
        kind: 'dish',
        dish: { queuedAt: NOW - 10 * MINUTE, body: fireberryBoon },
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      },
      expect.objectContaining({ id: 'dish-row-2', actorId: 'actor-vex' }),
    ])
  })

  it.each([
    ['another session', { helloSession: 'sess-old' }],
    ['dishes off', { dishesEnabled: false }],
  ])('hands nothing to %s', async (_name, fields) => {
    campaign(fields)

    await expect(claimDishes('c1', 'sess-1')).resolves.toEqual([])
    expect(prismaMock.cookbookDish.findMany).not.toHaveBeenCalled()
  })

  it('hands nothing for a campaign gone', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(null)

    await expect(claimDishes('c1', 'sess-1')).resolves.toEqual([])
  })

  it('hands only dishes of the versions the hello reads', async () => {
    campaign({ dishVersions: [2] })

    await claimDishes('c1', 'sess-1')

    expect(prismaMock.cookbookDish.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: due([2]) }),
    )
  })

  it('fails a dish handed over too many times, for good, and hands the rest', async () => {
    expect(DISH_ATTEMPTS).toBe(5)
    prismaMock.cookbookDish.findMany
      .mockResolvedValueOnce([
        { id: 'row-1', attempts: DISH_ATTEMPTS },
        { id: 'row-2', attempts: DISH_ATTEMPTS - 1 },
      ] as any)
      .mockResolvedValueOnce([dish({ id: 'row-2' })] as any)

    const commands = await claimDishes('c1', 'sess-1')

    expect(prismaMock.cookbookDish.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: ['row-1'] }, AND: [due()] },
      data: { status: 'failed', reason: 'undeliverable' },
    })
    expect(prismaMock.cookbookDish.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ['row-2'] }, AND: [due()] },
      data: expect.objectContaining({ status: 'claimed' }),
    })
    expect(commands.map(({ id }) => id)).toEqual(['dish-row-2'])
  })

  it('hands nothing where every dish due has failed for good', async () => {
    prismaMock.cookbookDish.findMany.mockResolvedValueOnce([
      { id: 'row-1', attempts: DISH_ATTEMPTS },
    ] as any)

    await expect(claimDishes('c1', 'sess-1')).resolves.toEqual([])
    expect(prismaMock.cookbookDish.updateMany).toHaveBeenCalledTimes(1)
  })

  it('makes no write on a pass with nothing due, once pruned', async () => {
    await claimDishes('c-idle', 'sess-1')
    jest.clearAllMocks()
    campaign()
    prismaMock.cookbookDish.findMany.mockResolvedValue([])

    await expect(claimDishes('c-idle', 'sess-1')).resolves.toEqual([])

    expect(prismaMock.campaign.findUnique).toHaveBeenCalledTimes(1)
    expect(prismaMock.cookbookDish.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.cookbookDish.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.cookbookDish.deleteMany).not.toHaveBeenCalled()
  })

  it('prunes a campaign’s old dishes at most once in a while, per server', async () => {
    await claimDishes('c-prune', 'sess-1')
    expect(prunes('c-prune')).toEqual([
      [
        {
          where: {
            campaignId: 'c-prune',
            updatedAt: { lt: ago(DISHES_KEPT_FOR) },
          },
        },
      ],
    ])

    jest.setSystemTime(NOW + DISHES_PRUNE_EVERY - 1)
    await claimDishes('c-prune', 'sess-1')
    expect(prunes('c-prune')).toHaveLength(1)

    jest.setSystemTime(NOW + DISHES_PRUNE_EVERY)
    await claimDishes('c-prune', 'sess-1')
    expect(prunes('c-prune')).toHaveLength(2)
  })
})

describe('recordDishResult', () => {
  const unclaimed = { claimToken: null, claimSession: null, claimedAt: null }
  const row1 = { id: 'dish-row-1' }

  it('marks a dish whose card is in Foundry delivered, lifting a failure too', async () => {
    await recordDishResult('c1', dishResult(row1))

    expect(prismaMock.cookbookDish.updateMany).toHaveBeenCalledWith({
      where: where({ in: ['queued', 'claimed', 'failed'] }),
      data: {
        status: 'delivered',
        messageId: 'Xy12ChatCardId00',
        reason: null,
        error: null,
        ...unclaimed,
      },
    })
  })

  it.each(['applied', 'dismissed'] as const)(
    'marks a dish whose card was decided already %s',
    async state => {
      await recordDishResult(
        'c1',
        dishResult({ ...row1, dish: { card: 'Card2', state } }),
      )

      expect(prismaMock.cookbookDish.updateMany).toHaveBeenCalledWith({
        where: where({ in: ['queued', 'claimed', 'failed'] }),
        data: expect.objectContaining({ status: state, messageId: 'Card2' }),
      })
    },
  )

  it('takes the card from the result’s message where the dish says none', async () => {
    await recordDishResult(
      'c1',
      dishResult({ ...row1, dish: undefined, messageId: 'Card3' }),
    )

    expect(prismaMock.cookbookDish.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'delivered',
          messageId: 'Card3',
        }),
      }),
    )
  })

  const failed = (reason: string, error: string | null = null) =>
    dishResult({
      ...row1,
      status: 'failed',
      reason,
      error,
      messageId: null,
      dish: undefined,
    })

  it('changes nothing on a timeout: the dish is handed over again once overdue', async () => {
    await recordDishResult('c1', failed('timeout'))

    expect(prismaMock.cookbookDish.updateMany).not.toHaveBeenCalled()
  })

  it('gives an attempt back, keeping the claim, where the module didn’t try it', async () => {
    await recordDishResult('c1', failed('off'))

    expect(prismaMock.cookbookDish.updateMany).toHaveBeenCalledWith({
      where: where('claimed'),
      data: { attempts: { decrement: 1 } },
    })
  })

  it('queues a dish again whose runner threw, the attempt counting', async () => {
    await recordDishResult('c1', failed('error', 'boom'))

    expect(prismaMock.cookbookDish.updateMany).toHaveBeenCalledWith({
      where: where('claimed'),
      data: { status: 'queued', ...unclaimed },
    })
  })

  it.each(['invalid', 'kind', 'refused'])(
    'fails a dish the module refused (%s), only while handed over',
    async reason => {
      await recordDishResult('c1', failed(reason, 'body.effect'))

      expect(prismaMock.cookbookDish.updateMany).toHaveBeenCalledWith({
        where: where('claimed'),
        data: { status: 'failed', reason, error: 'body.effect' },
      })
    },
  )
})

describe('recordDishDecision', () => {
  const at = { time: '2026-10-24T20:15:00.000Z', worldTime: 1_234_567 }
  const by = { userId: 'GmUser0000000001', name: 'Gamemaster' }
  const thorin = {
    actorId: 'actor-thorin',
    name: 'Thorin Oakenshield',
    effectId: 'Ae0000dish000001',
    replaced: null,
    healed: 7,
    exhaustion: 0,
    skipped: [],
  }
  const applied = (fields: Partial<DishApplied> = {}): DishDecision => ({
    type: 'dish.applied',
    data: {
      dish: 'row-1',
      id: fireberryBoon.dish.id,
      card: 'Xy12ChatCardId00',
      outcome: 'boon',
      characters: [thorin, { ...thorin, actorId: 'actor-vex', name: 'Vex' }],
      rolled: [{ type: 'maxHitPoints', value: 7, formula: '3+1d6' }],
      by,
      at,
      ...fields,
    },
  })
  const dismissed = (fields: Partial<DishDismissed> = {}): DishDecision => ({
    type: 'dish.dismissed',
    data: {
      dish: 'row-1',
      id: fireberryBoon.dish.id,
      card: 'Xy12ChatCardId00',
      reason: 'deleted',
      by,
      at,
      ...fields,
    },
  })

  it('records everyone served, overwriting, whatever the dish’s state', async () => {
    const event = applied()
    await recordDishDecision('c1', event)

    expect(prismaMock.cookbookDish.updateMany).toHaveBeenCalledWith({
      where: { id: 'row-1', campaignId: 'c1' },
      data: {
        status: 'applied',
        appliedTo: (event.data as DishApplied).characters,
        rolled: (event.data as DishApplied).rolled,
        decidedAt: new Date(at.time),
        messageId: 'Xy12ChatCardId00',
      },
    })
  })

  it('takes now for a decision whose time can’t be read, and keeps the card without one', async () => {
    await recordDishDecision('c1', applied({ at: null, card: null }))

    const [{ data }] = prismaMock.cookbookDish.updateMany.mock.calls[0]
    expect(data).toMatchObject({ decidedAt: new Date(NOW) })
    expect(data).not.toHaveProperty('messageId')

    await recordDishDecision(
      'c1',
      applied({ at: { time: 'not a time', worldTime: 0 } }),
    )
    expect(
      prismaMock.cookbookDish.updateMany.mock.calls[1][0].data,
    ).toMatchObject({ decidedAt: new Date(NOW) })
  })

  it('sets aside a dish not served, never one served', async () => {
    await recordDishDecision('c1', dismissed())

    expect(prismaMock.cookbookDish.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'row-1',
        campaignId: 'c1',
        status: { in: ['queued', 'claimed', 'delivered', 'failed'] },
      },
      data: {
        status: 'dismissed',
        reason: 'deleted',
        decidedAt: new Date(at.time),
      },
    })
  })

  it('changes nothing for a dish no longer held', async () => {
    prismaMock.cookbookDish.updateMany.mockResolvedValue({ count: 0 })

    await expect(recordDishDecision('c1', dismissed())).resolves.toBeUndefined()
  })
})

describe('getCookbookView', () => {
  const seat = { id: 'char-1', campaignId: 'c1', actorId: 'actor-thorin' }
  const heldLink = {
    hint: 'U2d4',
    campaignId: 'c1',
    actorId: 'actor-thorin',
    createdAt: new Date('2026-10-24T18:00:00.000Z'),
    lastUsedAt: null,
  }

  beforeEach(() => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      dishesEnabled: true,
      lastSeenAt: ago(BRIDGE_TIMEOUT - 1000),
    } as any)
    prismaMock.cookbookLink.findUnique.mockResolvedValue(heldLink as any)
    prismaMock.cookbookDish.findMany.mockResolvedValue([])
  })

  it('shows the link and the character’s latest dishes, newest first', async () => {
    prismaMock.cookbookDish.findMany.mockResolvedValue([
      dish({
        id: 'row-2',
        status: 'applied',
        appliedTo: [
          { name: 'Thorin Oakenshield' },
          { name: 'Vex' },
          { actorId: 'x' },
        ],
        rolled: [{ type: 'maxHitPoints', value: 7, formula: '3+1d6' }],
        decidedAt: new Date('2026-10-24T20:15:00.000Z'),
      }),
      dish({ id: 'row-1', status: 'failed', reason: 'undeliverable' }),
    ] as any)

    await expect(getCookbookView(seat)).resolves.toEqual({
      enabled: true,
      live: true,
      link: {
        hint: 'U2d4',
        createdAt: '2026-10-24T18:00:00.000Z',
        lastUsedAt: null,
      },
      dishes: [
        {
          id: 'row-2',
          recipe: 'Fireberry Glazed Skewers',
          outcome: 'boon',
          state: 'applied',
          reason: null,
          eatenBy: ['Thorin Oakenshield', 'Vex'],
          rolled: [{ type: 'maxHitPoints', value: 7, formula: '3+1d6' }],
          queuedAt: ago(10 * MINUTE).toISOString(),
          decidedAt: '2026-10-24T20:15:00.000Z',
        },
        {
          id: 'row-1',
          recipe: 'Fireberry Glazed Skewers',
          outcome: 'boon',
          state: 'failed',
          reason: 'undeliverable',
          eatenBy: [],
          rolled: [],
          queuedAt: ago(10 * MINUTE).toISOString(),
          decidedAt: null,
        },
      ],
    })
    expect(prismaMock.cookbookDish.findMany).toHaveBeenCalledWith({
      where: { characterId: 'char-1' },
      orderBy: { createdAt: 'desc' },
      take: DISHES_SHOWN,
      select: expect.any(Object),
    })
    expect(DISHES_SHOWN).toBe(10)
    expect(prismaMock.cookbookLink.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { characterId: 'char-1' } }),
    )
  })

  it.each([
    ['another actor', { actorId: 'actor-vex' }],
    ['another campaign', { campaignId: 'c2' }],
  ])('shows no link made for %s', async (_name, fields) => {
    prismaMock.cookbookLink.findUnique.mockResolvedValue({
      ...heldLink,
      ...fields,
    } as any)

    await expect(getCookbookView(seat)).resolves.toMatchObject({ link: null })
  })

  it('shows no link where there is none, and the game offline', async () => {
    prismaMock.cookbookLink.findUnique.mockResolvedValue(null)
    prismaMock.campaign.findUnique.mockResolvedValue({
      dishesEnabled: false,
      lastSeenAt: null,
    } as any)

    await expect(getCookbookView(seat)).resolves.toEqual({
      enabled: false,
      live: false,
      link: null,
      dishes: [],
    })
  })

  it('shows nothing for a campaign gone', async () => {
    prismaMock.campaign.findUnique.mockResolvedValue(null)

    await expect(getCookbookView(seat)).resolves.toBeUndefined()
  })
})
