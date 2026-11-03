import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ROLL_KINDS } from '@/constants/sending-stone'
import {
  useSheetRoller,
  type SheetDamageRoll,
  type SheetFormulaRoll,
  type SheetRoll,
  type TypedRolls,
} from '@/features/rolling/hooks/use-sheet-roller'
import { CharacterPane } from '@/features/sheet/components/character-pane/character-pane'
import {
  BANE_DIE,
  BLESS_DIE,
  characterSheet,
  fullerSheet,
} from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'
import {
  advance,
  atFixedTime,
  ordered,
  rollServer,
  sent,
} from '@/utils/test-utils'
import type { DiceEntry, EnterDice } from '@/types/dice-entry'
import type { CharacterSheet } from '@/types/sending-stone'

// C8 (round.md §3.2): the dice the app throws for each roll shape, from a fixed Math.random, and
// what it posts of them. Frozen from the commit that adds it (gate 10); never updated.

jest.mock(
  '@lambersond/3d-dice-react',
  () => jest.requireActual('@/mocks/dice-renderer').NO_DICE_RENDERER,
)

const GAME = 'https://my-game.forge-vtt.com'

/** Long enough for the app to look again at a roll on its way. */
const CHECK = 1000

/** Math.random as a fixed LCG (seed 43, a = 1664525, c = 1013904223, m = 2^32, value / m). */
const seeded = () => {
  let state = 43
  return jest.spyOn(Math, 'random').mockImplementation(() => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0
    return state / 2 ** 32
  })
}

/** crypto.randomUUID, numbered in the order it is asked for, from 1 in each test. */
const numberedIds = () => {
  let count = 0
  return jest
    .spyOn(crypto, 'randomUUID')
    .mockImplementation(
      () =>
        `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}` as ReturnType<
          typeof crypto.randomUUID
        >,
    )
}

/** The roller's own counters (`use-<ms>-<n>`, `ask-<ms>-<n>`), numbered by first appearance. */
const stableIds = (text: string) => {
  const seen = new Map<string, string>()
  return text.replaceAll(/\b(use|ask)-\d+-\d+\b/g, (token, kind: string) => {
    if (!seen.has(token)) seen.set(token, `${kind}-${seen.size + 1}`)
    return seen.get(token) as string
  })
}

/** A term of dice: so many of a die, added, unless taken away. */
const d = (
  count: number,
  sides: 4 | 6 | 8 | 10 | 12 | 20,
  sign: 1 | -1 = 1,
) => ({ sign, count, sides })

/** A flat number, added or taken away. */
const flat = (value: number) => ({
  sign: (value < 0 ? -1 : 1) as 1 | -1,
  flat: Math.abs(value),
})

const longsword: SheetDamageRoll = {
  label: 'Longsword damage',
  parts: [{ terms: [d(1, 8), flat(3)], type: 'Slashing' }],
  source: { item: 'longsword', activity: 'attack' },
}

const hitDie = (con: number, minimum: number): SheetFormulaRoll => ({
  label: 'Hit die (d8)',
  terms: [d(1, 8), ...(con === 0 ? [] : [flat(con)])],
  healing: true,
  minimum,
  source: { kind: 'hitDie', denomination: 'd8' },
})

