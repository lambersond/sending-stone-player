import { act, renderHook, waitFor } from '@testing-library/react'
import { useDiceTray } from './use-dice-tray'
import { SEND_KEY } from '@/features/rolling/constants'
import { rollServer } from '@/utils/test-utils'
import type { RollKind } from '@/types/roll'

// No WebGL here: the renderer is never ready, so each roll lands at once, on the app's own dice.
jest.mock(
  '@lambersond/3d-dice-react',
  () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
)

/** The game of module 0.44.0, which takes a plain roll; and one before it, which takes formulas. */
const TAKES: RollKind[] = ['skill', 'formula', 'plainRoll']
const OLDER: RollKind[] = ['skill', 'formula']

const trayOf = (kinds: RollKind[] = TAKES) =>
  renderHook(() => useDiceTray({ characterId: 'char-1', kinds, typing: false }))

let posted: Record<string, unknown>[]

beforeEach(() => {
  localStorage.clear()
  posted = rollServer()
})

describe('features/rolling/components/dice-tray/use-dice-tray', () => {
  it('keeps the dice by size, smallest first, takes them away and clears them, the number added too', () => {
    const { result } = trayOf()
    act(() => result.current.add(8))
    act(() => result.current.add(6))
    act(() => result.current.add(6))
    act(() => result.current.step(1))
    expect(result.current.dice).toEqual([
      { sides: 6, count: 2 },
      { sides: 8, count: 1 },
    ])
    expect(result.current.bonus).toBe(1)
    act(() => result.current.remove(8))
    expect(result.current.dice).toEqual([{ sides: 6, count: 2 }])
    act(() => result.current.clear())
    expect(result.current.dice).toEqual([])
    expect(result.current.bonus).toBe(0)
  })

  it('adds no more than 20 dice, and steps the number no further than 100 either way', () => {
    const { result } = trayOf()
    for (let die = 0; die < 21; die++) act(() => result.current.add(6))
    act(() => result.current.add(4))
    expect(result.current.dice).toEqual([{ sides: 6, count: 20 }])
    expect(result.current.room).toBe(false)
    for (let step = 0; step < 101; step++) act(() => result.current.step(-1))
    expect(result.current.bonus).toBe(-100)
  })

  it('rolls nothing with no dice, a number added or not', async () => {
    const { result } = trayOf()
    act(() => result.current.step(1))
    await act(async () => result.current.roll())
    expect(result.current.latest).toBeUndefined()
    expect(posted).toHaveLength(0)
  })

  it('rolls its dice, keeps them for the next roll, and sends the game the values thrown, as a plain roll', async () => {
    const { result } = trayOf()
    act(() => result.current.add(8))
    act(() => result.current.add(6))
    act(() => result.current.add(6))
    act(() => result.current.step(1))
    act(() => result.current.step(1))
    await act(async () => result.current.roll())
    await waitFor(() => expect(posted).toHaveLength(1))

    const roll = result.current.latest?.roll
    expect(roll?.label).toBe('Dice (2d6 + 1d8 + 2)')
    expect(posted[0]).toEqual({
      kind: 'plainRoll',
      plainRoll: {
        terms: [
          { faces: 6, count: 2 },
          { faces: 8, count: 1 },
        ],
        bonus: 2,
      },
      mode: 0,
      explicit: false,
      extras: [],
      dice: [
        { faces: 6, results: roll?.terms[0].values },
        { faces: 8, results: roll?.terms[1].values },
      ],
    })
    expect(result.current.latest?.state?.status).toBeDefined()
    expect(result.current.dice).toHaveLength(2)
  })

  it.each([
    ['a module before 0.44.0', OLDER, 'on'],
    ['Send to the table off', TAKES, 'off'],
  ])(
    'rolls here only, sending nothing, with %s',
    async (_name, kinds, sending) => {
      localStorage.setItem(SEND_KEY, sending)
      const { result } = trayOf(kinds)
      act(() => result.current.add(20))
      await act(async () => result.current.roll())
      expect(result.current.latest?.roll.label).toBe('Dice (1d20)')
      expect(result.current.latest?.state).toBeUndefined()
      expect(posted).toHaveLength(0)
    },
  )
})
