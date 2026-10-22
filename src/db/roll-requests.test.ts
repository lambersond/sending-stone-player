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
  noteTableOpen,
  openActorIds,
  recordCommandResult,
} from './roll-requests'
import { playerSeat } from './seats'
import { sanitizeSheetHtml } from '@/lib/sheet-html'
import {
  characterSheet,
  chargingSheet,
  checkingSheet,
  combat,
  combatant,
  fullerSheet,
  sheetAction,
  TEXTS,
  typingRosterEntry,
} from '@/mocks/sending-stone'
import { toCommand } from '@/utils/roll-requests'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'

const NOW = Date.parse('2026-10-09T20:00:00Z')

/** A death save held, the Gamemaster's as the character (#156) or its player's. */
const heldAs = (role: 'gm' | 'player') =>
  prismaMock.rollRequest.findFirst.mockResolvedValue({
    payload: { kind: 'death' },
    role,
  } as any)
const ago = (ms: number) => new Date(NOW - ms)

/** Thorin's player at his sheet. */
const character = playerSeat(
  {
    id: 'char-1',
    name: 'Thorin Oakenshield',
    gameUrl: 'https://my-game.forge-vtt.com',
    campaignTitle: 'The Lonely Mountain',
    campaignId: 'c1',
    actorId: 'actor-thorin',
  },
  'user-1',
)

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

/**
 * A campaign whose game takes Rook's checks and uses, doing what else is given with them, and
 * holds his sheet, from module 0.21.0.
 */
