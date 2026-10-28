/* eslint-disable unicorn/no-null -- a damage part without a kind has null */
import { useDiceRenderer } from '@lambersond/3d-dice-react'
import { act, renderHook } from '@testing-library/react'
import {
  MOST_EXTRAS,
  REROLL_NOTE,
  useSheetRoller,
  type LocalCheck,
  type LocalDamage,
  type LocalFormula,
  type SheetDamageRoll,
  type SheetFormulaRoll,
  type SheetRoll,
  type TypedRolls,
} from './use-sheet-roller'
import { damageRollOf, toRollRequest } from './use-table-rolls'
import { shownTotal } from '@/components/character-sheet/roll-tray'
import { BANE_DIE, BLESS_DIE, INSPIRATION_DIE } from '@/mocks/sending-stone'
import { MAX_EXTRAS } from '@/schemas/roll-request'
import type { DiceEntry, EnterDice } from '@/types/dice-entry'
import type { DamagePreview, SheetEffectDie } from '@/types/sending-stone'
import type { SheetOffer } from '@/utils/effect-dice'

jest.mock('@lambersond/3d-dice-react', () => ({ useDiceRenderer: jest.fn() }))

// Rolls whose dice the player types in from their own (module 0.32.0): asked for once their dice
// are known, kept at once, never animated, and built as the app's own throw would be.

const renderer = () => {
  const fake = {
    isReady: true,
    roll: jest.fn<Promise<number[]>, [string, object?]>(async () => []),
  }
  jest.mocked(useDiceRenderer).mockReturnValue(fake as any)
  return fake
}

/** The player, typing in these dice for each roll, in turn; or cancelling where none are given. */
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

/** A term of dice: so many of a die, added, unless taken away. */
const d = (
  count: number,
  sides: 4 | 6 | 8 | 10 | 12 | 20 | 100,
  sign: 1 | -1 = 1,
  modifiers?: string[],
) => ({ sign, count, sides, ...(modifiers && { modifiers }) })

const flat = (value: number) => ({
  sign: (value < 0 ? -1 : 1) as 1 | -1,
  flat: Math.abs(value),
})

function setUp(enter?: EnterDice) {
  const onThrown = jest.fn()
  const onDamageThrown = jest.fn()
  const onFormulaThrown = jest.fn()
  const hook = renderHook(() =>
    useSheetRoller(onThrown, onDamageThrown, onFormulaThrown, enter),
  )
  return { ...hook, onThrown, onDamageThrown, onFormulaThrown }
}

/** Roll it, and what it resolved to. */
async function rolled<T>(roll: () => Promise<T>): Promise<T> {
  let done: T | undefined
  await act(async () => {
    done = await roll()
  })
  return done as T
}

/** As the game said an attack's damage will be rolled. */
const preview = (fields: Partial<DamagePreview> = {}): DamagePreview => ({
  critical: false,
  plannable: true,
  rolls: [
    {
      formula: '1d8 + 3',
      type: 'Slashing',
      dice: [{ faces: 8, number: 1 }],
    },
  ],
  ...fields,
})

