/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- Prisma uses null for an absent value */
import { prismaMock } from '../../jest.setup'
import { createFavoriteRequest } from './favorites'
import { createRollRequest } from './roll-requests'
import { playerSeat } from './seats'
import { fullerSheet, mockCompanionEntry } from '@/mocks/sending-stone'
import type { SheetSeat } from '@/types/character'
import type { FavoriteInput, RollRequestInput } from '@/types/roll'

const NOW = Date.parse('2026-10-26T12:00:00Z')
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
/** Thorin's player at his wolf's pane, from module 0.36.0. */
const wolf: SheetSeat = {
  ...thorin,
  actorId: 'wolfBrakka',
  companion: { of: THORIN, entry: mockCompanionEntry() },
}

/** A favorite added or removed, as a row's menu sends it. */
const favoriting = (
  favorite: FavoriteInput,
  fields: Partial<RollRequestInput> = {},
): RollRequestInput => ({
  kind: 'favorite',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  favorite,
  ...fields,
})
const ADD_ROPE: FavoriteInput = { op: 'add', type: 'item', id: 'rope' }

/**
 * The campaign, taking favorites unless said, with Thorin and Vex; Thorin's sheet as held; and the
 * seat's favorites on their way, as given.
 */
const given = ({
  favoritesEnabled = true,
  bridgePolledAt = ago(5000) as Date | null,
  inFlight = 0,
  lastMinute = 0,
  held = [] as FavoriteInput[],
  sheet = fullerSheet() as object | null,
} = {}) => {
  prismaMock.campaign.findUnique.mockResolvedValue({
    favoritesEnabled,
    bridgePolledAt,
    characters: [
      { id: THORIN, name: 'Thorin' },
      { id: VEX, name: 'Vex' },
    ],
  } as any)
  prismaMock.actorSheet.findUnique.mockResolvedValue(
    sheet && ({ data: sheet } as any),
  )
  prismaMock.rollRequest.count.mockImplementation((({ where }: any) =>
    Promise.resolve(where.OR ? inFlight : lastMinute)) as any)
  prismaMock.rollRequest.findMany.mockResolvedValue(
    held.map(favorite => ({ payload: favoriting(favorite) })) as any,
  )
  prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-favorite' } as any)
  // Changed on purpose (round 0.40.0 §10.3): createRollRequest asks first whether the character,
  // or a move's other end, is transformed; none is.
  prismaMock.actorSheet.findMany.mockResolvedValue([])
}
/** What was stored for the module to fetch. */
const created = () => prismaMock.rollRequest.create.mock.calls[0][0].data