const givenRook = (features: string[]) => {
  prismaMock.campaign.findUnique.mockResolvedValue({
    ...takingRolls,
    rollKinds: ['skill', 'tool', 'ability', 'use'],
    rollFeatures: features,
  } as any)
  prismaMock.actorSheet.findUnique.mockResolvedValue({
    data: checkingSheet(),
  } as any)
  prismaMock.rollRequest.count.mockResolvedValue(0)
  prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-1' } as any)
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
          characters: true,
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
          role: 'player',
          requestedById: 'user-1',
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

      await expect(getRollRequestView(character, 'req-1')).resolves.toEqual({
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
        getRollRequestView(character, 'req-9'),
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
          // No move of items and coins, from module 0.31.0, nor removal, from module 0.33.0, to a
          // session not known to take them.
          OR: [{ role: 'player', kind: { notIn: ['transfer', 'remove'] } }],
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
        rollKinds: ['save', 'ability', 'skill'],
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
      // Either seat's answers: its player's or the Gamemaster's (#156).
      expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          actorId: 'actor-thorin',
          kind: { in: ['save', 'ability', 'skill'] },
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

    describe('of what Midi-QOL asks (module 0.27.0)', () => {
      /** Midi-QOL asks Thorin for Athletics or Stealth to escape a web, with advantage on his. */
      const web = asked({
        data: {
          type: 'skill',
          abilities: [],
          skills: ['ath', 'ste'],
          dc: 12,
          label: 'Web',
          messageId: 'k3y',
          source: 'overtime',
          advantage: { ath: 'adv' },
          askedInFoundry: false,
        },
      })
      const athletics: RollRequestInput = {
        kind: 'skill',
        key: 'ath',
        mode: 1,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [3, 17] }],
        prompt: 'k3y-thorin',
      }
      /** And a Strength check, as a turn's effect may ask for. */
      const strength = asked({
        data: {
          type: 'check',
          abilities: ['str'],
          dc: null,
          label: 'Grappled',
          messageId: 'k4y',
          source: 'overtime',
        },
      })

      it('takes a skill or ability check of the kind it asks for, with a choice it offers', async () => {
        given({ prompt: web })
        await expect(createRollRequest(character, athletics)).resolves.toEqual({
          id: 'req-1',
        })

        given({ prompt: strength })
        await expect(
          createRollRequest(character, {
            ...athletics,
            kind: 'ability',
            key: 'str',
            mode: 0,
            dice: [{ faces: 20, results: [9] }],
            prompt: 'k4y-thorin',
          }),
        ).resolves.toEqual({ id: 'req-1' })
      })

      it.each<[string, Partial<RollRequestInput>]>([
        ['a skill it does not offer', { key: 'prc' }],
        ['another kind of roll', { kind: 'ability', key: 'str' }],
        ['a saving throw', { kind: 'save', key: 'str' }],
        [
          'one rolled as the player chose',
          { explicit: true, mode: -1, dice: [{ faces: 20, results: [3, 17] }] },
        ],
        [
          'one with something added',
          {
            extras: [{ sign: 1, count: 1, sides: 4 }],
            dice: [
              { faces: 20, results: [3, 17] },
              { faces: 4, results: [2] },
            ],
          },
        ],
      ])(
        'refuses %s, as Midi-QOL decides how it is rolled',
        async (_, fields) => {
          given({ prompt: web })

          await expect(
            createRollRequest(character, { ...athletics, ...fields }),
          ).resolves.toEqual({ status: 422, reason: 'prompt' })
          expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
        },
      )

      it('refuses a saving throw answering an ability check Midi-QOL asked for, of the ability it offers', async () => {
        given({ prompt: strength })

        await expect(
          createRollRequest(character, {
            ...athletics,
            kind: 'save',
            key: 'str',
            mode: 0,
            dice: [{ faces: 20, results: [9] }],
            prompt: 'k4y-thorin',
          }),
        ).resolves.toEqual({ status: 422, reason: 'prompt' })
      })

      it('refuses an ability check answering a save the game asked for, as before', async () => {
        given()

        await expect(
          createRollRequest(character, { ...answer, kind: 'ability' }),
        ).resolves.toEqual({ status: 422, reason: 'prompt' })
      })
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

    /** Two d10 hit dice spent at once, from module 0.20.0. */
    const hitDice: RollRequestInput = {
      kind: 'hitDice',
      hitDice: [{ denomination: 'd10', count: 2 }],
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 10, results: [6, 2] }],
    }

    it('takes hit dice spent at once, as many of a size as are left, where the game takes them so', async () => {
      given({ kinds: ['hitDie', 'hitDice'] })

      await expect(createRollRequest(character, hitDice)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.combat.findMany).not.toHaveBeenCalled()
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kind: 'hitDice', payload: hitDice }),
        select: { id: true },
      })
    })

    it('refuses hit dice spent at once where the game takes only a hit die a request, or more of a size than are left', async () => {
      given({ kinds: ['attack', 'hitDie', 'formula'] })
      await expect(createRollRequest(character, hitDice)).resolves.toEqual({
        status: 409,
        reason: 'unavailable',
      })

      // Thorin's Fighter levels have 3 of their 5 d10s left.
      given({ kinds: ['hitDie', 'hitDice'] })
      await expect(
        createRollRequest(character, {
          ...hitDice,
          hitDice: [{ denomination: 'd10', count: 4 }],
          dice: [{ faces: 10, results: [6, 2, 1, 1] }],
        }),
      ).resolves.toEqual({ status: 422, reason: 'no-hit-dice' })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })

    it.each([
      ['nineteen', 19, { id: 'req-1' }],
      ['twenty', 20, { status: 429, reason: 'busy' }],
    ])(
      'counts hit dice spent at once one roll toward the minute, with %s made in it before',
      async (_name, lastMinute, taken) => {
        given({ kinds: ['hitDie', 'hitDice'] })
        prismaMock.rollRequest.count.mockReset()
        prismaMock.rollRequest.count
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(lastMinute)

        await expect(
          createRollRequest(character, {
            ...hitDice,
            hitDice: [{ denomination: 'd10', count: 3 }],
            dice: [{ faces: 10, results: [6, 2, 1] }],
          }),
        ).resolves.toEqual(taken)
      },
    )

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

    it("changes a description's damage that takes a die away only where the game changes the die it adds, from module 0.21.0", async () => {
      /** Withering Touch's 3 - 1d4 + 2d6, as held. */
      const withering = sanitizeSheetHtml(
        '<p>It deals <span class="ss-damage roll" data-n="0" data-formulas="3 - 1d4 + 2d6" data-types="necrotic">3 - 1d4 + 2d6</span> damage.</p>',
        'https://my-game.forge-vtt.com',
      )
      const sheet = {
        ...fullerSheet(),
        critical: {
          perDie: 2,
          multiplyNumeric: false,
          powerfulCritical: false,
          altered: false,
        },
      }
      const more: RollRequestInput = {
        ...linked,
        kind: 'textDamage',
        link: 0,
        modifiers: { extra: 1 },
        dice: [
          { faces: 4, results: [2] },
          { faces: 6, results: [3, 4, 5] },
        ],
      }
      // A module before 0.21.0 would throw a d4 more, and less damage.
      given({ html: withering, features: ['modifiers'], sheet })
      await expect(createRollRequest(character, more)).resolves.toEqual({
        status: 422,
        reason: 'dice',
      })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()

      given({ html: withering, features: ['modifiers', 'signedDice'], sheet })
      await expect(createRollRequest(character, more)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kind: 'textDamage', payload: more }),
        select: { id: true },
      })
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

  describe('createRollRequest, for a check an activity asks for, from module 0.21.0', () => {
    /** Thieves' Tools' Pick a Lock, Rook's own to make. */
    const lock: RollRequestInput = {
      kind: 'tool',
      key: 'thief',
      item: 'tools',
      activity: 'pick',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 20, results: [9] }],
    }

    it('takes it where the game makes it against the activity', async () => {
      givenRook(['activityChecks'])

      await expect(createRollRequest(character, lock)).resolves.toEqual({
        id: 'req-1',
      })
      expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kind: 'tool', payload: lock }),
        select: { id: true },
      })
    })

    it("refuses it, without looking further, where the game doesn't make it so, but not a plain check", async () => {
      givenRook(['modifiers', 'prompts', 'areaAttacks'])

      for (const input of [
        lock,
        { ...lock, kind: 'skill' as const, key: 'slt', activity: 'fh-slt' },
        { ...lock, kind: 'ability' as const, key: 'dex' },
      ]) {
        await expect(createRollRequest(character, input)).resolves.toEqual({
          status: 409,
          reason: 'unavailable',
        })
      }
      expect(prismaMock.actorSheet.findUnique).not.toHaveBeenCalled()
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()

      await expect(
        createRollRequest(character, {
          ...lock,
          item: undefined,
          activity: undefined,
        }),
      ).resolves.toEqual({ id: 'req-1' })
    })

    it('refuses one the activity has no such way to make, as the sheet says', async () => {
      givenRook(['activityChecks'])

      await expect(
        createRollRequest(character, { ...lock, kind: 'skill', key: 'slt' }),
      ).resolves.toEqual({ status: 422, reason: 'unknown' })
      expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
    })
  })

  describe('recordCommandResult', () => {
    beforeEach(() => {
      prismaMock.rollRequest.updateMany.mockResolvedValue({ count: 1 })
    })

    describe('a note command’s, from module 0.34.0', () => {
      const WRITE = '7d2c3f5e-1b0a-4c8e-9f6d-2a1b3c4d5e6f'
      const noteResult = {
        id: `${WRITE}.2`,
        status: 'done' as const,
        reason: null,
        error: null,
        messageId: null,
        visible: false,
        rolls: [],
        note: { id: 'goblinCaveNote01', rev: null },
      }

      beforeEach(() => {
        prismaMock.rollRequest.updateMany.mockResolvedValue({ count: 0 })
        prismaMock.$transaction.mockImplementation((run: any) =>
          run(prismaMock),
        )
        prismaMock.journalWrite.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.journalWrite.findUnique.mockResolvedValue({
          id: WRITE,
          bookId: 'book-1',
          noteId: 'goblinCaveNote01',
          op: 'update',
        } as any)
      })

      it('is no roll: it reaches the change handed over under its id and number', async () => {
        await recordCommandResult('c1', noteResult)

        expect(prismaMock.journalWrite.updateMany).toHaveBeenCalledWith({
          where: { id: WRITE, seq: 2, campaignId: 'c1', status: 'claimed' },
          data: { status: 'made', reason: null },
        })
        expect(prismaMock.rollRequest.findFirst).not.toHaveBeenCalled()
      })

      it('leaves notes alone for a roll answered already, whose id names no change', async () => {
        await recordCommandResult('c1', { ...noteResult, id: 'req-1' })

        expect(prismaMock.journalWrite.updateMany).not.toHaveBeenCalled()
      })
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

    it('records hit dice the game spent some of before it stopped, once the module had said they took too long, as made after all', async () => {
      const result = {
        id: 'req-1',
        status: 'failed' as const,
        reason: 'timeout',
        error: null,
        messageId: 'msg-1',
        visible: true,
        rolls: [],
        healed: 9,
        spent: { count: 3, made: 1 },
      }
      await recordCommandResult('c1', result)

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
        data: { status: 'failed', result, completedAt: new Date(NOW) },
      })
      // It answered nothing the game asked.
      expect(prismaMock.rollRequest.findFirst).not.toHaveBeenCalled()
    })

    it('records hit dice the game spent none of only while they were still to be answered', async () => {
      const result = {
        id: 'req-1',
        status: 'failed' as const,
        reason: 'full-hp',
        error: null,
        messageId: null,
        visible: false,
        rolls: [],
        spent: { count: 3, made: 0 },
      }
      await recordCommandResult('c1', result)

      expect(prismaMock.rollRequest.updateMany).toHaveBeenCalledWith({
        where: { id: 'req-1', campaignId: 'c1', OR: [{ status: 'claimed' }] },
        data: { status: 'failed', result, completedAt: new Date(NOW) },
      })
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
          select: { payload: true, role: true },
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

    describe("of the Gamemaster's roll as a character, listing the messages it made (module 0.25.0)", () => {
      const result = {
        id: 'req-gm',
        status: 'done' as const,
        reason: null,
        error: null,
        messageId: 'm-roll',
        visible: true,
        rolls: [],
        messages: ['m-roll', 'm-outcome'],
      }

      it("marks those of the campaign's messages held already as the Gamemaster's, telling its pages", async () => {
        heldAs('gm')
        prismaMock.chatMessage.updateMany.mockResolvedValue({ count: 2 })

        await recordCommandResult('c1', result)

        expect(prismaMock.chatMessage.updateMany).toHaveBeenCalledWith({
          where: {
            campaignId: 'c1',
            messageId: { in: ['m-roll', 'm-outcome'] },
            byGm: false,
          },
          data: { byGm: true },
        })
        expect(prismaMock.campaign.update).toHaveBeenCalledWith({
          where: { id: 'c1' },
          data: { version: { increment: 1 } },
        })
      })

      it('leaves its pages be where none was held, or all were marked already', async () => {
        heldAs('gm')
        prismaMock.chatMessage.updateMany.mockResolvedValue({ count: 0 })

        await recordCommandResult('c1', { ...result, status: 'failed' })

        expect(prismaMock.chatMessage.updateMany).toHaveBeenCalled()
        expect(prismaMock.campaign.update).not.toHaveBeenCalled()
      })

      it("never marks a player's roll's, whatever its result lists", async () => {
        heldAs('player')

        await recordCommandResult('c1', result)

        expect(prismaMock.chatMessage.updateMany).not.toHaveBeenCalled()
        expect(prismaMock.campaign.update).not.toHaveBeenCalled()
      })

      it("marks nothing for a result it didn't record, as a second answer", async () => {
        heldAs('gm')
        prismaMock.rollRequest.updateMany.mockResolvedValue({ count: 0 })

        await recordCommandResult('c1', result)

        expect(prismaMock.chatMessage.updateMany).not.toHaveBeenCalled()
      })

      it('looks nothing up for a roll that made none', async () => {
        heldAs('gm')

        await recordCommandResult('c1', {
          ...result,
          status: 'failed',
          messages: [],
        })

        expect(prismaMock.rollRequest.findFirst).not.toHaveBeenCalled()
        expect(prismaMock.chatMessage.updateMany).not.toHaveBeenCalled()
      })
    })
  })

  describe('markBridgePolled', () => {
    it('tells whether the game keeps journal notes, from module 0.34.0, with rolls, moves and removals off', async () => {
      prismaMock.campaign.update.mockResolvedValue({
        rollsEnabled: false,
        transfersEnabled: false,
        removalsEnabled: false,
        notesEnabled: true,
        playersSeenAt: null,
      } as any)

      await expect(markBridgePolled('c1')).resolves.toEqual({
        rollsEnabled: false,
        transfersEnabled: false,
        removalsEnabled: false,
        notesEnabled: true,
        playersPresent: false,
      })
    })

    it('notes the fetch, and tells whether players are about', async () => {
      prismaMock.campaign.update.mockResolvedValue({
        rollsEnabled: true,
        transfersEnabled: false,
        removalsEnabled: false,
        notesEnabled: false,
        playersSeenAt: ago(60_000),
      } as any)

      await expect(markBridgePolled('c1')).resolves.toEqual({
        rollsEnabled: true,
        transfersEnabled: false,
        removalsEnabled: false,
        notesEnabled: false,
        playersPresent: true,
      })
      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { bridgePolledAt: new Date(NOW), lastSeenAt: new Date(NOW) },
        select: {
          rollsEnabled: true,
          transfersEnabled: true,
          removalsEnabled: true,
          notesEnabled: true,
          playersSeenAt: true,
        },
      })
    })

    it('tells whether the game removes characters’ items, from module 0.33.0, with rolls and moves off', async () => {
      prismaMock.campaign.update.mockResolvedValue({
        rollsEnabled: false,
        transfersEnabled: false,
        removalsEnabled: true,
        notesEnabled: false,
        playersSeenAt: null,
      } as any)

      await expect(markBridgePolled('c1')).resolves.toEqual({
        rollsEnabled: false,
        transfersEnabled: false,
        removalsEnabled: true,
        notesEnabled: false,
        playersPresent: false,
      })
    })

    it('tells whether the campaign takes moves of items and coins, from module 0.31.0, with rolls off', async () => {
      prismaMock.campaign.update.mockResolvedValue({
        rollsEnabled: false,
        transfersEnabled: true,
        removalsEnabled: false,
        notesEnabled: false,
        playersSeenAt: null,
      } as any)

      await expect(markBridgePolled('c1')).resolves.toEqual({
        rollsEnabled: false,
        transfersEnabled: true,
        removalsEnabled: false,
        notesEnabled: false,
        playersPresent: false,
      })
    })

    it.each([
      ['none has been', null],
      ['none has been for two minutes', ago(120_000)],
    ])('tells players are away when %s', async (_name, playersSeenAt) => {
      prismaMock.campaign.update.mockResolvedValue({
        rollsEnabled: false,
        transfersEnabled: false,
        removalsEnabled: false,
        notesEnabled: false,
        playersSeenAt,
      } as any)

      await expect(markBridgePolled('c1')).resolves.toEqual({
        rollsEnabled: false,
        transfersEnabled: false,
        removalsEnabled: false,
        notesEnabled: false,
        playersPresent: false,
      })
    })
  })

  describe('noteTableOpen', () => {
    it("notes a character's table open at most once every five seconds, in the database", async () => {
      await noteTableOpen('char-seen')
      expect(prismaMock.character.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'char-seen',
          OR: [{ tableSeenAt: null }, { tableSeenAt: { lt: ago(5000) } }],
        },
        data: { tableSeenAt: new Date(NOW) },
      })

      jest.setSystemTime(NOW + 4900)
      await noteTableOpen('char-seen')
      expect(prismaMock.character.updateMany).toHaveBeenCalledTimes(1)

      await noteTableOpen('char-other')
      expect(prismaMock.character.updateMany).toHaveBeenCalledTimes(2)

      jest.setSystemTime(NOW + 5000)
      await noteTableOpen('char-seen')
      expect(prismaMock.character.updateMany).toHaveBeenCalledTimes(3)
      expect(prismaMock.character.updateMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: { tableSeenAt: new Date(NOW + 5000) },
        }),
      )
    })
  })

  describe('openActorIds', () => {
    it('lists the actors of the characters whose tables were open in the last fifteen seconds, once each', async () => {
      // Each as the module names actors, which it reads back; none it would drop.
      prismaMock.character.findMany.mockResolvedValue([
        { actorId: 'balin' },
        { actorId: 'thorin' },
        { actorId: 'thorin' },
        { actorId: 'actor-dwalin' },
        { actorId: null },
      ] as any)

      await expect(openActorIds('c1')).resolves.toEqual(['balin', 'thorin'])
      expect(prismaMock.character.findMany).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          actorId: { not: null },
          tableSeenAt: { gt: ago(15_000) },
        },
        orderBy: { actorId: 'asc' },
        take: 200,
        select: { actorId: true },
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

/** The campaign's Gamemaster at Thorin's sheet, rolling as him (#156). */
const gm = (fields: Partial<SheetSeat> = {}): SheetSeat => ({
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
  role: 'gm',
  userId: 'gm-1',
  characterId: null,
  ...fields,
})
/** What the Gamemaster's rolls as Thorin are found by, here. */
const gmMade = {
  campaignId: 'c1',
  actorId: 'actor-thorin',
  role: 'gm',
  requestedById: 'gm-1',
}

/**
 * A campaign whose game takes skill checks, attacks and saves, and the Gamemaster's, or not; with
 * the rolls counted for a seat as `counts` has them.
 */
const givenGm = ({
  features = ['gmRolls'] as string[],
  counts = (): number => 0,
}: { features?: string[]; counts?: (where: any) => number } = {}) => {
  prismaMock.campaign.findUnique.mockResolvedValue({
    ...takingRolls,
    rollKinds: [...takingRolls.rollKinds, 'save', 'endEnchantment'],
    rollFeatures: features,
  } as any)
  prismaMock.actorSheet.findUnique.mockResolvedValue({
    data: fullerSheet(),
  } as any)
  prismaMock.rollRequest.count.mockImplementation(((args: any) =>
    Promise.resolve(counts(args.where))) as any)
  prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-gm' } as any)
}
/** The rolls on their way, as counted for whichever seat a count names. */
const inFlight = (where: any) => (where.OR ? 3 : 0)

/** Mocks with nothing queued from earlier tests, which only clear what they were called with. */
const fresh = () => {
  for (const mock of [
    prismaMock.campaign.findUnique,
    prismaMock.actorSheet.findUnique,
    prismaMock.rollPrompt.findUnique,
    prismaMock.rollRequest.count,
    prismaMock.rollRequest.findFirst,
    prismaMock.rollRequest.findMany,
    prismaMock.rollRequest.create,
    prismaMock.rollRequest.deleteMany,
  ]) {
    mock.mockReset()
  }
}

describe("db/roll-requests, the Gamemaster's rolls as a character (#156)", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    fresh()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("takes the Gamemaster's roll as the character, by them, with no character of their own, counting and pruning only theirs", async () => {
    givenGm()

    await expect(createRollRequest(gm(), perception)).resolves.toEqual({
      id: 'req-gm',
    })
    expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
      data: {
        campaignId: 'c1',
        characterId: null,
        role: 'gm',
        requestedById: 'gm-1',
        actorId: 'actor-thorin',
        kind: 'skill',
        payload: perception,
        createdAt: new Date(NOW),
      },
      select: { id: true },
    })
    for (const [args] of prismaMock.rollRequest.count.mock.calls) {
      expect(args?.where).toMatchObject(gmMade)
      expect(args?.where).not.toHaveProperty('characterId')
    }
    expect(prismaMock.rollRequest.deleteMany).toHaveBeenCalledWith({
      where: { ...gmMade, createdAt: { lt: ago(86_400_000) } },
    })
  })

  it("keeps what the Gamemaster's page calls a roll, for its player to be shown it by, and never sends it to the game", async () => {
    givenGm()

    await createRollRequest(gm(), { ...perception, label: 'Perception check' })

    expect(prismaMock.rollRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: 'gm',
        label: 'Perception check',
        payload: perception,
      }),
      select: { id: true },
    })
    const { data } = prismaMock.rollRequest.create.mock.calls[0][0]
    expect(data.payload).not.toHaveProperty('label')
  })

  it("keeps no name a player's page sends for a roll, which nothing shows", async () => {
    givenGm()

    await createRollRequest(character, { ...perception, label: 'Mine' })

    const { data } = prismaMock.rollRequest.create.mock.calls[0][0]
    expect(data).not.toHaveProperty('label')
    expect(data.payload).toEqual(perception)
  })

  it("is refused while the game doesn't make the Gamemaster's rolls, and for ending an enchantment, before anything else", async () => {
    givenGm({ features: ['prompts', 'modifiers'] })
    await expect(createRollRequest(gm(), perception)).resolves.toEqual({
      status: 409,
      reason: 'unavailable',
    })

    givenGm()
    await expect(
      createRollRequest(gm(), {
        kind: 'endEnchantment',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
        enchantment: { item: 'club', effect: 'magicWeapon00001' },
      } as RollRequestInput),
    ).resolves.toEqual({ status: 409, reason: 'unavailable' })
    expect(prismaMock.rollRequest.count).not.toHaveBeenCalled()
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })

  it("keeps each seat's limits apart, both ways", async () => {
    // The player has three rolls on their way: the Gamemaster still rolls.
    givenGm({
      counts: where => (where.characterId === 'char-1' ? inFlight(where) : 0),
    })
    await expect(createRollRequest(character, perception)).resolves.toEqual({
      status: 429,
      reason: 'busy',
    })
    await expect(createRollRequest(gm(), perception)).resolves.toEqual({
      id: 'req-gm',
    })

    // The Gamemaster has three: the player still rolls.
    givenGm({
      counts: where => (where.role === 'gm' ? inFlight(where) : 0),
    })
    await expect(createRollRequest(gm(), perception)).resolves.toEqual({
      status: 429,
      reason: 'busy',
    })
    await expect(createRollRequest(character, perception)).resolves.toEqual({
      id: 'req-gm',
    })
  })

  it('keeps two Gamemasters of two campaigns with the same actor apart, in counts, views and prunes', async () => {
    const other = gm({ campaignId: 'c2', userId: 'gm-2' })
    // The first has three on their way.
    givenGm({
      counts: where =>
        where.campaignId === 'c1' && where.requestedById === 'gm-1'
          ? inFlight(where)
          : 0,
    })
    await expect(createRollRequest(gm(), perception)).resolves.toEqual({
      status: 429,
      reason: 'busy',
    })
    await expect(createRollRequest(other, perception)).resolves.toEqual({
      id: 'req-gm',
    })
    expect(prismaMock.rollRequest.deleteMany).toHaveBeenCalledWith({
      where: {
        campaignId: 'c2',
        actorId: 'actor-thorin',
        role: 'gm',
        requestedById: 'gm-2',
        createdAt: { lt: ago(86_400_000) },
      },
    })

    prismaMock.rollRequest.findFirst.mockResolvedValue(null)
    await expect(getRollRequestView(other, 'req-gm')).resolves.toBeUndefined()
    expect(prismaMock.rollRequest.findFirst).toHaveBeenLastCalledWith({
      where: {
        id: 'req-gm',
        campaignId: 'c2',
        actorId: 'actor-thorin',
        role: 'gm',
        requestedById: 'gm-2',
      },
      select: expect.objectContaining({ role: true, status: true }),
    })
  })

  it("rolls damage only after the seat's own attack: never the player's", async () => {
    givenGm()
    // An attack is found only where the seat's own rolls are looked for.
    const attacks = (owner: object) =>
      prismaMock.rollRequest.findFirst.mockImplementation((({ where }: any) =>
        Promise.resolve(
          Object.entries(owner).every(([key, value]) => where[key] === value)
            ? madeSwing()
            : null,
        )) as any)
    prismaMock.rollRequest.findMany.mockResolvedValue([])

    attacks({ characterId: 'char-1' })
    await expect(createRollRequest(gm(), smash)).resolves.toEqual({
      status: 422,
      reason: 'gone',
    })

    attacks(gmMade)
    await expect(createRollRequest(gm(), smash)).resolves.toEqual({
      id: 'req-gm',
    })
    expect(prismaMock.rollRequest.findMany).toHaveBeenCalledWith({
      where: { useId: 'req-0', ...gmMade },
      select: { status: true, createdAt: true, claimedAt: true },
    })
    // And the player's damage never follows the Gamemaster's attack.
    await expect(createRollRequest(character, smash)).resolves.toEqual({
      status: 422,
      reason: 'gone',
    })
  })

  it('answers a prompt once, from either seat: the second answer is refused', async () => {
    const answer: RollRequestInput = {
      kind: 'save',
      key: 'dex',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 20, results: [12] }],
      prompt: 'msg1-thorin',
    }
    const answered = [
      { status: 'done', createdAt: ago(5000), claimedAt: ago(4000) },
    ]
    for (const [first, second] of [
      [gm(), character],
      [character, gm()],
    ] as const) {
      givenGm({ features: ['gmRolls', 'prompts'] })
      prismaMock.rollPrompt.findUnique.mockResolvedValue(asked() as any)
      // The first seat's answer, made: found for the second, whichever it is.
      prismaMock.rollRequest.findMany.mockResolvedValue([])
      await expect(createRollRequest(first, answer)).resolves.toEqual({
        id: 'req-gm',
      })
      prismaMock.rollRequest.findMany.mockResolvedValue(answered as any)
      await expect(createRollRequest(second, answer)).resolves.toEqual({
        status: 422,
        reason: 'prompt',
      })
      for (const [args] of prismaMock.rollRequest.findMany.mock.calls) {
        expect(args?.where).toEqual({
          campaignId: 'c1',
          actorId: 'actor-thorin',
          kind: { in: ['save', 'ability', 'skill'] },
          payload: { path: ['prompt'], equals: 'msg1-thorin' },
        })
      }
      prismaMock.rollRequest.findMany.mockClear()
    }
  })

  it("hands the module the Gamemaster's roll saying it's theirs, and a player's exactly as before", async () => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      helloSession: 'session-1',
      rollFeatures: ['gmRolls'],
      ownerId: 'gm-1',
    } as any)
    prismaMock.rollRequest.findMany
      .mockResolvedValueOnce([{ id: 'req-1' }, { id: 'req-2' }] as any)
      .mockResolvedValueOnce([
        held('req-1', { role: 'player' }),
        held('req-2', { role: 'gm' }),
      ] as any)

    const commands = await claimRollRequests('c1', 'session-1')
    expect(commands).toEqual([
      { ...perception, id: 'req-1', actorId: 'actor-thorin' },
      { ...perception, id: 'req-2', actorId: 'actor-thorin', by: 'gm' },
    ])
    expect(commands[0]).not.toHaveProperty('by')
  })
})

