/* eslint-disable unicorn/no-null -- a damage part without a kind has null */
import { useDiceRenderer } from '@lambersond/3d-dice-react'
import { act, renderHook } from '@testing-library/react'
import {
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
import { BANE_DIE, BLESS_DIE } from '@/mocks/sending-stone'
import type { DiceEntry, EnterDice } from '@/types/dice-entry'
import type { DamagePreview, SheetEffectDie } from '@/types/sending-stone'

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

    it('keeps the three boxes of Elven Accuracy as one group, the effects after', async () => {
      renderer()
      const { enter, asked } = typing([[3, 18, 7], [4]])
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
        ['d20, advantage (Elven Accuracy)', 3],
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
