/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- Prisma uses null for an absent value */
import { prismaMock } from '../../jest.setup'
import { createEffectRequest } from './effects'
import { createRollRequest } from './roll-requests'
import { playerSeat } from './seats'
import { fullerSheet, mockCompanionEntry } from '@/mocks/sending-stone'
import type { SheetSeat } from '@/types/character'
import type { EffectInput, RollRequestInput } from '@/types/roll'
import type { SheetEffect } from '@/types/sending-stone'

const NOW = Date.parse('2026-10-28T12:00:00Z')
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

/** One of Thorin's effects changed, as a row's control sends it. */
const changing = (
  effect: EffectInput,
  fields: Partial<RollRequestInput> = {},
): RollRequestInput => ({
  kind: 'effect',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  effect,
  ...fields,
})
/** Bless, an ally's spell on Thorin, turned off. */
const BLESS_OFF: EffectInput = { op: 'disable', id: 'blessed' }

/**
 * Thorin's sheet as the module sends it after a change the page may not show yet: Bless moved to
 * Inactive as given, or gone.
 */
const blessAs = (fields: Partial<SheetEffect> | null) => {
  const sheet = fullerSheet()
  const [temporary, inactive] = sheet.effects
  const [bless, ...rest] = temporary.effects
  return {
    ...sheet,
    effects: [
      { ...temporary, effects: rest },
      {
        ...inactive,
        effects: fields
          ? [...inactive.effects, { ...bless, ...fields }]
          : inactive.effects,
      },
    ],
  }
}
/** Thorin's sheet with Shield of Faith moved to Temporary as given. */
const shieldAs = (fields: Partial<SheetEffect>) => {
  const sheet = fullerSheet()
  const [temporary, inactive] = sheet.effects
  return {
    ...sheet,
    effects: [
      {
        ...temporary,
        effects: [
          ...temporary.effects,
          ...inactive.effects.map(shield => ({ ...shield, ...fields })),
        ],
      },
      { ...inactive, effects: [] },
    ],
  }
}

/**
 * The campaign, letting its players change their effects unless said, with Thorin and Vex;
 * Thorin's sheet as held; and the seat's changes on their way, as given.
 */