describe("db/roll-requests, handing over the Gamemaster's rolls (#156)", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    fresh()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  /** Waiting rolls, as held: ten older ones of the Gamemaster's, then a player's. */
  const waiting: {
    id: string
    campaignId: string
    status: string
    role: string
    requestedById: string
    createdAt: Date
    kind?: string
  }[] = [
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `gm-${index}`,
      campaignId: 'c1',
      status: 'pending',
      role: 'gm',
      requestedById: 'gm-1',
      createdAt: ago(20_000 - index),
    })),
    {
      id: 'player-1',
      campaignId: 'c1',
      status: 'pending',
      role: 'player',
      requestedById: 'user-1',
      createdAt: ago(1000),
    },
  ]
  /** Whether a row is one a `where` asks for, as far as a fetch's asks. */
  const matches = (row: (typeof waiting)[number], where: any): boolean =>
    Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === 'OR') return value.some((each: any) => matches(row, each))
      if (key === 'createdAt') return row.createdAt > value.gt
      if (key === 'id') return value.in.includes(row.id)
      if (key === 'claimToken') return true
      if (key === 'kind' && typeof value === 'object') {
        return !value.notIn.includes(row.kind ?? 'skill')
      }
      if (key === 'kind') return (row.kind ?? 'skill') === value
      return (row as any)[key] === value
    })
  /** A fetch for this session, from a campaign as given, and what it took, in order. */
  const fetched = async (
    campaign: object,
    session = 'session-1',
    rows: ((typeof waiting)[number] & { kind?: string })[] = waiting,
  ): Promise<string[]> => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)
    prismaMock.rollRequest.findMany.mockImplementation((({
      where,
      take,
    }: any) =>
      Promise.resolve(
        rows
          .filter(row => matches(row, where))
          .slice(0, take)
          .map(row => held(row.id, { role: row.role })),
      )) as any)
    const commands = await claimRollRequests('c1', session)
    return commands.map(({ id }) => id)
  }
  const ready = {
    helloSession: 'session-1',
    rollFeatures: ['gmRolls'],
    ownerId: 'gm-1',
  }

  it("takes only players' rolls while the game doesn't make the Gamemaster's, leaving theirs waiting", async () => {
    await expect(
      fetched({ ...ready, rollFeatures: ['prompts'] }),
    ).resolves.toEqual(['player-1'])
  })

  it("takes the Gamemaster's only for the session whose hello said it makes them", async () => {
    await expect(fetched(ready, 'session-old')).resolves.toEqual(['player-1'])
    await expect(fetched(ready)).resolves.toEqual(
      waiting.slice(0, 10).map(({ id }) => id),
    )
  })

  it("takes the Gamemaster's only when its owner sent them, and none of an ownerless campaign", async () => {
    await expect(fetched({ ...ready, ownerId: 'gm-2' })).resolves.toEqual([
      'player-1',
    ])
    await expect(fetched({ ...ready, ownerId: null })).resolves.toEqual([
      'player-1',
    ])
    await expect(fetched(null as unknown as object)).resolves.toEqual([
      'player-1',
    ])
  })
})

