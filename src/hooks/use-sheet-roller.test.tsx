/* eslint-disable unicorn/no-null -- a damage part without a kind has null */
import { useDiceRenderer } from '@lambersond/3d-dice-react'
import { act, renderHook } from '@testing-library/react'
import {
  ANIMATION_TIMEOUT,
  ROLL_HISTORY,
  useSheetRoller,
  type LocalCheck,
  type LocalDamage,
  type LocalFormula,
  type SheetFormulaRoll,
} from './use-sheet-roller'
import { damageRollOf } from './use-table-rolls'

jest.mock('@lambersond/3d-dice-react', () => ({ useDiceRenderer: jest.fn() }))

/** Dice that land when told to. */
function deferred<T>() {
  const settle: { resolve?: (value: T) => void } = {}
  const promise = new Promise<T>(resolve => {
    settle.resolve = resolve
  })
  return { promise, resolve: (value: T) => settle.resolve?.(value) }
}

const renderer = (fields: object = {}) => {
  const fake = {
    isReady: true,
    roll: jest.fn<Promise<number[]>, [string, object?]>(async () => []),
    ...fields,
  }
  jest.mocked(useDiceRenderer).mockReturnValue(fake as any)
  return fake
}

/** A term of damage's dice: so many of a die, added, unless taken away. */
const d = (count: number, sides: 4 | 6 | 8, sign: 1 | -1 = 1) => ({
  sign,
  count,
  sides,
})

/** What Math.random returns for a die of so many sides to land on this face. */
const face = (value: number, sides: number) => (value - 0.5) / sides

/** Dice that land on these faces, in order, each with its sides. */
const landing = (...faces: [number, number][]) => {
  const random = jest.spyOn(Math, 'random')
  for (const [value, sides] of faces) {
    random.mockReturnValueOnce(face(value, sides))
  }
  return random
}

/** A d8 hit die spent, with this Constitution modifier, 0 or less, giving back at least this. */
const hitDie = (con: number, minimum: number): SheetFormulaRoll => ({
  label: 'Hit die (d8)',
  terms: [
    { sign: 1, count: 1, sides: 8 },
    ...(con === 0 ? [] : [{ sign: -1 as const, flat: -con }]),
  ],
  healing: true,
  minimum,
  source: { kind: 'hitDie', denomination: 'd8' },
})

/**
 * Two d10 hit dice and a d8 spent at once, with this Constitution modifier, 0 or less, each giving
 * back at least this.
 */
const hitDice = (con: number, minimum: number): SheetFormulaRoll => {
  const terms = (sides: 8 | 10) => [
    { sign: 1 as const, count: 1, sides },
    ...(con === 0 ? [] : [{ sign: -1 as const, flat: -con }]),
  ]
  return {
    label: 'Hit dice (2d10 + 1d8)',
    terms: [],
    sets: [
      { terms: terms(10), times: 2 },
      { terms: terms(8), times: 1 },
    ],
    healing: true,
    minimum,
    source: {
      kind: 'hitDice',
      hitDice: [
        { denomination: 'd10', count: 2 },
        { denomination: 'd8', count: 1 },
      ],
    },
  }
}