describe('hooks/use-sheet-roller, typed dice (module 0.32.0)', () => {
  afterEach(() => jest.restoreAllMocks())

  describe('a d20 roll', () => {
    const perception: SheetRoll = { label: 'Perception check', modifier: 5 }

    it('asks for one d20, keeps it at once as typed, and never animates', async () => {
      const fake = renderer()
      const { enter, asked } = typing([[17]])
      const { result, onThrown } = setUp(enter)

      const kept = await rolled(() => result.current.roll(perception))

      expect(kept).toBe(true)
      expect(asked).toHaveLength(1)
      expect(asked[0]).toMatchObject({
        title: 'Perception check',
        terms: [{ sides: 20, count: 1, label: 'd20' }],
      })
      const [roll] = result.current.rolls as LocalCheck[]
      expect(roll).toMatchObject({
        kind: 'check',
        d20s: [17],
        natural: 17,
        total: 22,
        typed: true,
      })
      expect(onThrown).toHaveBeenCalledWith(perception, roll)
      expect(fake.roll).not.toHaveBeenCalled()
      expect(result.current.rolling).toBe(false)
    })

    it('asks for two d20s with advantage or disadvantage, keeping the higher or the lower', async () => {
      renderer()
      const { enter, asked } = typing([[4, 15]], [[4, 15]])
      const { result } = setUp(enter)

      await rolled(() =>
        result.current.roll({ ...perception, advantage: 'adv' }),
      )
      await rolled(() =>
        result.current.roll({ ...perception, advantage: 'dis' }),
      )

      expect(asked.map(({ terms }) => terms[0])).toEqual([
        { sides: 20, count: 2, label: 'd20, advantage' },
        { sides: 20, count: 2, label: 'd20, disadvantage' },
      ])
      const [dis, adv] = result.current.rolls as LocalCheck[]
      expect(adv).toMatchObject({ d20s: [4, 15], natural: 15, total: 20 })
      expect(dis).toMatchObject({ d20s: [4, 15], natural: 4, total: 9 })
    })

    // Changed on purpose (round 0.42.1 §7.2): the third d20 on a line of its own after the two,
    // with no Skip where the roll isn't sent; its value kept among the d20s.
    it('asks for a third d20 only with advantage where dnd5e gives the attack Elven Accuracy, on its own line', async () => {
      renderer()
      const { enter, asked } = typing([[3, 18], [7]], [[3, 9]], [[11]])
      const { result } = setUp(enter)
      const rapier: SheetRoll = {
        label: 'Rapier attack',
        modifier: 7,
        elvenAccuracy: true,
      }

      await rolled(() => result.current.roll({ ...rapier, advantage: 'adv' }))
      await rolled(() => result.current.roll({ ...rapier, advantage: 'dis' }))
      await rolled(() => result.current.roll(rapier))

      expect(asked[0].terms).toEqual([
        { sides: 20, count: 2, label: 'd20, advantage' },
        {
          sides: 20,
          count: 1,
          label: 'Elven Accuracy: third d20',
          name: 'Elven Accuracy',
        },
      ])
      expect(asked.slice(1).map(({ terms }) => terms)).toEqual([
        [{ sides: 20, count: 2, label: 'd20, disadvantage' }],
        [{ sides: 20, count: 1, label: 'd20' }],
      ])
      const [plain, dis, adv] = result.current.rolls as LocalCheck[]
      expect(adv).toMatchObject({ d20s: [3, 18, 7], natural: 18, total: 25 })
      expect(dis).toMatchObject({ d20s: [3, 9], natural: 3 })
      expect(plain).toMatchObject({ d20s: [11], natural: 11 })
    })

    it('types in each die the player added, as written, a die taken away subtracted', async () => {
      renderer()
      const { enter, asked } = typing([[12], [3], [2, 5]])
      const { result } = setUp(enter)

      await rolled(() =>
        result.current.roll({
          ...perception,
          extras: [d(1, 4), flat(2), d(2, 6, -1)],
        }),
      )

      expect(asked[0].terms).toEqual([
        { sides: 20, count: 1, label: 'd20' },
        { sides: 4, count: 1, label: '+1d4' },
        { sides: 6, count: 2, label: '−2d6' },
      ])
      const [roll] = result.current.rolls as LocalCheck[]
      expect(roll.extras).toEqual([
        { text: '+1d4', values: [3], value: 3 },
        { text: '+2', values: [], value: 2 },
        { text: '−2d6', values: [2, 5], value: -7 },
      ])
      expect(roll.total).toBe(12 + 5 + 3 + 2 - 7)
    })

    it('keeps nothing, sends nothing and resolves false when the player cancels', async () => {
      const fake = renderer()
      const { enter } = typing()
      const { result, onThrown } = setUp(enter)

      const kept = await rolled(() => result.current.roll(perception))

      expect(kept).toBe(false)
      expect(result.current.rolls).toEqual([])
      expect(onThrown).not.toHaveBeenCalled()
      expect(fake.roll).not.toHaveBeenCalled()
    })

    it('asks until when the game waits for an answer, and with what tells it the answer was given elsewhere', async () => {
      renderer()
      const { enter, asked } = typing([[9]])
      const { result } = setUp(enter)
      const signal = new AbortController().signal

      await rolled(() =>
        result.current.roll({
          label: 'Dexterity saving throw',
          modifier: 2,
          until: '2026-10-20T12:10:00.000Z',
          signal,
        }),
      )

      expect(asked[0].until).toBe('2026-10-20T12:10:00.000Z')
      expect(asked[0].signal).toBe(signal)
    })

    it('comes to, as typed so far, what it will be kept as: a d20 not typed counts nothing', async () => {
      renderer()
      const { enter, asked } = typing([[5, 12], [3]], [[5, 12]])
      const { result } = setUp(enter)

      await rolled(() =>
        result.current.roll({
          ...perception,
          advantage: 'adv',
          extras: [d(1, 4)],
        }),
      )
      await rolled(() =>
        result.current.roll({ ...perception, advantage: 'dis' }),
      )

      const [adv, dis] = asked
      expect(adv.total([[undefined, undefined], [undefined]])).toBe(5)
      expect(adv.total([[5, undefined], [undefined]])).toBe(10)
      expect(adv.total([[undefined, 12], [3]])).toBe(20)
      expect(dis.total([[5, undefined]])).toBe(10)
      expect(dis.total([[undefined, undefined]])).toBe(5)
      // Once every die is typed, what it came to is what's kept.
      const [kept, first] = result.current.rolls as LocalCheck[]
      expect(adv.total([[5, 12], [3]])).toBe(first.total)
      expect(dis.total([[5, 12]])).toBe(kept.total)
    })

    it("throws the app's own two d20s without typing, Elven Accuracy or not", async () => {
      const fake = renderer()
      const { result } = setUp()

      await rolled(() =>
        result.current.roll({
          ...perception,
          advantage: 'adv',
          elvenAccuracy: true,
        }),
      )

      const [roll] = result.current.rolls as LocalCheck[]
      expect(roll.d20s).toHaveLength(2)
      expect(roll).not.toHaveProperty('typed')
      expect(fake.roll).toHaveBeenCalledWith(
        expect.stringMatching(/^2d20@\d+,\d+$/),
        expect.any(Object),
      )
    })
  })

  describe('damage', () => {
    const longsword: SheetDamageRoll = {
      label: 'Longsword damage',
      parts: [{ terms: [d(1, 8), flat(3)], type: 'Slashing' }],
    }
    it("asks for a local critical hit's dice doubled, keeping them at once, never animated", async () => {
      const fake = renderer()
      const { enter, asked } = typing([[3, 6]])
      const { result, onDamageThrown } = setUp(enter)

      const kept = await rolled(() =>
        result.current.rollDamage({ ...longsword, critical: true }),
      )

      expect(kept).toBe(true)
      expect(asked[0]).toMatchObject({
        title: 'Longsword damage',
        terms: [{ sides: 8, count: 2, label: '2d8 Slashing' }],
      })
      const [damage] = result.current.rolls as LocalDamage[]
      expect(damage).toMatchObject({ total: 12, critical: true, typed: true })
      expect(damage.parts[0].terms[0]).toMatchObject({
        text: '2d8',
        values: [3, 6],
      })
      expect(onDamageThrown).toHaveBeenCalled()
      expect(fake.roll).not.toHaveBeenCalled()
    })

    it("asks for the game's own dice of a critical hit as it doubled them, not doubled again", async () => {
      renderer()
      const { enter, asked } = typing([[2, 7]])
      const { result } = setUp(enter)
      const critical = preview({
        critical: true,
        rolls: [
          {
            formula: '2d8 + 3',
            type: 'Slashing',
            dice: [{ faces: 8, number: 2 }],
            perDie: 2,
          },
        ],
      })

      await rolled(() =>
        result.current.rollDamage(
          damageRollOf('Longsword', { use: 'req-1', damage: critical }),
        ),
      )

      expect(asked[0].terms).toEqual([
        { sides: 8, count: 2, label: '2d8 Slashing' },
      ])
      expect((result.current.rolls[0] as LocalDamage).total).toBe(12)
    })

    it('asks for more dice and another die as the player changed them, and a die taken away named so', async () => {
      renderer()
      const { enter, asked } = typing([[2, 3, 4]], [[9]], [[5], [4]])
      const { result } = setUp(enter)

      await rolled(() =>
        result.current.rollDamage({ ...longsword, modifiers: { extra: 2 } }),
      )
      await rolled(() =>
        result.current.rollDamage({ ...longsword, modifiers: { faces: 12 } }),
      )
      await rolled(() =>
        result.current.rollDamage({
          label: 'Reduced damage',
          parts: [{ terms: [d(1, 8), d(1, 4, -1)], type: null }],
        }),
      )

      expect(asked.map(({ terms }) => terms)).toEqual([
        [{ sides: 8, count: 3, label: '3d8 Slashing' }],
        [{ sides: 12, count: 1, label: '1d12 Slashing' }],
        [
          { sides: 8, count: 1, label: '1d8' },
          { sides: 4, count: 1, label: '−1d4' },
        ],
      ])
      const [reduced, bigger, more] = result.current.rolls as LocalDamage[]
      expect(more.total).toBe(12)
      expect(bigger.total).toBe(12)
      expect(reduced.total).toBe(1)
    })

    it('never asks for damage at its highest, nor damage only the game can plan', async () => {
      const fake = renderer()
      const { enter } = typing()
      const { result } = setUp(enter)

      await rolled(() =>
        result.current.rollDamage({
          ...longsword,
          modifiers: { maximize: true },
        }),
      )
      await rolled(() =>
        result.current.rollDamage(
          damageRollOf('Club', {
            use: 'req-2',
            damage: preview({ plannable: false }),
          }),
        ),
      )

      expect(enter).not.toHaveBeenCalled()
      const [unplanned, maximized] = result.current.rolls as LocalDamage[]
      expect(maximized).toMatchObject({ total: 11, maximized: true })
      expect(maximized).not.toHaveProperty('typed')
      expect(unplanned).not.toHaveProperty('typed')
      expect(fake.roll).toHaveBeenCalledTimes(1)
    })

    it("throws no die again for a reroll, leaving the game's total to count", async () => {
      renderer()
      const { enter, asked } = typing([[1, 5]])
      const { result } = setUp(enter)
      const random = jest.spyOn(Math, 'random')

      await rolled(() =>
        result.current.rollDamage({
          label: 'Greatsword damage',
          parts: [{ terms: [d(2, 6, 1, ['r<=2']), flat(4)], type: 'Slashing' }],
        }),
      )

      expect(asked[0].terms).toEqual([
        { sides: 6, count: 2, label: '2d6r<=2 Slashing' },
      ])
      const [damage] = result.current.rolls as LocalDamage[]
      expect(damage.gameTotal).toBe(true)
      expect(damage.parts[0].terms[0].values).toEqual([1, 5])
      // The 1 that Foundry rerolls is thrown again there, never here.
      expect(damage.parts[0].terms[0].thrown).toEqual([
        { value: 1, active: true },
        { value: 5, active: true },
      ])
      expect(random).not.toHaveBeenCalled()
      // What its first throw comes to, until the game says.
      expect(damage.total).toBe(10)
    })

    it('keeps what Foundry keeps of a typed first throw, as the highest three of 4d6', async () => {
      renderer()
      const { enter, asked } = typing([[1, 2, 3, 4]])
      const { result } = setUp(enter)

      await rolled(() =>
        result.current.rollDamage({
          label: 'Stat damage',
          parts: [{ terms: [d(4, 6, 1, ['kh3'])], type: null }],
        }),
      )

      const [damage] = result.current.rolls as LocalDamage[]
      expect(damage.total).toBe(9)
      expect(damage.gameTotal).toBeUndefined()
      expect(asked[0].total([[1, 2, 3, 4]])).toBe(9)
    })

    it('comes to, as typed so far, what it will be kept as', async () => {
      renderer()
      const { enter, asked } = typing([[3, 6], [2]], [[1, 5]])
      const { result } = setUp(enter)

      await rolled(() =>
        result.current.rollDamage({
          label: 'Flame tongue damage',
          parts: [
            { terms: [d(1, 8), flat(3)], type: 'Slashing' },
            { terms: [d(1, 4, -1)], type: 'Fire' },
          ],
          critical: true,
        }),
      )
      await rolled(() =>
        result.current.rollDamage({
          label: 'Greatsword damage',
          parts: [{ terms: [d(2, 6, 1, ['r<=2']), flat(4)], type: 'Slashing' }],
        }),
      )

      const [flame, greatsword] = asked
      expect(flame.terms).toEqual([
        { sides: 8, count: 2, label: '2d8 Slashing' },
        { sides: 4, count: 2, label: '−2d4 Fire' },
      ])
      expect(
        flame.total([
          [undefined, undefined],
          [undefined, undefined],
        ]),
      ).toBe(3)
      expect(
        flame.total([
          [3, undefined],
          [undefined, undefined],
        ]),
      ).toBe(6)
      const [kept, first] = result.current.rolls as LocalDamage[]
      expect(
        flame.total([
          [3, 6],
          [2, 2],
        ]),
      ).toBe(
        // Each kind at least 0, as dnd5e's card adds damage up.
        12,
      )
      expect(first.total).toBe(12)
      expect(greatsword.total([[1, 5]])).toBe(kept.total)
      expect(greatsword.total([[undefined, 5]])).toBe(9)
    })
  })

  describe('formulas and hit dice', () => {
    it("asks for a formula's dice, term by term, and never animates", async () => {
      const fake = renderer()
      const { enter, asked } = typing([[3], [5]])
      const { result, onFormulaThrown } = setUp(enter)
      const light: SheetFormulaRoll = {
        label: 'Light radius',
        terms: [d(1, 4), d(1, 6), flat(2)],
        source: { kind: 'formula', item: 'light', activity: 'radius' },
      }

      const kept = await rolled(() => result.current.rollFormula(light))

      expect(kept).toBe(true)
      expect(asked[0]).toMatchObject({
        title: 'Light radius',
        terms: [
          { sides: 4, count: 1, label: '1d4' },
          { sides: 6, count: 1, label: '+1d6' },
        ],
      })
      const [formula] = result.current.rolls as LocalFormula[]
      expect(formula).toMatchObject({ total: 10, typed: true })
      expect(formula.terms.map(({ values }) => values)).toEqual([[3], [5], []])
      expect(onFormulaThrown).toHaveBeenCalledWith(light, formula)
      expect(asked[0].total([[3], [5]])).toBe(formula.total)
      expect(asked[0].total([[undefined], [5]])).toBe(7)
      // Kept at once, as typed: no dice thrown on screen.
      expect(fake.roll).not.toHaveBeenCalled()
      expect(result.current.rolling).toBe(false)
    })

    it('asks for hit dice spent at once a box each, each time at least its least, never animated', async () => {
      const fake = renderer()
      const { enter, asked } = typing([[1, 7], [2]])
      const { result } = setUp(enter)
      const spent: SheetFormulaRoll = {
        label: 'Hit dice (2d10 + 1d8)',
        terms: [],
        sets: [
          { terms: [d(1, 10), flat(-2)], times: 2 },
          { terms: [d(1, 8), flat(-2)], times: 1 },
        ],
        healing: true,
        minimum: 1,
        source: {
          kind: 'hitDice',
          hitDice: [
            { denomination: 'd10', count: 2 },
            { denomination: 'd8', count: 1 },
          ],
        },
      }

      await rolled(() => result.current.rollFormula(spent))

      expect(asked[0].terms).toEqual([
        { sides: 10, count: 2, label: '2d10' },
        { sides: 8, count: 1, label: '+1d8' },
      ])
      const [formula] = result.current.rolls as LocalFormula[]
      // 1 − 2 and 2 − 2 each give back 1; 7 − 2 gives 5.
      expect(formula.total).toBe(7)
      expect(formula.times).toBe(3)
      // Their numbers, −2 each time, after their dice.
      expect(formula.terms.map(({ values }) => values)).toEqual([
        [1, 7],
        [2],
        [],
      ])
      expect(asked[0].total([[1, 7], [2]])).toBe(formula.total)
      // A time with nothing typed yet still gives back its least.
      expect(asked[0].total([[undefined, undefined], [undefined]])).toBe(3)
      expect(fake.roll).not.toHaveBeenCalled()
      expect(result.current.rolling).toBe(false)
    })

    it('takes a d100 typed as one number, never animated', async () => {
      const fake = renderer()
      const { enter, asked } = typing([[100]])
      const { result } = setUp(enter)

      await rolled(() =>
        result.current.rollFormula({
          label: 'Wild magic',
          terms: [d(1, 100)],
          source: { kind: 'textRoll', text: 'a'.repeat(16), link: 0 },
        }),
      )

      expect(asked[0].terms).toEqual([{ sides: 100, count: 1, label: '1d100' }])
      expect(result.current.rolls[0]).toMatchObject({
        total: 100,
        typed: true,
        described: true,
      })
      expect(fake.roll).not.toHaveBeenCalled()
      expect(result.current.rolling).toBe(false)
    })

    it('keeps nothing when the player cancels', async () => {
      renderer()
      const { enter } = typing()
      const { result, onFormulaThrown } = setUp(enter)

      const kept = await rolled(() =>
        result.current.rollFormula({ label: 'Hit die (d8)', terms: [d(1, 8)] }),
      )

      expect(kept).toBe(false)
      expect(result.current.rolls).toEqual([])
      expect(onFormulaThrown).not.toHaveBeenCalled()
    })
  })

  describe('the critical guard (decision 5)', () => {
    /** Midi-QOL's critical, whose numbers the app can't read: only its die. */
    const unread: DamagePreview = {
      critical: true,
      plannable: true,
      rolls: [
        {
          formula: '1d6mx2 + 4',
          type: 'Slashing',
          dice: [{ faces: 6, number: 1 }],
          perDie: 1,
        },
      ],
    }

    it("J1 counts the game's total of damage whose formula the app can't read, as Midi-QOL's 1d6mx2 + 4", async () => {
      renderer()
      jest.spyOn(Math, 'random').mockReturnValue(4.5 / 6)
      const { result } = setUp()

      await rolled(() =>
        result.current.rollDamage(
          damageRollOf('Longsword', { use: 'req-1', damage: unread }),
        ),
      )

      const [damage] = result.current.rolls as LocalDamage[]
      expect(damage.gameTotal).toBe(true)
      expect(
        shownTotal(damage, { status: 'done', visible: true, total: 14 }),
      ).toBe(14)
    })

    it("J1 counts the game's total of it typed in too, not the bare die typed", async () => {
      const fake = renderer()
      const { enter, asked } = typing([[5]])
      const { result } = setUp(enter)

      await rolled(() =>
        result.current.rollDamage(
          damageRollOf('Longsword', { use: 'req-1', damage: unread }),
        ),
      )

      expect(asked[0].terms).toEqual([
        { sides: 6, count: 1, label: '1d6 Slashing' },
      ])
      const [damage] = result.current.rolls as LocalDamage[]
      expect(damage).toMatchObject({ total: 5, typed: true, gameTotal: true })
      expect(
        shownTotal(damage, { status: 'done', visible: true, total: 14 }),
      ).toBe(14)
      expect(fake.roll).not.toHaveBeenCalled()
    })
  })
})