describe('db/roll-requests, handing over moves of items and coins, from module 0.31.0', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    fresh()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  /** Waiting, as held: a player's roll and move, and the Gamemaster's roll and moves. */
  const waiting = [
    {
      id: 'roll-player',
      role: 'player',
      requestedById: 'user-1',
      kind: 'skill',
    },
    {
      id: 'move-player',
      role: 'player',
      requestedById: 'user-1',
      kind: 'transfer',
    },
    { id: 'roll-gm', role: 'gm', requestedById: 'gm-1', kind: 'skill' },
    { id: 'move-gm', role: 'gm', requestedById: 'gm-1', kind: 'transfer' },
    {
      id: 'move-other-gm',
      role: 'gm',
      requestedById: 'gm-2',
      kind: 'transfer',
    },
  ].map((row, index) => ({
    ...row,
    campaignId: 'c1',
    status: 'pending',
    createdAt: ago(5000 - index),
  }))
  /** Whether a row is one a `where` asks for, as far as a fetch's asks. */
  const matches = (row: (typeof waiting)[number], where: any): boolean =>
    Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === 'OR') return value.some((each: any) => matches(row, each))
      if (key === 'createdAt') return row.createdAt > value.gt
      if (key === 'kind' && typeof value === 'object')
        return !value.notIn.includes(row.kind)
      return (row as any)[key] === value
    })
  /** What a fetch for this session takes, from a campaign as given. */
  const fetched = async (campaign: object | null, session = 'session-1') => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)
    prismaMock.rollRequest.findMany.mockImplementation((({ where }: any) =>
      Promise.resolve(
        where.claimToken
          ? waiting
              .filter(row => where.id.in.includes(row.id))
              .map(row => held(row.id, { role: row.role }))
          : waiting
              .filter(row => matches(row, where))
              .map(({ id }) => ({ id })),
      )) as any)
    const commands = await claimRollRequests('c1', session)
    return commands.map(({ id }) => id)
  }
  /** Moves on, rolls off: the module sends gmRolls only while rolls are on. */
  const moving = {
    helloSession: 'session-1',
    rollFeatures: [],
    ownerId: 'gm-1',
    transfersEnabled: true,
  }

  it("hands the Gamemaster's move over with rolls off, needing no gmRolls, and only its owner's", async () => {
    await expect(fetched(moving)).resolves.toEqual([
      'roll-player',
      'move-player',
      'move-gm',
    ])
  })

  it("still withholds the Gamemaster's rolls without gmRolls, and hands them over with it as before", async () => {
    await expect(
      fetched({ ...moving, rollFeatures: ['gmRolls'] }),
    ).resolves.toEqual(['roll-player', 'move-player', 'roll-gm', 'move-gm'])
    await expect(
      fetched({
        ...moving,
        rollFeatures: ['gmRolls'],
        transfersEnabled: false,
      }),
    ).resolves.toEqual(['roll-player', 'roll-gm'])
  })

  it('hands no move to a session whose hello said nothing of them, nor while the campaign takes none', async () => {
    await expect(fetched(moving, 'session-old')).resolves.toEqual([
      'roll-player',
    ])
    await expect(
      fetched({ ...moving, transfersEnabled: false }),
    ).resolves.toEqual(['roll-player'])
    await expect(fetched({ ...moving, ownerId: null })).resolves.toEqual([
      'roll-player',
      'move-player',
    ])
    await expect(fetched(null)).resolves.toEqual(['roll-player'])
  })

  it('hands every move over as the module is sent it, the Gamemaster’s saying so', async () => {
    const move = {
      kind: 'transfer',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
      transfer: {
        from: 'company',
        to: 'actor-thorin',
        items: [{ id: 'rope', quantity: 1 }],
      },
    }
    prismaMock.campaign.findUnique.mockResolvedValue(moving as any)
    prismaMock.rollRequest.findMany
      .mockResolvedValueOnce([{ id: 'move-gm' }] as any)
      .mockResolvedValueOnce([
        held('move-gm', { role: 'gm', kind: 'transfer', payload: move }),
      ] as any)

    await expect(claimRollRequests('c1', 'session-1')).resolves.toEqual([
      { ...move, id: 'move-gm', actorId: 'actor-thorin', by: 'gm' },
    ])
  })
})

