/**
 * @jest-environment node
 */
import { createHitPointsRequest } from './hit-points'
import { createRollRequest } from './roll-requests'
import { playerSeat } from './seats'
import {
  fullerSheet,
  mockCompanionEntry,
  mockCompanionSheet,
  shapedSheet,
} from '@/mocks/sending-stone'
import { prismaMock } from '@/utils/test-utils-node'
import type { SheetSeat } from '@/types/character'
import type { HitPointsInput, RollRequestInput } from '@/types/roll'

const NOW = Date.parse('2026-11-06T12:00:00Z')
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
/** Thorin's wolf, as the module lists it. */
const WOLF = mockCompanionEntry({ of: [THORIN] })
/** Thorin's player at his wolf's pane, from module 0.36.0. */
const atWolf: SheetSeat = {
  ...thorin,
  actorId: 'wolfBrakka',
  name: 'Wolf',
  companion: { of: THORIN, entry: WOLF },
}

/** Hit points set as the editor sends them: the GM's fall, 4 damage taken from 22 and 3. */
const FALL: HitPointsInput = {
  op: 'set',
  value: 21,
  temp: 0,
  from: { value: 22, temp: 3 },
}

/** Hit points set, as the page sends them. */
const setting = (
  hitPoints: HitPointsInput = FALL,
  fields: Partial<RollRequestInput> = {},
): RollRequestInput => ({
  kind: 'hitPoints',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  hitPoints,
  ...fields,
})

/** Thorin's hit points as the page shows them: 22 of 30, with 3 temporary. */
const SHOWN = { value: 22, max: 30, temp: 3 }
/** Thorin's sheet, at the hit points shown unless said. */
const thorinAt = (hp: object | null = SHOWN) => ({ ...fullerSheet(), hp })

/**
 * The campaign, letting its players set hit points unless said, with Thorin and Vex and Thorin's
 * wolf; the sheets as held; and the seat's changes on their way, as given.
 */
const given = ({
  hitPointsEnabled = true,
  bridgePolledAt = ago(5000) as Date | null,
  inFlight = 0,
  sheet = thorinAt() as object | null,
  companionSheet = mockCompanionSheet() as object | null,
  companions = [WOLF] as object[],
  held = [] as { actorId: string; payload: RollRequestInput }[],
} = {}) => {
  prismaMock.campaign.findUnique.mockResolvedValue({
    hitPointsEnabled,
    bridgePolledAt,
    characters: [
      { id: THORIN, name: 'Thorin' },
      { id: VEX, name: 'Vex' },
    ],
    companions,
  } as any)
  prismaMock.actorSheet.findUnique.mockResolvedValue(
    sheet && ({ data: sheet } as any),
  )
  prismaMock.companionSheet.findUnique.mockResolvedValue(
    companionSheet && ({ data: companionSheet } as any),
  )
  prismaMock.rollRequest.count.mockImplementation((({ where }: any) =>
    Promise.resolve(where.OR ? inFlight : 0)) as any)
  prismaMock.rollRequest.findMany.mockResolvedValue(held as any)
  prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-hp' } as any)
}
/** What was stored for the module to fetch. */
const created = () => prismaMock.rollRequest.create.mock.calls[0][0].data