describe('hooks/use-sheet-roller', () => {
  afterEach(() => jest.restoreAllMocks())

  it('throws a d20 with the modifier, and keeps the result once the dice land', async () => {
    const landing = deferred<number[]>()
    const fake = renderer({
      roll: jest.fn<Promise<number[]>, [string, object?]>(
        () => landing.promise,
      ),
    })
    const { result } = renderHook(() => useSheetRoller())

    let rolled: Promise<boolean> | undefined
    act(() => {
      rolled = result.current.roll({ label: 'Perception check', modifier: 5 })
    })
    expect(result.current.rolling).toBe(true)
    expect(result.current.rolls).toEqual([])
    expect(fake.roll).toHaveBeenCalledWith(
      expect.stringMatching(/^1d20@\d+$/),
      { theme: expect.any(Object) },
    )

    await act(async () => {
      landing.resolve([14])
      await rolled
    })

    expect(result.current.rolling).toBe(false)
    const [roll] = result.current.rolls as LocalCheck[]
    expect(roll).toMatchObject({ label: 'Perception check', modifier: 5 })
    expect(roll.d20s).toHaveLength(1)
    expect(roll.total).toBe(roll.natural + 5)
    expect(fake.roll.mock.calls[0][0]).toBe(`1d20@${roll.natural}`)
  })

  it('tells of a check as its dice are thrown, before they land, with what they came to', async () => {
    const landing = deferred<number[]>()
    renderer({
      roll: jest.fn<Promise<number[]>, [string, object?]>(
        () => landing.promise,
      ),
    })
    const onThrown = jest.fn()
    const { result } = renderHook(() => useSheetRoller(onThrown))
    const request = {
      label: 'Perception check',
      modifier: 5,
      advantage: 'adv' as const,
      extras: [{ sign: 1 as const, count: 1, sides: 4 as const }],
      source: { kind: 'skill' as const, key: 'prc' },
      explicit: true,
    }

    let rolled: Promise<boolean> | undefined
    act(() => {
      rolled = result.current.roll(request)
    })
    expect(onThrown).toHaveBeenCalledTimes(1)
    const [told, check] = onThrown.mock.calls[0] as [unknown, LocalCheck]
    expect(told).toBe(request)
    expect(check.d20s).toHaveLength(2)
    expect(check.extras[0].values).toHaveLength(1)
    expect(result.current.rolls).toEqual([])

    await act(async () => {
      landing.resolve([])
      await rolled
    })
    expect(result.current.rolls).toEqual([check])
  })

  it('throws two d20s with advantage, keeping the higher', async () => {
    renderer()
    const { result } = renderHook(() => useSheetRoller())

    await act(() =>
      result.current.roll({
        label: 'Stealth check',
        modifier: -1,
        advantage: 'adv',
      }),
    )

    const [roll] = result.current.rolls as LocalCheck[]
    expect(roll.advantage).toBe('adv')
    expect(roll.d20s).toHaveLength(2)
    expect(roll.natural).toBe(Math.max(...roll.d20s))
    expect(roll.total).toBe(roll.natural - 1)
  })

  it('throws extra dice with the d20, without advantage, and adds what the player added', async () => {
    const fake = renderer()
    const { result } = renderHook(() => useSheetRoller())

    await act(() =>
      result.current.roll({
        label: 'Wisdom saving throw',
        modifier: 3,
        advantage: 'adv',
        extras: [
          { sign: 1, count: 1, sides: 4 },
          { sign: -1, count: 2, sides: 6 },
          { sign: 1, flat: 2 },
        ],
      }),
    )

    const [roll] = result.current.rolls as LocalCheck[]
    expect(roll.d20s).toHaveLength(2)
    expect(roll.extras.map(({ text }) => text)).toEqual(['+1d4', '−2d6', '+2'])
    const [bless, bane, flat] = roll.extras
    expect(bless.values).toHaveLength(1)
    expect(bane.values).toHaveLength(2)
    expect(bane.value).toBe(-(bane.values[0] + bane.values[1]))
    expect(flat).toEqual({ text: '+2', values: [], value: 2 })
    expect(roll.total).toBe(roll.natural + 3 + bless.values[0] + bane.value + 2)
    expect(fake.roll.mock.calls[0][0]).toBe(
      `2d20+1d4+2d6@${[...roll.d20s, ...bless.values, ...bane.values].join(',')}`,
    )
  })

  it('throws the dice of every part of a damage roll, and adds each part up with its kind', async () => {
    const fake = renderer()
    const { result } = renderHook(() => useSheetRoller())

    await act(() =>
      result.current.rollDamage({
        label: 'Flame Tongue damage',
        parts: [
          {
            terms: [
              { sign: 1, count: 1, sides: 8 },
              { sign: 1, flat: 4 },
            ],
            type: 'Slashing',
          },
          { terms: [{ sign: 1, count: 2, sides: 6 }], type: 'Fire' },
        ],
      }),
    )

    const [roll] = result.current.rolls as LocalDamage[]
    expect(roll).toMatchObject({
      kind: 'damage',
      label: 'Flame Tongue damage',
      critical: false,
      healing: false,
    })
    const [slashing, fire] = roll.parts
    expect(slashing.terms.map(({ text }) => text)).toEqual(['1d8', '+4'])
    expect(slashing.terms[0].values).toHaveLength(1)
    expect(slashing.total).toBe(slashing.terms[0].values[0] + 4)
    expect(fire).toMatchObject({ type: 'Fire' })
    expect(fire.terms[0].text).toBe('+2d6')
    expect(fire.terms[0].values).toHaveLength(2)
    expect(roll.total).toBe(slashing.total + fire.total)
    expect(fake.roll.mock.calls[0][0]).toBe(
      `1d8+2d6@${[...slashing.terms[0].values, ...fire.terms[0].values].join(',')}`,
    )
  })

  it('rolls every die twice for a critical hit, adding the same numbers once', async () => {
    renderer()
    const { result } = renderHook(() => useSheetRoller())

    await act(() =>
      result.current.rollDamage({
        label: 'Longsword damage',
        parts: [
          {
            terms: [
              { sign: 1, count: 1, sides: 8 },
              { sign: 1, flat: 3 },
              { sign: -1, count: 1, sides: 4 },
            ],
            type: null,
          },
        ],
        critical: true,
      }),
    )

    const [roll] = result.current.rolls as LocalDamage[]
    const [dice, flat, less] = roll.parts[0].terms
    expect([dice.text, flat.text, less.text]).toEqual(['2d8', '+3', '−2d4'])
    expect(dice.values).toHaveLength(2)
    expect(less.values).toHaveLength(2)
    expect(less.value).toBe(-(less.values[0] + less.values[1]))
    // Each kind of damage is at least 0, as dnd5e's card adds it up: low dice can take it below.
    expect(roll.total).toBe(Math.max(0, dice.value + 3 + less.value))
    expect(roll.critical).toBe(true)
  })

  it("throws a critical hit's dice as the game gave them, already doubled, and tells of them", async () => {
    renderer()
    const onDamageThrown = jest.fn()
    const { result } = renderHook(() =>
      useSheetRoller(undefined, onDamageThrown),
    )
    const request = {
      label: 'Longsword damage',
      parts: [
        {
          terms: [
            { sign: 1 as const, count: 2, sides: 8 as const },
            { sign: 1 as const, flat: 4 },
          ],
          type: 'slashing',
        },
      ],
      critical: true,
      exact: true,
      use: 'req-1',
    }

    await act(() => result.current.rollDamage(request))

    const [roll] = result.current.rolls as LocalDamage[]
    const [dice, flat] = roll.parts[0].terms
    expect([dice.text, flat.text]).toEqual(['2d8', '+4'])
    expect(dice.values).toHaveLength(2)
    expect(roll.critical).toBe(true)
    expect(onDamageThrown).toHaveBeenCalledWith(request, roll)
  })

  it('throws damage changed as the player chose: more of its first die, another size, landing high', async () => {
    const fake = renderer()
    const onDamageThrown = jest.fn()
    const { result } = renderHook(() =>
      useSheetRoller(undefined, onDamageThrown),
    )

    await act(() =>
      result.current.rollDamage({
        label: 'Toll the Dead damage',
        parts: [{ terms: [{ sign: 1, count: 1, sides: 8 }], type: 'Necrotic' }],
        modifiers: { extra: 1, faces: 12, maximize: true },
      }),
    )

    const [roll] = result.current.rolls as LocalDamage[]
    expect(roll.parts[0].terms[0]).toMatchObject({
      text: '2d12',
      values: [12, 12],
    })
    expect(roll).toMatchObject({ total: 24, maximized: true })
    // The dice land on their highest faces.
    expect(fake.roll.mock.calls[0][0]).toBe('2d12@12,12')
    // The game is told of the dice thrown, as changed.
    expect(onDamageThrown.mock.calls[0][0].parts).toEqual([
      { terms: [{ sign: 1, count: 2, sides: 12 }], type: 'Necrotic' },
    ])
  })

  it("throws the game's dice changed as the player chose, the die damage takes away as it is", async () => {
    const fake = renderer()
    const onDamageThrown = jest.fn()
    const { result } = renderHook(() =>
      useSheetRoller(undefined, onDamageThrown),
    )
    // A greataxe under Reduce, as the game marks it: 1d12 + 3, less 1d4; one die more.
    const reduced = damageRollOf(
      'Greataxe',
      {
        use: 'req-1',
        damage: {
          critical: false,
          plannable: true,
          rolls: [
            {
              formula: '1d12 + 3 - 1d4',
              type: 'Slashing',
              dice: [
                { faces: 12, number: 1 },
                { faces: 4, number: 1, subtracted: true },
              ],
            },
          ],
        },
      },
      undefined,
      { extra: 1 },
    )

    await act(() => result.current.rollDamage(reduced))

    // Two d12s, and the d4 it takes away, as the game will throw them.
    expect(fake.roll.mock.calls[0][0]).toMatch(/^2d12\+1d4@/)
    expect(onDamageThrown.mock.calls[0][0].parts).toEqual([
      {
        terms: [
          { sign: 1, count: 2, sides: 12 },
          { sign: 1, flat: 3 },
          { sign: -1, count: 1, sides: 4 },
        ],
        type: 'Slashing',
      },
    ])
    const [roll] = result.current.rolls as LocalDamage[]
    expect(roll.parts[0].terms.map(({ text }) => text)).toEqual([
      '2d12',
      '+3',
      '−1d4',
    ])
  })

  it("adds as many of the game's dice for each as it throws, and doubles those rolled here for a critical hit", async () => {
    renderer()
    const { result } = renderHook(() => useSheetRoller())
    const parts = [
      {
        terms: [{ sign: 1 as const, count: 2, sides: 8 as const }],
        type: null,
      },
    ]

    await act(() =>
      result.current.rollDamage({
        label: 'At the table',
        parts,
        critical: true,
        exact: true,
        perDie: 2,
        modifiers: { extra: 1 },
      }),
    )
    await act(() =>
      result.current.rollDamage({
        label: 'Here',
        parts: [{ terms: [{ sign: 1, count: 1, sides: 8 }], type: null }],
        critical: true,
        modifiers: { extra: 1 },
      }),
    )

    const [here, table] = result.current.rolls as LocalDamage[]
    expect(table.parts[0].terms[0].text).toBe('4d8')
    expect(here.parts[0].terms[0].text).toBe('4d8')
    expect(here.maximized).toBeUndefined()
  })

  it("throws a description's critical hit as the world's rules make one, once changed as the player chose, and tells the game of the dice so", async () => {
    const fake = renderer()
    const onDamageThrown = jest.fn()
    const { result } = renderHook(() =>
      useSheetRoller(undefined, onDamageThrown),
    )
    const parts = [
      {
        terms: [
          { sign: 1 as const, count: 2, sides: 6 as const },
          { sign: 1 as const, flat: 3 },
        ],
        type: 'fire',
      },
      {
        terms: [{ sign: 1 as const, count: 1, sides: 4 as const }],
        type: null,
      },
    ]
    const text = { text: 'a1b2c3d4e5f6a7', link: 3 }

    // As dnd5e makes one by default, the numbers doubled too: one die more is two more.
    await act(() =>
      result.current.rollDamage({
        label: 'Flame damage',
        parts,
        critical: true,
        criticalRule: {
          perDie: 2,
          multiplyNumeric: true,
          powerfulCritical: false,
          altered: false,
        },
        modifiers: { extra: 1 },
        text,
      }),
    )
    const [doubled] = result.current.rolls as LocalDamage[]
    expect(
      doubled.parts.map(part => part.terms.map(term => term.text)),
    ).toEqual([['6d6', '+6'], ['+2d4']])
    expect(doubled).toMatchObject({ critical: true, described: true })
    expect(fake.roll.mock.calls[0][0]).toMatch(/^6d6\+2d4@/)
    expect(onDamageThrown.mock.calls[0][0].parts).toEqual([
      {
        terms: [
          { sign: 1, count: 6, sides: 6 },
          { sign: 1, flat: 6 },
        ],
        type: 'fire',
      },
      { terms: [{ sign: 1, count: 2, sides: 4 }], type: null },
    ])

    // Under Powerful Critical: its dice once, a d8 now, and the most they could roll added, at
    // their highest.
    await act(() =>
      result.current.rollDamage({
        label: 'Flame damage',
        parts,
        critical: true,
        criticalRule: {
          perDie: 1,
          multiplyNumeric: false,
          powerfulCritical: true,
          altered: false,
        },
        modifiers: { extra: 1, faces: 8, maximize: true },
        text,
      }),
    )
    const [powerful] = result.current.rolls as LocalDamage[]
    expect(
      powerful.parts.map(part => part.terms.map(term => term.text)),
    ).toEqual([
      ['3d8', '+3', '+24'],
      ['+1d4', '+4'],
    ])
    expect(powerful).toMatchObject({
      critical: true,
      maximized: true,
      total: 24 + 3 + 24 + 4 + 4,
    })

    // Not a critical hit, it's thrown as it is, the rules aside.
    await act(() =>
      result.current.rollDamage({
        label: 'Flame damage',
        parts,
        criticalRule: {
          perDie: 2,
          multiplyNumeric: true,
          powerfulCritical: true,
          altered: false,
        },
        text,
      }),
    )
    const [plain] = result.current.rolls as LocalDamage[]
    expect(plain.parts.map(part => part.terms.map(term => term.text))).toEqual([
      ['2d6', '+3'],
      ['+1d4'],
    ])
    expect(plain.critical).toBe(false)
    expect(plain).not.toHaveProperty('gameTotal')
    expect(doubled).not.toHaveProperty('gameTotal')

    // Under rules that change its dice as only the game adds them up, such as Midi-QOL's at their
    // highest: thrown twice over, its total the game's to say.
    await act(() =>
      result.current.rollDamage({
        label: 'Flame damage',
        parts,
        critical: true,
        criticalRule: {
          perDie: 2,
          multiplyNumeric: false,
          powerfulCritical: false,
          altered: true,
        },
        text,
      }),
    )
    const [altered] = result.current.rolls as LocalDamage[]
    expect(
      altered.parts.map(part => part.terms.map(term => term.text)),
    ).toEqual([['4d6', '+3'], ['+2d4']])
    expect(altered).toMatchObject({ critical: true, gameTotal: true })
  })

  it("throws what a critical hit adds to a description's damage: extra dice with its first die, and its critical damage after, as the world's rules make one, or as dnd5e does by default", async () => {
    const fake = renderer()
    const onDamageThrown = jest.fn()
    const { result } = renderHook(() =>
      useSheetRoller(undefined, onDamageThrown),
    )
    // A greataxe's 1d12 + 4, to which Savage Attacks adds a die, and the weapon 1d6.
    const parts = [
      {
        terms: [
          { sign: 1 as const, count: 1, sides: 12 as const },
          { sign: 1 as const, flat: 4 },
        ],
        type: 'slashing',
      },
    ]
    const criticalAdds = {
      dice: [1],
      damage: [[{ sign: 1 as const, count: 1, sides: 6 as const }]],
    }
    const text = { text: 'a1b2c3d4e5f6a7', link: 0 }

    await act(() =>
      result.current.rollDamage({
        label: 'Greataxe damage',
        parts,
        critical: true,
        criticalRule: {
          perDie: 2,
          multiplyNumeric: false,
          powerfulCritical: false,
          altered: false,
          bonusDice: 'rolled',
        },
        criticalAdds,
        text,
      }),
    )
    const [ruled] = result.current.rolls as LocalDamage[]
    expect(ruled.parts[0].terms.map(term => term.text)).toEqual([
      '3d12',
      '+4',
      '+1d6',
    ])
    expect(ruled.parts[0].terms.map(term => term.values.length)).toEqual([
      3, 0, 1,
    ])
    expect(ruled.total).toBe(
      ruled.parts[0].terms.reduce((sum, term) => sum + term.value, 0),
    )
    // The d12s first, then the d6: the pools the dice are thrown in.
    expect(fake.roll.mock.calls[0][0]).toMatch(/^3d12\+1d6@/)
    // Told of as thrown, the critical damage's die marked.
    expect(onDamageThrown.mock.calls[0][0].parts).toEqual([
      {
        terms: [
          { sign: 1, count: 3, sides: 12 },
          { sign: 1, flat: 4 },
          { sign: 1, count: 1, sides: 6, added: true },
        ],
        type: 'slashing',
      },
    ])

    // The player's alone, with no rules given: as dnd5e makes one by default, a die more two more.
    await act(() =>
      result.current.rollDamage({
        label: 'Greataxe damage',
        parts,
        critical: true,
        criticalAdds,
        modifiers: { extra: 1 },
        text,
      }),
    )
    const [local] = result.current.rolls as LocalDamage[]
    expect(local.parts[0].terms.map(term => term.text)).toEqual([
      '5d12',
      '+4',
      '+1d6',
    ])
    expect(fake.roll.mock.calls[1][0]).toMatch(/^5d12\+1d6@/)
    expect(local).toMatchObject({ critical: true, described: true })
    expect(local).not.toHaveProperty('gameTotal')
  })

  it("adds damage up as dnd5e's card does: each kind's parts together, each kind at least 0", async () => {
    renderer()
    const random = jest.spyOn(Math, 'random')
    const { result } = renderHook(() => useSheetRoller())
    const latest = () => result.current.rolls[0] as LocalDamage

    // A dagger under Ray of Enfeeblement: 1d4 + 3, less 1d8, landing 1 and 8.
    random.mockReturnValueOnce(0).mockReturnValueOnce(0.99)
    await act(() =>
      result.current.rollDamage({
        label: 'Dagger damage',
        parts: [
          {
            terms: [d(1, 4), { sign: 1, flat: 3 }, d(1, 8, -1)],
            type: 'Slashing',
          },
        ],
      }),
    )
    expect(latest().parts[0].total).toBe(-4)
    expect(latest().total).toBe(0)

    // Another kind isn't taken away from: −1d8 slashing at 8, 1d6 fire at 5.
    random.mockReturnValueOnce(0.99).mockReturnValueOnce(0.7)
    await act(() =>
      result.current.rollDamage({
        label: 'Flame Tongue damage',
        parts: [
          { terms: [d(1, 8, -1)], type: 'Slashing' },
          { terms: [d(1, 6)], type: 'Fire' },
        ],
      }),
    )
    expect(latest().parts.map(part => part.total)).toEqual([-8, 5])
    expect(latest().total).toBe(5)

    // One kind's parts are added up first: 1d4 at 4, less 1d6 at 6.
    random.mockReturnValueOnce(0.99).mockReturnValueOnce(0.99)
    await act(() =>
      result.current.rollDamage({
        label: 'Dagger damage',
        parts: [
          { terms: [d(1, 4)], type: 'Slashing' },
          { terms: [d(1, 6, -1)], type: 'Slashing' },
        ],
      }),
    )
    expect(latest().parts.map(part => part.total)).toEqual([4, -6])
    expect(latest().total).toBe(0)

    // Healing too.
    random.mockReturnValueOnce(0.5)
    await act(() =>
      result.current.rollDamage({
        label: 'Withering healing',
        parts: [{ terms: [d(1, 4, -1)], type: 'Healing' }],
        healing: true,
      }),
    )
    expect(latest()).toMatchObject({ healing: true, total: 0 })

    // Damage that takes nothing away comes to all of it: 1d8 + 4 at 5, and 2d6 fire at 6 and 1.
    random
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0)
    await act(() =>
      result.current.rollDamage({
        label: 'Flame Tongue damage',
        parts: [
          { terms: [d(1, 8), { sign: 1, flat: 4 }], type: 'Slashing' },
          { terms: [d(2, 6)], type: 'Fire' },
        ],
      }),
    )
    expect(latest().parts.map(part => part.total)).toEqual([9, 7])
    expect(latest().total).toBe(16)
  })

  describe('dice Foundry works out once thrown', () => {
    /** Great Weapon Fighting's greatsword, with a d8 of Divine Favor's. */
    const greatsword = {
      label: 'Greatsword damage',
      parts: [
        {
          terms: [
            {
              sign: 1 as const,
              count: 2,
              sides: 6 as const,
              modifiers: ['r<=2'],
            },
            { sign: 1 as const, flat: 7 },
            { sign: 1 as const, count: 1, sides: 8 as const },
          ],
          type: 'Slashing',
        },
      ],
    }

    it('throws the first throw, then the dice rerolled after, in the same throw, the game told of the first throw and its total the game’s', async () => {
      const fake = renderer()
      const onDamageThrown = jest.fn()
      const { result } = renderHook(() =>
        useSheetRoller(undefined, onDamageThrown),
      )
      // The 1 is rerolled, landing 4.
      landing([1, 6], [5, 6], [3, 8], [4, 6])

      await act(() => result.current.rollDamage(greatsword))

      const [roll] = result.current.rolls as LocalDamage[]
      const [dice, flat, d8] = roll.parts[0].terms
      expect(dice).toEqual({
        text: '2d6r<=2',
        values: [1, 5],
        value: 9,
        thrown: [
          { value: 1, active: false, rerolled: true },
          { value: 5, active: true },
          { value: 4, active: true },
        ],
      })
      expect(flat).toEqual({ text: '+7', values: [], value: 7 })
      expect(d8).toEqual({ text: '+1d8', values: [3], value: 3 })
      expect(roll.total).toBe(19)
      expect(roll.gameTotal).toBe(true)
      expect(fake.roll).toHaveBeenCalledTimes(1)
      expect(fake.roll.mock.calls[0][0]).toBe('2d6+1d8+1d6@1,5,3,4')
      expect(onDamageThrown).toHaveBeenCalledWith(
        expect.objectContaining({ parts: greatsword.parts }),
        roll,
      )
    })

    it('throws nothing more where no die is rerolled, its total its own', async () => {
      const fake = renderer()
      const { result } = renderHook(() => useSheetRoller())
      landing([3, 6], [5, 6], [3, 8])

      await act(() => result.current.rollDamage(greatsword))

      const [roll] = result.current.rolls as LocalDamage[]
      expect(roll.parts[0].terms[0]).toMatchObject({
        values: [3, 5],
        value: 8,
      })
      expect(roll.total).toBe(18)
      expect(roll).not.toHaveProperty('gameTotal')
      expect(fake.roll.mock.calls[0][0]).toBe('2d6+1d8@3,5,3')
    })

    it('keeps the highest of the dice as Foundry does, rethrowing none', async () => {
      renderer()
      const { result } = renderHook(() => useSheetRoller())
      landing([1, 6], [2, 6], [3, 6], [4, 6])

      await act(() =>
        result.current.rollDamage({
          label: 'Ability score',
          parts: [
            {
              terms: [{ sign: 1, count: 4, sides: 6, modifiers: ['kh3'] }],
              type: null,
            },
          ],
        }),
      )

      const [roll] = result.current.rolls as LocalDamage[]
      expect(roll.parts[0].terms[0]).toMatchObject({
        text: '4d6kh3',
        values: [1, 2, 3, 4],
        value: 9,
      })
      expect(roll.parts[0].terms[0].thrown?.[0]).toEqual({
        value: 1,
        active: false,
        discarded: true,
      })
      expect(roll).not.toHaveProperty('gameTotal')
    })

    it("doubles a critical hit's dice with what Foundry does with them", async () => {
      renderer()
      const { result } = renderHook(() => useSheetRoller())
      landing([3, 6], [4, 6], [5, 6], [6, 6], [8, 8], [8, 8])

      await act(() =>
        result.current.rollDamage({ ...greatsword, critical: true }),
      )

      const [roll] = result.current.rolls as LocalDamage[]
      expect(roll.parts[0].terms[0]).toMatchObject({
        text: '4d6r<=2',
        values: [3, 4, 5, 6],
        value: 18,
      })
      expect(roll.total).toBe(18 + 7 + 16)
    })

    it('throws a formula that explodes as damage does, its total the game’s where a die exploded', async () => {
      const fake = renderer()
      const onFormulaThrown = jest.fn()
      const { result } = renderHook(() =>
        useSheetRoller(undefined, undefined, onFormulaThrown),
      )
      const request: SheetFormulaRoll = {
        label: 'Wild Magic roll',
        terms: [
          { sign: 1, count: 1, sides: 4, modifiers: ['x'] },
          { sign: 1, flat: 2 },
        ],
        source: { kind: 'formula', item: 'surge', activity: 'roll' },
      }
      landing([4, 4], [2, 4])

      await act(() => result.current.rollFormula(request))

      const [exploded] = result.current.rolls as LocalFormula[]
      expect(exploded.terms[0]).toEqual({
        text: '1d4x',
        values: [4],
        value: 6,
        thrown: [
          { value: 4, active: true, exploded: true },
          { value: 2, active: true },
        ],
      })
      expect(exploded.total).toBe(8)
      expect(exploded.gameTotal).toBe(true)
      expect(fake.roll.mock.calls[0][0]).toBe('1d4+1d4@4,2')
      expect(onFormulaThrown).toHaveBeenCalledWith(request, exploded)

      landing([3, 4])
      await act(() => result.current.rollFormula(request))
      const [plain] = result.current.rolls as LocalFormula[]
      expect(plain.total).toBe(5)
      expect(plain).not.toHaveProperty('gameTotal')
    })
  })

  it('keeps healing with nothing to throw, without dice', async () => {
    const fake = renderer()
    const { result } = renderHook(() => useSheetRoller())

    await act(() =>
      result.current.rollDamage({
        label: 'Healing Word healing',
        parts: [{ terms: [{ sign: 1, flat: 5 }], type: 'Healing' }],
        healing: true,
      }),
    )

    expect(fake.roll).not.toHaveBeenCalled()
    expect(result.current.rolls[0]).toMatchObject({
      kind: 'damage',
      total: 5,
      healing: true,
    })
  })

  it("throws a formula's dice, adding up each term in order, and tells of it as they're thrown, before they land", async () => {
    const landing = deferred<number[]>()
    const fake = renderer({
      roll: jest.fn<Promise<number[]>, [string, object?]>(
        () => landing.promise,
      ),
    })
    const onFormulaThrown = jest.fn()
    const { result } = renderHook(() =>
      useSheetRoller(undefined, undefined, onFormulaThrown),
    )
    const request: SheetFormulaRoll = {
      label: 'Lantern: Light radius',
      terms: [
        { sign: 1, count: 1, sides: 4 },
        { sign: 1, flat: 3 },
        { sign: -1, count: 2, sides: 6 },
      ],
      source: { kind: 'formula', item: 'lantern', activity: 'shine' },
    }

    let rolled: Promise<boolean> | undefined
    act(() => {
      rolled = result.current.rollFormula(request)
    })
    expect(onFormulaThrown).toHaveBeenCalledTimes(1)
    const [told, formula] = onFormulaThrown.mock.calls[0] as [
      unknown,
      LocalFormula,
    ]
    expect(told).toBe(request)
    expect(result.current.rolling).toBe(true)
    expect(result.current.rolls).toEqual([])
    expect(formula).toMatchObject({
      kind: 'formula',
      label: 'Lantern: Light radius',
      healing: false,
    })
    // With no least it comes to, it may come to less than nothing.
    expect(formula).not.toHaveProperty('minimum')
    const [light, flat, shadow] = formula.terms
    expect([light.text, flat.text, shadow.text]).toEqual(['1d4', '+3', '−2d6'])
    expect(light.values).toHaveLength(1)
    expect(light.value).toBe(light.values[0])
    expect(flat).toEqual({ text: '+3', values: [], value: 3 })
    expect(shadow.values).toHaveLength(2)
    expect(shadow.value).toBe(-(shadow.values[0] + shadow.values[1]))
    expect(formula.total).toBe(light.value + 3 + shadow.value)
    expect(fake.roll.mock.calls[0][0]).toBe(
      `1d4+2d6@${[...light.values, ...shadow.values].join(',')}`,
    )

    await act(async () => {
      landing.resolve([])
      await rolled
    })
    expect(result.current.rolling).toBe(false)
    expect(result.current.rolls).toEqual([formula])
  })

  it('comes to no less than its least, as a hit die spent does, saying so only when its dice and numbers came to less', async () => {
    renderer()
    const random = jest.spyOn(Math, 'random').mockReturnValue(0)
    const { result } = renderHook(() => useSheetRoller())
    const latest = () => result.current.rolls[0] as LocalFormula

    // The die lands on 1; with −3, that's −2.
    await act(() => result.current.rollFormula(hitDie(-3, 1)))
    expect(latest()).toMatchObject({
      label: 'Hit die (d8)',
      total: 1,
      minimum: 1,
      healing: true,
    })
    expect(latest().terms).toEqual([
      { text: '1d8', values: [1], value: 1 },
      { text: '−3', values: [], value: -3 },
    ])
    // Under the 2014 rules, at least none.
    await act(() => result.current.rollFormula(hitDie(-3, 0)))
    expect(latest()).toMatchObject({ total: 0, minimum: 0 })
    // Coming to just the least, or more, it's as it came to.
    await act(() => result.current.rollFormula(hitDie(0, 1)))
    expect(latest().total).toBe(1)
    expect(latest()).not.toHaveProperty('minimum')
    random.mockReturnValue(0.99)
    await act(() => result.current.rollFormula(hitDie(-3, 1)))
    expect(latest().total).toBe(5)
    expect(latest()).not.toHaveProperty('minimum')
  })

  it('throws hit dice of several sizes at once, each die coming to no less than its least, as hit dice spent at once do', async () => {
    const fake = renderer()
    const onFormulaThrown = jest.fn()
    // The d10s land on 1 and 10, the d8 on 5.
    const random = jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.5)
    const { result } = renderHook(() =>
      useSheetRoller(undefined, undefined, onFormulaThrown),
    )
    const latest = () => result.current.rolls[0] as LocalFormula
    const request = hitDice(-3, 1)

    await act(() => result.current.rollFormula(request))
    // In one throw.
    expect(fake.roll).toHaveBeenCalledTimes(1)
    expect(fake.roll.mock.calls[0][0]).toBe('2d10+1d8@1,10,5')
    // Each die with −3 for Constitution, at least 1: 1, 7 and 2. Its dice a term a size, then all
    // their numbers as one, which came to 7, less than they gave back.
    expect(latest()).toEqual({
      kind: 'formula',
      id: expect.any(String),
      label: 'Hit dice (2d10 + 1d8)',
      total: 10,
      healing: true,
      terms: [
        { text: '2d10', values: [1, 10], value: 11 },
        { text: '+1d8', values: [5], value: 5 },
        { text: '−9', values: [], value: -9 },
      ],
      minimum: 1,
      times: 3,
      at: expect.any(Number),
    })
    expect(onFormulaThrown).toHaveBeenCalledWith(request, latest())

    // Under the 2014 rules, each at least none: 0, 0 and 5.
    random
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99)
    await act(() => result.current.rollFormula(hitDice(-3, 0)))
    expect(latest()).toMatchObject({ total: 5, minimum: 0, times: 3 })
    // None came to less than its least: 9, 10 and 5.
    random
      .mockReturnValueOnce(0.8)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.5)
    await act(() => result.current.rollFormula(request))
    expect(latest().total).toBe(15)
    expect(latest()).not.toHaveProperty('minimum')
  })

  it('throws several of one size at once, with no number where Constitution adds none', async () => {
    const fake = renderer()
    // The dice land on 1, 8 and 5.
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.5)
    const { result } = renderHook(() => useSheetRoller())
    const latest = () => result.current.rolls[0] as LocalFormula

    await act(() =>
      result.current.rollFormula({
        label: 'Hit dice (3d8)',
        terms: [],
        sets: [{ terms: [{ sign: 1, count: 1, sides: 8 }], times: 3 }],
        healing: true,
        minimum: 1,
        source: {
          kind: 'hitDice',
          hitDice: [{ denomination: 'd8', count: 3 }],
        },
      }),
    )

    expect(fake.roll.mock.calls[0][0]).toBe('3d8@1,8,5')
    expect(latest()).toMatchObject({
      total: 14,
      terms: [{ text: '3d8', values: [1, 8, 5], value: 14 }],
      times: 3,
    })
    expect(latest()).not.toHaveProperty('minimum')
  })

  it('keeps a formula of numbers alone, with no dice to throw', async () => {
    const fake = renderer()
    const onFormulaThrown = jest.fn()
    const { result } = renderHook(() =>
      useSheetRoller(undefined, undefined, onFormulaThrown),
    )

    await act(() =>
      result.current.rollFormula({
        label: 'Candle roll',
        terms: [{ sign: 1, flat: 5 }],
      }),
    )

    expect(fake.roll).not.toHaveBeenCalled()
    expect(result.current.rolls).toEqual([
      expect.objectContaining({
        kind: 'formula',
        total: 5,
        healing: false,
        terms: [{ text: '5', values: [], value: 5 }],
      }),
    ])
    expect(onFormulaThrown).toHaveBeenCalledWith(
      { label: 'Candle roll', terms: [{ sign: 1, flat: 5 }] },
      result.current.rolls[0],
    )
  })

  it('still rolls, without dice, when the 3D renderer is not ready', async () => {
    const fake = renderer({ isReady: false })
    const { result } = renderHook(() => useSheetRoller())

    await act(() =>
      result.current.roll({ label: 'Strength save', modifier: 7 }),
    )

    expect(fake.roll).not.toHaveBeenCalled()
    expect(result.current.rolls).toHaveLength(1)
  })

  it('keeps the result when the animation fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    renderer({
      roll: jest.fn(async () => {
        throw new Error('lost')
      }),
    })
    const { result } = renderHook(() => useSheetRoller())

    await act(() =>
      result.current.roll({ label: 'Strength save', modifier: 7 }),
    )

    expect(result.current.rolls).toHaveLength(1)
    expect(console.error).toHaveBeenCalled()
  })

  it('stops waiting for dice that never settle', async () => {
    jest.useFakeTimers()
    renderer({ roll: jest.fn(() => new Promise<number[]>(() => {})) })
    const { result } = renderHook(() => useSheetRoller())

    let rolled: Promise<boolean> | undefined
    act(() => {
      rolled = result.current.roll({ label: 'Arcana check', modifier: 2 })
    })
    await act(async () => {
      jest.advanceTimersByTime(ANIMATION_TIMEOUT)
      await rolled
    })
    jest.useRealTimers()

    expect(result.current.rolls).toHaveLength(1)
    expect(result.current.rolling).toBe(false)
  })

  it('keeps rolls in the order they were thrown, should dice thrown later land first', async () => {
    const healing = deferred<number[]>()
    const attack = deferred<number[]>()
    renderer({
      roll: jest
        .fn<Promise<number[]>, [string, object?]>()
        .mockReturnValueOnce(healing.promise)
        .mockReturnValueOnce(attack.promise),
    })
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000)
    const { result } = renderHook(() => useSheetRoller())

    let healed: Promise<boolean> | undefined
    act(() => {
      healed = result.current.rollDamage({
        label: 'Cure Wounds healing',
        parts: [{ terms: [{ sign: 1, count: 2, sides: 8 }], type: 'Healing' }],
        healing: true,
      })
    })
    now.mockReturnValue(2000)
    let attacked: Promise<boolean> | undefined
    act(() => {
      attacked = result.current.roll({
        label: 'Witch Bolt attack',
        modifier: 6,
      })
    })
    await act(async () => {
      attack.resolve([11])
      await attacked
    })
    expect(result.current.rolling).toBe(true)
    await act(async () => {
      healing.resolve([4, 5])
      await healed
    })

    expect(result.current.rolling).toBe(false)
    expect(result.current.rolls.map(roll => roll.label)).toEqual([
      'Witch Bolt attack',
      'Cure Wounds healing',
    ])
  })

  it('keeps a spell or feature used, which throws no dice, first among the rolls', async () => {
    const fake = renderer()
    const { result } = renderHook(() => useSheetRoller())
    await act(() =>
      result.current.roll({ label: 'Perception check', modifier: 0 }),
    )

    let used: ReturnType<typeof result.current.logUse> | undefined
    act(() => {
      used = result.current.logUse('Fireball', true)
    })
    let other: typeof used
    act(() => {
      other = result.current.logUse('Second Wind', false)
    })

    expect(used).toMatchObject({ kind: 'use', label: 'Fireball', spell: true })
    expect(other?.id).not.toBe(used?.id)
    expect(result.current.rolls.map(roll => roll.label)).toEqual([
      'Second Wind',
      'Fireball',
      'Perception check',
    ])
    expect(fake.roll).toHaveBeenCalledTimes(1)
    expect(result.current.rolling).toBe(false)
  })

  it('keeps the table asked for a saving throw, which throws no dice, first among the rolls', async () => {
    const fake = renderer()
    const { result } = renderHook(() => useSheetRoller())
    await act(() =>
      result.current.roll({ label: 'Perception check', modifier: 0 }),
    )

    let asked: ReturnType<typeof result.current.logAsk> | undefined
    act(() => {
      asked = result.current.logAsk('DC 15 Dexterity saving throw')
    })

    expect(asked).toMatchObject({
      kind: 'ask',
      label: 'DC 15 Dexterity saving throw',
    })
    expect(result.current.rolls.map(roll => roll.kind)).toEqual([
      'ask',
      'check',
    ])
    expect(fake.roll).toHaveBeenCalledTimes(1)
  })

  it('marks what a description rolls as its, and a saving throw it calls for with its DC', async () => {
    renderer()
    const onThrown = jest.fn()
    const { result } = renderHook(() => useSheetRoller(onThrown))
    const text = { text: '0f1a2b3c4d5e6f', link: 1 }

    await act(() =>
      result.current.roll({
        label: 'Dexterity saving throw',
        modifier: 1,
        source: { kind: 'save', key: 'dex', ...text },
        dc: 15,
      }),
    )
    await act(() =>
      result.current.rollDamage({
        label: 'Flame damage',
        parts: [{ terms: [{ sign: 1, count: 2, sides: 6 }], type: 'fire' }],
        text,
      }),
    )
    await act(() =>
      result.current.rollFormula({
        label: 'Flame roll',
        terms: [{ sign: 1, count: 1, sides: 4 }],
        source: { kind: 'textRoll', ...text },
      }),
    )
    await act(() =>
      result.current.roll({ label: 'Dexterity saving throw', modifier: 1 }),
    )

    const [plain, formula, damage, save] = result.current.rolls
    expect(save).toMatchObject({ kind: 'check', dc: 15, described: true })
    expect(save).not.toHaveProperty('verdict')
    expect(onThrown.mock.calls[0][1]).toMatchObject({ dc: 15, described: true })
    expect(damage).toMatchObject({ kind: 'damage', described: true })
    expect(formula).toMatchObject({ kind: 'formula', described: true })
    expect(plain).not.toHaveProperty('dc')
    expect(plain).not.toHaveProperty('described')
  })

  it('marks a check a description calls for as its, passed rather than saved against its DC', async () => {
    renderer()
    const { result } = renderHook(() => useSheetRoller())
    const text = { text: '0f1a2b3c4d5e6f', link: 4 }

    for (const source of [
      { kind: 'skill', key: 'ath', ...text },
      { kind: 'tool', key: 'thief', ...text },
      { kind: 'ability', key: 'int', ...text },
    ] as const) {
      await act(() =>
        result.current.roll({ label: 'A check', modifier: 1, source, dc: 15 }),
      )
    }
    // Without a DC, as one whose DC the game keeps from the player, it's still passed or not.
    await act(() =>
      result.current.roll({
        label: 'Intelligence check',
        modifier: -1,
        source: { kind: 'ability', key: 'int', ...text },
      }),
    )
    await act(() =>
      result.current.roll({
        label: 'Athletics check',
        modifier: 7,
        source: { kind: 'skill', key: 'ath' },
      }),
    )

    const [plain, undecided, ...checks] = result.current.rolls
    for (const check of checks) {
      expect(check).toMatchObject({
        kind: 'check',
        dc: 15,
        verdict: 'check',
        described: true,
      })
    }
    expect(undecided).toMatchObject({ described: true, verdict: 'check' })
    expect(undecided).not.toHaveProperty('dc')
    expect(plain).not.toHaveProperty('described')
    expect(plain).not.toHaveProperty('verdict')
  })

  it('marks a check an activity asks for as passed rather than saved against its DC, never as from a description', async () => {
    renderer()
    const { result } = renderHook(() => useSheetRoller())
    const named = { item: 'tools', activity: 'pick' }

    for (const source of [
      { kind: 'skill', key: 'slt', ...named },
      { kind: 'tool', key: 'thief', ...named },
      { kind: 'ability', key: 'dex', ...named },
    ] as const) {
      await act(() =>
        result.current.roll({ label: 'A check', modifier: 6, source, dc: 15 }),
      )
    }
    // Against no DC, as Fast Hands', it's still passed or not, where the game says.
    await act(() =>
      result.current.roll({
        label: 'Sleight of Hand check',
        modifier: 5,
        source: { kind: 'skill', key: 'slt', item: 'hands', activity: 'slt' },
      }),
    )

    const [undecided, ...checks] = result.current.rolls
    for (const check of checks) {
      expect(check).toMatchObject({ kind: 'check', dc: 15, verdict: 'check' })
      expect(check).not.toHaveProperty('described')
    }
    expect(undecided).toMatchObject({ verdict: 'check' })
    expect(undecided).not.toHaveProperty('dc')
    expect(undecided).not.toHaveProperty('described')
  })

  it(`keeps the latest ${ROLL_HISTORY} rolls, newest first`, async () => {
    renderer()
    const { result } = renderHook(() => useSheetRoller())

    for (let n = 1; n <= ROLL_HISTORY + 2; n++) {
      await act(() => result.current.roll({ label: `Roll ${n}`, modifier: 0 }))
    }

    expect(result.current.rolls).toHaveLength(ROLL_HISTORY)
    expect(result.current.rolls[0].label).toBe(`Roll ${ROLL_HISTORY + 2}`)
  })
})

describe('hooks/use-sheet-roller, items and coins moved, from module 0.31.0', () => {
  it('keeps a move first among the rolls, as a use, named for what moved', () => {
    renderer()
    const { result } = renderHook(() => useSheetRoller())
    const move = {
      verb: 'give' as const,
      things: '2 Potion of Healing',
      other: 'The Iron Company',
      item: 'potion',
    }

    let moved: ReturnType<typeof result.current.logMove> | undefined
    act(() => {
      result.current.logCharge('Sorcery Points', { spent: 1 })
      moved = result.current.logMove(move)
    })

    expect(moved).toEqual({
      kind: 'use',
      id: expect.stringMatching(/^use-/),
      label: '2 Potion of Healing',
      spell: false,
      move,
      at: expect.any(Number),
    })
    expect(result.current.rolls[0]).toBe(moved)
    expect(result.current.rolls).toHaveLength(2)
  })
})