/** A game that takes each, holding Ember's sheet, whose Gamemaster's rolls it makes. */
const givenEmber = () => {
  prismaMock.campaign.findUnique.mockResolvedValue({
    ...takingRolls,
    rollKinds: ['skill', 'endConcentration', 'spend', 'inspiration'],
    rollFeatures: ['gmRolls'],
  } as any)
  prismaMock.actorSheet.findUnique.mockResolvedValue({
    data: chargingSheet({ inspiration: true }),
  } as any)
  prismaMock.rollRequest.count.mockResolvedValue(0)
  prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-1' } as any)
}

describe('db/roll-requests, concentration, charges and Heroic Inspiration, from module 0.29.0', () => {
  const plain = { mode: 0 as const, explicit: false, extras: [], dice: [] }
  const ending = {
    kind: 'endConcentration',
    ...plain,
    concentration: { effect: 'concBless0001' },
  } as RollRequestInput
  const spending = {
    kind: 'spend',
    ...plain,
    counter: { item: 'sorcery' },
    count: 2,
  } as RollRequestInput
  const inspiring = {
    kind: 'inspiration',
    ...plain,
    inspiration: 'use',
  } as RollRequestInput

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    fresh()
    givenEmber()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it.each([
    ['a concentration ended', ending],
    ['charges spent', spending],
    ['Heroic Inspiration used', inspiring],
  ])("takes the player's %s, as the sheet allows it", async (_name, input) => {
    await expect(createRollRequest(character, input)).resolves.toEqual({
      id: 'req-1',
    })
  })

  it("refuses the player's, where the sheet doesn't allow it, saying why", async () => {
    await expect(
      createRollRequest(character, { ...spending, count: 9 }),
    ).resolves.toEqual({ status: 422, reason: 'short' })
    await expect(
      createRollRequest(character, {
        ...ending,
        concentration: { effect: 'concHex000001' },
      }),
    ).resolves.toEqual({ status: 422, reason: 'concentration' })
    await expect(
      createRollRequest(character, { ...inspiring, inspiration: 'gain' }),
    ).resolves.toEqual({ status: 422, reason: 'inspired' })
  })

  it("takes the Gamemaster's charges spent and Heroic Inspiration, which post a line marked theirs, but never a concentration ended, which posts none", async () => {
    await expect(createRollRequest(gm(), spending)).resolves.toEqual({
      id: 'req-1',
    })
    await expect(createRollRequest(gm(), inspiring)).resolves.toEqual({
      id: 'req-1',
    })
    prismaMock.rollRequest.count.mockClear()
    prismaMock.rollRequest.create.mockClear()

    await expect(createRollRequest(gm(), ending)).resolves.toEqual({
      status: 409,
      reason: 'unavailable',
    })
    expect(prismaMock.rollRequest.count).not.toHaveBeenCalled()
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })
})