const given = ({
  effectsEnabled = true,
  bridgePolledAt = ago(5000) as Date | null,
  inFlight = 0,
  lastMinute = 0,
  held = [] as EffectInput[],
  sheet = fullerSheet() as object | null,
} = {}) => {
  prismaMock.campaign.findUnique.mockResolvedValue({
    effectsEnabled,
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
    held.map(effect => ({ payload: changing(effect) })) as any,
  )
  prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-effect' } as any)
  // Changed on purpose (round 0.40.0 §10.3): createRollRequest asks first whether the character,
  // or a move's other end, is transformed; none is.
  prismaMock.actorSheet.findMany.mockResolvedValue([])
}
/** What was stored for the module to fetch. */
const created = () => prismaMock.rollRequest.create.mock.calls[0][0].data

describe('db/effects, createEffectRequest, from module 0.39.0', () => {
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

  it('takes an effect turned off, with everything else off, for the module to make', async () => {
    given()
    await expect(
      createEffectRequest(thorin, changing(BLESS_OFF)),
    ).resolves.toEqual({ id: 'req-effect' })
    expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      select: {
        effectsEnabled: true,
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
        kind: 'effect',
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
        kind: 'effect',
        payload: changing(BLESS_OFF),
        createdAt: new Date(NOW),
      },
      select: { id: true },
    })
    // The seat's older rows go, as a favorite's do.
    expect(prismaMock.rollRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        characterId: 'char-1',
        createdAt: { lt: ago(86_400_000) },
      },
    })
  })

  it('is what createRollRequest does with an effect', async () => {
    given()
    await expect(
      createRollRequest(thorin, changing(BLESS_OFF)),
    ).resolves.toEqual({ id: 'req-effect' })
    expect(created()).toMatchObject({ kind: 'effect', actorId: THORIN })
  })

  it.each([
    ['Bless deleted', { op: 'delete', id: 'blessed' }],
    [
      'Shield of Faith, turned off from the app, turned back on',
      {
        op: 'enable',
        id: 'shieldOfFaith',
      },
    ],
    ['Shield of Faith deleted', { op: 'delete', id: 'shieldOfFaith' }],
    [
      'Rage, on its feature, turned off by its dotted id',
      {
        op: 'disable',
        id: 'rage.raging',
      },
    ],
  ] as [string, EffectInput][])(
    'takes %s, as its ops let it',
    async (_name, effect) => {
      given()
      await expect(
        createEffectRequest(thorin, changing(effect)),
      ).resolves.toEqual({ id: 'req-effect' })
      expect(created().payload).toEqual(changing(effect))
    },
  )

  it('stores neither what the page calls it nor that it was typed in', async () => {
    given()
    await createEffectRequest(
      thorin,
      changing(BLESS_OFF, { typed: true, label: 'Bless' }),
    )
    expect(created().payload).toEqual(changing(BLESS_OFF))
    expect(created().payload).not.toHaveProperty('typed')
    expect(created().payload).not.toHaveProperty('label')
    expect(created()).not.toHaveProperty('label')
  })

  it('refuses the Gamemaster’s seat, before anything is read, as nothing would mark it theirs', async () => {
    given()
    await expect(createEffectRequest(gm, changing(BLESS_OFF))).resolves.toEqual(
      { status: 409, reason: 'unavailable' },
    )
    await expect(createRollRequest(gm, changing(BLESS_OFF))).resolves.toEqual({
      status: 409,
      reason: 'unavailable',
    })
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a companion’s seat as unknown, before anything is read, as its effects are no player’s to change', async () => {
    given()
    await expect(createRollRequest(wolf, changing(BLESS_OFF))).resolves.toEqual(
      { status: 422, reason: 'unknown' },
    )
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it.each([
    ['the campaign lets its players change none', { effectsEnabled: false }],
    ['the module isn’t fetching', { bridgePolledAt: ago(46_000) }],
    ['the module never fetched', { bridgePolledAt: null }],
  ])('refuses a change while %s', async (_name, campaign) => {
    given(campaign)
    await expect(
      createEffectRequest(thorin, changing(BLESS_OFF)),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a change from a seat with no campaign or character, naming no effect, or of a campaign gone', async () => {
    given()
    for (const seat of [
      { ...thorin, campaignId: null },
      { ...thorin, actorId: null },
    ]) {
      await expect(
        createEffectRequest(seat, changing(BLESS_OFF)),
      ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    }
    await expect(
      createEffectRequest(thorin, {
        ...changing(BLESS_OFF),
        effect: undefined,
      }),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    prismaMock.campaign.findUnique.mockResolvedValue(null)
    await expect(
      createEffectRequest(thorin, changing(BLESS_OFF)),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a seat sending too many, of rolls, moves, removals and favorites together', async () => {
    given({ inFlight: 3 })
    await expect(
      createEffectRequest(thorin, changing(BLESS_OFF)),
    ).resolves.toEqual({ status: 429, reason: 'busy' })
    given({ lastMinute: 20 })
    await expect(
      createEffectRequest(thorin, changing(BLESS_OFF)),
    ).resolves.toEqual({ status: 429, reason: 'busy' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a character no longer in the roster as unknown, before its sheet is read', async () => {
    given()
    await expect(
      createEffectRequest(
        { ...thorin, actorId: 'actorGone001' },
        changing(BLESS_OFF),
      ),
    ).resolves.toEqual({ status: 422, reason: 'unknown' })
    expect(prismaMock.actorSheet.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it.each([
    ['an effect the sheet lacks', { op: 'disable', id: 'hasted' }],
    ['an effect the sheet lacks, turned on', { op: 'enable', id: 'hasted' }],
    ['an item’s effect the sheet lacks', { op: 'disable', id: 'ring.ward' }],
  ] as [string, EffectInput][])(
    'refuses a change to %s as gone',
    async (_name, effect) => {
      given()
      await expect(
        createEffectRequest(thorin, changing(effect)),
      ).resolves.toEqual({ status: 422, reason: 'gone' })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    },
  )

  it('refuses any change for a character without a sheet as gone', async () => {
    given({ sheet: null })
    for (const op of ['disable', 'enable', 'delete'] as const) {
      await expect(
        createEffectRequest(thorin, changing({ op, id: 'blessed' })),
      ).resolves.toEqual({ status: 422, reason: 'gone' })
    }
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it.each([
    [
      'Rage deleted from its feature',
      { op: 'delete', id: 'rage.raging', sheet: fullerSheet() },
    ],
    [
      'Bless turned on once the Gamemaster turned it off in Foundry',
      {
        op: 'enable',
        id: 'blessed',
        sheet: blessAs({ disabled: true, ops: ['delete'] }),
      },
    ],
    [
      'Bless, off, turned off, where nothing of it is the player’s',
      {
        op: 'disable',
        id: 'blessed',
        sheet: blessAs({ disabled: true, ops: [] }),
      },
    ],
  ] as [string, EffectInput & { sheet: object }][])(
    'refuses %s, which its ops don’t list, as not that effect’s',
    async (_name, { sheet, ...effect }) => {
      given({ sheet })
      await expect(
        createEffectRequest(thorin, changing(effect)),
      ).resolves.toEqual({ status: 422, reason: 'effect' })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    },
  )

  it('refuses every change to an effect a module before 0.39.0 sent, which lists no ops, and the delete of one gone', async () => {
    const sheet = fullerSheet()
    given({
      sheet: {
        ...sheet,
        effects: sheet.effects.map(section => ({
          ...section,
          effects: section.effects.map(effect => ({
            ...effect,
            ops: undefined,
          })),
        })),
      },
    })
    for (const effect of [
      BLESS_OFF,
      { op: 'enable', id: 'blessed' },
      { op: 'delete', id: 'hasted' },
    ] as EffectInput[]) {
      await expect(
        createEffectRequest(thorin, changing(effect)),
      ).resolves.toEqual({ status: 422, reason: 'effect' })
    }
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  describe('one already so, as the page may show an older sheet, for the module to answer done with nothing written', () => {
    it.each([
      [
        'Bless turned off on another device',
        {
          op: 'disable',
          id: 'blessed',
          sheet: blessAs({ disabled: true, ops: ['enable', 'delete'] }),
        },
      ],
      [
        'Bless turned off by the Gamemaster in Foundry',
        {
          op: 'disable',
          id: 'blessed',
          sheet: blessAs({ disabled: true, ops: ['delete'] }),
        },
      ],
      [
        'Bless deleted in Foundry',
        { op: 'delete', id: 'blessed', sheet: blessAs(null) },
      ],
      [
        'the last effect deleted in Foundry',
        {
          op: 'delete',
          id: 'blessed',
          sheet: { ...fullerSheet(), effects: [] },
        },
      ],
      [
        'Shield of Faith turned on on another device',
        {
          op: 'enable',
          id: 'shieldOfFaith',
          sheet: shieldAs({ disabled: false, ops: ['disable', 'delete'] }),
        },
      ],
      [
        'Rage, on, turned on',
        { op: 'enable', id: 'rage.raging', sheet: fullerSheet() },
      ],
    ] as [string, EffectInput & { sheet: object }][])(
      'takes a change to %s',
      async (_name, { sheet, ...effect }) => {
        given({ sheet })
        await expect(
          createEffectRequest(thorin, changing(effect)),
        ).resolves.toEqual({ id: 'req-effect' })
        expect(created().payload).toEqual(changing(effect))
      },
    )

    it('refuses it as moving while the other device’s is still on its way', async () => {
      given({
        sheet: blessAs({ disabled: true, ops: ['enable', 'delete'] }),
        held: [BLESS_OFF],
      })
      await expect(
        createEffectRequest(thorin, changing(BLESS_OFF)),
      ).resolves.toEqual({ status: 409, reason: 'moving' })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })
  })

  describe('one already on its way from the seat, as from a second tap', () => {
    it.each([
      ['the same turned off', BLESS_OFF, BLESS_OFF],
      [
        'the same turned off, then deleted',
        BLESS_OFF,
        {
          op: 'delete',
          id: 'blessed',
        },
      ],
    ] as [string, EffectInput, EffectInput][])(
      'refuses a change beside %s as moving',
      async (_name, earlier, effect) => {
        given({ held: [earlier] })
        await expect(
          createEffectRequest(thorin, changing(effect)),
        ).resolves.toEqual({ status: 409, reason: 'moving' })
        expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
      },
    )

    it('takes one beside another effect’s', async () => {
      given({
        held: [
          { op: 'enable', id: 'shieldOfFaith' },
          { op: 'disable', id: 'rage.raging' },
        ],
      })
      await expect(
        createEffectRequest(thorin, changing(BLESS_OFF)),
      ).resolves.toEqual({ id: 'req-effect' })
    })
  })
})
