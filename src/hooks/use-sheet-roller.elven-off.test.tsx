import { useDiceRenderer } from '@lambersond/3d-dice-react'
import { act, renderHook } from '@testing-library/react'
import {
  useSheetRoller,
  type LocalCheck,
  type SheetRoll,
  type TypedRolls,
} from './use-sheet-roller'
import { BLESS_DIE } from '@/mocks/sending-stone'
import type { DiceEntry, EnterDice } from '@/types/dice-entry'
import type { SheetEffectDie } from '@/types/sending-stone'

jest.mock('@lambersond/3d-dice-react', () => ({ useDiceRenderer: jest.fn() }))

// Round 0.42.1 §0.8.4: Elven Accuracy's line is dropped by one switch, `ELVEN_LINE`, never by
// reverting its commit. Turned off, the roller asks the third d20 with the other two, exactly as
// 0.42.0 did: these are 0.42.0's tests of it (use-sheet-roller.typed.test.tsx), copied before
// round 0.42.1 changed them, and Skip never offered, though the roll goes to the game.
jest.mock('@/utils/typed-dice', () => ({
  ...jest.requireActual('@/utils/typed-dice'),
  ELVEN_LINE: false,
}))

const renderer = () => {
  const fake = {
    isReady: true,
    roll: jest.fn<Promise<number[]>, [string, object?]>(async () => []),
  }
  jest.mocked(useDiceRenderer).mockReturnValue(fake as any)
  return fake
}

/** The player, typing in these dice for each roll, in turn. */
function typing(...answers: (number[][] | undefined)[]) {
  const asked: DiceEntry[] = []
  const enter = jest.fn<ReturnType<EnterDice>, Parameters<EnterDice>>(
    async entry => {
      asked.push(entry)
      return answers.shift()
    },
  )
  return { enter, asked }
}

function setUp(enter?: EnterDice, typedRolls?: TypedRolls) {
  const onThrown = jest.fn()
  const hook = renderHook(() =>
    useSheetRoller(onThrown, undefined, undefined, enter, typedRolls),
  )
  return { ...hook, onThrown }
}

/** Roll it, and what it resolved to. */
async function rolled<T>(roll: () => Promise<T>): Promise<T> {
  let done: T | undefined
  await act(async () => {
    done = await roll()
  })
  return done as T
}

/** The roller as the pane makes it while typing: these effects' dice, every roll sent. */
const sent = (effects: SheetEffectDie[] = []): TypedRolls => ({
  effectsFor: () => effects,
  keptRerolls: false,
  sends: () => true,
})

const rapierAttack: SheetRoll = {
  label: 'Rapier attack',
  modifier: 7,
  advantage: 'adv',
  elvenAccuracy: true,
  source: { kind: 'attack', item: 'rapier', activity: 'rapierAttack' },
}

describe('hooks/use-sheet-roller, with Elven Accuracy’s line switched off', () => {
  afterEach(() => jest.restoreAllMocks())

  it('asks for three d20s only with advantage where dnd5e gives the attack Elven Accuracy', async () => {
    renderer()
    const { enter, asked } = typing([[3, 18, 7]], [[3, 9]], [[11]])
    const { result } = setUp(enter)
    const rapier: SheetRoll = {
      label: 'Rapier attack',
      modifier: 7,
      elvenAccuracy: true,
    }

    await rolled(() => result.current.roll({ ...rapier, advantage: 'adv' }))
    await rolled(() => result.current.roll({ ...rapier, advantage: 'dis' }))
    await rolled(() => result.current.roll(rapier))

    expect(asked.map(({ terms }) => terms[0])).toEqual([
      { sides: 20, count: 3, label: 'd20, advantage (Elven Accuracy)' },
      { sides: 20, count: 2, label: 'd20, disadvantage' },
      { sides: 20, count: 1, label: 'd20' },
    ])
    const [plain, dis, adv] = result.current.rolls as LocalCheck[]
    expect(adv).toMatchObject({ d20s: [3, 18, 7], natural: 18, total: 25 })
    expect(dis).toMatchObject({ d20s: [3, 9], natural: 3 })
    expect(plain).toMatchObject({ d20s: [11], natural: 11 })
  })

  it('keeps the three boxes of Elven Accuracy as one group, the effects after', async () => {
    renderer()
    const { enter, asked } = typing([[3, 18, 7], [4]])
    const { result } = setUp(enter, sent([BLESS_DIE]))

    await rolled(() => result.current.roll(rapierAttack))

    expect(asked[0].terms.map(({ label, count }) => [label, count])).toEqual([
      ['d20, advantage (Elven Accuracy)', 3],
      ['Bless: +1d4', 1],
    ])
    const [roll] = result.current.rolls as LocalCheck[]
    expect(roll).toMatchObject({ d20s: [3, 18, 7], natural: 18 })
    expect(roll.total).toBe(18 + 7 + 4)
    // Bless's place is the second, as 0.42.0 counted it.
    expect(asked[0].skippedWords?.([1])).toBe('not counting Bless’s d4')
  })

  it('offers no Skip of a third d20, nor words for one, though the roll goes to the game', async () => {
    renderer()
    const { enter, asked } = typing([[3, 18, 7]])
    const { result, onThrown } = setUp(enter, sent())

    await rolled(() => result.current.roll(rapierAttack))

    expect(asked[0].terms).toEqual([
      { sides: 20, count: 3, label: 'd20, advantage (Elven Accuracy)' },
    ])
    expect(asked[0]).not.toHaveProperty('skippedWords')
    const [roll] = result.current.rolls as LocalCheck[]
    expect(roll).not.toHaveProperty('skipped')
    expect(onThrown).toHaveBeenCalledWith(rapierAttack, roll)
  })
})