/** What was stored to send the game, as the module is sent it. */
const stored = () => {
  const [[{ data }]] = prismaMock.rollRequest.create.mock.calls as any
  return data.payload
}

describe('db/roll-requests, dice typed in, from module 0.32.0', () => {
  const typed = { ...perception, typed: true as const }
  const inspiring = {
    kind: 'inspiration',
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
    inspiration: 'use',
    typed: true,
  } as RollRequestInput

  /** A game that lets players type in their dice, and Thorin's player, as it said last. */
  const givenTyping = ({
    features = ['manualDice', 'gmRolls'] as string[],
    characters = [typingRosterEntry({ id: 'actor-thorin' })] as object[],
    polled = 5000,
  } = {}) => {
    prismaMock.campaign.findUnique.mockResolvedValue({
      ...takingRolls,
      rollKinds: [...takingRolls.rollKinds, 'inspiration'],
      rollFeatures: features,
      bridgePolledAt: ago(polled),
      characters,
    } as any)
    prismaMock.actorSheet.findUnique.mockResolvedValue({
      data: chargingSheet({ inspiration: true }),
    } as any)
    prismaMock.rollRequest.count.mockResolvedValue(0)
    prismaMock.rollRequest.create.mockResolvedValue({ id: 'req-1' } as any)
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    fresh()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('marks the dice typed in where the player may type theirs, as the game said last', async () => {
    givenTyping()

    await expect(createRollRequest(character, typed)).resolves.toEqual({
      id: 'req-1',
    })
    expect(stored()).toEqual(typed)
    expect(
      toCommand({
        id: 'req-1',
        actorId: 'actor-thorin',
        role: 'player',
        kind: 'skill',
        payload: stored(),
        status: 'pending',
        result: null,
        createdAt: ago(0),
        claimedAt: null,
      }),
    ).toEqual({ ...typed, id: 'req-1', actorId: 'actor-thorin' })
  })

  it.each<[string, Parameters<typeof givenTyping>[0], SheetSeat?]>([
    ['the Gamemaster', {}, gm()],
    ["a game that doesn't let players", { features: ['gmRolls'] }],
    [
      'a character whose player may not',
      {
        characters: [
          typingRosterEntry({ id: 'actor-thorin', manualDice: false }),
        ],
      },
    ],
    [
      'a character the game no longer lists',
      { characters: [typingRosterEntry({ id: 'actor-vex' })] },
    ],
  ])(
    'takes the same dice unmarked from %s, refusing nothing',
    async (_name, given, seat = character) => {
      givenTyping(given)

      await expect(createRollRequest(seat, typed)).resolves.toEqual({
        id: 'req-1',
      })
      expect(stored()).toEqual(perception)
      expect(stored()).not.toHaveProperty('typed')
    },
  )

  it('never marks what throws no dice', async () => {
    givenTyping()

    await expect(createRollRequest(character, inspiring)).resolves.toEqual({
      id: 'req-1',
    })
    expect(stored()).not.toHaveProperty('typed')
  })

  it('reads whether the player may from what the game said last, not when its module last polled; the roll itself still needs it', async () => {
    givenTyping({ polled: 40_000 })
    await expect(createRollRequest(character, typed)).resolves.toEqual({
      id: 'req-1',
    })
    expect(stored()).toEqual(typed)

    fresh()
    givenTyping({ polled: 120_000 })
    await expect(createRollRequest(character, typed)).resolves.toEqual({
      status: 409,
      reason: 'unavailable',
    })
    expect(prismaMock.rollRequest.create).not.toHaveBeenCalled()
  })
})

describe('db/roll-requests, handing over removals of items, from module 0.33.0', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    fresh()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  /** Waiting, as held: a player's roll, move and removal, and the Gamemaster's roll and removal. */
  const waiting = [
    {
      id: 'roll-player',
      role: 'player',
      requestedById: 'user-1',
      kind: 'skill',
    },
    {
      id: 'move-player',
      role: 'player',
      requestedById: 'user-1',
      kind: 'transfer',
    },
    {
      id: 'remove-player',
      role: 'player',
      requestedById: 'user-1',
      kind: 'remove',
    },
    { id: 'roll-gm', role: 'gm', requestedById: 'gm-1', kind: 'skill' },
    { id: 'remove-gm', role: 'gm', requestedById: 'gm-1', kind: 'remove' },
    {
      id: 'remove-other-gm',
      role: 'gm',
      requestedById: 'gm-2',
      kind: 'remove',
    },
  ].map((row, index) => ({
    ...row,
    campaignId: 'c1',
    status: 'pending',
    createdAt: ago(5000 - index),
  }))
  /** Whether a row is one a `where` asks for, as far as a fetch's asks. */
  const matches = (row: (typeof waiting)[number], where: any): boolean =>
    Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === 'OR') return value.some((each: any) => matches(row, each))
      if (key === 'createdAt') return row.createdAt > value.gt
      if (key === 'kind' && typeof value === 'object')
        return !value.notIn.includes(row.kind)
      return (row as any)[key] === value
    })
  /** What a fetch for this session takes, from a campaign as given. */
  const fetched = async (campaign: object | null, session = 'session-1') => {
    prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)
    prismaMock.rollRequest.findMany.mockImplementation((({ where }: any) =>
      Promise.resolve(
        where.claimToken
          ? waiting
              .filter(row => where.id.in.includes(row.id))
              .map(row => held(row.id, { role: row.role }))
          : waiting
              .filter(row => matches(row, where))
              .map(({ id }) => ({ id })),
      )) as any)
    const commands = await claimRollRequests('c1', session)
    return commands.map(({ id }) => id)
  }
  /** Removals taken, rolls and moves off: the module sends gmRolls only while rolls are on. */
  const removing = {
    helloSession: 'session-1',
    rollFeatures: [],
    ownerId: 'gm-1',
    transfersEnabled: false,
    removalsEnabled: true,
  }

  it("hands a removal over only to the hello's session, the Gamemaster's needing no gmRolls, and only its owner's", async () => {
    await expect(fetched(removing)).resolves.toEqual([
      'roll-player',
      'remove-player',
      'remove-gm',
    ])
    await expect(fetched(removing, 'session-old')).resolves.toEqual([
      'roll-player',
    ])
  })

  it('withholds every removal while the game takes none, with moves on or off', async () => {
    await expect(
      fetched({ ...removing, removalsEnabled: false }),
    ).resolves.toEqual(['roll-player'])
    await expect(
      fetched({ ...removing, removalsEnabled: false, transfersEnabled: true }),
    ).resolves.toEqual(['roll-player', 'move-player'])
    await expect(fetched(null)).resolves.toEqual(['roll-player'])
  })

  it("still hands moves over as before, and never a removal as one of the Gamemaster's rolls", async () => {
    await expect(
      fetched({ ...removing, transfersEnabled: true }),
    ).resolves.toEqual([
      'roll-player',
      'move-player',
      'remove-player',
      'remove-gm',
    ])
    await expect(
      fetched({
        ...removing,
        rollFeatures: ['gmRolls'],
        removalsEnabled: false,
      }),
    ).resolves.toEqual(['roll-player', 'roll-gm'])
    await expect(
      fetched({ ...removing, rollFeatures: ['gmRolls'] }),
    ).resolves.toEqual(['roll-player', 'remove-player', 'roll-gm', 'remove-gm'])
  })

  it('hands a removal over as the module is sent it, the Gamemaster’s saying so', async () => {
    const removal = {
      kind: 'remove',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
      remove: { item: 'rope', quantity: 1, held: 1 },
    }
    prismaMock.campaign.findUnique.mockResolvedValue(removing as any)
    prismaMock.rollRequest.findMany
      .mockResolvedValueOnce([{ id: 'remove-gm' }] as any)
      .mockResolvedValueOnce([
        held('remove-gm', { role: 'gm', kind: 'remove', payload: removal }),
      ] as any)

    await expect(claimRollRequests('c1', 'session-1')).resolves.toEqual([
      { ...removal, id: 'remove-gm', actorId: 'actor-thorin', by: 'gm' },
    ])
  })
})
