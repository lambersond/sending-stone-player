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

    let rolled: Promise<void> | undefined
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

    let rolled: Promise<void> | undefined
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
    expect(roll.total).toBe(dice.value + 3 + less.value)
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

    let rolled: Promise<void> | undefined
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

  it('throws several of a formula together, each coming to no less than its least, as hit dice spent at once do', async () => {
    const fake = renderer()
    const onFormulaThrown = jest.fn()
    // The dice land on 1, 8 and 5.
    const random = jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.5)
    const { result } = renderHook(() =>
      useSheetRoller(undefined, undefined, onFormulaThrown),
    )
    const latest = () => result.current.rolls[0] as LocalFormula
    const request = { ...hitDie(-3, 1), label: 'Hit dice (3d8)', times: 3 }

    await act(() => result.current.rollFormula(request))
    // In one throw.
    expect(fake.roll).toHaveBeenCalledTimes(1)
    expect(fake.roll.mock.calls[0][0]).toBe('3d8@1,8,5')
    // Each die with −3 for Constitution, at least 1: 1, 5 and 2. Its terms as one, all its dice
    // and numbers, which came to 5, less than they gave back.
    expect(latest()).toEqual({
      kind: 'formula',
      id: expect.any(String),
      label: 'Hit dice (3d8)',
      total: 8,
      healing: true,
      terms: [
        { text: '3d8', values: [1, 8, 5], value: 14 },
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
    await act(() =>
      result.current.rollFormula({ ...request, ...hitDie(-3, 0), times: 3 }),
    )
    expect(latest()).toMatchObject({ total: 5, minimum: 0, times: 3 })
    // None came to less than its least: 4, 5 and 2.
    random
      .mockReturnValueOnce(0.8)
      .mockReturnValueOnce(0.99)
      .mockReturnValueOnce(0.5)
    await act(() => result.current.rollFormula(request))
    expect(latest().total).toBe(11)
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

    let rolled: Promise<void> | undefined
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

    let healed: Promise<void> | undefined
    act(() => {
      healed = result.current.rollDamage({
        label: 'Cure Wounds healing',
        parts: [{ terms: [{ sign: 1, count: 2, sides: 8 }], type: 'Healing' }],
        healing: true,
      })
    })
    now.mockReturnValue(2000)
    let attacked: Promise<void> | undefined
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
