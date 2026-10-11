/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- Prisma uses null for an absent value */
import { prismaMock } from '../../jest.setup'
import {
  claimRollRequests,
  createRollRequest,
  getRollRequestView,
  markBridgePolled,
  notePlayersSeen,
  recordCommandResult,
} from './roll-requests'
import { sanitizeSheetHtml } from '@/lib/sheet-html'
import {
  characterSheet,
  combat,
  combatant,
  fullerSheet,
  sheetAction,
  TEXTS,
} from '@/mocks/sending-stone'
import type { RollRequestInput } from '@/types/roll'

const NOW = Date.parse('2026-10-09T20:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)

const character = {
  id: 'char-1',
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

const perception: RollRequestInput = {
  kind: 'skill',
  key: 'prc',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
}

const initiative: RollRequestInput = {
  kind: 'initiative',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [9] }],
  combatId: 'cmbt1',
}

/** A warhammer attack at the goblin. */
const swing: RollRequestInput = {
  kind: 'attack',
  item: 'warhammer',
  activity: 'warhammerAttack',
  target: { combatId: 'cmbt1', combatantId: 'c-goblin' },
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [15] }],
}

/** Its damage: 1d8 + 4. */
const smash: RollRequestInput = {
  kind: 'damage',
  use: 'req-0',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 8, results: [6] }],
}

/** A campaign whose game takes skill checks, initiative and attacks, its module fetching them. */
const takingRolls = {
  rollsEnabled: true,
  rollKinds: ['skill', 'initiative', 'attack', 'damage'],
  rollFeatures: [] as string[],
  bridgePolledAt: ago(5000),
}

/** A held roll, as read back. */
const held = (id: string, fields: object = {}) => ({
  id,
  actorId: 'actor-thorin',
  kind: 'skill',
  payload: perception,
  status: 'claimed',
  result: null,
  createdAt: ago(3000),
  claimedAt: new Date(NOW),
  ...fields,
})

/** The warhammer attack, req-0, made in the game: a hit, its damage to roll. */
const madeSwing = (fields: object = {}) =>
  held('req-0', {
    kind: 'attack',
    payload: swing,
    status: 'done',
    createdAt: ago(20_000),
    result: {
      id: 'req-0',
      status: 'done',
      visible: true,
      rolls: [],
      attack: { critical: false, fumble: false, outcome: 'hit' },
      damage: {
        critical: false,
        plannable: true,
        rolls: [
          {
            formula: '1d8 + 4',
            type: 'bludgeoning',
            dice: [{ faces: 8, number: 1 }],
          },
        ],
      },
    },
    ...fields,
  })

/** The save the game asks of Thorin, as held: Dexterity or Strength, for another minute. */
const asked = (fields: object = {}) => ({
  actorId: 'actor-thorin',
  data: {
    type: 'save',
    abilities: ['dex', 'str'],
    dc: 15,
    label: 'Burning Hands',
    messageId: 'msg1',
  },
  expiresAt: new Date(NOW + 60_000),
  closedAt: null,
  ...fields,
})

