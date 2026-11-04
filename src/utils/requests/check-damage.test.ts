import { checkDamage, checkDamageDice } from './check-damage'
import { mockTableDamage } from '@/mocks/sending-stone'
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

/** The damage of the attack req-1, with these dice. */
const damageRequest = (dice: RollRequestInput['dice']) =>
  request({ kind: 'damage', key: undefined, use: 'req-1', dice })

/** Dice of damage that takes a d4 away: so many d4s, then so many of another, d6s unless said. */
const lessD4 = (fours: number, others: number, faces = 6) => [
  { faces: 4, results: Array.from({ length: fours }, () => 2) },
  { faces, results: Array.from({ length: others }, () => 3) },
]

/** The damage of the attack req-1 that takes a d4 away, with so many d4s and d6s, changed so. */
const lessD4Damage = (
  fours: number,
  sixes: number,
  modifiers?: RollRequestInput['modifiers'],
) => ({
  ...damageRequest(lessD4(fours, sixes)),
  ...(modifiers && { modifiers }),
})

describe('utils/roll-requests', () => {
  describe('checkDamage', () => {
    const preview: DamagePreview = {
      critical: false,
      plannable: true,
      rolls: [
        {
          formula: '1d8 + 4',
          type: 'bludgeoning',
          dice: [{ faces: 8, number: 1 }],
        },
        { formula: '2d6', type: 'fire', dice: [{ faces: 6, number: 2 }] },
      ],
    }
    const result = (damage: DamagePreview | null): CommandResult => ({
      id: 'req-1',
      status: 'done',
      reason: null,
      error: null,
      messageId: 'msg-1',
      visible: true,
      rolls: [],
      attack: { critical: false, fumble: false, outcome: 'hit' },
      damage,
    })
    const use = (fields: Partial<HeldRollRequest> = {}) =>
      held({
        kind: 'attack',
        status: 'done',
        createdAt: ago(60_000),
        result: result(preview),
        ...fields,
      })
    const thrown = damageRequest([
      { faces: 8, results: [5] },
      { faces: 6, results: [2, 6] },
    ])

    it('lets the damage of an attack made lately be rolled once, with the dice it said', () => {
      expect(checkDamage(thrown, use(), [], NOW)).toBeUndefined()
      expect(
        checkDamage(thrown, use(), [held({ status: 'failed' })], NOW),
      ).toBeUndefined()
      // One that never reached the game doesn't count.
      expect(
        checkDamage(thrown, use(), [held({ createdAt: ago(30_000) })], NOW),
      ).toBeUndefined()
    })

    it('rolls no dice for damage the game rolls itself', () => {
      const unplannable = use({
        result: result({ ...preview, plannable: false }),
      })
      expect(
        checkDamage(damageRequest([]), unplannable, [], NOW),
      ).toBeUndefined()
      expect(checkDamage(thrown, unplannable, [], NOW)).toBe('dice')
    })

    it.each([
      ['takes a die away', '1d3 + 3 - 1d4', 'dice'],
      [
        'takes one away as Foundry may wrap a leading die',
        '(1d4 * -1) + 2d6',
        'dice',
      ],
      ['takes a number away', '1d3 - 1', undefined],
    ])(
      'rolls damage the game rolls itself at its highest only where its formula takes no die away: one that %s',
      (_name, formula, refusal) => {
        const unplannable = use({
          result: result({
            critical: false,
            plannable: false,
            rolls: [{ formula, type: 'bludgeoning', dice: [] }],
          }),
        })
        const maximum = {
          ...damageRequest([]),
          modifiers: { maximize: true },
        }
        expect(checkDamage(maximum, unplannable, [], NOW)).toBe(refusal)
        expect(
          checkDamage(damageRequest([]), unplannable, [], NOW),
        ).toBeUndefined()
      },
    )

    it.each([
      ['no attack', null],
      ['an attack still on its way', use({ status: 'claimed' })],
      ['an attack not made', use({ status: 'failed' })],
      ['a check', use({ kind: 'skill' })],
      ['an attack made too long ago', use({ createdAt: ago(600_001) })],
    ])('refuses the damage of %s', (_name, attack) => {
      expect(checkDamage(thrown, attack, [], NOW)).toBe('gone')
    })

    it("lets a use's damage be rolled, as the kinds chosen among those its rolls offer", () => {
      const fire = { key: 'fire', label: 'Fire' }
      const cold = { key: 'cold', label: 'Cold' }
      const offered = use({
        kind: 'use',
        result: result({
          ...preview,
          rolls: [
            { ...preview.rolls[0], types: [fire, cold] },
            preview.rolls[1],
          ],
        }),
      })
      const as = (types: (string | null)[]) => ({ ...thrown, types })
      expect(checkDamage(thrown, offered, [], NOW)).toBeUndefined()
      expect(checkDamage(as(['cold']), offered, [], NOW)).toBeUndefined()
      expect(checkDamage(as(['fire', null]), offered, [], NOW)).toBeUndefined()
      expect(checkDamage(as(['acid']), offered, [], NOW)).toBe('type')
      expect(checkDamage(as([null, 'fire']), offered, [], NOW)).toBe('type')
      expect(checkDamage(as(['fire', null, null]), offered, [], NOW)).toBe(
        'type',
      )
      expect(checkDamage(as(['fire']), use(), [], NOW)).toBe('type')
    })

    it('refuses the damage of an attack no damage follows', () => {
      expect(checkDamage(thrown, use({ result: result(null) }), [], NOW)).toBe(
        'no-damage',
      )
    })

    it.each([
      ['on its way', held()],
      ['being rolled', held({ status: 'claimed', claimedAt: ago(1000) })],
      ['rolled', held({ status: 'done' })],
    ])('refuses damage already %s', (_name, other) => {
      expect(checkDamage(thrown, use(), [other], NOW)).toBe('damaged')
    })

    it("changes only a critical hit's own first die, never its critical damage's", () => {
      // A greataxe's critical hit: 3d12 + 3, and the weapon's 1d6.
      const greataxe = use({
        result: result({
          critical: true,
          plannable: true,
          rolls: [
            {
              formula: '3d12 + 3 + 1d6',
              type: 'slashing',
              dice: [
                { faces: 12, number: 3 },
                { faces: 6, number: 1, added: true },
              ],
              perDie: 2,
            },
          ],
        }),
      })
      const sent = (twelves: number) =>
        damageRequest([
          { faces: 12, results: Array.from({ length: twelves }, () => 7) },
          { faces: 6, results: [4] },
        ])
      expect(checkDamage(sent(3), greataxe, [], NOW)).toBeUndefined()
      expect(
        checkDamage({ ...sent(5), modifiers: { extra: 1 } }, greataxe, [], NOW),
      ).toBeUndefined()
      expect(
        checkDamage({ ...sent(4), modifiers: { extra: 1 } }, greataxe, [], NOW),
      ).toBe('dice')

      // "3 + 1d6": no die of its own to add to.
      const numbers = use({
        result: result({
          critical: true,
          plannable: true,
          rolls: [
            {
              formula: '3 + 1d6',
              type: 'bludgeoning',
              dice: [{ faces: 6, number: 1, added: true }],
              perDie: 2,
            },
          ],
        }),
      })
      const six = damageRequest([{ faces: 6, results: [4] }])
      expect(checkDamage(six, numbers, [], NOW)).toBeUndefined()
      expect(
        checkDamage(
          {
            ...damageRequest([{ faces: 6, results: [4, 2, 1] }]),
            modifiers: { extra: 1 },
          },
          numbers,
          [],
          NOW,
        ),
      ).toBe('dice')
      expect(
        checkDamage({ ...six, modifiers: { extra: 1 } }, numbers, [], NOW),
      ).toBe('dice')
      // At its highest, as it is.
      expect(
        checkDamage(
          { ...six, modifiers: { maximize: true } },
          numbers,
          [],
          NOW,
        ),
      ).toBeUndefined()
    })

    /** "-1d4 + 2d6", its d4 marked taken away, from module 0.21.0, or not, from one before. */
    const withering = (marked: boolean) =>
      use({
        kind: 'use',
        result: result({
          critical: false,
          plannable: true,
          rolls: [
            {
              formula: '- 1d4 + 2d6',
              type: 'necrotic',
              dice: [
                { faces: 4, number: 1, ...(marked && { subtracted: true }) },
                { faces: 6, number: 2 },
              ],
            },
          ],
        }),
      })

    describe('that takes dice away', () => {
      it('changes the first die it adds, never one the game marks taken away', () => {
        expect(
          checkDamage(lessD4Damage(1, 2), withering(true), [], NOW),
        ).toBeUndefined()
        expect(
          checkDamage(
            lessD4Damage(1, 3, { extra: 1 }),
            withering(true),
            [],
            NOW,
          ),
        ).toBeUndefined()
        expect(
          checkDamage(
            lessD4Damage(2, 2, { extra: 1 }),
            withering(true),
            [],
            NOW,
          ),
        ).toBe('dice')
      })

      it('changes none where a module before 0.21.0 would change the die it takes away', () => {
        expect(
          checkDamage(lessD4Damage(1, 2), withering(false), [], NOW),
        ).toBeUndefined()
        expect(
          checkDamage(
            lessD4Damage(1, 3, { extra: 1 }),
            withering(false),
            [],
            NOW,
          ),
        ).toBe('dice')
        expect(
          checkDamage(
            lessD4Damage(2, 2, { extra: 1 }),
            withering(false),
            [],
            NOW,
          ),
        ).toBe('dice')
      })

      it('never rolls it at its highest, as the game marks it or its formula has it', () => {
        expect(
          checkDamage(
            lessD4Damage(1, 2, { maximize: true }),
            withering(true),
            [],
            NOW,
          ),
        ).toBe('dice')
        expect(
          checkDamage(
            lessD4Damage(1, 2, { maximize: true }),
            withering(false),
            [],
            NOW,
          ),
        ).toBe('dice')
        // Damage that takes nothing away is, as ever.
        expect(
          checkDamage(
            {
              ...thrown,
              modifiers: { maximize: true },
            },
            use(),
            [],
            NOW,
          ),
        ).toBeUndefined()
      })
    })

    it.each([
      ['a part missing', [{ faces: 8, results: [5] }]],
      [
        'a die too few',
        [
          { faces: 8, results: [5] },
          { faces: 6, results: [2] },
        ],
      ],
      [
        'the wrong die',
        [
          { faces: 10, results: [5] },
          { faces: 6, results: [2, 6] },
        ],
      ],
      [
        'the parts the other way about',
        [
          { faces: 6, results: [2, 6] },
          { faces: 8, results: [5] },
        ],
      ],
    ])('refuses damage with %s', (_name, dice) => {
      expect(checkDamage(damageRequest(dice), use(), [], NOW)).toBe('dice')
    })
  })
})