describe('hooks/use-sheet-roller, the dice effects add, and rerolls kept, from module 0.42.0', () => {
  afterEach(() => jest.restoreAllMocks())

  /** The roller as the pane makes it while the game takes either: these effects' dice, and so. */
  function setUpTyped(
    enter: EnterDice,
    effects: SheetEffectDie[] = [],
    keptRerolls = false,
  ) {
    const effectsFor = jest.fn<SheetEffectDie[], [SheetRoll]>(() => effects)
    const typedRolls: TypedRolls = { effectsFor, keptRerolls }
    const onThrown = jest.fn()
    const onDamageThrown = jest.fn()
    const onFormulaThrown = jest.fn()
    const hook = renderHook(() =>
      useSheetRoller(
        onThrown,
        onDamageThrown,
        onFormulaThrown,
        enter,
        typedRolls,
      ),
    )
    return { ...hook, effectsFor, onThrown, onDamageThrown }
  }

  /** A Dexterity save, +3, with the player's own +1d4 added. */
  const dexSave: SheetRoll = {
    label: 'Dexterity saving throw',
    modifier: 3,
    extras: [d(1, 4)],
    source: { kind: 'save', key: 'dex' },
  }

  describe('a d20 roll', () => {
    it("asks for its d20s, then the player's own dice, then each die its effects add, by its name, which may be skipped", async () => {
      renderer()
      const { enter, asked } = typing([[12], [2], [3], [1]])
      const { result, effectsFor } = setUpTyped(enter, [BLESS_DIE, BANE_DIE])

      await rolled(() => result.current.roll(dexSave))

      expect(effectsFor).toHaveBeenCalledWith(dexSave)
      expect(asked[0].terms).toEqual([
        { sides: 20, count: 1, label: 'd20' },
        { sides: 4, count: 1, label: '+1d4' },
        {
          sides: 4,
          count: 1,
          label: 'Bless: +1d4',
          skippable: true,
          name: 'Bless',
        },
        {
          sides: 4,
          count: 1,
          label: 'Bane: −1d4',
          skippable: true,
          name: 'Bane',
        },
      ])
      const [roll] = result.current.rolls as LocalCheck[]
      // The player's own first, so that the dice the game is sent, read by their places, are as
      // ever; then the effects', each by its name.
      expect(roll.extras).toEqual([
        { text: '+1d4', values: [2], value: 2 },
        { text: 'Bless +1d4', values: [3], value: 3 },
        { text: 'Bane −1d4', values: [1], value: -1 },
      ])
      expect(roll.effectDice).toEqual([
        { faces: 4, sign: 1, results: [3] },
        { faces: 4, sign: -1, results: [1] },
      ])
      expect(roll.total).toBe(12 + 3 + 2 + 3 - 1)
      expect(roll).not.toHaveProperty('skipped')
      expect(roll.typed).toBe(true)

      const request = toRollRequest(dexSave, { kind: 'save', key: 'dex' }, roll)
      expect(request.dice).toEqual([
        { faces: 20, results: [12] },
        { faces: 4, results: [2] },
      ])
      expect(request.extras).toEqual([d(1, 4)])
      expect(request.effectDice).toEqual(roll.effectDice)
    })

    // Review fix (round 0.42.0): a number the player added asks for no box, so each effect's die is
    // read after their own dice alone, not after every term they added.
    it("reads each effect's die after the player's own dice, a number they added before them asking for none", async () => {
      renderer()
      const { enter, asked } = typing([[12], [2], [3], [1]])
      const { result } = setUpTyped(enter, [BLESS_DIE, BANE_DIE])
      const plusTwo: SheetRoll = { ...dexSave, extras: [flat(2), d(1, 4)] }

      await rolled(() => result.current.roll(plusTwo))

      const [entry] = asked
      expect(entry.terms.map(({ label }) => label)).toEqual([
        'd20',
        '+1d4',
        'Bless: +1d4',
        'Bane: −1d4',
      ])
      const [roll] = result.current.rolls as LocalCheck[]
      expect(roll.extras).toEqual([
        { text: '+2', values: [], value: 2 },
        { text: '+1d4', values: [2], value: 2 },
        { text: 'Bless +1d4', values: [3], value: 3 },
        { text: 'Bane −1d4', values: [1], value: -1 },
      ])
      expect(roll.effectDice).toEqual([
        { faces: 4, sign: 1, results: [3] },
        { faces: 4, sign: -1, results: [1] },
      ])
      expect(roll).not.toHaveProperty('skipped')
      expect(roll.total).toBe(12 + 3 + 2 + 2 + 3 - 1)
      expect(entry.total([[12], [2], [3], [1]])).toBe(roll.total)
      const request = toRollRequest(plusTwo, { kind: 'save', key: 'dex' }, roll)
      expect(request.dice).toEqual([
        { faces: 20, results: [12] },
        { faces: 4, results: [2] },
      ])
      expect(request.effectDice).toEqual(roll.effectDice)
      // Its terms counted as the dialog has them: Bless's the third, Bane's the fourth.
      expect(entry.skippedWords?.([2])).toBe('not counting Bless’s d4')
      expect(entry.skippedWords?.([3])).toBe('not counting Bane’s d4')
    })

    it('never sends nor counts a die skipped, and says one was', async () => {
      renderer()
      const { enter } = typing([[12], [2], [], [1]], [[12], [2], [], []])
      const { result } = setUpTyped(enter, [BLESS_DIE, BANE_DIE])

      await rolled(() => result.current.roll(dexSave))
      await rolled(() => result.current.roll(dexSave))

      const [none, bane] = result.current.rolls as LocalCheck[]
      expect(bane.effectDice).toEqual([{ faces: 4, sign: -1, results: [1] }])
      expect(bane.extras.map(({ text }) => text)).toEqual(['+1d4', 'Bane −1d4'])
      expect(bane.total).toBe(12 + 3 + 2 - 1)
      expect(bane.skipped).toBe(true)
      expect(none).not.toHaveProperty('effectDice')
      expect(none.extras.map(({ text }) => text)).toEqual(['+1d4'])
      expect(none.total).toBe(12 + 3 + 2)
      expect(none.skipped).toBe(true)
      expect(
        toRollRequest(dexSave, { kind: 'save', key: 'dex' }, none),
      ).not.toHaveProperty('effectDice')
    })

    it("takes a die an effect takes away from the total, as typed so far, and words what's skipped", async () => {
      renderer()
      const { enter, asked } = typing([[10], [3]], [[10], [3], [2]])
      const { result } = setUpTyped(enter, [BANE_DIE])
      const plain: SheetRoll = {
        label: 'Wisdom saving throw',
        modifier: 2,
        source: { kind: 'save', key: 'wis' },
      }

      await rolled(() => result.current.roll(plain))

      const [roll] = result.current.rolls as LocalCheck[]
      expect(roll.total).toBe(10 + 2 - 3)
      expect(roll.extras).toEqual([
        { text: 'Bane −1d4', values: [3], value: -3 },
      ])
      const [entry] = asked
      expect(entry.total([[10], [3]])).toBe(9)
      expect(entry.total([[10], [undefined]])).toBe(12)
      // Skipped, the dialog gives none for it.
      expect(entry.total([[10], []])).toBe(12)
      expect(entry.skippedWords?.([1])).toBe('not counting Bane’s d4')

      // Two of them skipped, by how many dice; the player's own dice before them never are.
      const two = typing([[10], [2], [], []])
      const both = setUpTyped(two.enter, [BLESS_DIE, { ...BANE_DIE, count: 2 }])
      await rolled(() =>
        both.result.current.roll({ ...plain, extras: [d(1, 4)] }),
      )
      expect(two.asked[0].skippedWords?.([2, 3])).toBe(
        'not counting 3 dice the game rolls',
      )
      expect(two.asked[0].skippedWords?.([3])).toBe('not counting Bane’s 2d4')
    })

    // Changed on purpose (round 0.42.1 §7.2): Elven Accuracy's third d20 on a line of its own,
    // right after the two, the effects after it.
    it('asks for Elven Accuracy’s third d20 on its own line after the two, the effects after', async () => {
      renderer()
      const { enter, asked } = typing([[3, 18], [7], [4]])
      const { result } = setUpTyped(enter, [BLESS_DIE])

      await rolled(() =>
        result.current.roll({
          label: 'Rapier attack',
          modifier: 7,
          advantage: 'adv',
          elvenAccuracy: true,
          source: {
            kind: 'attack',
            item: 'rapier',
            activity: 'rapierAttack',
          },
        }),
      )

      expect(asked[0].terms.map(({ label, count }) => [label, count])).toEqual([
        ['d20, advantage', 2],
        ['Elven Accuracy: third d20', 1],
        ['Bless: +1d4', 1],
      ])
      const [roll] = result.current.rolls as LocalCheck[]
      expect(roll).toMatchObject({ d20s: [3, 18, 7], natural: 18 })
      expect(roll.total).toBe(18 + 7 + 4)
    })

    it("asks for no effect's die, and sends as ever, where the game takes none", async () => {
      renderer()
      const { enter, asked } = typing([[12], [2]], [[12], [2]])
      const { result, onThrown } = setUp(enter)
      const taken = setUpTyped(enter, [], false)

      await rolled(() => result.current.roll(dexSave))
      await rolled(() => taken.result.current.roll(dexSave))

      for (const entry of asked) {
        expect(entry.terms.map(({ label }) => label)).toEqual(['d20', '+1d4'])
        expect(entry).not.toHaveProperty('skippedWords')
      }
      const [roll] = result.current.rolls as LocalCheck[]
      const [other] = taken.result.current.rolls as LocalCheck[]
      for (const each of [roll, other]) {
        expect(each).not.toHaveProperty('effectDice')
        expect(each).not.toHaveProperty('skipped')
        expect(each).not.toHaveProperty('rerolls')
      }
      expect(onThrown).toHaveBeenCalledWith(dexSave, roll)
    })

    it('says its rerolls were kept at the table only where the game keeps them', async () => {
      renderer()
      const { enter } = typing([[1], [2]], [[1], [2]])
      const kept = setUpTyped(enter, [], true)
      const rerolled = setUpTyped(enter, [], false)

      await rolled(() => kept.result.current.roll(dexSave))
      await rolled(() => rerolled.result.current.roll(dexSave))

      const [roll] = kept.result.current.rolls as LocalCheck[]
      expect(roll).toMatchObject({ d20s: [1], rerolls: 'kept' })
      expect(
        toRollRequest(dexSave, { kind: 'save', key: 'dex' }, roll),
      ).toMatchObject({ typed: true, rerolls: 'kept' })
      expect(rerolled.result.current.rolls[0]).not.toHaveProperty('rerolls')
    })
  })

  describe('damage and formulas, their rerolls kept at the table', () => {
    const greatsword: SheetDamageRoll = {
      label: 'Greatsword damage',
      parts: [{ terms: [d(2, 6, 1, ['r<=2']), flat(4)], type: 'Slashing' }],
    }

    it("counts a reroll's die as typed, the game's total not waited for, and says to reroll at the table", async () => {
      renderer()
      const { enter, asked } = typing([[1, 5]])
      const { result } = setUpTyped(enter, [], true)

      await rolled(() => result.current.rollDamage(greatsword))

      // Written as on the sheet, with the note.
      expect(asked[0].terms).toEqual([
        { sides: 6, count: 2, label: '2d6r<=2 Slashing' },
      ])
      expect(asked[0].note).toBe(REROLL_NOTE)
      expect(REROLL_NOTE).toBe(
        'Reroll at the table as your feature says, and type in the die you keep.',
      )
      const [damage] = result.current.rolls as LocalDamage[]
      expect(damage.total).toBe(1 + 5 + 4)
      expect(damage.gameTotal).toBeUndefined()
      expect(damage.rerolls).toBe('kept')
      expect(damage.parts[0].terms[0]).toMatchObject({
        text: '2d6r<=2',
        values: [1, 5],
      })
      expect(asked[0].total([[1, 5]])).toBe(damage.total)
      expect(shownTotal(damage, { status: 'sending' })).toBe(10)
    })

    it("still leaves an exploded die's total to the game, and keeps what a die counts at least", async () => {
      renderer()
      const { enter, asked } = typing([[6]], [[2]], [[1, 5]])
      const { result } = setUpTyped(enter, [], true)

      await rolled(() =>
        result.current.rollDamage({
          label: 'Blast damage',
          parts: [{ terms: [d(1, 6, 1, ['x'])], type: 'Fire' }],
        }),
      )
      await rolled(() =>
        result.current.rollDamage({
          label: 'Blast damage',
          parts: [{ terms: [d(1, 6, 1, ['x'])], type: 'Fire' }],
        }),
      )
      await rolled(() =>
        result.current.rollDamage({
          label: 'Greatsword damage',
          parts: [{ terms: [d(2, 6, 1, ['min3'])], type: 'Slashing' }],
        }),
      )

      const [least, unexploded, exploded] = result.current
        .rolls as LocalDamage[]
      expect(exploded.gameTotal).toBe(true)
      expect(exploded.rerolls).toBe('kept')
      expect(unexploded.gameTotal).toBeUndefined()
      expect(least.total).toBe(3 + 5)
      expect(least.gameTotal).toBeUndefined()
      // Neither rerolls: no note.
      for (const entry of asked) expect(entry).not.toHaveProperty('note')
    })

    it("leaves a reroll's total to the game, as ever, where the game doesn't keep them", async () => {
      renderer()
      const { enter, asked } = typing([[1, 5]], [[1, 5]])
      const { result } = setUpTyped(enter, [BLESS_DIE], false)
      const plain = setUp(enter)

      await rolled(() => result.current.rollDamage(greatsword))
      await rolled(() => plain.result.current.rollDamage(greatsword))

      for (const damage of [
        ...(result.current.rolls as LocalDamage[]),
        ...(plain.result.current.rolls as LocalDamage[]),
      ]) {
        expect(damage.gameTotal).toBe(true)
        expect(damage).not.toHaveProperty('rerolls')
      }
      for (const entry of asked) expect(entry).not.toHaveProperty('note')
    })

    it("counts a formula's reroll as typed, with the note, and says hit dice's were kept too", async () => {
      renderer()
      const { enter, asked } = typing([[1], [3]], [[4]])
      const { result } = setUpTyped(enter, [], true)

      await rolled(() =>
        result.current.rollFormula({
          label: 'Lucky light',
          terms: [d(1, 6, 1, ['r1']), d(1, 4), flat(1)],
          source: { kind: 'formula', item: 'light', activity: 'radius' },
        }),
      )
      await rolled(() =>
        result.current.rollFormula({
          label: 'Hit die (d8)',
          terms: [d(1, 8), flat(2)],
          source: { kind: 'hitDie', denomination: 'd8' },
        }),
      )

      const [hit, light] = result.current.rolls as LocalFormula[]
      expect(asked[0].note).toBe(REROLL_NOTE)
      expect(light).toMatchObject({ total: 1 + 3 + 1, rerolls: 'kept' })
      expect(light.gameTotal).toBeUndefined()
      expect(asked[1]).not.toHaveProperty('note')
      expect(hit).toMatchObject({ total: 6, rerolls: 'kept' })
    })
  })
})