const hitDice: SheetFormulaRoll = {
  label: 'Hit dice (2d10 + 1d8)',
  terms: [],
  sets: [
    { terms: [d(1, 10), flat(-1)], times: 2 },
    { terms: [d(1, 8), flat(-1)], times: 1 },
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

const check = (fields: Partial<SheetRoll> = {}): SheetRoll => ({
  label: 'Perception check',
  modifier: 4,
  source: { kind: 'skill', key: 'prc' },
  ...fields,
})

const attack = (fields: Partial<SheetRoll> = {}): SheetRoll => ({
  label: 'Longbow attack',
  modifier: 7,
  source: { kind: 'attack', item: 'longbow', activity: 'attack' },
  ...fields,
})

/** Effects' dice on d20 rolls, as module 0.42.0 has them typed in, rerolls kept. */
const blessedAndBaned: TypedRolls = {
  effectsFor: request =>
    request.source?.kind === 'attack' || request.source?.kind === 'save'
      ? [BLESS_DIE, BANE_DIE]
      : [],
  keptRerolls: true,
}

/**
 * Each roll shape: how it's thrown, and for a roll the player types in (module 0.32.0), the dice
 * typed for each roll in turn and what the game takes of it.
 */
const SHAPES: {
  name: string
  throw: (roller: ReturnType<typeof useSheetRoller>) => Promise<boolean>
  typed?: number[][][]
  typedRolls?: TypedRolls
}[] = [
  { name: 'd20, normal', throw: ({ roll }) => roll(check()) },
  {
    name: 'd20, advantage',
    throw: ({ roll }) => roll(check({ advantage: 'adv' })),
  },
  {
    name: 'd20, disadvantage',
    throw: ({ roll }) => roll(check({ advantage: 'dis' })),
  },
  {
    name: 'd20 with dice added and taken away (+1d4, −1d6, +2)',
    throw: ({ roll }) =>
      roll(check({ extras: [d(1, 4), d(1, 6, -1), flat(2)] })),
  },
  {
    name: 'Elven Accuracy thrown, with advantage',
    throw: ({ roll }) =>
      roll(attack({ advantage: 'adv', elvenAccuracy: true })),
  },
  { name: 'damage, normal', throw: ({ rollDamage }) => rollDamage(longsword) },
  {
    name: 'damage, two kinds',
    throw: ({ rollDamage }) =>
      rollDamage({
        label: 'Flame Tongue damage',
        parts: [
          { terms: [d(1, 8), flat(3)], type: 'Slashing' },
          { terms: [d(2, 6)], type: 'Fire' },
        ],
      }),
  },
  {
    name: 'damage, critical (every die twice)',
    throw: ({ rollDamage }) => rollDamage({ ...longsword, critical: true }),
  },
  {
    name: 'damage, one more die, made a d12',
    throw: ({ rollDamage }) =>
      rollDamage({ ...longsword, modifiers: { extra: 1, faces: 12 } }),
  },
  {
    name: 'damage, maximized',
    throw: ({ rollDamage }) =>
      rollDamage({ ...longsword, modifiers: { maximize: true } }),
  },
  {
    name: 'damage, critical and one more die',
    throw: ({ rollDamage }) =>
      rollDamage({ ...longsword, critical: true, modifiers: { extra: 1 } }),
  },
  {
    name: 'healing',
    throw: ({ rollDamage }) =>
      rollDamage({
        label: 'Cure Wounds healing',
        parts: [{ terms: [d(2, 8), flat(3)], type: 'Healing' }],
        healing: true,
      }),
  },
  {
    name: 'hit die, its minimum',
    throw: ({ rollFormula }) => rollFormula(hitDie(-3, 1)),
  },
  {
    name: 'hit die, with Constitution',
    throw: ({ rollFormula }) => rollFormula(hitDie(2, 1)),
  },
  {
    name: 'hit dice at once',
    throw: ({ rollFormula }) => rollFormula(hitDice),
  },
  {
    name: 'formula',
    throw: ({ rollFormula }) =>
      rollFormula({
        label: 'Light radius',
        terms: [d(2, 6), flat(10)],
        source: { kind: 'formula', item: 'torch', activity: 'light' },
      }),
  },
  {
    name: 'recharge',
    throw: ({ rollFormula }) =>
      rollFormula({
        label: 'Fire Breath recharge',
        terms: [d(1, 6)],
        recharge: { item: 'breath', activity: 'use' },
      }),
  },
  {
    name: 'typed d20 with Bless and Bane, rerolls kept',
    throw: ({ roll }) => roll(attack()),
    typed: [[[14], [3], [2]]],
    typedRolls: blessedAndBaned,
  },
  {
    name: 'typed d20 with Bane skipped',
    throw: ({ roll }) => roll(attack()),
    typed: [[[9], [4], []]],
    typedRolls: blessedAndBaned,
  },
  {
    name: 'typed Elven Accuracy, its third d20 on its own line',
    throw: ({ roll }) =>
      roll(attack({ advantage: 'adv', elvenAccuracy: true })),
    typed: [[[6, 11], [17], [1], [4]]],
    typedRolls: { ...blessedAndBaned, sends: () => true },
  },
  {
    name: 'typed damage, critical, rerolls kept',
    throw: ({ rollDamage }) => rollDamage({ ...longsword, critical: true }),
    typed: [[[2, 7]]],
    typedRolls: { effectsFor: () => [], keptRerolls: true },
  },
  {
    name: 'typed hit dice at once',
    throw: ({ rollFormula }) => rollFormula(hitDice),
    typed: [[[3, 9], [1]]],
  },
]

const user = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

/** What reached the game, raw, and how many dice it took. */
const drawn = () =>
  ordered({
    randomCalls: jest.mocked(Math.random).mock.calls.length,
    posted: sent()
      .filter(({ method }) => method === 'POST')
      .map(({ url, body }) => ({ url, body })),
  })

const settle = () => act(async () => {})

describe('golden C8: dice draws', () => {
  let random: jest.SpyInstance

  // React's async act takes one Math.random the first time it runs in a file (to find
  // setImmediate): taken here, so no test's draws depend on which ran first.
  beforeAll(async () => {
    await act(async () => {})
  })

  beforeEach(() => {
    atFixedTime('2026-10-04T19:30:00.000Z')
    random = seeded()
    numberedIds()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  describe('useSheetRoller, per roll shape', () => {
    it.each(SHAPES.map(shape => [shape.name, shape] as const))(
      '%s',
      async (name, shape) => {
        const asked: DiceEntry[] = []
        const answers = [...(shape.typed ?? [])]
        const enter: EnterDice | undefined = shape.typed
          ? async entry => {
              asked.push(entry)
              return answers.shift()
            }
          : undefined
        const thrown: unknown[] = []
        const { result } = renderHook(() =>
          useSheetRoller(
            (...args) => thrown.push(['check', ...args]),
            (...args) => thrown.push(['damage', ...args]),
            (...args) => thrown.push(['formula', ...args]),
            enter,
            shape.typedRolls,
          ),
        )

        let kept: boolean | undefined
        await act(async () => {
          kept = await shape.throw(result.current)
        })

        expect(
          stableIds(
            ordered({
              kept,
              randomCalls: random.mock.calls.length,
              asked,
              thrown,
              rolls: result.current.rolls,
            }),
          ),
        ).toMatchSnapshot(name)
      },
    )
  })

  describe('the bodies posted, from the sheet', () => {
    const renderSheet = (sheet: CharacterSheet) => {
      rollServer()
      localStorage.setItem('sending-stone:roll-toasts', 'off')
      render(
        <CharacterPane
          characterId='char-1'
          name='Thorin Oakenshield'
          sheet={toTableSheet(sheet, GAME)}
          rollsToTable={[...ROLL_KINDS]}
        />,
      )
    }

    it('a save, as tapped', async () => {
      renderSheet(characterSheet())
      await user().click(
        screen.getByRole('button', {
          name: 'Strength saving throw, +7, proficient',
        }),
      )
      await settle()
      expect(drawn()).toMatchSnapshot('save')
    })

    it.each([
      ['advantage', 'Roll with advantage'],
      ['disadvantage', 'Roll with disadvantage'],
    ])('a save with %s, from its menu', async (name, item) => {
      renderSheet(characterSheet())
      fireEvent.contextMenu(
        screen.getByRole('button', {
          name: 'Strength saving throw, +7, proficient',
        }),
      )
      await user().click(screen.getByRole('menuitem', { name: item }))
      await settle()
      expect(drawn()).toMatchSnapshot(name)
    })

    it('an attack dnd5e gives Elven Accuracy, with advantage', async () => {
      const sheet = fullerSheet()
      const [warhammer, ...rest] = sheet.actions[0].actions
      sheet.actions[0].actions = [
        { ...warhammer, elvenAccuracy: true },
        ...rest,
      ]
      renderSheet(sheet)
      await user().click(screen.getByRole('tab', { name: 'Actions' }))
      fireEvent.contextMenu(
        screen.getByRole('button', { name: 'Warhammer attack, +7' }),
      )
      await user().click(
        screen.getByRole('menuitem', { name: 'Roll with advantage' }),
      )
      await settle()
      expect(drawn()).toMatchSnapshot('elven accuracy')
    })

    it.each([
      ['a hit', false],
      ['a critical hit', true],
    ])(
      'an attack the game makes %s, then its damage',
      async (name, critical) => {
        renderSheet(fullerSheet())
        rollServer({
          'req-1': {
            status: 'done',
            visible: true,
            total: 19,
            attack: { critical, fumble: false, outcome: 'hit' },
            damage: {
              critical,
              plannable: true,
              rolls: [
                {
                  formula: critical ? '2d8 + 4' : '1d8 + 4',
                  type: 'bludgeoning',
                  dice: [{ faces: 8, number: critical ? 2 : 1 }],
                },
              ],
            },
          },
        })
        await user().click(screen.getByRole('tab', { name: 'Actions' }))
        await user().click(
          screen.getByRole('button', { name: 'Warhammer attack, +7' }),
        )
        await settle()
        await advance(CHECK)
        await user().click(
          screen.getByRole('button', { name: /^Roll .*damage$/ }),
        )
        await settle()
        expect(drawn()).toMatchSnapshot(name)
      },
    )

    it('a hit die spent', async () => {
      renderSheet(fullerSheet())
      await user().click(
        screen.getByRole('button', { name: 'Use a d10 hit die, 3 of 5 left' }),
      )
      await settle()
      expect(drawn()).toMatchSnapshot('hit die')
    })
  })
})
