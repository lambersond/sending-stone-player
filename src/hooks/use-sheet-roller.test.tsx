import { useDiceRenderer } from '@lambersond/3d-dice-react'
import { act, renderHook } from '@testing-library/react'
import {
  ANIMATION_TIMEOUT,
  ROLL_HISTORY,
  useSheetRoller,
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
    const [roll] = result.current.rolls
    expect(roll).toMatchObject({ label: 'Perception check', modifier: 5 })
    expect(roll.d20s).toHaveLength(1)
    expect(roll.total).toBe(roll.natural + 5)
    expect(fake.roll.mock.calls[0][0]).toBe(`1d20@${roll.natural}`)
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

    const [roll] = result.current.rolls
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

    const [roll] = result.current.rolls
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