describe('hooks/use-sheet-roller, Elven Accuracy’s third d20 on its own line, from 0.42.1', () => {
  afterEach(() => jest.restoreAllMocks())

  /**
   * The roller as the pane makes it while typing: these effects' dice, and whether each roll goes
   * to the game, unsaid as before 0.42.1.
   */
  function setUpElven(
    enter: EnterDice,
    {
      effects = [],
      sends,
    }: { effects?: SheetEffectDie[]; sends?: boolean } = {},
  ) {
    const typedRolls: TypedRolls = {
      effectsFor: () => effects,
      keptRerolls: false,
      ...(sends !== undefined && { sends: () => sends }),
    }
    const onThrown = jest.fn<void, [SheetRoll, LocalCheck]>()
    const hook = renderHook(() =>
      useSheetRoller(onThrown, undefined, undefined, enter, typedRolls),
    )
    return { ...hook, onThrown }
  }

  const ATTACK = {
    kind: 'attack',
    item: 'rapier',
    activity: 'rapierAttack',
  } as const
  const rapier: SheetRoll = {
    label: 'Rapier attack',
    modifier: 7,
    advantage: 'adv',
    elvenAccuracy: true,
    source: ATTACK,
  }
  const GROUP = { sides: 20, count: 2, label: 'd20, advantage' }
  const ELVEN = {
    sides: 20,
    count: 1,
    label: 'Elven Accuracy: third d20',
    name: 'Elven Accuracy',
  }

  it('may skip the third d20 where the roll goes to the game, the two typed sent and the higher kept', async () => {
    renderer()
    const { enter, asked } = typing([[3, 18], []])
    const { result, onThrown } = setUpElven(enter, { sends: true })

    await rolled(() => result.current.roll(rapier))

    const [entry] = asked
    expect(entry.terms).toEqual([GROUP, { ...ELVEN, skippable: true }])
    const [roll] = result.current.rolls as LocalCheck[]
    expect(roll).toMatchObject({
      d20s: [3, 18],
      natural: 18,
      total: 18 + 7,
      skipped: true,
      typed: true,
      extras: [],
    })
    expect(roll).not.toHaveProperty('effectDice')
    expect(onThrown).toHaveBeenCalledWith(rapier, roll)
    const request = toRollRequest(rapier, ATTACK, roll)
    expect(request.dice).toEqual([{ faces: 20, results: [3, 18] }])
    expect(request).not.toHaveProperty('effectDice')
    // The total says what it leaves out: the game's third d20.
    expect(entry.total([[3, 18], []])).toBe(25)
    expect(entry.skippedWords?.([1])).toBe('not counting Elven Accuracy’s d20')
  })

  it('keeps the highest of the three typed, the third among the d20s, as typed so far too', async () => {
    renderer()
    const { enter, asked } = typing([[3, 9], [19]])
    const { result } = setUpElven(enter, { sends: true })

    await rolled(() => result.current.roll(rapier))

    const [roll] = result.current.rolls as LocalCheck[]
    expect(roll).toMatchObject({ d20s: [3, 9, 19], natural: 19, total: 26 })
    expect(roll).not.toHaveProperty('skipped')
    expect(toRollRequest(rapier, ATTACK, roll).dice).toEqual([
      { faces: 20, results: [3, 9, 19] },
    ])
    const [entry] = asked
    expect(entry.total([[3, 9], [19]])).toBe(26)
    // The third alone counts, typed before the two; none typed counts for nothing.
    expect(entry.total([[undefined, undefined], [12]])).toBe(19)
    expect(entry.total([[undefined, undefined], [undefined]])).toBe(7)
  })

  it("reads the player's own dice and the effects' after the third, wording each skipped by its place", async () => {
    renderer()
    const { enter, asked } = typing([[3, 18], [], [2], [4]], [[3, 18], [], []])
    const { result } = setUpElven(enter, {
      effects: [BLESS_DIE],
      sends: true,
    })
    const plusD4: SheetRoll = { ...rapier, extras: [d(1, 4)] }

    await rolled(() => result.current.roll(plusD4))
    await rolled(() => result.current.roll(rapier))

    const [own, plain] = asked
    expect(own.terms.map(({ label }) => label)).toEqual([
      'd20, advantage',
      'Elven Accuracy: third d20',
      '+1d4',
      'Bless: +1d4',
    ])
    const [blessed, roll] = result.current.rolls as LocalCheck[]
    // The +1d4's value is the player's own, the first of the extras and the request's second die.
    expect(roll.extras).toEqual([
      { text: '+1d4', values: [2], value: 2 },
      { text: 'Bless +1d4', values: [4], value: 4 },
    ])
    expect(roll).toMatchObject({ d20s: [3, 18], total: 18 + 7 + 2 + 4 })
    expect(roll.skipped).toBe(true)
    const request = toRollRequest(plusD4, ATTACK, roll)
    expect(request.dice).toEqual([
      { faces: 20, results: [3, 18] },
      { faces: 4, results: [2] },
    ])
    expect(request.effectDice).toEqual([{ faces: 4, sign: 1, results: [4] }])
    expect(own.skippedWords?.([1])).toBe('not counting Elven Accuracy’s d20')
    expect(own.skippedWords?.([3])).toBe('not counting Bless’s d4')
    expect(own.skippedWords?.([1, 3])).toBe(
      'not counting 2 dice the game rolls',
    )

    // Bless's die the third term without one of the player's own, both skipped.
    expect(plain.skippedWords?.([2])).toBe('not counting Bless’s d4')
    expect(plain.skippedWords?.([1, 2])).toBe(
      'not counting 2 dice the game rolls',
    )
    expect(blessed).toMatchObject({ d20s: [3, 18], total: 25, skipped: true })
    expect(blessed).not.toHaveProperty('effectDice')
  })

  it.each([
    ['the roll goes to no game', false],
    ["it's unsaid whether the roll goes to the game", undefined],
  ])(
    'asks the third d20 on its own line with no Skip where %s',
    async (_, sends) => {
      renderer()
      const { enter, asked } = typing([[3, 18], [7]])
      const { result } = setUpElven(enter, { sends })

      await rolled(() => result.current.roll(rapier))

      expect(asked[0].terms).toEqual([GROUP, ELVEN])
      expect(asked[0]).not.toHaveProperty('skippedWords')
      expect(result.current.rolls[0]).toMatchObject({ d20s: [3, 18, 7] })
    },
  )

  it("offers no Skip where the roll adds a d20 of the player's own, whose value the game would give the third", async () => {
    renderer()
    const { enter, asked } = typing([[3, 18], [7], [11]])
    const { result } = setUpElven(enter, { sends: true })
    const plusD20: SheetRoll = { ...rapier, extras: [d(1, 20)] }

    await rolled(() => result.current.roll(plusD20))

    expect(asked[0].terms).toEqual([
      GROUP,
      ELVEN,
      { sides: 20, count: 1, label: '+1d20' },
    ])
    expect(asked[0]).not.toHaveProperty('skippedWords')
    const [roll] = result.current.rolls as LocalCheck[]
    expect(toRollRequest(plusD20, ATTACK, roll).dice).toEqual([
      { faces: 20, results: [3, 18, 7] },
      { faces: 20, results: [11] },
    ])
  })

  it('asks for no third d20 with disadvantage, or without the mark, though the roll goes to the game', async () => {
    renderer()
    const { enter, asked } = typing([[3, 9]], [[4, 15]])
    const { result } = setUpElven(enter, { sends: true })

    await rolled(() => result.current.roll({ ...rapier, advantage: 'dis' }))
    await rolled(() =>
      result.current.roll({ ...rapier, elvenAccuracy: undefined }),
    )

    expect(asked.map(({ terms }) => terms)).toEqual([
      [{ sides: 20, count: 2, label: 'd20, disadvantage' }],
      [GROUP],
    ])
    for (const entry of asked) expect(entry).not.toHaveProperty('skippedWords')
  })
})