describe('db/favorites, createFavoriteRequest', () => {
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

  it('takes a favorite added, with everything else off, for the module to make', async () => {
    given()
    await expect(
      createFavoriteRequest(thorin, favoriting(ADD_ROPE)),
    ).resolves.toEqual({ id: 'req-favorite' })
    expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      select: {
        favoritesEnabled: true,
        bridgePolledAt: true,
        characters: true,
      },
    })
    expect(prismaMock.actorSheet.findUnique).toHaveBeenCalledWith({
      where: { campaignActor: { campaignId: 'c1', actorId: THORIN } },
      select: { data: true },
    })
    expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
      where: {
        characterId: 'char-1',
        kind: 'favorite',
        OR: [
          { status: 'pending', createdAt: { gt: ago(30_000) } },
          { status: 'claimed', claimedAt: { gt: ago(75_000) } },
        ],
      },
      select: { payload: true },
      take: 3,
    })
    expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
      data: {
        campaignId: 'c1',
        characterId: 'char-1',
        role: 'player',
        requestedById: 'user-1',
        actorId: THORIN,
        kind: 'favorite',
        payload: favoriting(ADD_ROPE),
        createdAt: new Date(NOW),
      },
      select: { id: true },
    })
    // The seat's older rows go, as a removal's do.
    expect(prismaMock.rollRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        characterId: 'char-1',
        createdAt: { lt: ago(86_400_000) },
      },
    })
  })

  it('is what createRollRequest does with a favorite', async () => {
    given()
    await expect(
      createRollRequest(thorin, favoriting(ADD_ROPE)),
    ).resolves.toEqual({ id: 'req-favorite' })
    expect(created()).toMatchObject({ kind: 'favorite', actorId: THORIN })
  })

  it.each([
    ['an action', { op: 'add', type: 'item', id: 'warhammer' }],
    ['a spell', { op: 'add', type: 'item', id: 'shield' }],
    ['something carried in a pouch', { op: 'add', type: 'item', id: 'coin' }],
    ['a feature', { op: 'add', type: 'item', id: 'darkvision' }],
    ['a class', { op: 'add', type: 'item', id: 'fighter' }],
    [
      "one of an item's activities",
      { op: 'add', type: 'activity', id: 'any', item: 'warhammer' },
    ],
    ['an effect', { op: 'add', type: 'effect', id: 'blessed' }],
    ['a skill', { op: 'add', type: 'skill', id: 'prc' }],
    // Tools and spell slots are the game's to check.
    ['a tool', { op: 'add', type: 'tool', id: 'whatever' }],
    ['spell slots', { op: 'add', type: 'slots', id: 'spell9' }],
    // A Remove of what the sheet no longer lists, whose favorite can still go.
    ['a Remove of an item gone', { op: 'remove', type: 'item', id: 'gone' }],
    [
      'a Remove of an effect gone',
      { op: 'remove', type: 'effect', id: 'gone' },
    ],
  ] as [string, FavoriteInput][])('takes %s', async (_name, favorite) => {
    given()
    await expect(
      createFavoriteRequest(thorin, favoriting(favorite)),
    ).resolves.toEqual({ id: 'req-favorite' })
  })

  it('stores neither what the page calls it nor that it was typed in', async () => {
    given()
    await createFavoriteRequest(
      thorin,
      favoriting(ADD_ROPE, { typed: true, label: 'Rope' }),
    )
    expect(created().payload).toEqual(favoriting(ADD_ROPE))
    expect(created().payload).not.toHaveProperty('typed')
    expect(created().payload).not.toHaveProperty('label')
    expect(created()).not.toHaveProperty('label')
  })

  it('refuses the Gamemaster’s seat, before anything is read, as nothing would mark it theirs', async () => {
    given()
    await expect(
      createFavoriteRequest(gm, favoriting(ADD_ROPE)),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    await expect(createRollRequest(gm, favoriting(ADD_ROPE))).resolves.toEqual({
      status: 409,
      reason: 'unavailable',
    })
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a companion’s seat as unknown, as an NPC has no favorites', async () => {
    given()
    await expect(
      createRollRequest(wolf, favoriting(ADD_ROPE)),
    ).resolves.toEqual({ status: 422, reason: 'unknown' })
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it.each([
    ['the module takes none', { favoritesEnabled: false }],
    ['the module isn’t fetching', { bridgePolledAt: ago(46_000) }],
    ['the module never fetched', { bridgePolledAt: null }],
  ])('refuses a favorite while %s', async (_name, campaign) => {
    given(campaign)
    await expect(
      createFavoriteRequest(thorin, favoriting(ADD_ROPE)),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a favorite from a seat with no campaign or character, or of a campaign gone', async () => {
    given()
    for (const seat of [
      { ...thorin, campaignId: null },
      { ...thorin, actorId: null },
    ]) {
      await expect(
        createFavoriteRequest(seat, favoriting(ADD_ROPE)),
      ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    }
    await expect(
      createFavoriteRequest(thorin, {
        ...favoriting(ADD_ROPE),
        favorite: undefined,
      }),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    prismaMock.campaign.findUnique.mockResolvedValue(null)
    await expect(
      createFavoriteRequest(thorin, favoriting(ADD_ROPE)),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a seat sending too many, of rolls, moves and removals together', async () => {
    given({ inFlight: 3 })
    await expect(
      createFavoriteRequest(thorin, favoriting(ADD_ROPE)),
    ).resolves.toEqual({ status: 429, reason: 'busy' })
    given({ lastMinute: 20 })
    await expect(
      createFavoriteRequest(thorin, favoriting(ADD_ROPE)),
    ).resolves.toEqual({ status: 429, reason: 'busy' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a character no longer in the roster as unknown, before its sheet is read', async () => {
    given()
    await expect(
      createFavoriteRequest(
        { ...thorin, actorId: 'actorGone001' },
        favoriting(ADD_ROPE),
      ),
    ).resolves.toEqual({ status: 422, reason: 'unknown' })
    expect(prismaMock.actorSheet.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it.each([
    ['an item the sheet lacks', { op: 'add', type: 'item', id: 'wandOfMagic' }],
    [
      'an activity of an item the sheet lacks',
      { op: 'add', type: 'activity', id: 'zap', item: 'wandOfMagic' },
    ],
    ['an effect the sheet lacks', { op: 'add', type: 'effect', id: 'hasted' }],
    ['a skill the sheet lacks', { op: 'add', type: 'skill', id: 'xyz' }],
  ] as [string, FavoriteInput][])(
    'refuses an Add of %s as gone',
    async (_name, favorite) => {
      given()
      await expect(
        createFavoriteRequest(thorin, favoriting(favorite)),
      ).resolves.toEqual({ status: 422, reason: 'gone' })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    },
  )

  it('refuses an Add for a character without a sheet as gone, but takes a Remove', async () => {
    given({ sheet: null })
    await expect(
      createFavoriteRequest(thorin, favoriting(ADD_ROPE)),
    ).resolves.toEqual({ status: 422, reason: 'gone' })
    await expect(
      createFavoriteRequest(
        thorin,
        favoriting({ op: 'remove', type: 'item', id: 'rope' }),
      ),
    ).resolves.toEqual({ id: 'req-favorite' })
  })

  describe('one already on its way from the seat, as from a second tap', () => {
    it.each([
      ['the same added', ADD_ROPE, ADD_ROPE],
      [
        'the same removed, then added',
        { op: 'remove', type: 'item', id: 'rope' },
        ADD_ROPE,
      ],
      [
        'the same activity of the same item',
        { op: 'add', type: 'activity', id: 'same', item: 'warhammer' },
        { op: 'remove', type: 'activity', id: 'same', item: 'warhammer' },
      ],
    ] as [string, FavoriteInput, FavoriteInput][])(
      'refuses a favorite beside %s as moving',
      async (_name, earlier, favorite) => {
        given({ held: [earlier] })
        await expect(
          createFavoriteRequest(thorin, favoriting(favorite)),
        ).resolves.toEqual({ status: 409, reason: 'moving' })
        expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
      },
    )

    it('takes one beside another target’s, or an activity of one id on another item', async () => {
      given({
        held: [
          { op: 'add', type: 'item', id: 'warhammer' },
          { op: 'add', type: 'effect', id: 'rope' },
          { op: 'add', type: 'activity', id: 'same', item: 'handaxe' },
        ],
      })
      await expect(
        createFavoriteRequest(thorin, favoriting(ADD_ROPE)),
      ).resolves.toEqual({ id: 'req-favorite' })
      await expect(
        createFavoriteRequest(
          thorin,
          favoriting({
            op: 'add',
            type: 'activity',
            id: 'same',
            item: 'warhammer',
          }),
        ),
      ).resolves.toEqual({ id: 'req-favorite' })
    })
  })
})
