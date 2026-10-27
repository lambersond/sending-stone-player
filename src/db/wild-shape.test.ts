/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- Prisma uses null for an absent value */
import { prismaMock } from '../../jest.setup'
import { createRollRequest } from './roll-requests'
import { playerSeat } from './seats'
import { createWildShapeRequest, shapedRefusal } from './wild-shape'
import {
  druidSheet,
  FORM_IDS,
  KNOWN_FORMS,
  mockCompanionEntry,
  shapedSheet,
  wildShapeBlock,
  wolfForm,
} from '@/mocks/sending-stone'
import { parseGameEvent } from '@/schemas/sending-stone'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput, WildShapeInput } from '@/types/roll'

const NOW = Date.parse('2026-10-29T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)

const ELOWEN = 'actorElowen1'
const THORIN = 'actorThorin1'
const PARTY = 'groupIronCo1'

/** Elowen's player, Alice, at her sheet. */
const elowen = playerSeat(
  {
    id: 'char-1',
    name: 'Elowen',
    gameUrl: 'https://my-game.forge-vtt.com',
    campaignTitle: 'The Lonely Mountain',
    campaignId: 'c1',
    actorId: ELOWEN,
  },
  'user-1',
)
/** The campaign's Gamemaster at Elowen's sheet. */
const gm: SheetSeat = {
  ...elowen,
  role: 'gm',
  userId: 'gm-1',
  characterId: null,
}
/** Alice at Elowen's familiar's pane, from module 0.36.0. */
const owl: SheetSeat = {
  ...elowen,
  actorId: 'owlFamiliar1',
  companion: { of: ELOWEN, entry: mockCompanionEntry() },
}

/** Wild Shape, as the page sends it: no dice, and what the page calls it. */
const shaping = (
  wildShape: WildShapeInput,
  fields: Partial<RollRequestInput> = {},
): RollRequestInput => ({
  kind: 'wildShape',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  wildShape,
  label: 'Wild Shape',
  ...fields,
})
const INTO_WOLF: WildShapeInput = { op: 'transform', form: FORM_IDS.wolf }
const INTO_BEAR: WildShapeInput = { op: 'transform', form: FORM_IDS.blackBear }
const RETURN: WildShapeInput = { op: 'revert' }
const FORMS: WildShapeInput = { op: 'forms' }
const learn = (replace: string | null): WildShapeInput => ({
  op: 'learn',
  uuid: 'Compendium.dnd5e.actors24.Actor.mmRidingHorse000',
  replace,
})

/**
 * The campaign, letting its players use Wild Shape unless said, with Elowen and Thorin; Elowen's
 * sheet as held; and the seat's Wild Shape commands on their way, as given.
 */
const given = ({
  wildShapeEnabled = true,
  bridgePolledAt = ago(5000) as Date | null,
  inFlight = 0,
  lastMinute = 0,
  held = [] as WildShapeInput[],
  sheet = druidSheet() as object | null,
} = {}) => {
  prismaMock.campaign.findUnique.mockResolvedValue({
    wildShapeEnabled,
    bridgePolledAt,
    characters: [
      { id: ELOWEN, name: 'Elowen' },
      { id: THORIN, name: 'Thorin' },
    ],
  } as any)
  prismaMock.actorSheet.findUnique.mockResolvedValue(
    sheet && ({ data: sheet } as any),
  )
  prismaMock.rollRequest.count.mockImplementation((({ where }: any) =>
    Promise.resolve(where.OR ? inFlight : lastMinute)) as any)
  prismaMock.rollRequest.findMany.mockResolvedValue(
    held.map(wildShape => ({ payload: shaping(wildShape) })) as any,
  )
  prismaMock.rollRequest.create.mockResolvedValue({
    id: 'req-wildshape',
  } as any)
}
/** What was stored for the module to fetch. */
const created = () => prismaMock.rollRequest.create.mock.calls[0][0].data

describe('db/wild-shape, createWildShapeRequest, from module 0.40.0', () => {
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

  it('takes a change into a known form, with everything else off, for the module to make', async () => {
    given()
    await expect(
      createWildShapeRequest(elowen, shaping(INTO_WOLF)),
    ).resolves.toEqual({ id: 'req-wildshape' })
    expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      select: {
        wildShapeEnabled: true,
        bridgePolledAt: true,
        characters: true,
      },
    })
    expect(prismaMock.actorSheet.findUnique).toHaveBeenCalledWith({
      where: { campaignActor: { campaignId: 'c1', actorId: ELOWEN } },
      select: { data: true },
    })
    expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
      where: {
        characterId: 'char-1',
        kind: 'wildShape',
        OR: [
          { status: 'pending', createdAt: { gt: ago(30_000) } },
          { status: 'claimed', claimedAt: { gt: ago(75_000) } },
        ],
      },
      select: { payload: true },
      take: 3,
    })
    // What the page called it is the app's alone, as nothing is typed in for Wild Shape.
    const command = shaping(INTO_WOLF)
    delete command.label
    expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
      data: {
        campaignId: 'c1',
        characterId: 'char-1',
        role: 'player',
        requestedById: 'user-1',
        actorId: ELOWEN,
        kind: 'wildShape',
        payload: command,
        createdAt: new Date(NOW),
      },
      select: { id: true },
    })
    // The seat's older rows go, as an effect's do.
    expect(prismaMock.rollRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        characterId: 'char-1',
        createdAt: { lt: ago(86_400_000) },
      },
    })
  })

  it('strips what the page calls it and that it was typed in, which nothing of Wild Shape is', async () => {
    given()
    await createWildShapeRequest(
      elowen,
      shaping(INTO_WOLF, { label: 'Wild Shape', typed: true }),
    )
    expect(created().payload).not.toHaveProperty('label')
    expect(created().payload).not.toHaveProperty('typed')
    expect(created().payload).toEqual({
      kind: 'wildShape',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
      wildShape: INTO_WOLF,
    })
    // The row's own label is the Gamemaster's page's, and this is never theirs.
    expect(created()).not.toHaveProperty('label')
  })

  it.each([
    ['a change from her shape into another', INTO_BEAR, shapedSheet()],
    ['a return', RETURN, shapedSheet()],
    [
      'a Beast learned',
      learn(null),
      druidSheet({ wildShape: wildShapeBlock({ known: [] }) }),
    ],
    [
      'a replacement after a Long Rest',
      learn(FORM_IDS.panther),
      druidSheet({ wildShape: wildShapeBlock({ swap: true }) }),
    ],
    ['the Beasts to learn listed', FORMS, druidSheet()],
  ] as [string, WildShapeInput, object][])(
    'takes %s',
    async (_name, wildShape, sheet) => {
      given({ sheet })
      await expect(
        createWildShapeRequest(elowen, shaping(wildShape)),
      ).resolves.toEqual({ id: 'req-wildshape' })
      expect(created()).toMatchObject({
        kind: 'wildShape',
        payload: { wildShape },
      })
    },
  )

  it('is what createRollRequest does with Wild Shape', async () => {
    given()
    await expect(
      createRollRequest(elowen, shaping(INTO_WOLF)),
    ).resolves.toEqual({ id: 'req-wildshape' })
    expect(created()).toMatchObject({ kind: 'wildShape', actorId: ELOWEN })
  })

  it('refuses a seat with no campaign or character, naming no Wild Shape, or of a campaign gone', async () => {
    given()
    for (const seat of [
      { ...elowen, campaignId: null },
      { ...elowen, actorId: null },
    ]) {
      await expect(
        createWildShapeRequest(seat, shaping(INTO_WOLF)),
      ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    }
    await expect(
      createWildShapeRequest(elowen, {
        ...shaping(INTO_WOLF),
        wildShape: undefined,
      }),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    prismaMock.campaign.findUnique.mockResolvedValue(null)
    await expect(
      createWildShapeRequest(elowen, shaping(INTO_WOLF)),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses the Gamemaster’s seat, before anything is read, as the change would be the player’s', async () => {
    given({ sheet: shapedSheet() })
    for (const wildShape of [INTO_WOLF, RETURN, learn(null), FORMS]) {
      await expect(
        createWildShapeRequest(gm, shaping(wildShape)),
      ).resolves.toEqual({ status: 409, reason: 'unavailable' })
      await expect(createRollRequest(gm, shaping(wildShape))).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })
    }
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a companion’s seat as unknown, before anything is read, as it has no Wild Shape of a character’s', async () => {
    given()
    await expect(createRollRequest(owl, shaping(INTO_WOLF))).resolves.toEqual({
      status: 422,
      reason: 'unknown',
    })
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it.each([
    ['the campaign lets its players use none', { wildShapeEnabled: false }],
    ['the module isn’t fetching', { bridgePolledAt: ago(46_000) }],
    ['the module never fetched', { bridgePolledAt: null }],
  ])('refuses Wild Shape while %s', async (_name, campaign) => {
    given(campaign)
    for (const wildShape of [INTO_WOLF, FORMS]) {
      await expect(
        createWildShapeRequest(elowen, shaping(wildShape)),
      ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    }
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('takes Wild Shape for a fetch 44 seconds ago', async () => {
    given({ bridgePolledAt: ago(44_000) })
    await expect(
      createWildShapeRequest(elowen, shaping(INTO_WOLF)),
    ).resolves.toEqual({ id: 'req-wildshape' })
  })

  it('refuses a seat sending too many, of rolls and every other kind together', async () => {
    given({ inFlight: 3 })
    await expect(
      createWildShapeRequest(elowen, shaping(INTO_WOLF)),
    ).resolves.toEqual({ status: 429, reason: 'busy' })
    given({ lastMinute: 20 })
    await expect(
      createWildShapeRequest(elowen, shaping(FORMS)),
    ).resolves.toEqual({ status: 429, reason: 'busy' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a character no longer in the roster as unknown, before its sheet is read', async () => {
    given()
    await expect(
      createWildShapeRequest(
        { ...elowen, actorId: 'actorGone001' },
        shaping(INTO_WOLF),
      ),
    ).resolves.toEqual({ status: 422, reason: 'unknown' })
    expect(prismaMock.actorSheet.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses every op on a sheet without her Wild Shape, or no sheet, as gone', async () => {
    for (const sheet of [druidSheet({ wildShape: undefined }), null]) {
      given({ sheet })
      for (const wildShape of [INTO_WOLF, RETURN, learn(null), FORMS]) {
        await expect(
          createWildShapeRequest(elowen, shaping(wildShape)),
        ).resolves.toEqual({ status: 422, reason: 'gone' })
      }
    }
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  describe('a change, in the order of round 0.40.0 §6.8', () => {
    it.each([
      ['not a known form', { op: 'transform', form: 'Ab0cD1eF2gH3iJ4k' }],
      [
        'a known form from anywhere but the campaign’s compendiums',
        { op: 'transform', form: 'Zq0Lm4Tn8Rb2Vc6X' },
      ],
      [
        'a known form outside the rules',
        { op: 'transform', form: 'Fx0aA1bB2cC3dD4e' },
      ],
      [
        'a known form Foundry no longer finds',
        { op: 'transform', form: 'Gn0aA1bB2cC3dD4e' },
      ],
    ] as [string, WildShapeInput][])(
      'refuses %s as form, sending nothing',
      async (_name, wildShape) => {
        given({
          sheet: druidSheet({
            wildShape: wildShapeBlock({
              known: [
                ...wildShapeBlock().known,
                { id: 'Zq0Lm4Tn8Rb2Vc6X', name: 'Giant Elk', pool: false },
                {
                  ...KNOWN_FORMS.brownBear,
                  id: 'Fx0aA1bB2cC3dD4e',
                  fits: false,
                },
                {
                  ...KNOWN_FORMS.direWolf,
                  id: 'Gn0aA1bB2cC3dD4e',
                  found: false,
                },
              ],
            }),
          }),
        })
        await expect(
          createWildShapeRequest(elowen, shaping(wildShape)),
        ).resolves.toEqual({ status: 422, reason: 'form' })
        expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
      },
    )

    it('refuses the form she is in now as form', async () => {
      given({ sheet: shapedSheet() })
      await expect(
        createWildShapeRequest(elowen, shaping(INTO_WOLF)),
      ).resolves.toEqual({ status: 422, reason: 'form' })
    })

    it('refuses a change from a Polymorph, or a 2014 Wild Shape, as transformed', async () => {
      for (const form of [
        wolfForm({
          kind: 'other',
          name: 'Giant Ape',
          profile: null,
          hours: null,
          minutesLeft: null,
        }),
        wolfForm({ hours: null, minutesLeft: null }),
      ]) {
        given({ sheet: shapedSheet({ form }) })
        await expect(
          createWildShapeRequest(elowen, shaping(INTO_BEAR)),
        ).resolves.toEqual({ status: 422, reason: 'transformed' })
      }
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it('refuses a change from a Polymorph at 0 hit points with no uses left as transformed, before incapacitated and consume', async () => {
      given({
        sheet: shapedSheet({
          hp: { value: 0, max: 38, temp: 0 },
          form: wolfForm({
            kind: 'other',
            name: 'Giant Ape',
            profile: null,
            hours: null,
            minutesLeft: null,
          }),
          wildShape: wildShapeBlock({ uses: { value: 0, max: 2 } }),
        }),
      })
      await expect(
        createWildShapeRequest(elowen, shaping(INTO_BEAR)),
      ).resolves.toEqual({ status: 422, reason: 'transformed' })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it('refuses a druid at 0 hit points with no uses left as incapacitated, before consume', async () => {
      given({
        sheet: druidSheet({
          hp: { value: 0, max: 38, temp: 0 },
          wildShape: wildShapeBlock({ uses: { value: 0, max: 2 } }),
        }),
      })
      await expect(
        createWildShapeRequest(elowen, shaping(INTO_WOLF)),
      ).resolves.toEqual({ status: 422, reason: 'incapacitated' })
    })

    it('refuses a Paralyzed druid as incapacitated', async () => {
      given({
        sheet: druidSheet({
          conditions: ['paralyzed', 'incapacitated'].map(id => ({
            id,
            name: id,
            img: null,
            level: null,
            detail: null,
            text: null,
          })),
        }),
      })
      await expect(
        createWildShapeRequest(elowen, shaping(INTO_WOLF)),
      ).resolves.toEqual({ status: 422, reason: 'incapacitated' })
    })

    it('refuses a change with no use left as consume', async () => {
      given({
        sheet: druidSheet({
          wildShape: wildShapeBlock({ uses: { value: 0, max: 2 } }),
        }),
      })
      await expect(
        createWildShapeRequest(elowen, shaping(INTO_WOLF)),
      ).resolves.toEqual({ status: 422, reason: 'consume' })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })
  })

  it('refuses a return while herself as not-shaped, and from a Polymorph as transformed', async () => {
    given()
    await expect(
      createWildShapeRequest(elowen, shaping(RETURN)),
    ).resolves.toEqual({ status: 422, reason: 'not-shaped' })
    given({
      sheet: shapedSheet({
        form: wolfForm({ kind: 'other', hours: null, minutesLeft: null }),
      }),
    })
    await expect(
      createWildShapeRequest(elowen, shaping(RETURN)),
    ).resolves.toEqual({ status: 422, reason: 'transformed' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a Beast learned with every place taken as full, in place of the form she is in as shaped, and before a Long Rest as swap', async () => {
    given()
    await expect(
      createWildShapeRequest(elowen, shaping(learn(null))),
    ).resolves.toEqual({ status: 422, reason: 'full' })
    given({ sheet: shapedSheet({ wildShape: wildShapeBlock({ swap: true }) }) })
    await expect(
      createWildShapeRequest(elowen, shaping(learn(FORM_IDS.wolf))),
    ).resolves.toEqual({ status: 422, reason: 'shaped' })
    given()
    await expect(
      createWildShapeRequest(elowen, shaping(learn(FORM_IDS.panther))),
    ).resolves.toEqual({ status: 422, reason: 'swap' })
    given({ sheet: druidSheet({ wildShape: wildShapeBlock({ swap: true }) }) })
    await expect(
      createWildShapeRequest(elowen, shaping(learn('Ab0cD1eF2gH3iJ4k'))),
    ).resolves.toEqual({ status: 422, reason: 'form' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a replacement of the form she is in as shaped before swap, with no replacement free', async () => {
    given({ sheet: shapedSheet() })
    await expect(
      createWildShapeRequest(elowen, shaping(learn(FORM_IDS.wolf))),
    ).resolves.toEqual({ status: 422, reason: 'shaped' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it('refuses a Beast learned as full where a known form with no name fills the last place, as the game counts it', async () => {
    // dnd5e writes no name for a form dropped on her Wild Shape in Foundry; the sheet is held as
    // the events route read it.
    const sent = druidSheet({
      wildShape: wildShapeBlock({
        known: [
          ...wildShapeBlock().known.slice(0, 5),
          { id: 'Zq0Lm4Tn8Rb2Vc6X', name: '', pool: false },
        ],
      }),
    })
    const read = parseGameEvent('character.updated', {
      character: { id: ELOWEN, name: 'Elowen', sheet: sent },
    })?.data as { character: { sheet: object } }
    given({ sheet: read.character.sheet })
    await expect(
      createWildShapeRequest(elowen, shaping(learn(null))),
    ).resolves.toEqual({ status: 422, reason: 'full' })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  describe('one on its way already', () => {
    it.each([
      ['a change', INTO_WOLF, INTO_BEAR],
      ['a return', RETURN, INTO_BEAR],
      ['a Beast learned', learn(null), INTO_BEAR],
      ['a change, then a Beast learned', INTO_WOLF, learn(FORM_IDS.panther)],
      ['a change, then a return', INTO_WOLF, RETURN],
    ] as [string, WildShapeInput, WildShapeInput][])(
      'refuses another behind %s as moving, as from a second tap',
      async (_name, earlier, later) => {
        given({
          held: [earlier],
          sheet:
            later.op === 'revert'
              ? shapedSheet({ wildShape: wildShapeBlock({ swap: true }) })
              : druidSheet({ wildShape: wildShapeBlock({ swap: true }) }),
        })
        await expect(
          createWildShapeRequest(elowen, shaping(later)),
        ).resolves.toEqual({ status: 409, reason: 'moving' })
        expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
      },
    )

    it('lists the Beasts to learn behind a change on its way, never looking for one', async () => {
      given({ held: [INTO_WOLF] })
      await expect(
        createWildShapeRequest(elowen, shaping(FORMS)),
      ).resolves.toEqual({ id: 'req-wildshape' })
      expect(prismaMock.rollRequest.findMany).not.toHaveBeenCalled()
    })

    it('takes a change behind a list of Beasts on its way, which holds nothing back', async () => {
      given({ held: [FORMS, FORMS] })
      await expect(
        createWildShapeRequest(elowen, shaping(INTO_WOLF)),
      ).resolves.toEqual({ id: 'req-wildshape' })
    })

    it('checks the sheet before what is on its way, so a refusal says why', async () => {
      given({
        held: [INTO_WOLF],
        sheet: druidSheet({
          wildShape: wildShapeBlock({ uses: { value: 0, max: 2 } }),
        }),
      })
      await expect(
        createWildShapeRequest(elowen, shaping(INTO_BEAR)),
      ).resolves.toEqual({ status: 422, reason: 'consume' })
    })
  })
})

/** The sheets held for the campaign's characters, by actor, as given. */
const held = (sheets: Record<string, object>) =>
  prismaMock.actorSheet.findMany.mockImplementation((({ where }: any) =>
    Promise.resolve(
      (where.actorId.in as string[])
        .filter(id => sheets[id])
        .map(id => ({ data: sheets[id] })),
    )) as any)
const plain = (kind: RollRequestInput['kind'], fields: object) =>
  ({
    kind,
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
    ...fields,
  }) as RollRequestInput

describe('db/wild-shape, shapedRefusal, from module 0.40.0', () => {
  const FAVORITE = plain('favorite', {
    favorite: { op: 'add', type: 'item', id: 'quarterstaff' },
  })
  const EFFECT = plain('effect', { effect: { op: 'disable', id: 'blessed' } })
  const REMOVE = plain('remove', {
    remove: { item: 'quarterstaff', quantity: 1, held: 1 },
  })
  const move = (transfer: object) => plain('transfer', { transfer })

  beforeEach(() => {
    for (const mock of [
      prismaMock.actorSheet.findMany,
      prismaMock.campaign.findUnique,
      prismaMock.rollRequest.create,
    ]) {
      mock.mockReset()
    }
  })

  it.each([
    ['a favorite', FAVORITE],
    ['an effect changed', EFFECT],
    ['a removal', REMOVE],
    ['a move from her', move({ from: ELOWEN, to: PARTY, currency: { gp: 1 } })],
  ])(
    'refuses %s at a shaped character’s seat as shaped, before its own ladder reads anything',
    async (_name, input) => {
      held({ [ELOWEN]: shapedSheet() })
      await expect(shapedRefusal(elowen, input)).resolves.toEqual({
        status: 422,
        reason: 'shaped',
      })
      await expect(createRollRequest(elowen, input)).resolves.toEqual({
        status: 422,
        reason: 'shaped',
      })
      expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    },
  )

  it('reads the seat’s sheet, and a move’s ends’, by actor id in the campaign', async () => {
    held({})
    await shapedRefusal(elowen, FAVORITE)
    expect(prismaMock.actorSheet.findMany).toHaveBeenLastCalledWith({
      where: { campaignId: 'c1', actorId: { in: [ELOWEN] } },
      select: { data: true },
    })
    await shapedRefusal(
      elowen,
      move({ from: THORIN, to: ELOWEN, items: [{ id: 'rope', quantity: 1 }] }),
    )
    expect(prismaMock.actorSheet.findMany).toHaveBeenLastCalledWith({
      where: { campaignId: 'c1', actorId: { in: [ELOWEN, THORIN] } },
      select: { data: true },
    })
  })

  it.each([
    ['Thorin gives to her', { from: THORIN, to: ELOWEN, currency: { gp: 1 } }],
    [
      'the party gives to her',
      { from: PARTY, to: ELOWEN, currency: { gp: 1 } },
    ],
    [
      'the party’s coin is shared among her and Thorin',
      { from: PARTY, among: [THORIN, ELOWEN], currency: { gp: 2 } },
    ],
  ])(
    'refuses a move by Thorin’s player where %s, shaped, as shaped: either end',
    async (_name, transfer) => {
      const thorin = { ...elowen, characterId: 'char-2', actorId: THORIN }
      held({
        [ELOWEN]: shapedSheet(),
        [THORIN]: druidSheet({ wildShape: undefined }),
      })
      await expect(shapedRefusal(thorin, move(transfer))).resolves.toEqual({
        status: 422,
        reason: 'shaped',
      })
    },
  )

  it('lets through what involves no transformed character', async () => {
    held({ [ELOWEN]: druidSheet(), [THORIN]: druidSheet() })
    for (const input of [
      FAVORITE,
      EFFECT,
      REMOVE,
      move({ from: ELOWEN, to: THORIN, currency: { gp: 1 } }),
      move({ from: PARTY, to: ELOWEN, currency: { gp: 1 } }),
    ]) {
      await expect(shapedRefusal(elowen, input)).resolves.toBeUndefined()
    }
    // A move between others, neither shaped, from a seat whose own character is.
    held({ [ELOWEN]: druidSheet(), [THORIN]: druidSheet() })
    await expect(
      shapedRefusal(
        { ...elowen, actorId: THORIN, characterId: 'char-2' },
        move({ from: THORIN, to: PARTY, currency: { gp: 1 } }),
      ),
    ).resolves.toBeUndefined()
  })

  it('names no character, and reads nothing, at a seat with no campaign or character', async () => {
    held({ [ELOWEN]: shapedSheet() })
    await expect(
      shapedRefusal({ ...elowen, campaignId: null }, FAVORITE),
    ).resolves.toBeUndefined()
    await expect(
      shapedRefusal({ ...elowen, actorId: null }, FAVORITE),
    ).resolves.toBeUndefined()
    expect(prismaMock.actorSheet.findMany).not.toHaveBeenCalled()
  })

  it('asks nothing of the rolls, which go on in form', async () => {
    given({ sheet: shapedSheet() })
    prismaMock.actorSheet.findMany.mockReset()
    await createRollRequest(
      elowen,
      plain('skill', { key: 'prc', dice: [{ faces: 20, results: [12] }] }),
    )
    expect(prismaMock.actorSheet.findMany).not.toHaveBeenCalled()
  })
})