describe('db/roll-requests', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('createRollRequest', () => {
    /** The sheet, combats and roll counts the request is checked against. */
    const given = ({
      sheet = fullerSheet() as object | null,
      combats = [] as object[],
      inFlight = 0,
      lastMinute = 0,
    } = {}) => {
      prismaMock.campaign.findUnique.mockResolvedValue(takingRolls as any)
      prismaMock.actorSheet.findUnique.mockResolvedValue(
        sheet ? ({ data: sheet } as any) : null,
      )
      prismaMock.combat.findMany.mockResolvedValue(
        combats.map(data => ({ data })) as any,
      )
      prismaMock.rollRequest.count
        .mockResolvedValueOnce(inFlight)
        .mockResolvedValueOnce(lastMinute)
      prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-1' } as any)
    }

    it("takes a roll the game takes and the character's sheet allows", async () => {
      given()

      await expect(createRollRequest(character, perception)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'c1' },
        select: {
          rollsEnabled: true,
          rollKinds: true,
          rollFeatures: true,
          bridgePolledAt: true,
        },
      })
      expect(prismaMock.actorSheet.findUnique).toHaveBeenCalledWith({
        where: { campaignActor: { campaignId: 'c1', actorId: 'actor-thorin' } },
        select: { data: true },
      })
      expect(prismaMock.combat.findMany).not.toHaveBeenCalled()
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
        data: {
          campaignId: 'c1',
          characterId: 'char-1',
          actorId: 'actor-thorin',
          kind: 'skill',
          payload: perception,
          createdAt: new Date(NOW),
        },
        select: { id: true },
      })
      // Only the latest rolls are kept.
      expect(prismaMock.rollRequest.deleteMany).toHaveBeenCalledWith({
        where: { characterId: 'char-1', createdAt: { lt: ago(86_400_000) } },
      })
    })

    it('counts the rolls the character has on their way, and made in the last minute', async () => {
      given()
      await createRollRequest(character, perception)

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
      ['in no campaign', { campaignId: null }],
      ['without an actor', { actorId: null }],
    ])('refuses, without looking, a character %s', async (_name, fields) => {
      await expect(
        createRollRequest({ ...character, ...fields }, perception),
      ).resolves.toEqual({ status: 409, reason: 'unavailable' })
      expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
    })

    it.each([
      ['its campaign is gone', null],
      ['the Gamemaster has rolls off', { ...takingRolls, rollsEnabled: false }],
      [
        'the module has stopped fetching',
        { ...takingRolls, bridgePolledAt: ago(60_000) },
      ],
      [
        'the game does not take the kind',
        { ...takingRolls, rollKinds: ['save'] },
      ],
    ])('refuses a roll when %s', async (_name, campaign) => {
      prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)

      await expect(createRollRequest(character, perception)).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it.each([
      ['three rolls on their way', { inFlight: 3 }],
      ['twenty rolls in the last minute', { lastMinute: 20 }],
    ])('refuses a character with %s', async (_name, counts) => {
      given(counts)

      await expect(createRollRequest(character, perception)).resolves.toEqual({
        status: 429,
        reason: 'busy',
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it('refuses what the sheet lacks, or a roll for a character without one', async () => {
      given()
      await expect(
        createRollRequest(character, { ...perception, key: 'xyz' }),
      ).resolves.toEqual({ status: 422, reason: 'unknown' })

      given({ sheet: null })
      await expect(createRollRequest(character, perception)).resolves.toEqual({
        status: 422,
        reason: 'unknown',
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it('takes initiative in the combat the character waits in, and only there', async () => {
      const waiting = combat({
        combatants: [
          combatant({
            id: 'c-thorin',
            character: 'actor-thorin',
            initiative: null,
          }),
        ],
      })
      given({ sheet: characterSheet(), combats: [waiting] })

      await expect(createRollRequest(character, initiative)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.combat.findMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', combatId: 'cmbt1' },
        select: { data: true },
      })

      given({ sheet: characterSheet(), combats: [] })
      await expect(createRollRequest(character, initiative)).resolves.toEqual({
        status: 422,
        reason: 'not-in-combat',
      })
    })

    it('takes an attack at a combatant of the combat it is in, as the player sees it', async () => {
      const fight = combat({
        combatants: [
          combatant({ id: 'c-goblin', name: 'Goblin' }),
          combatant({ id: 'c-lurker', name: 'Lurker', hidden: true }),
        ],
      })
      given({ combats: [fight] })

      await expect(createRollRequest(character, swing)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.combat.findMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', combatId: 'cmbt1' },
        select: { data: true },
      })
      expect(prismaMock.rollRequest.findFirst).not.toHaveBeenCalled()
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          kind: 'attack',
          payload: swing,
          useId: undefined,
        }),
        select: { id: true },
      })

      given({ combats: [fight] })
      await expect(
        createRollRequest(character, {
          ...swing,
          target: { combatId: 'cmbt1', combatantId: 'c-lurker' },
        }),
      ).resolves.toEqual({ status: 422, reason: 'target' })
    })

    it('takes an attack at no one, looking up no combat', async () => {
      given()

      await expect(
        createRollRequest(character, { ...swing, target: null }),
      ).resolves.toEqual({ id: 'req-1' })
      expect(prismaMock.combat.findMany).not.toHaveBeenCalled()
    })

    describe('damage', () => {
      it("takes an attack's damage, noting the attack it follows", async () => {
        given()
        prismaMock.rollRequest.findFirst.mockResolvedValue(madeSwing() as any)
        prismaMock.rollRequest.findMany.mockResolvedValue([])

        await expect(createRollRequest(character, smash)).resolves.toEqual({
          id: 'req-1',
        })
        // Only the character's own attack, and the damage asked for it.
        expect(prismaMock.rollRequest.findFirst).toHaveBeenCalledWith({
          where: { id: 'req-0', characterId: 'char-1' },
          select: expect.objectContaining({ status: true, result: true }),
        })
        expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
          where: { useId: 'req-0', characterId: 'char-1' },
          select: { status: true, createdAt: true, claimedAt: true },
        })
        expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            kind: 'damage',
            payload: smash,
            useId: 'req-0',
          }),
          select: { id: true },
        })
      })

      it.each([
        ['of an attack that is not the character’s', null, [], 'gone'],
        ['rolled already', madeSwing(), [{ status: 'done' }], 'damaged'],
        ['with dice its attack did not say', madeSwing({}), [], 'dice'],
      ])('refuses damage %s', async (_name, use, others, reason) => {
        given()
        prismaMock.rollRequest.findFirst.mockResolvedValue(use as any)
        prismaMock.rollRequest.findMany.mockResolvedValue(
          others.map(other => ({
            createdAt: ago(1000),
            claimedAt: null,
            ...other,
          })) as any,
        )
        const input =
          reason === 'dice'
            ? { ...smash, dice: [{ faces: 6, results: [6] }] }
            : smash

        await expect(createRollRequest(character, input)).resolves.toEqual({
          status: 422,
          reason,
        })
        expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
      })

      it('takes damage the player changed, with the changed dice, only where the game takes it so', async () => {
        const changed = {
          ...smash,
          modifiers: { extra: 1, faces: 10 as const },
          dice: [{ faces: 10, results: [6, 7] }],
        }
        given()
        prismaMock.rollRequest.findFirst.mockResolvedValue(madeSwing() as any)
        prismaMock.rollRequest.findMany.mockResolvedValue([])
        await expect(createRollRequest(character, changed)).resolves.toEqual({
          status: 409,
          reason: 'unavailable',
        })

        prismaMock.campaign.findUnique.mockResolvedValue({
          ...takingRolls,
          rollFeatures: ['modifiers'],
        } as any)
        // The dice its attack said, unchanged, aren't those of the damage changed.
        await expect(
          createRollRequest(character, {
            ...smash,
            modifiers: changed.modifiers,
          }),
        ).resolves.toEqual({ status: 422, reason: 'dice' })
        await expect(createRollRequest(character, changed)).resolves.toEqual({
          id: 'req-1',
        })
        expect(prismaMock.rollRequest.create).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('getRollRequestView', () => {
    it("reads a roll of the character's, and where it stands", async () => {
      prismaMock.rollRequest.findFirst.mockResolvedValue(
        held('req-1', { status: 'pending', claimedAt: null }) as any,
      )

      await expect(getRollRequestView('char-1', 'req-1')).resolves.toEqual({
        id: 'req-1',
        status: 'sending',
      })
      expect(prismaMock.rollRequest.findFirst).toHaveBeenCalledWith({
        where: { id: 'req-1', characterId: 'char-1' },
        select: expect.objectContaining({ status: true, result: true }),
      })
    })

    it("is nothing for a roll that isn't the character's", async () => {
      prismaMock.rollRequest.findFirst.mockResolvedValue(null)

      await expect(
        getRollRequestView('char-1', 'req-9'),
      ).resolves.toBeUndefined()
    })
  })

  describe('claimRollRequests', () => {
    it('hands over nothing, and marks nothing, when no roll waits', async () => {
      prismaMock.rollRequest.findMany.mockResolvedValue([])

      await expect(claimRollRequests('c1', 'session-1')).resolves.toEqual([])
      expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          status: 'pending',
          createdAt: { gt: ago(30_000) },
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
        select: { id: true },
      })
      expect(prismaMock.rollRequest.updateMany).not.toHaveBeenCalled()
    })

    it('marks the waiting rolls fetched, and hands over only those it marked', async () => {
      prismaMock.rollRequest.findMany
        .mockResolvedValueOnce([{ id: 'req-1' }, { id: 'req-2' }] as any)
        // Another fetch marked req-2 first.
        .mockResolvedValueOnce([held('req-1')] as any)

      await expect(claimRollRequests('c1', 'session-1')).resolves.toEqual([
        { ...perception, id: 'req-1', actorId: 'actor-thorin' },
      ])
      expect(prismaMock.rollRequest.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['req-1', 'req-2'] }, status: 'pending' },
        data: {
          status: 'claimed',
          claimToken: expect.any(String),
          claimSession: 'session-1',
          claimedAt: new Date(NOW),
        },
      })
      const { claimToken } =
        prismaMock.rollRequest.updateMany.mock.calls[0][0].data
      expect(prismaMock.rollRequest.findMany).toHaveBeenLastCalledWith({
        where: { id: { in: ['req-1', 'req-2'] }, claimToken },
        orderBy: { createdAt: 'asc' },
        select: expect.objectContaining({ payload: true, actorId: true }),
      })
    })

    it('marks each fetch apart', async () => {
      prismaMock.rollRequest.findMany.mockResolvedValue([
        { id: 'req-1' },
      ] as any)
      await claimRollRequests('c1', 'session-1')
      await claimRollRequests('c1', 'session-1')

      const [first, second] = prismaMock.rollRequest.updateMany.mock.calls.map(
        ([update]) => update.data.claimToken,
      )
      expect(first).not.toEqual(second)
    })
  })

  describe('createRollRequest, answering what the game asked', () => {
    /** A Dexterity saving throw answering the game's prompt. */
    const answer: RollRequestInput = {
      kind: 'save',
      key: 'dex',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 20, results: [12] }],
      prompt: 'msg1-thorin',
    }
    const given = ({
      prompt = asked() as object | null,
      answers = [] as object[],
      features = ['prompts'],
    } = {}) => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        ...takingRolls,
        rollKinds: ['save'],
        rollFeatures: features,
      } as any)
      prismaMock.actorSheet.findUnique.mockResolvedValue({
        data: fullerSheet(),
      } as any)
      prismaMock.rollRequest.count.mockResolvedValue(0)
      prismaMock.rollPrompt.findUnique.mockResolvedValue(prompt as any)
      prismaMock.rollRequest.findMany.mockResolvedValue(answers as any)
      prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-1' } as any)
    }

    it('takes a save answering an open prompt of its character, with an ability it offers', async () => {
      given()

      await expect(createRollRequest(character, answer)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.rollPrompt.findUnique).toHaveBeenCalledWith({
        where: {
          campaignPrompt: { campaignId: 'c1', promptId: 'msg1-thorin' },
        },
        select: { actorId: true, data: true, expiresAt: true, closedAt: true },
      })
      expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
        where: {
          characterId: 'char-1',
          kind: 'save',
          payload: { path: ['prompt'], equals: 'msg1-thorin' },
        },
        select: { status: true, createdAt: true, claimedAt: true },
      })
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ kind: 'save', payload: answer }),
        }),
      )
    })

    it("refuses an answer where the game doesn't ask its players", async () => {
      given({ features: [] })

      await expect(createRollRequest(character, answer)).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })
    })

    it.each([
      ['no such prompt', { prompt: null }],
      ['a closed one', { prompt: asked({ closedAt: ago(1000) }) }],
      ['one run out', { prompt: asked({ expiresAt: ago(1) }) }],
      ['another character’s', { prompt: asked({ actorId: 'actor-vex' }) }],
      [
        'one answered already',
        {
          answers: [
            { status: 'claimed', createdAt: ago(2000), claimedAt: ago(1000) },
          ],
        },
      ],
    ])('refuses an answer to %s', async (_name, fields) => {
      given(fields)

      await expect(createRollRequest(character, answer)).resolves.toEqual({
        status: 422,
        reason: 'prompt',
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it("refuses an ability the prompt doesn't offer, and takes another answer once one failed", async () => {
      given()
      await expect(
        createRollRequest(character, { ...answer, key: 'con' }),
      ).resolves.toEqual({ status: 422, reason: 'prompt' })

      given({
        answers: [{ status: 'failed', createdAt: ago(5000), claimedAt: null }],
      })
      await expect(createRollRequest(character, answer)).resolves.toEqual({
        id: 'req-1',
      })
    })
  })

  describe('createRollRequest, for area attacks, hit dice and formulas', () => {
    /**
     * Thorin with Dragon Breath, made at two in its cone, and a lantern whose light's radius is
     * 1d4 + 3; and his Fighter levels' d10 hit dice, 3 of 5 left.
     */
    const sheet = fullerSheet({
      actions: [
        {
          id: 'action',
          label: 'Actions',
          actions: [
            sheetAction({
              id: 'breath',
              name: 'Dragon Breath',
              toHit: 5,
              attackId: 'exhale',
              attackArea: { count: 2, perLevel: null, affects: 'creature' },
            }),
            sheetAction({
              id: 'lantern',
              name: 'Lantern',
              activity: {
                id: 'shine',
                type: 'utility',
                targets: {
                  self: true,
                  area: false,
                  count: null,
                  perLevel: null,
                  affects: 'self',
                },
              },
              rollFormula: { formula: '1d4 + 3', name: 'Light radius' },
            }),
          ],
        },
      ],
    })
    const fight = combat({
      combatants: [
        combatant({ id: 'c-goblin', name: 'Goblin' }),
        combatant({ id: 'c-hob', name: 'Hobgoblin' }),
        combatant({ id: 'c-ogre', name: 'Ogre' }),
      ],
    })
    const given = ({
      kinds = ['attack', 'hitDie', 'formula'],
      features = ['areaAttacks'],
      data = sheet as object,
    } = {}) => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        ...takingRolls,
        rollKinds: kinds,
        rollFeatures: features,
      } as any)
      prismaMock.actorSheet.findUnique.mockResolvedValue({ data } as any)
      prismaMock.combat.findMany.mockResolvedValue([{ data: fight }] as any)
      prismaMock.rollRequest.count.mockResolvedValue(0)
      prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-1' } as any)
    }

    /** Dragon Breath at the goblin and the hobgoblin. */
    const breath: RollRequestInput = {
      kind: 'attack',
      item: 'breath',
      activity: 'exhale',
      targets: [
        { combatId: 'cmbt1', combatantId: 'c-goblin' },
        { combatId: 'cmbt1', combatantId: 'c-hob' },
      ],
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 20, results: [15] }],
    }

    /** A d10 hit die spent. */
    const hitDie: RollRequestInput = {
      kind: 'hitDie',
      denomination: 'd10',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 10, results: [6] }],
    }

    /** The lantern's light. */
    const light: RollRequestInput = {
      kind: 'formula',
      item: 'lantern',
      activity: 'shine',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 4, results: [2] }],
    }

    it('takes an area attack at the combatants picked, from the combat they are in, where the game makes it so', async () => {
      given()

      await expect(createRollRequest(character, breath)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.combat.findMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', combatId: 'cmbt1' },
        select: { data: true },
      })
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kind: 'attack', payload: breath }),
        select: { id: true },
      })
    })

    it("refuses, without looking further, an area attack where the game doesn't make it at those picked, but not an attack at one", async () => {
      given({ features: ['modifiers', 'prompts'] })

      await expect(createRollRequest(character, breath)).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })
      expect(prismaMock.actorSheet.findUnique).not.toHaveBeenCalled()
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()

      await expect(
        createRollRequest(character, {
          ...breath,
          targets: undefined,
          target: { combatId: 'cmbt1', combatantId: 'c-goblin' },
        }),
      ).resolves.toEqual({ id: 'req-1' })
    })

    it('refuses an area attack at more combatants than its area takes', async () => {
      given()

      await expect(
        createRollRequest(character, {
          ...breath,
          targets: [
            ...(breath.targets ?? []),
            { combatId: 'cmbt1', combatantId: 'c-ogre' },
          ],
        }),
      ).resolves.toEqual({ status: 422, reason: 'target' })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it('takes a hit die of a size the character has one of left, looking up no combat', async () => {
      given()

      await expect(createRollRequest(character, hitDie)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.combat.findMany).not.toHaveBeenCalled()
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kind: 'hitDie', payload: hitDie }),
        select: { id: true },
      })
    })

    it('refuses a hit die with none of its size left, or where the game takes none', async () => {
      const [fighter] = sheet.classes
      given({
        data: {
          ...sheet,
          classes: [{ ...fighter, hitDice: { die: 'd10', value: 0, max: 5 } }],
        },
      })
      await expect(createRollRequest(character, hitDie)).resolves.toEqual({
        status: 422,
        reason: 'no-hit-dice',
      })

      given({ kinds: ['attack', 'formula'] })
      await expect(createRollRequest(character, hitDie)).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it("takes an activity's own formula with the dice it throws, where the game takes it", async () => {
      given()
      await expect(createRollRequest(character, light)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kind: 'formula', payload: light }),
        select: { id: true },
      })

      await expect(
        createRollRequest(character, {
          ...light,
          dice: [{ faces: 6, results: [2] }],
        }),
      ).resolves.toEqual({ status: 422, reason: 'dice' })

      given({ kinds: ['attack', 'hitDie'] })
      await expect(createRollRequest(character, light)).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })
      expect(prismaMock.rollRequest.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('createRollRequest, from a link in a description', () => {
    /**
     * Second Wind's description, as held: a save the table may be asked for, one in a secret,
     * damage, a roll of its own, and a check.
     */
    const described = sanitizeSheetHtml(
      '<p>Each creature makes a <span class="ss-save roll" data-n="0" data-ability="dex" data-dc="15">DC 15 Dexterity</span> saving throw, taking ' +
        '<span class="ss-damage roll" data-n="1" data-formulas="2d6&amp;1d4" data-types="fire|cold&amp;">2d6 fire or cold and 1d4</span> damage, ' +
        'and <span class="ss-roll roll" data-n="2" data-formula="1d6 + 2">1d6 + 2</span> more.</p>' +
        '<section class="secret"><p>Or a <span class="ss-save roll" data-n="3" data-ability="wis">Wisdom</span> saving throw.</p></section>' +
        '<p>Climbing out takes a <span class="ss-check roll" data-n="4" data-checks="skill:str:ath|tool:dex:thief" data-dc="15">DC 15 Strength (Athletics) or Dexterity (Thieves’ Tools)</span> check.</p>',
      'https://my-game.forge-vtt.com',
    )
    const linked: RollRequestInput = {
      kind: 'ask',
      text: TEXTS.secondWind,
      link: 0,
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    }
    const given = ({
      html = described as string | null,
      asks = 0,
      features = [] as string[],
      sheet = fullerSheet() as object,
    } = {}) => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        ...takingRolls,
        rollFeatures: features,
        rollKinds: [
          'save',
          'skill',
          'tool',
          'ability',
          'ask',
          'textDamage',
          'textRoll',
        ],
      } as any)
      prismaMock.actorSheet.findUnique.mockResolvedValue({
        data: sheet,
      } as any)
      prismaMock.sheetText.findUnique.mockResolvedValue(
        html === null ? null : ({ html } as any),
      )
      prismaMock.rollRequest.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(asks)
      prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-1' } as any)
    }

    it('asks the table for a save a description on the sheet calls for, as held', async () => {
      given()

      await expect(createRollRequest(character, linked)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.sheetText.findUnique).toHaveBeenCalledWith({
        where: { campaignHash: { campaignId: 'c1', hash: TEXTS.secondWind } },
        select: { html: true },
      })
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kind: 'ask', payload: linked }),
        select: { id: true },
      })
    })

    it('counts the asks the game made or may yet make in the last minute, at most three', async () => {
      given()
      await createRollRequest(character, linked)

      expect(prismaMock.rollRequest.count).toHaveBeenCalledTimes(3)
      expect(prismaMock.rollRequest.count).toHaveBeenLastCalledWith({
        where: {
          characterId: 'char-1',
          kind: 'ask',
          status: { in: ['pending', 'claimed', 'done'] },
          createdAt: { gt: ago(60_000) },
        },
      })

      given({ asks: 3 })
      await expect(createRollRequest(character, linked)).resolves.toEqual({
        status: 429,
        reason: 'busy',
      })
      expect(prismaMock.rollRequest.create).toHaveBeenCalledTimes(1)
    })

    it('counts no asks for any other roll, and looks up no description for one without a link', async () => {
      given()
      await createRollRequest(character, {
        kind: 'save',
        key: 'dex',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [11] }],
      })

      expect(prismaMock.rollRequest.count).toHaveBeenCalledTimes(2)
      expect(prismaMock.sheetText.findUnique).not.toHaveBeenCalled()
      expect(prismaMock.rollRequest.create).toHaveBeenCalled()
    })

    it.each([
      ['a link in a secret', { link: 3 }, 'secret'],
      ['damage', { link: 1 }, 'link'],
      ['a link the description has not', { link: 9 }, 'link'],
      ['a description not on the sheet', { text: 'ffffffffffffff' }, 'gone'],
    ])('refuses to ask the table for %s', async (_name, fields, reason) => {
      given()

      await expect(
        createRollRequest(character, { ...linked, ...fields }),
      ).resolves.toEqual({ status: 422, reason })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it('refuses a link in a description not held here', async () => {
      given({ html: null })

      await expect(createRollRequest(character, linked)).resolves.toEqual({
        status: 422,
        reason: 'gone',
      })
    })

    it("rolls a player's own save a description calls for with an ability it names", async () => {
      const save: RollRequestInput = {
        ...linked,
        kind: 'save',
        key: 'dex',
        dice: [{ faces: 20, results: [11] }],
      }
      given()
      await expect(createRollRequest(character, save)).resolves.toEqual({
        id: 'req-1',
      })

      given()
      await expect(
        createRollRequest(character, { ...save, key: 'str' }),
      ).resolves.toEqual({ status: 422, reason: 'link' })
    })

    it('asks the table for a check a description calls for', async () => {
      given()

      await expect(
        createRollRequest(character, { ...linked, link: 4 }),
      ).resolves.toEqual({ id: 'req-1' })
    })

    it("rolls a player's own check a description calls for, one of its ways, a tool the character hasn't too", async () => {
      const check: RollRequestInput = {
        ...linked,
        kind: 'skill',
        key: 'ath',
        link: 4,
        dice: [{ faces: 20, results: [11] }],
      }
      given()
      await expect(createRollRequest(character, check)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kind: 'skill', payload: check }),
        select: { id: true },
      })

      given()
      await expect(
        createRollRequest(character, { ...check, kind: 'tool', key: 'thief' }),
      ).resolves.toEqual({ id: 'req-1' })

      given()
      await expect(
        createRollRequest(character, { ...check, key: 'prc' }),
      ).resolves.toEqual({ status: 422, reason: 'link' })

      given()
      await expect(
        createRollRequest(character, { ...check, kind: 'ability', key: 'str' }),
      ).resolves.toEqual({ status: 422, reason: 'link' })
    })

    it("rolls a description's damage and roll with the dice their formulas throw", async () => {
      const textDamage: RollRequestInput = {
        ...linked,
        kind: 'textDamage',
        link: 1,
        dice: [
          { faces: 6, results: [2, 5] },
          { faces: 4, results: [3] },
        ],
        types: ['cold'],
      }
      given()
      await expect(createRollRequest(character, textDamage)).resolves.toEqual({
        id: 'req-1',
      })

      given()
      await expect(
        createRollRequest(character, { ...textDamage, types: ['acid'] }),
      ).resolves.toEqual({ status: 422, reason: 'type' })

      const textRoll: RollRequestInput = {
        ...linked,
        kind: 'textRoll',
        link: 2,
        dice: [{ faces: 6, results: [4] }],
      }
      given()
      await expect(createRollRequest(character, textRoll)).resolves.toEqual({
        id: 'req-1',
      })

      given()
      await expect(
        createRollRequest(character, { ...textRoll, dice: [] }),
      ).resolves.toEqual({ status: 422, reason: 'dice' })
    })

    it("rolls a description's damage changed, where the game takes it so, and as a critical hit's, as the sheet says the world makes one", async () => {
      /** A sheet from module 0.19.0, whose world doubles a critical hit's dice. */
      const sheet = {
        ...fullerSheet(),
        critical: {
          perDie: 2,
          multiplyNumeric: false,
          powerfulCritical: false,
          altered: false,
        },
      }
      const critical: RollRequestInput = {
        ...linked,
        kind: 'textDamage',
        link: 1,
        critical: true,
        modifiers: { extra: 1, maximize: true },
        dice: [
          { faces: 6, results: [6, 6, 6, 6, 6, 6] },
          { faces: 4, results: [4, 4] },
        ],
      }
      given({ features: ['modifiers'], sheet })
      await expect(createRollRequest(character, critical)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          kind: 'textDamage',
          payload: critical,
        }),
        select: { id: true },
      })

      // Changed, only where the game takes damage changed.
      given({ sheet })
      await expect(createRollRequest(character, critical)).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })

      // A critical hit's alone, where it doesn't.
      const plain = {
        ...critical,
        modifiers: undefined,
        dice: [
          { faces: 6, results: [1, 2, 3, 4] },
          { faces: 4, results: [1, 2] },
        ],
      }
      given({ sheet })
      await expect(createRollRequest(character, plain)).resolves.toEqual({
        id: 'req-1',
      })

      // Not with the dice its world doesn't throw.
      given({ sheet })
      await expect(
        createRollRequest(character, {
          ...plain,
          dice: [
            { faces: 6, results: [1, 2] },
            { faces: 4, results: [1] },
          ],
        }),
      ).resolves.toEqual({ status: 422, reason: 'dice' })

      // Nor where the sheet, from before module 0.19.0, doesn't say how it makes one, nor
      // takes it changed.
      given({ features: ['modifiers'] })
      await expect(createRollRequest(character, plain)).resolves.toEqual({
        status: 422,
        reason: 'dice',
      })
      given({ features: ['modifiers'] })
      await expect(
        createRollRequest(character, {
          ...linked,
          kind: 'textDamage',
          link: 1,
          modifiers: { maximize: true },
          dice: [
            { faces: 6, results: [6, 6] },
            { faces: 4, results: [4] },
          ],
        }),
      ).resolves.toEqual({ status: 422, reason: 'unavailable' })
    })

    it('refuses a link the game does not take', async () => {
      given()
      prismaMock.campaign.findUnique.mockResolvedValue(takingRolls as any)

      await expect(createRollRequest(character, linked)).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })
    })
  })

  describe('recordCommandResult', () => {
    beforeEach(() => {
      prismaMock.rollRequest.updateMany.mockResolvedValue({ count: 1 })
    })

    it("records what became of a fetched roll of the campaign's", async () => {
      const result = {
        id: 'req-1',
        status: 'done' as const,
        reason: null,
        error: null,
        messageId: 'msg-1',
        visible: true,
        rolls: [],
      }
      await recordCommandResult('c1', result)

      // Made after all, once the module said it took too long, it counts too.
      expect(prismaMock.rollRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'req-1',
          campaignId: 'c1',
          OR: [
            { status: 'claimed' },
            {
              status: 'failed',
              result: { path: ['reason'], equals: 'timeout' },
            },
          ],
        },
        data: { status: 'done', result, completedAt: new Date(NOW) },
      })
    })

    it('records a roll that failed only while it was still to be answered', async () => {
      const result = {
        id: 'req-1',
        status: 'failed' as const,
        reason: 'timeout',
        error: null,
        messageId: null,
        visible: false,
        rolls: [],
      }
      await recordCommandResult('c1', result)

      expect(prismaMock.rollRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'req-1', campaignId: 'c1', OR: [{ status: 'claimed' }] },
        data: { status: 'failed', result, completedAt: new Date(NOW) },
      })
      // Nothing it answered is closed: it may be answered again.
      expect(prismaMock.rollPrompt.updateMany).not.toHaveBeenCalled()
    })

    describe('of a save answering what the game asked', () => {
      const result = {
        id: 'req-1',
        status: 'done' as const,
        reason: null,
        error: null,
        messageId: 'msg-2',
        visible: true,
        rolls: [],
        outcome: 'failure' as const,
      }
      beforeEach(() => {
        prismaMock.rollRequest.findFirst.mockResolvedValue({
          payload: { kind: 'save', key: 'dex', prompt: 'msg1-thorin' },
        } as any)
      })

      it("closes the prompt it answered, telling its player's page", async () => {
        prismaMock.rollPrompt.updateMany.mockResolvedValue({ count: 1 })

        await recordCommandResult('c1', result)

        expect(prismaMock.rollRequest.findFirst).toHaveBeenCalledWith({
          where: { id: 'req-1', campaignId: 'c1' },
          select: { payload: true },
        })
        expect(prismaMock.rollPrompt.updateMany).toHaveBeenCalledWith({
          where: { campaignId: 'c1', promptId: 'msg1-thorin', closedAt: null },
          data: { closedAt: new Date(NOW), closedReason: 'answered' },
        })
        expect(prismaMock.campaign.update).toHaveBeenCalledWith({
          where: { id: 'c1' },
          data: { version: { increment: 1 } },
        })
      })

      it('closes a prompt the game said no longer waits, as it said, and only once', async () => {
        prismaMock.rollPrompt.updateMany.mockResolvedValue({ count: 0 })

        await recordCommandResult('c1', {
          ...result,
          status: 'failed',
          reason: 'prompt',
          error: 'expired',
          outcome: null,
        })

        expect(prismaMock.rollPrompt.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { closedAt: new Date(NOW), closedReason: 'expired' },
          }),
        )
        // The module said so already: its page has been told.
        expect(prismaMock.campaign.update).not.toHaveBeenCalled()
      })

      it("changes nothing for a result it didn't record", async () => {
        prismaMock.rollRequest.updateMany.mockResolvedValue({ count: 0 })

        await recordCommandResult('c1', result)

        expect(prismaMock.rollRequest.findFirst).not.toHaveBeenCalled()
        expect(prismaMock.rollPrompt.updateMany).not.toHaveBeenCalled()
      })
    })
  })

  describe('markBridgePolled', () => {
    it('notes the fetch, and tells whether players are about', async () => {
      prismaMock.campaign.update.mockResolvedValue({
        rollsEnabled: true,
        playersSeenAt: ago(60_000),
      } as any)

      await expect(markBridgePolled('c1')).resolves.toEqual({
        rollsEnabled: true,
        playersPresent: true,
      })
      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { bridgePolledAt: new Date(NOW), lastSeenAt: new Date(NOW) },
        select: { rollsEnabled: true, playersSeenAt: true },
      })
    })

    it.each([
      ['none has been', null],
      ['none has been for two minutes', ago(120_000)],
    ])('tells players are away when %s', async (_name, playersSeenAt) => {
      prismaMock.campaign.update.mockResolvedValue({
        rollsEnabled: false,
        playersSeenAt,
      } as any)

      await expect(markBridgePolled('c1')).resolves.toEqual({
        rollsEnabled: false,
        playersPresent: false,
      })
    })
  })

  describe('notePlayersSeen', () => {
    it('notes players present at most once every half minute', async () => {
      await notePlayersSeen('c-seen')
      expect(prismaMock.campaign.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'c-seen',
          OR: [{ playersSeenAt: null }, { playersSeenAt: { lt: ago(30_000) } }],
        },
        data: { playersSeenAt: new Date(NOW) },
      })

      jest.setSystemTime(NOW + 29_000)
      await notePlayersSeen('c-seen')
      expect(prismaMock.campaign.updateMany).toHaveBeenCalledTimes(1)

      await notePlayersSeen('c-other')
      expect(prismaMock.campaign.updateMany).toHaveBeenCalledTimes(2)

      jest.setSystemTime(NOW + 30_000)
      await notePlayersSeen('c-seen')
      expect(prismaMock.campaign.updateMany).toHaveBeenCalledTimes(3)
    })
  })
})
