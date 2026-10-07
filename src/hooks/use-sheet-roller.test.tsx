/* eslint-disable unicorn/no-null -- a damage part without a kind has null */
import { useDiceRenderer } from '@lambersond/3d-dice-react'
import { act, renderHook } from '@testing-library/react'
import {
  ANIMATION_TIMEOUT,
  ROLL_HISTORY,
  useSheetRoller,
  type LocalCheck,
  type LocalDamage,
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
