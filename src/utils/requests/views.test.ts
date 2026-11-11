import { GM_UNSENT } from './commands'
import { toGmRollView, toRollRequestView } from './views'
import { aloneResult } from '@/mocks/sending-stone'
import type { HeldRollRequest } from './types'
import type { RollRequestInput } from '@/types/roll'
import type { CommandResult, DamagePreview } from '@/types/sending-stone'

const NOW = Date.parse('2026-10-09T20:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)

const request = (fields: Partial<RollRequestInput>): RollRequestInput => ({
  kind: 'skill',
  key: 'prc',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
  ...fields,
})

const held = (fields: Partial<HeldRollRequest> = {}): HeldRollRequest => ({
  id: 'req-1',
  actorId: 'actor-thorin',
  role: 'player',
  kind: 'skill',
  payload: request({}),
  status: 'pending',
  result: null,
  createdAt: ago(1000),
  claimedAt: null,
  ...fields,
})

/** A part of damage the game made, totalling this, or saying no total. */
const damagePart = (total: number | null) => ({
  formula: '1d8 + 4',
  total,
  dice: [{ faces: 8, results: [{ result: 5, active: true }] }],
})

/** A part of damage the game made, totalling this, of this type. */
const typedPart = (total: number, damageType: string) => ({
  ...damagePart(total),
  damageType,
})

/** A part of damage as its player is shown it, of `damagePart`, every key as it always was. */
const shownPart = (total: number, damageType?: string) => ({
  formula: '1d8 + 4',
  total,
  dice: [{ faces: 8, value: 5, active: true }],
  advantage: false,
  disadvantage: false,
  critical: false,
  fumble: false,
  damageType,
})

/** A save answering what the game asked, made, as its player is told of it. */
const answered = (outcome: 'success' | 'failure' | null) =>
  toRollRequestView(
    held({
      kind: 'save',
      status: 'done',
      result: {
        id: 'req-1',
        status: 'done',
        reason: null,
        error: null,
        messageId: 'msg-1',
        visible: true,
        rolls: [
          {
            formula: '1d20 + 4',
            total: 18,
            dice: [{ faces: 20, results: [{ result: 14, active: true }] }],
          },
        ],
        outcome,
      },
    }),
    NOW,
  )

/** A hit die spent, as its player is told of it, giving back this many hit points. */
const spent = (visible: boolean, healed?: number | null) =>
  toRollRequestView(
    held({
      kind: 'hitDie',
      status: 'done',
      result: {
        id: 'req-1',
        status: 'done',
        reason: null,
        error: null,
        messageId: 'msg-1',
        visible,
        rolls: visible
          ? [
              {
                formula: '1d10 + 3',
                total: 9,
                dice: [{ faces: 10, results: [{ result: 6, active: true }] }],
              },
            ]
          : [],
        healed,
      },
    }),
    NOW,
  )

/** A hit die's roll, as the game made it, giving back this many. */
const hitDieRoll = (total: number) => ({
  formula: '1d10 + 3',
  total,
  dice: [{ faces: 10, results: [{ result: total - 3, active: true }] }],
})

/**
 * Hit dice spent at once, as their player is told of them, from module 0.20.0: of three, as many
 * as the game made, each giving back this many, and why it stopped, if it did.
 */
const spentAtOnce = (
  visible: boolean,
  made: number,
  reason: string | null = null,
) =>
  toRollRequestView(
    held({
      kind: 'hitDice',
      status: made === 3 ? 'done' : 'failed',
      result: {
        id: 'req-1',
        status: made === 3 ? 'done' : 'failed',
        reason,
        error: null,
        messageId: made > 0 ? `msg-${made}` : null,
        visible,
        rolls: visible
          ? [9, 5, 8].slice(0, made).map(total => hitDieRoll(total))
          : [],
        ...(made > 0 && {
          healed: [9, 5, 6].slice(0, made).reduce((a, b) => a + b, 0),
        }),
        spent: { count: 3, made },
      },
    }),
    NOW,
  )

const favorited = (fields: Partial<CommandResult>, status: 'done' | 'failed') =>
  toRollRequestView(
    held({
      kind: 'favorite',
      status,
      claimedAt: ago(500),
      result: {
        id: 'req-1',
        status,
        reason: null,
        error: null,
        messageId: null,
        visible: true,
        rolls: [],
        ...fields,
      },
    }),
    NOW,
  )

const changed = (fields: Partial<CommandResult>, status: 'done' | 'failed') =>
  toRollRequestView(
    held({
      kind: 'effect',
      status,
      claimedAt: ago(500),
      result: {
        id: 'req-1',
        status,
        reason: null,
        error: null,
        messageId: null,
        visible: true,
        rolls: [],
        ...fields,
      },
    }),
    NOW,
  )

const shapeChanged = (
  fields: Partial<CommandResult>,
  status: 'done' | 'failed',
) =>
  toRollRequestView(
    held({
      kind: 'wildShape',
      status,
      claimedAt: ago(500),
      result: {
        id: 'req-1',
        status,
        reason: null,
        error: null,
        messageId: null,
        visible: true,
        rolls: [],
        ...fields,
      },
    }),
    NOW,
  )

describe('utils/roll-requests', () => {
  describe('toRollRequestView', () => {
    const summary = {
      formula: '1d20 + 4',
      total: 18,
      dice: [{ faces: 20, results: [{ result: 14, active: true }] }],
    }

    it("shows the game's roll and total once made", () => {
      expect(
        toRollRequestView(
          held({
            status: 'done',
            result: {
              id: 'req-1',
              status: 'done',
              reason: null,
              error: null,
              messageId: 'msg-1',
              visible: true,
              rolls: [summary],
            },
          }),
          NOW,
        ),
      ).toEqual({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: 18,
        rolls: [
          {
            formula: '1d20 + 4',
            total: 18,
            dice: [{ faces: 20, value: 14, active: true }],
            advantage: false,
            disadvantage: false,
            critical: false,
            fumble: false,
            damageType: undefined,
          },
        ],
      })
    })

    it('shows whether a save the game asked for succeeded, where the game shows its player', () => {
      expect(answered('success')).toMatchObject({
        total: 18,
        outcome: 'success',
      })
      expect(answered('failure')).toMatchObject({ outcome: 'failure' })
      expect(answered(null)).not.toHaveProperty('outcome')
    })

    it('shows an answer to what Midi-QOL asked that made no card, as its dice are the player’s own (module 0.27.0)', () => {
      const view = toRollRequestView(
        held({
          kind: 'skill',
          status: 'done',
          result: {
            id: 'req-1',
            status: 'done',
            reason: null,
            error: null,
            messageId: null,
            visible: true,
            rolls: [
              {
                formula: '2d20kh + 7',
                total: 24,
                dice: [
                  {
                    faces: 20,
                    results: [
                      { result: 17, active: true },
                      { result: 4, active: false },
                    ],
                  },
                ],
              },
            ],
            outcome: 'success',
          },
        }),
        NOW,
      )
      expect(view).toMatchObject({
        status: 'done',
        visible: true,
        total: 24,
        outcome: 'success',
      })
      expect(view.rolls).toHaveLength(1)
      expect(view).not.toHaveProperty('card')
    })

    it('shows the hit points a hit die gave back in the game, where the game shows its player', () => {
      expect(spent(true, 9)).toMatchObject({ total: 9, healed: 9 })
      // Spent at full hit points, it gives back none.
      expect(spent(true, 0)).toMatchObject({ total: 9, healed: 0 })
      expect(spent(true, null)).not.toHaveProperty('healed')
      expect(spent(true)).not.toHaveProperty('healed')
      expect(spent(false, 9)).toEqual({
        id: 'req-1',
        status: 'done',
        visible: false,
      })
    })

    it('keeps a roll the game made blind from its player', () => {
      expect(
        toRollRequestView(
          held({
            status: 'done',
            result: {
              id: 'req-1',
              status: 'done',
              reason: null,
              error: null,
              messageId: 'msg-1',
              visible: false,
              rolls: [],
            },
          }),
          NOW,
        ),
      ).toEqual({ id: 'req-1', status: 'done', visible: false })
    })

    it("says why a roll wasn't made, and where one stands until it is", () => {
      expect(
        toRollRequestView(
          held({
            status: 'failed',
            result: { id: 'req-1', status: 'failed', reason: 'not-dying' },
          }),
          NOW,
        ),
      ).toEqual({ id: 'req-1', status: 'failed', reason: 'not-dying' })
      expect(toRollRequestView(held({ status: 'failed' }), NOW)).toEqual({
        id: 'req-1',
        status: 'failed',
        reason: undefined,
      })
      expect(toRollRequestView(held(), NOW)).toEqual({
        id: 'req-1',
        status: 'sending',
      })
      expect(toRollRequestView(held({ status: 'done' }), NOW)).toEqual({
        id: 'req-1',
        status: 'done',
      })
    })
  })

  describe('toRollRequestView for a typed roll the game asks later dice of, from module 0.44.0', () => {
    const claimed = held({ status: 'claimed', claimedAt: ago(90_000) })
    it.each([
      [
        'held 20 s, one waiting: rolling, waiting on its dice',
        { held: 20_000, waiting: true },
        { id: 'req-1', status: 'rolling', diceAsked: true },
      ],
      [
        'held 20 s, none waiting now: rolling',
        { held: 20_000, waiting: false },
        { id: 'req-1', status: 'rolling' },
      ],
      [
        'held 10 s: lost, past its time, never said to wait',
        { held: 10_000, waiting: true },
        { id: 'req-1', status: 'lost' },
      ],
    ])('a roll fetched 90 s ago, %s', (_, asks, view) => {
      expect(toRollRequestView(claimed, NOW, asks)).toEqual(view)
    })
  })

  describe('toRollRequestView for a move of items and coins, from module 0.31.0', () => {
    const transfer = {
      from: 'groupIronCo01',
      to: 'actorThorin1',
      items: [
        {
          id: 'potionHeal01',
          quantity: 2,
          created: null,
          stacked: 'pot0Thorin01',
        },
      ],
      currency: null,
    }
    const moved = (fields: Partial<CommandResult>, status: 'done' | 'failed') =>
      toRollRequestView(
        held({
          kind: 'transfer',
          status,
          claimedAt: ago(500),
          result: {
            id: 'req-1',
            status,
            reason: null,
            error: null,
            messageId: 'm-line',
            visible: true,
            rolls: [],
            transfer,
            ...fields,
          },
        }),
        NOW,
      )

    it('passes on what moved, once made, seen or not', () => {
      expect(moved({}, 'done')).toEqual({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: undefined,
        rolls: [],
        transfer,
      })
      expect(moved({ visible: false }, 'done')).toEqual({
        id: 'req-1',
        status: 'done',
        visible: false,
        transfer,
      })
    })

    it('passes on what moved before it failed, and none where nothing did', () => {
      expect(
        moved({ status: 'failed', reason: 'error', error: 'boom' }, 'failed'),
      ).toEqual({ id: 'req-1', status: 'failed', reason: 'error', transfer })
      expect(
        moved(
          { status: 'failed', reason: 'gone', transfer: undefined },
          'failed',
        ),
      ).toEqual({ id: 'req-1', status: 'failed', reason: 'gone' })
    })
  })

  describe('toRollRequestView for a favorite added or removed, from module 0.37.0', () => {
    it('passes on whether it is one of the favorites now, as the game says', () => {
      expect(favorited({ favorited: true }, 'done')).toEqual({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: undefined,
        rolls: [],
        favorited: true,
      })
      expect(favorited({ favorited: false }, 'done')).toMatchObject({
        status: 'done',
        favorited: false,
      })
    })

    it('says nothing of it where the game said nothing, as a refusal says nothing', () => {
      expect(favorited({}, 'done')).not.toHaveProperty('favorited')
      expect(favorited({ status: 'failed', reason: 'gone' }, 'failed')).toEqual(
        { id: 'req-1', status: 'failed', reason: 'gone' },
      )
    })
  })

  describe('toRollRequestView for an effect turned off, on or deleted, from module 0.39.0', () => {
    it('passes on what became of the effect, as the game says', () => {
      const off = { id: 'blessed', disabled: true, deleted: false }
      expect(changed({ effect: off }, 'done')).toEqual({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: undefined,
        rolls: [],
        effect: off,
      })
      const gone = { id: 'blessed', disabled: null, deleted: true }
      expect(changed({ effect: gone }, 'done')).toMatchObject({
        status: 'done',
        effect: gone,
      })
    })

    it('says nothing of it where the game said nothing, as a refusal says nothing', () => {
      expect(changed({}, 'done')).not.toHaveProperty('effect')
      expect(changed({ effect: null }, 'done')).not.toHaveProperty('effect')
      expect(
        changed({ status: 'failed', reason: 'cancelled' }, 'failed'),
      ).toEqual({ id: 'req-1', status: 'failed', reason: 'cancelled' })
      expect(changed({ status: 'failed', reason: 'effect' }, 'failed')).toEqual(
        { id: 'req-1', status: 'failed', reason: 'effect' },
      )
    })
  })

  describe('toRollRequestView for Wild Shape, from module 0.40.0', () => {
    it('passes on the form taken, as the game says', () => {
      const wildShape = {
        op: 'transform' as const,
        form: {
          id: 'Kp3vQ8mZr2LdW0aB',
          name: 'Wolf',
          uuid: 'Compendium.dnd5e.actors24.Actor.mmWolf0000000000',
        },
        temp: 5,
        hours: 2,
      }
      expect(shapeChanged({ wildShape }, 'done')).toEqual({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: undefined,
        rolls: [],
        wildShape,
      })
    })

    it('passes on the form left, the form learned and the Beasts to learn, as the game says', () => {
      for (const wildShape of [
        { op: 'revert' as const, form: { name: 'Wolf' } },
        { op: 'revert' as const, form: null },
        {
          op: 'learn' as const,
          form: {
            id: 'Kp3vQ8mZr2LdW0aB',
            name: 'Riding Horse',
            uuid: 'Compendium.dnd5e.actors24.Actor.mmRidingHorse000',
          },
          replaced: { id: 'Kp3vQ8mZr2LdW0aB', name: 'Panther' },
        },
        {
          op: 'forms' as const,
          forms: [
            {
              uuid: 'Compendium.dnd5e.actors24.Actor.mmRat00000000000',
              name: 'Rat',
              img: null,
              size: 'Tiny',
              cr: 0,
              ac: 10,
              speeds: ['Walk 20 ft'],
              known: false,
            },
          ],
          more: false,
          limits: { count: 6, cr: 0.5, fly: false },
        },
      ]) {
        expect(shapeChanged({ wildShape }, 'done')).toMatchObject({
          status: 'done',
          wildShape,
        })
      }
    })

    it('says nothing of it where the game said nothing, and passes on a refusal’s reason', () => {
      expect(shapeChanged({}, 'done')).not.toHaveProperty('wildShape')
      expect(
        shapeChanged({ status: 'failed', reason: 'consume' }, 'failed'),
      ).toEqual({ id: 'req-1', status: 'failed', reason: 'consume' })
      for (const reason of [
        'form',
        'full',
        'swap',
        'incapacitated',
        'transformed',
        'shaped',
      ]) {
        expect(shapeChanged({ status: 'failed', reason }, 'failed')).toEqual({
          id: 'req-1',
          status: 'failed',
          reason,
        })
      }
    })
  })

  describe('toRollRequestView for hit points set, from module 0.44.0', () => {
    it('passes on the hit points the game says the actor has now, apart from any roll', () => {
      const hitPoints = { value: 21, temp: 0, max: 30 }
      expect(changed({ hitPoints }, 'done')).toEqual({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: undefined,
        rolls: [],
        hitPoints,
      })
    })

    it('says nothing of them on a refusal, which the game sends none with', () => {
      expect(
        changed({ status: 'failed', reason: 'changed' }, 'failed'),
      ).toEqual({ id: 'req-1', status: 'failed', reason: 'changed' })
    })
  })

  describe('toRollRequestView for hit dice spent at once, from module 0.20.0', () => {
    it('shows what every die the game made came to, added up, and gave back, and how many it made', () => {
      const view = spentAtOnce(true, 3)
      expect(view).toMatchObject({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: 22,
        healed: 20,
        spent: { count: 3, made: 3 },
      })
      expect(view.rolls).toHaveLength(3)
      expect(spentAtOnce(false, 3)).toEqual({
        id: 'req-1',
        status: 'done',
        visible: false,
      })
    })

    it('shows how many the game made before it stopped, what they came to and gave back, and why it stopped', () => {
      const view = spentAtOnce(true, 1, 'full-hp')
      expect(view).toEqual({
        id: 'req-1',
        status: 'failed',
        reason: 'full-hp',
        visible: true,
        total: 9,
        rolls: [expect.objectContaining({ formula: '1d10 + 3', total: 9 })],
        healed: 9,
        spent: { count: 3, made: 1 },
      })
    })

    it('shows how many the game made blind before it stopped, but not what they came to or gave back', () => {
      expect(spentAtOnce(false, 2, 'timeout')).toEqual({
        id: 'req-1',
        status: 'failed',
        reason: 'timeout',
        visible: false,
        spent: { count: 3, made: 2 },
      })
    })

    it('says only why, where the game made none of them', () => {
      expect(spentAtOnce(true, 0, 'full-hp')).toEqual({
        id: 'req-1',
        status: 'failed',
        reason: 'full-hp',
      })
    })
  })

  describe('toRollRequestView for attacks', () => {
    const preview: DamagePreview = {
      critical: true,
      plannable: true,
      rolls: [
        {
          formula: '2d8 + 4',
          type: 'bludgeoning',
          dice: [{ faces: 8, number: 2 }],
        },
      ],
    }
    const attackResult = (visible: boolean): CommandResult => ({
      id: 'req-1',
      status: 'done',
      reason: null,
      error: null,
      messageId: 'msg-1',
      visible,
      rolls: visible
        ? [
            {
              formula: '1d20 + 7',
              total: 27,
              dice: [{ faces: 20, results: [{ result: 20, active: true }] }],
            },
          ]
        : [],
      attack: { critical: true, fumble: false, outcome: 'hit' },
      damage: preview,
    })

    it('shows what came of an attack, and the dice its damage throws', () => {
      expect(
        toRollRequestView(
          held({ kind: 'attack', status: 'done', result: attackResult(true) }),
          NOW,
        ),
      ).toMatchObject({
        status: 'done',
        visible: true,
        total: 27,
        attack: { critical: true, fumble: false, outcome: 'hit' },
        damage: preview,
      })
    })

    it('gives the damage of an attack its player may not see, for them to roll it', () => {
      expect(
        toRollRequestView(
          held({ kind: 'attack', status: 'done', result: attackResult(false) }),
          NOW,
        ),
      ).toEqual({
        id: 'req-1',
        status: 'done',
        visible: false,
        damage: preview,
      })
    })

    it('says what kind of activity a use was, and the dice its healing throws, seen or not', () => {
      const used = (visible: boolean): CommandResult => ({
        ...attackResult(visible),
        rolls: [],
        attack: undefined,
        use: { type: 'heal' },
        damage: { ...preview, healing: true },
      })
      expect(
        toRollRequestView(
          held({ kind: 'use', status: 'done', result: used(true) }),
          NOW,
        ),
      ).toEqual({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: undefined,
        rolls: [],
        use: { type: 'heal' },
        damage: { ...preview, healing: true },
      })
      expect(
        toRollRequestView(
          held({ kind: 'use', status: 'done', result: used(false) }),
          NOW,
        ),
      ).toEqual({
        id: 'req-1',
        status: 'done',
        visible: false,
        use: { type: 'heal' },
        damage: { ...preview, healing: true },
      })
    })

    /** Damage the game made, with these rolls. */
    const madeDamage = (rolls: CommandResult['rolls']) =>
      held({
        kind: 'damage',
        status: 'done',
        result: {
          ...attackResult(true),
          attack: undefined,
          damage: undefined,
          rolls,
        },
      })

    /** The total of damage the game made of these parts, each a total and a type. */
    const typedTotal = (...parts: [number, string][]) =>
      toRollRequestView(
        madeDamage(parts.map(([total, type]) => typedPart(total, type))),
        NOW,
      ).total

    it("totals a description's damage's parts too", () => {
      expect(
        toRollRequestView(
          {
            ...madeDamage([damagePart(9), damagePart(7)]),
            kind: 'textDamage',
          },
          NOW,
        ),
      ).toMatchObject({ total: 16 })
    })

    it("totals damage as dnd5e's card does: each kind's parts together, each kind at least 0", () => {
      const part = (total: number, damageType: string) => ({
        ...damagePart(total),
        damageType,
      })
      const totalOf = (rolls: CommandResult['rolls'], kind = 'damage') =>
        toRollRequestView(
          { ...madeDamage(rolls), kind: kind as HeldRollRequest['kind'] },
          NOW,
        ).total
      expect(totalOf([part(-4, 'slashing')])).toBe(0)
      expect(totalOf([part(-4, 'slashing'), part(5, 'fire')])).toBe(5)
      expect(totalOf([part(-4, 'slashing'), part(5, 'slashing')])).toBe(1)
      expect(totalOf([part(-4, 'slashing')], 'textDamage')).toBe(0)
      // Each roll's own total stays the game's.
      expect(
        toRollRequestView(madeDamage([part(-4, 'slashing')]), NOW).rolls?.[0]
          .total,
      ).toBe(-4)
      // Hit dice's totals are added up as they are.
      expect(totalOf([damagePart(-3), damagePart(1)], 'hitDice')).toBe(-2)
    })

    it("shows the game's rolls as before, whatever marks module 0.28.0 adds to them", () => {
      // Every field a roll may carry from module 0.28.0, as a roll request is sent them.
      const marks = {
        class: 'DamageRoll',
        damage: true,
        damageLabel: 'Piercing',
        section: 'damage',
        flavor: 'Sneak Attack',
        attack: true,
      }
      const view = toRollRequestView(
        madeDamage([
          { ...damagePart(9), damageType: 'piercing', ...marks },
          { ...damagePart(-3), damageType: 'piercing', ...marks },
          { ...damagePart(7), ...marks, section: 'bonus' },
        ] as CommandResult['rolls']),
        NOW,
      )

      expect(view.total).toBe(13)
      expect(view.rolls).toStrictEqual([
        shownPart(9, 'piercing'),
        shownPart(-3, 'piercing'),
        shownPart(7),
      ])
      for (const roll of view.rolls ?? []) {
        expect(Object.keys(roll)).toEqual([
          'formula',
          'total',
          'dice',
          'advantage',
          'disadvantage',
          'critical',
          'fumble',
          'damageType',
        ])
      }
    })

    it("counts every kind in the table's total, as it always has: Midi-QOL's none and each pool of healing too", () => {
      expect(typedTotal([5, 'piercing'], [4, 'midi-none'])).toBe(9)
      expect(typedTotal([5, 'piercing'], [4, 'none'])).toBe(9)
      expect(typedTotal([11, 'healing'], [5, 'temphp'])).toBe(16)
      expect(typedTotal([11, 'healing'], [5, 'necrotic'])).toBe(16)
    })

    it("tells the Gamemaster's damage that only raises maximum hit points as healing", () => {
      const maximum = { ...damagePart(6), damageType: 'maximum' }
      const necrotic = { ...damagePart(6), damageType: 'necrotic' }

      expect(
        toGmRollView({ ...madeDamage([maximum]), label: null }, NOW),
      ).toMatchObject({ healing: true, total: 6 })
      expect(
        toGmRollView({ ...madeDamage([maximum, necrotic]), label: null }, NOW),
      ).not.toHaveProperty('healing')
    })

    it("totals damage's parts, when the game said each", () => {
      expect(
        toRollRequestView(madeDamage([damagePart(9), damagePart(7)]), NOW),
      ).toMatchObject({
        total: 16,
      })
      expect(
        toRollRequestView(madeDamage([damagePart(9), damagePart(null)]), NOW)
          .total,
      ).toBeUndefined()
      expect(toRollRequestView(madeDamage([]), NOW).total).toBeUndefined()
    })
  })
})

describe('utils/roll-requests for enchant activities, from module 0.21.0', () => {
  describe('toRollRequestView', () => {
    const outcome = {
      enchanted: {
        item: 'longsword',
        itemName: 'Longsword',
        effect: 'effect000000002',
        profile: 'SLSudYaACjmmmZsU',
        name: 'Magic Weapon, +1',
      },
      ended: null,
    }
    const done = (visible: boolean): CommandResult => ({
      id: 'req-1',
      status: 'done',
      reason: null,
      error: null,
      messageId: visible ? 'card-1' : null,
      visible,
      rolls: [],
      use: { type: 'enchant' },
      damage: null,
      enchantment: outcome,
    })

    it('says what an enchant activity applied and ended, seen or not', () => {
      for (const visible of [true, false]) {
        expect(
          toRollRequestView(
            held({ kind: 'use', status: 'done', result: done(visible) }),
          ),
        ).toEqual(
          expect.objectContaining({
            status: 'done',
            visible,
            use: { type: 'enchant' },
            enchantment: outcome,
          }),
        )
      }
    })

    it('says nothing of it for a use whose result has none, nor why one wasn’t made beyond its reason', () => {
      expect(
        toRollRequestView(
          held({
            kind: 'use',
            status: 'done',
            result: { ...done(true), enchantment: null },
          }),
        ),
      ).not.toHaveProperty('enchantment')
      expect(
        toRollRequestView(
          held({
            kind: 'use',
            status: 'failed',
            result: {
              ...done(true),
              status: 'failed',
              reason: 'enchant',
              enchantment: null,
            },
          }),
        ),
      ).toEqual({ id: 'req-1', status: 'failed', reason: 'enchant' })
    })

    it('says of one used whose card is gone from the game’s chat, or was never posted, that there is none', () => {
      const cases: [Partial<CommandResult>, Record<string, unknown>][] = [
        [{ reason: 'enchant' }, { reason: 'enchant', card: false }],
        [{ reason: 'midi' }, { reason: 'midi', card: false }],
        // Of any other use, nothing.
        [{ reason: 'consume', use: null }, { reason: 'consume' }],
      ]
      for (const [fields, view] of cases) {
        expect(
          toRollRequestView(
            held({
              kind: 'use',
              status: 'failed',
              result: {
                ...done(false),
                status: 'failed',
                enchantment: null,
                ...fields,
              },
            }),
          ),
        ).toEqual({ id: 'req-1', status: 'failed', ...view })
      }
    })
  })
})

/** What a request of the kinds from module 0.29.0 throws: nothing. */
const plain = { mode: 0, explicit: false, extras: [], dice: [] } as const

describe('utils/roll-requests for concentration, charges and Heroic Inspiration, from module 0.29.0', () => {
  it.each([
    ['endConcentration', 'Concentration ended'],
    ['spend', 'Charges spent'],
    ['inspiration', 'Heroic Inspiration'],
    // From module 0.31.0.
    ['transfer', 'Items or coins moved'],
    // From module 0.33.0.
    ['remove', 'An item removed'],
    // From module 0.36.0, though the Gamemaster never sends one.
    ['endTurn', 'A turn ended'],
    ['undoEndTurn', 'A turn taken back'],
  ])(
    "calls the Gamemaster's %s from a page that didn't say %p",
    (kind, label) => {
      expect(
        toGmRollView(
          { ...held({ kind, status: 'done', result: null }), label: null },
          NOW,
        ).label,
      ).toBe(label)
    },
  )
})

describe('toRollRequestView for a distribution, from module 0.32.0', () => {
  const transfer = {
    from: 'groupIronCo01',
    to: null,
    items: [],
    currency: { gp: 25 },
    among: ['actorBram001'],
  }
  const shared = (fields: Partial<CommandResult>, status: 'done' | 'failed') =>
    toRollRequestView(
      held({
        kind: 'transfer',
        status,
        claimedAt: ago(500),
        result: {
          id: 'req-1',
          status,
          reason: null,
          error: null,
          messageId: 'm-line',
          visible: true,
          rolls: [],
          transfer,
          ...fields,
        },
      }),
      NOW,
    )

  it('passes on who was given their share, made or failed part way', () => {
    expect(shared({}, 'done')).toMatchObject({ status: 'done', transfer })
    expect(
      shared({ status: 'failed', reason: 'error', error: 'refused' }, 'failed'),
    ).toEqual({ id: 'req-1', status: 'failed', reason: 'error', transfer })
  })
})

describe('toRollRequestView for an item removed, from module 0.33.0', () => {
  const removed = { item: 'potionThorin', quantity: 2 }
  const removal = (fields: Partial<CommandResult>, status: 'done' | 'failed') =>
    toRollRequestView(
      held({
        kind: 'remove',
        status,
        claimedAt: ago(500),
        result: {
          id: 'req-1',
          status,
          reason: null,
          error: null,
          messageId: 'm-line',
          visible: true,
          rolls: [],
          removed,
          ...fields,
        },
      }),
      NOW,
    )

  it('passes on what was removed, once made, seen or not', () => {
    expect(removal({}, 'done')).toEqual({
      id: 'req-1',
      status: 'done',
      visible: true,
      total: undefined,
      rolls: [],
      removed,
    })
    expect(removal({ visible: false }, 'done')).toEqual({
      id: 'req-1',
      status: 'done',
      visible: false,
      removed,
    })
  })

  it('passes on what was removed before it failed, and nothing where the item itself was kept', () => {
    expect(
      removal(
        {
          status: 'failed',
          reason: 'error',
          error: 'Not every item was deleted',
        },
        'failed',
      ),
    ).toEqual({ id: 'req-1', status: 'failed', reason: 'error', removed })
    expect(
      removal(
        { status: 'failed', reason: 'changed', removed: undefined },
        'failed',
      ),
    ).toEqual({ id: 'req-1', status: 'failed', reason: 'changed' })
  })
})

describe('utils/roll-requests for companions, from module 0.36.0', () => {
  it('names, totals and tells healing of damage on its own as damage, and a recharge as one', () => {
    const made = held({
      kind: 'itemDamage',
      role: 'gm',
      status: 'done',
      result: {
        id: 'req-1',
        status: 'done',
        visible: true,
        rolls: [
          { formula: '2d6', total: 7, dice: [], damageType: 'healing' },
          { formula: '1d4', total: 2, dice: [], damageType: 'healing' },
        ],
      } as unknown as CommandResult,
    })
    expect(toRollRequestView(made, NOW).total).toBe(9)
    expect(toGmRollView({ ...made, label: null }, NOW)).toMatchObject({
      label: 'Damage',
      healing: true,
    })
    expect(
      toGmRollView({ ...held({ kind: 'recharge' }), label: null }, NOW).label,
    ).toBe('A recharge')
  })
})

describe("utils/roll-requests, damage on its own's choices, from module 0.41.0", () => {
  it('passes on what damage on its own spent, and whether concentration began, as the game says', () => {
    const made = held({
      kind: 'itemDamage',
      status: 'done',
      result: aloneResult(['slot', 'uses'], true),
    })
    expect(toRollRequestView(made, NOW)).toMatchObject({
      status: 'done',
      visible: true,
      alone: { spent: ['slot', 'uses'], concentrating: true },
    })
    expect(
      toRollRequestView(
        held({
          kind: 'itemDamage',
          status: 'done',
          result: aloneResult([], false, { visible: false }),
        }),
        NOW,
      ),
    ).toEqual({
      id: 'req-1',
      status: 'done',
      visible: false,
      alone: { spent: [] },
    })
    expect(
      toRollRequestView(
        held({
          kind: 'itemDamage',
          status: 'done',
          result: aloneResult([], false, { alone: undefined }),
        }),
        NOW,
      ),
    ).not.toHaveProperty('alone')
  })
})

/** The Gamemaster's spell slot, spent or restored, as held, with what their page called it. */
const gmSlot = (payload: unknown, label: string | null = null) =>
  toGmRollView(
    {
      ...held({
        kind: 'spellSlot',
        role: 'gm',
        status: 'done',
        payload,
        result: {
          status: 'done',
          messageId: 'msg-1',
          visible: true,
          rolls: [],
        },
      }),
      label,
    },
    NOW,
  )

describe('utils/roll-requests, a spell slot spent or restored, from module 0.42.1', () => {
  describe('toGmRollView', () => {
    const spent = {
      kind: 'spellSlot',
      ...plain,
      spellSlot: { op: 'spend', id: 'spell1', from: 3 },
    }

    it('says whether the Gamemaster spent one or restored one, for their line on the player’s page', () => {
      expect(gmSlot(spent, '1st-level spell slot')).toMatchObject({
        kind: 'spellSlot',
        label: '1st-level spell slot',
        status: 'done',
        slotOp: 'spend',
      })
      expect(
        gmSlot({ ...spent, spellSlot: { ...spent.spellSlot, op: 'restore' } }),
      ).toMatchObject({ slotOp: 'restore' })
    })

    it('calls one from a page that didn’t say by its kind', () => {
      expect(gmSlot(spent).label).toBe('A spell slot spent or restored')
    })

    it.each([
      ['no spell slot', { kind: 'spellSlot', ...plain }],
      ['an op it doesn’t know', { ...spent, spellSlot: { op: 'set' } }],
      ['a spell slot that isn’t an object', { ...spent, spellSlot: 'spell1' }],
      ['nothing', null],
    ])('says neither for a payload with %s', (_name, payload) => {
      expect(gmSlot(payload)).not.toHaveProperty('slotOp')
    })

    it('says neither for another kind, whatever its payload holds', () => {
      const view = toGmRollView(
        {
          ...held({
            kind: 'spend',
            role: 'gm',
            status: 'done',
            payload: spent,
          }),
          label: null,
        },
        NOW,
      )
      expect(view.label).toBe('Charges spent')
      expect(view).not.toHaveProperty('slotOp')
    })
  })
})

/** A preparation, as its row's menu sends it, with these fields. */
const preparing = (
  fields: Partial<RollRequestInput> = {},
): RollRequestInput => ({
  kind: 'prepare',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  ...fields,
})

describe('utils/roll-requests, a spell prepared or unprepared, from module 0.42.1', () => {
  it('is never sent by the Gamemaster, as it posts nothing, and is called so on the player’s page all the same', () => {
    expect(GM_UNSENT.has('prepare')).toBe(true)
    const view = toGmRollView(
      {
        ...held({
          kind: 'prepare',
          role: 'gm',
          status: 'done',
          payload: preparing({ prepare: { op: 'prepare', id: 'witch' } }),
          result: {
            status: 'done',
            messageId: null,
            visible: true,
            rolls: [],
          },
        }),
        label: null,
      },
      NOW,
    )
    expect(view.label).toBe('A spell prepared or unprepared')
    expect(view).not.toHaveProperty('slotOp')
  })
})