/** An attack made lately, whose damage is of one roll of this formula, its dice as said. */
const attackOf = (
  formula: string,
  dice: DamagePreview['rolls'][number]['dice'],
  plannable = true,
) =>
  held({
    kind: 'attack',
    status: 'done',
    createdAt: ago(60_000),
    result: {
      id: 'req-1',
      status: 'done',
      reason: null,
      error: null,
      messageId: 'msg-1',
      visible: true,
      rolls: [],
      attack: { critical: false, fumble: false, outcome: 'hit' },
      damage: {
        critical: false,
        plannable,
        rolls: [{ formula, type: 'slashing', dice }],
      },
    } satisfies CommandResult,
  })

/** The damage of the attack req-1 at its highest, with these dice. */
const maximum = (dice: RollRequestInput['dice']) => ({
  ...damageRequest(dice),
  modifiers: { maximize: true },
})

describe('utils/roll-requests for dice Foundry works out once thrown, from module 0.22.0', () => {
  describe('checkDamage', () => {
    it('takes the first throw of dice Foundry rerolls, at its highest too', () => {
      const greatsword = attackOf('2d6r<=2 + 7', [{ faces: 6, number: 2 }])
      const first = [{ faces: 6, results: [1, 5] }]
      expect(
        checkDamage(damageRequest(first), greatsword, [], NOW),
      ).toBeUndefined()
      expect(
        checkDamage(
          damageRequest([{ faces: 6, results: [1, 5, 4] }]),
          greatsword,
          [],
          NOW,
        ),
      ).toBe('dice')
      expect(
        checkDamage(
          maximum([{ faces: 6, results: [6, 6] }]),
          greatsword,
          [],
          NOW,
        ),
      ).toBeUndefined()
    })

    it.each([
      ['explodes', '1d6x + 2'],
      ['explodes once', '1d6xo + 2'],
      ['is rerolled on its highest face', '1d6r6 + 2'],
    ])('never takes damage at its highest whose die %s', (_name, formula) => {
      const thrown = [{ faces: 6, results: [6] }]
      const attack = attackOf(formula, [{ faces: 6, number: 1 }])
      expect(
        checkDamage(damageRequest(thrown), attack, [], NOW),
      ).toBeUndefined()
      expect(checkDamage(maximum(thrown), attack, [], NOW)).toBe('dice')
    })

    it('never takes damage the game rolls itself at its highest where its formula seems to explode a die', () => {
      const rolledThere = attackOf('(1d6x) * 2', [], false)
      expect(checkDamage(maximum([]), rolledThere, [], NOW)).toBe('dice')
      expect(
        checkDamage(damageRequest([]), rolledThere, [], NOW),
      ).toBeUndefined()
    })
  })
})

const alone = (fields: Partial<RollRequestInput> = {}) =>
  request({
    kind: 'itemDamage',
    key: undefined,
    item: 'wolfBite',
    activity: 'biteAttack',
    dice: [{ faces: 8, results: [5] }],
    ...fields,
  })

describe('utils/roll-requests for companions, from module 0.36.0', () => {
  describe('damage on its own', () => {
    it('checks its dice as an attack’s due damage is checked', () => {
      const { normal } = mockTableDamage()
      expect(checkDamageDice(alone(), normal)).toBeUndefined()
      expect(
        checkDamageDice(
          alone({
            dice: [{ faces: 8, results: [5, 6] }],
            modifiers: { extra: 1 },
          }),
          normal,
        ),
      ).toBeUndefined()
      expect(checkDamageDice(alone({ modifiers: { extra: 1 } }), normal)).toBe(
        'dice',
      )
      expect(checkDamageDice(alone({ types: [null] }), normal)).toBeUndefined()
      expect(checkDamageDice(alone({ types: ['cold'] }), normal)).toBe('type')
    })
  })
})