describe('db/hit-points, createHitPointsRequest, from module 0.44.0', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    for (const mock of [
      prismaMock.campaign.findUnique,
      prismaMock.actorSheet.findUnique,
      prismaMock.actorSheet.findMany,
      prismaMock.companionSheet.findUnique,
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

  it('takes hit points set, with the rolls and everything else off, for the module to make', async () => {
    given()
    await expect(createHitPointsRequest(thorin, setting())).resolves.toEqual({
      id: 'req-hp',
    })
    expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      select: {
        hitPointsEnabled: true,
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
        kind: 'hitPoints',
        OR: [
          { status: 'pending', createdAt: { gt: ago(30_000) } },
          { status: 'claimed', claimedAt: { gt: ago(75_000) } },
        ],
      },
      select: { actorId: true, payload: true },
      take: 3,
    })
    expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
      data: {
        campaignId: 'c1',
        characterId: 'char-1',
        role: 'player',
        requestedById: 'user-1',
        actorId: THORIN,
        kind: 'hitPoints',
        payload: setting(),
        createdAt: new Date(NOW),
      },
      select: { id: true },
    })
  })

  it('is what createRollRequest does with hit points, while shaped too: the module sets the form’s', async () => {
    given({ sheet: { ...shapedSheet(), hp: { value: 22, max: 30, temp: 3 } } })
    await expect(createRollRequest(thorin, setting())).resolves.toEqual({
      id: 'req-hp',
    })
    expect(created()).toMatchObject({ kind: 'hitPoints', actorId: THORIN })
    // Nothing waits for the character's own form.
    expect(prismaMock.actorSheet.findMany).not.toHaveBeenCalled()
  })

  it('stores neither what the page calls it nor that it was typed in', async () => {
    given()
    await createHitPointsRequest(
      thorin,
      setting(FALL, { typed: true, label: 'Hit points', rerolls: 'kept' }),
    )
    expect(created().payload).toEqual(setting())
    expect(created()).not.toHaveProperty('label')
  })

  it('refuses the Gamemaster’s seat, before anything is read, as nothing would mark it theirs', async () => {
    given()
    for (const seat of [gm, { ...atWolf, role: 'gm' as const }]) {
      await expect(createRollRequest(seat, setting())).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })
    }
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
  })

  it.each([
    [
      'the campaign lets none, as before module 0.44.0',
      { hitPointsEnabled: false },
    ],
    ['the module isn’t fetching', { bridgePolledAt: ago(46_000) }],
    ['the module never fetched', { bridgePolledAt: null }],
  ])(
    'refuses a change while %s, with the rolls never asked',
    async (_name, campaign) => {
      given(campaign)
      await expect(createRollRequest(thorin, setting())).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    },
  )

  it('refuses a seat sending too many, of rolls and every other kind together', async () => {
    given({ inFlight: 3 })
    await expect(createHitPointsRequest(thorin, setting())).resolves.toEqual({
      status: 429,
      reason: 'busy',
    })
  })

  it('refuses a character no longer in the roster as unknown', async () => {
    given()
    await expect(
      createHitPointsRequest({ ...thorin, actorId: 'actorGone001' }, setting()),
    ).resolves.toEqual({ status: 422, reason: 'unknown' })
  })

  it.each([
    ['no sheet held', null, 'unknown'],
    ['a sheet without hit points', thorinAt(null), 'unknown'],
    [
      'hit points moved in the game',
      thorinAt({ value: 15, max: 30, temp: 3 }),
      'changed',
    ],
    [
      'temporary ones moved',
      thorinAt({ value: 22, max: 30, temp: 0 }),
      'changed',
    ],
  ])(
    'refuses one the sheet as held refuses: %s',
    async (_name, sheet, reason) => {
      given({ sheet })
      await expect(createHitPointsRequest(thorin, setting())).resolves.toEqual({
        status: 422,
        reason,
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    },
  )

  it('checks only the fields it sets against the sheet', async () => {
    given({ sheet: thorinAt({ value: 22, max: 30, temp: 8 }) })
    await expect(
      createHitPointsRequest(
        thorin,
        setting({ op: 'set', value: 18, from: { value: 22 } }),
      ),
    ).resolves.toEqual({ id: 'req-hp' })
  })

  it('refuses a second change to the same hit points on their way, but not to another’s', async () => {
    given({ held: [{ actorId: THORIN, payload: setting() }] })
    await expect(createHitPointsRequest(thorin, setting())).resolves.toEqual({
      status: 409,
      reason: 'moving',
    })
    given({ held: [{ actorId: 'wolfBrakka', payload: setting() }] })
    await expect(createHitPointsRequest(thorin, setting())).resolves.toEqual({
      id: 'req-hp',
    })
  })

  describe('at a companion’s seat', () => {
    const WOLF_BITTEN: HitPointsInput = {
      op: 'set',
      value: 7,
      from: { value: 11 },
    }

    it('takes a listed companion’s, checked against its own sheet, kept as its key with its character', async () => {
      given()
      await expect(
        createRollRequest(atWolf, setting(WOLF_BITTEN)),
      ).resolves.toEqual({ id: 'req-hp' })
      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'c1' },
        select: {
          hitPointsEnabled: true,
          bridgePolledAt: true,
          characters: true,
          companions: true,
        },
      })
      expect(prismaMock.companionSheet.findUnique).toHaveBeenCalledWith({
        where: { campaignCompanion: { campaignId: 'c1', key: 'wolfBrakka' } },
        select: { data: true },
      })
      expect(prismaMock.actorSheet.findUnique).not.toHaveBeenCalled()
      expect(created()).toMatchObject({
        characterId: 'char-1',
        role: 'player',
        actorId: 'wolfBrakka',
        ofActorId: THORIN,
        kind: 'hitPoints',
        payload: setting(WOLF_BITTEN),
      })
    })

    it.each([
      ['no longer listed', []],
      [
        'listed as another character’s now',
        [mockCompanionEntry({ of: [VEX] })],
      ],
    ])('refuses one %s as unknown', async (_name, companions) => {
      given({ companions })
      await expect(
        createRollRequest(atWolf, setting(WOLF_BITTEN)),
      ).resolves.toEqual({ status: 422, reason: 'unknown' })
    })

    it('refuses one whose own sheet moved in the game', async () => {
      given({
        companionSheet: mockCompanionSheet({
          hp: { value: 4, max: 11, temp: 0 },
        }),
      })
      await expect(
        createRollRequest(atWolf, setting(WOLF_BITTEN)),
      ).resolves.toEqual({ status: 422, reason: 'changed' })
    })
  })
})