describe('hooks/use-sheet-roller, the dice the sheet offers, from module 0.42.1', () => {
  afterEach(() => jest.restoreAllMocks())

  /** Vex's Bardic Inspiration, as `offersFor` gives it for Thorin's Inspired. */
  const VEX: SheetOffer = {
    die: INSPIRATION_DIE,
    spends: {
      effect: 'inspired',
      name: 'Inspired',
      offer: 'Bardic Inspiration',
    },
  }
  /** Another bard's, a d8, named apart from Vex's. */
  const MIRA: SheetOffer = {
    die: {
      ...INSPIRATION_DIE,
      name: 'Bardic Inspiration (Mira)',
      effect: 'inspiredMira',
      faces: 8,
    },
    spends: {
      effect: 'inspiredMira',
      name: 'Inspired',
      offer: 'Bardic Inspiration (Mira)',
    },
  }
  const OFFERED = {
    sides: 6,
    count: 1,
    label: 'Bardic Inspiration: +1d6',
    name: 'Bardic Inspiration',
    offered: true,
  }

  /**
   * The roller as the pane makes it while the game takes dice of effects: these effects' dice and
   * offers, each roll going to the game.
   */
  function setUpOffers(
    enter: EnterDice,
    {
      effects = [],
      offers = [],
      offering = true,
    }: {
      effects?: SheetEffectDie[]
      offers?: SheetOffer[]
      offering?: boolean
    } = {},
  ) {
    const typedRolls: TypedRolls = {
      effectsFor: () => effects,
      keptRerolls: false,
      sends: () => true,
      ...(offering && { offersFor: () => offers }),
    }
    const onThrown = jest.fn<void, [SheetRoll, LocalCheck]>()
    const hook = renderHook(() =>
      useSheetRoller(onThrown, undefined, undefined, enter, typedRolls),
    )
    return { ...hook, onThrown }
  }

  const SAVE = { kind: 'save', key: 'str' } as const
  /** A Strength save, +2, with the player's own +1d4 added. */
  const strSave: SheetRoll = {
    label: 'Strength saving throw',
    modifier: 2,
    extras: [d(1, 4)],
    source: SAVE,
  }

  it('asks for the offer last, left out, and sends the roll as asked where it stays out', async () => {
    renderer()
    const { enter, asked } = typing([[9], [2], []])
    const { result, onThrown } = setUpOffers(enter, { offers: [VEX] })

    await rolled(() => result.current.roll(strSave))

    const [entry] = asked
    expect(entry.terms).toEqual([
      { sides: 20, count: 1, label: 'd20' },
      { sides: 4, count: 1, label: '+1d4' },
      OFFERED,
    ])
    // Nothing for the total to leave out: the offer is no die the game rolls.
    expect(entry).not.toHaveProperty('skippedWords')
    const [roll] = result.current.rolls as LocalCheck[]
    expect(roll.extras).toEqual([{ text: '+1d4', values: [2], value: 2 }])
    expect(roll.total).toBe(9 + 2 + 2)
    expect(roll).not.toHaveProperty('spends')
    expect(roll).not.toHaveProperty('skipped')
    expect(onThrown.mock.calls[0][0]).toBe(strSave)
    expect(toRollRequest(strSave, SAVE, roll).dice).toEqual([
      { faces: 20, results: [9] },
      { faces: 4, results: [2] },
    ])
  })

  it('sends an offer added as the last of the extras, named by it, before the effects’ dice, spending its effect', async () => {
    renderer()
    const { enter, asked } = typing([[9], [2], [3], [5]])
    const { result, onThrown } = setUpOffers(enter, {
      effects: [BLESS_DIE],
      offers: [VEX],
    })

    await rolled(() => result.current.roll(strSave))

    const [entry] = asked
    expect(entry.terms.map(({ label }) => label)).toEqual([
      'd20',
      '+1d4',
      'Bless: +1d4',
      'Bardic Inspiration: +1d6',
    ])
    const [roll] = result.current.rolls as LocalCheck[]
    const [[request, sent]] = onThrown.mock.calls
    expect(sent).toBe(roll)
    expect(request).toEqual({
      ...strSave,
      extras: [d(1, 4), { sign: 1, count: 1, sides: 6 }],
    })
    expect(roll.extras).toEqual([
      { text: '+1d4', values: [2], value: 2 },
      { text: 'Bardic Inspiration +1d6', values: [5], value: 5 },
      { text: 'Bless +1d4', values: [3], value: 3 },
    ])
    expect(roll.total).toBe(9 + 2 + 2 + 5 + 3)
    expect(entry.total([[9], [2], [3], [5]])).toBe(roll.total)
    expect(roll.spends).toEqual([
      { effect: 'inspired', name: 'Inspired', offer: 'Bardic Inspiration' },
    ])
    expect(roll).not.toHaveProperty('skipped')
    const wire = toRollRequest(request, SAVE, roll)
    expect(wire.extras).toEqual([d(1, 4), { sign: 1, count: 1, sides: 6 }])
    expect(wire.dice).toEqual([
      { faces: 20, results: [9] },
      { faces: 4, results: [2] },
      { faces: 6, results: [5] },
    ])
    // Bless's die alone among the effects': never the offer's.
    expect(wire.effectDice).toEqual([{ faces: 4, sign: 1, results: [3] }])
    // Its place words nothing, as no game rolls it; Bless's does.
    expect(entry.skippedWords?.([2])).toBe('not counting Bless’s d4')
    expect(entry.skippedWords?.([3])).toBe('')
  })

  it('counts an offer added as typed so far, and one left out as nothing', async () => {
    renderer()
    const { enter, asked } = typing([[9], []])
    const { result } = setUpOffers(enter, { offers: [VEX] })

    await rolled(() =>
      result.current.roll({ ...strSave, extras: undefined, modifier: 0 }),
    )

    const [entry] = asked
    expect(entry.total([[9], []])).toBe(9)
    expect(entry.total([[9], [undefined]])).toBe(9)
    expect(entry.total([[9], [4]])).toBe(13)
    expect(entry.total([[undefined], [4]])).toBe(4)
  })

  it('asks for as many of its die as the bard’s scale gives, each sent', async () => {
    renderer()
    const { enter, asked } = typing([[9], [4, 5]])
    const two = { ...VEX, die: { ...VEX.die, count: 2 } }
    const { result, onThrown } = setUpOffers(enter, { offers: [two] })
    const plain: SheetRoll = { ...strSave, extras: undefined }

    await rolled(() => result.current.roll(plain))

    expect(asked[0].terms[1]).toEqual({
      ...OFFERED,
      count: 2,
      label: 'Bardic Inspiration: +2d6',
    })
    const [roll] = result.current.rolls as LocalCheck[]
    expect(roll.extras).toEqual([
      { text: 'Bardic Inspiration +2d6', values: [4, 5], value: 9 },
    ])
    const [[request]] = onThrown.mock.calls
    expect(request.extras).toEqual([{ sign: 1, count: 2, sides: 6 }])
    expect(toRollRequest(request, SAVE, roll).dice).toEqual([
      { faces: 20, results: [9] },
      { faces: 6, results: [4, 5] },
    ])
  })

  // CT 17: the offers' values are read after the effects', each by its own place.
  it('reads the second of two offers after Bless’s die and the first, sending only the one added', async () => {
    renderer()
    const { enter, asked } = typing([[9], [3], [], [6]])
    const { result, onThrown } = setUpOffers(enter, {
      effects: [BLESS_DIE],
      offers: [VEX, MIRA],
    })
    const plain: SheetRoll = { ...strSave, extras: undefined }

    await rolled(() => result.current.roll(plain))

    expect(asked[0].terms.map(({ label }) => label)).toEqual([
      'd20',
      'Bless: +1d4',
      'Bardic Inspiration: +1d6',
      'Bardic Inspiration (Mira): +1d8',
    ])
    const [roll] = result.current.rolls as LocalCheck[]
    expect(roll.extras).toEqual([
      { text: 'Bardic Inspiration (Mira) +1d8', values: [6], value: 6 },
      { text: 'Bless +1d4', values: [3], value: 3 },
    ])
    expect(roll.spends).toEqual([MIRA.spends])
    const [[request]] = onThrown.mock.calls
    expect(request.extras).toEqual([{ sign: 1, count: 1, sides: 8 }])
    expect(toRollRequest(request, SAVE, roll).dice).toEqual([
      { faces: 20, results: [9] },
      { faces: 8, results: [6] },
    ])
  })

  it('reads an offer after Elven Accuracy’s third d20 skipped, the offer never skipped', async () => {
    renderer()
    const { enter, asked } = typing([[3, 18], [], [5]])
    const { result } = setUpOffers(enter, { offers: [VEX] })
    const rapier: SheetRoll = {
      label: 'Rapier attack',
      modifier: 7,
      advantage: 'adv',
      elvenAccuracy: true,
      source: { kind: 'attack', item: 'rapier', activity: 'rapierAttack' },
    }

    await rolled(() => result.current.roll(rapier))

    const [entry] = asked
    expect(entry.terms.at(-1)).toEqual(OFFERED)
    expect(entry.skippedWords?.([1])).toBe('not counting Elven Accuracy’s d20')
    const [roll] = result.current.rolls as LocalCheck[]
    expect(roll).toMatchObject({ d20s: [3, 18], total: 18 + 7 + 5 })
    expect(roll.skipped).toBe(true)
    expect(roll.extras).toEqual([
      { text: 'Bardic Inspiration +1d6', values: [5], value: 5 },
    ])
  })

  it('offers no more than the roll’s extras leave room for, none at ten', async () => {
    renderer()
    const nine = Array.from({ length: 9 }, () => flat(1))
    const { enter, asked } = typing([[9], []], [[9], [], []])
    const { result } = setUpOffers(enter, { offers: [VEX, MIRA] })

    await rolled(() =>
      result.current.roll({ ...strSave, extras: [...nine, flat(1)] }),
    )
    await rolled(() => result.current.roll({ ...strSave, extras: nine }))

    expect(asked[0].terms.some(({ offered }) => offered)).toBe(false)
    expect(
      asked[1].terms.filter(({ offered }) => offered).map(({ label }) => label),
    ).toEqual(['Bardic Inspiration: +1d6'])
  })

  it('holds the most extras as the roll request’s schema does', () => {
    expect(MOST_EXTRAS).toBe(MAX_EXTRAS)
  })

  it.each([
    ['offers none, as against module 0.41.0', true],
    ["can't say what it offers", false],
  ])('asks and sends as before where the game %s', async (_, offering) => {
    renderer()
    const { enter, asked } = typing([[9], [2]])
    const { result, onThrown } = setUpOffers(enter, { offering })

    await rolled(() => result.current.roll(strSave))

    expect(asked[0].terms).toEqual([
      { sides: 20, count: 1, label: 'd20' },
      { sides: 4, count: 1, label: '+1d4' },
    ])
    const [roll] = result.current.rolls as LocalCheck[]
    expect(onThrown).toHaveBeenCalledWith(strSave, roll)
    expect(onThrown.mock.calls[0][0]).toBe(strSave)
    expect(roll).not.toHaveProperty('spends')
  })
})
