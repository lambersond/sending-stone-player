/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { renderHook } from '@testing-library/react'
import { useSpentOffers } from './use-spent-offers'
import type { Effects } from '@/components/character-sheet/effect-controls'
import type { EffectOp } from '@/constants/sending-stone'
import type { LocalCheck, LocalRoll } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { SheetEffect } from '@/types/sending-stone'

// The dice offered that a player added (module 0.42.1): spent from the moment their roll is sent,
// unless it isn't made; and once it's made, their effect removed, once, where the player may.

/** Thorin's Inspired, as the Effects tab lists it, which its player may turn off or delete. */
const INSPIRED: SheetEffect = {
  id: 'inspired',
  name: 'Inspired',
  img: null,
  source: 'Vex',
  duration: '1 Hour',
  disabled: false,
  ops: ['disable', 'delete'],
  text: null,
}

/** A Strength save Vex's Bardic Inspiration was added to, made at 1000. */
const SAVE: LocalCheck = {
  kind: 'check',
  id: 'check-1',
  label: 'Strength saving throw',
  total: 16,
  modifier: 2,
  d20s: [9],
  natural: 9,
  extras: [{ text: 'Bardic Inspiration +1d6', values: [5], value: 5 }],
  typed: true,
  spends: [
    { effect: 'inspired', name: 'Inspired', offer: 'Bardic Inspiration' },
  ],
  at: 1000,
}

/** Another roll, which spent nothing. */
const PLAIN: LocalCheck = {
  ...SAVE,
  id: 'check-0',
  extras: [],
  spends: undefined,
  at: 500,
}

const state = (status: TableRollState['status']): TableRollState => ({
  status,
})

type Props = {
  rolls?: LocalRoll[]
  states?: ReadonlyMap<string, TableRollState>
  effects?: SheetEffect[]
  /** What the controls offer of each effect: none, as where they're off. */
  ops?: EffectOp[] | 'off'
  /** Whether another change of it waits. */
  waiting?: boolean
}

/** The hook as the pane calls it, with its effect controls as given. */
function setUp(initial: Props = {}) {
  const spent = { current: new Set<string>() as ReadonlySet<string> }
  const send = jest.fn<string | undefined, [SheetEffect, EffectOp, number?]>(
    () => 'use-9',
  )
  const effectingOf = ({
    effects = [INSPIRED],
    ops = ['disable', 'delete'],
    waiting = false,
  }: Props): Pick<Effects, 'effectOf' | 'choiceFor' | 'send'> => ({
    effectOf: id => effects.find(effect => effect.id === id),
    choiceFor: () =>
      ops === 'off' ? undefined : { ops, waiting, choose: () => {} },
    send,
  })
  const hook = renderHook(
    (props: Props) =>
      useSpentOffers({
        spent,
        rolls: props.rolls ?? [SAVE, PLAIN],
        states: props.states ?? new Map(),
        effecting: effectingOf(props),
      }),
    { initialProps: initial },
  )
  return { ...hook, spent, send }
}

describe('hooks/use-spent-offers', () => {
  it.each([
    ['on its way', state('sending')],
    ['being made', state('rolling')],
    ['made', state('done')],
    ['not yet heard of', undefined],
  ])('holds its effect spent while the roll is %s', (_, way) => {
    const { spent } = setUp({
      states: new Map(way ? [[SAVE.id, way]] : []),
    })

    expect([...spent.current]).toEqual(['inspired'])
  })

  it.each(['refused', 'failed', 'expired', 'lost'] as const)(
    'spends nothing, and removes nothing, of a roll %s, so it is offered again',
    status => {
      const { spent, send } = setUp({
        states: new Map([[SAVE.id, state(status)]]),
      })

      expect(spent.current.size).toBe(0)
      expect(send).not.toHaveBeenCalled()
    },
  )

  // Round 0.42.1's review: a roll that took the game too long may still be made, as the page goes
  // on following it, so its die isn't offered again meanwhile, which would add it twice.
  it('holds its effect spent while a roll that took too long may still be made, and removes it once it is', () => {
    const { spent, send, rerender } = setUp({
      states: new Map([[SAVE.id, { ...state('failed'), reason: 'timeout' }]]),
    })

    expect([...spent.current]).toEqual(['inspired'])
    expect(send).not.toHaveBeenCalled()

    rerender({ states: new Map([[SAVE.id, state('done')]]) })
    expect(send).toHaveBeenCalledWith(INSPIRED, 'delete', SAVE.at - 1)
  })

  it('spends nothing of a roll nothing offered was added to', () => {
    const { spent } = setUp({ rolls: [PLAIN] })

    expect(spent.current.size).toBe(0)
  })

  it('deletes the effect once the roll is made, logged just before it, once however often the ways change', () => {
    const { send, rerender } = setUp({
      states: new Map([[SAVE.id, state('rolling')]]),
    })
    expect(send).not.toHaveBeenCalled()

    rerender({ states: new Map([[SAVE.id, state('done')]]) })
    rerender({
      states: new Map([
        [SAVE.id, state('done')],
        ['use-9', state('sending')],
      ]),
    })
    rerender({
      states: new Map([
        [SAVE.id, state('done')],
        ['use-9', state('done')],
      ]),
    })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(INSPIRED, 'delete', SAVE.at - 1)
  })

  it('tries again on the next ways where another change of it waits, or the delete isn’t sent', () => {
    const { send, rerender } = setUp({
      states: new Map([[SAVE.id, state('done')]]),
      waiting: true,
    })
    expect(send).not.toHaveBeenCalled()

    // Not waiting by the controls' own word, but turned down as it's sent.
    // eslint-disable-next-line unicorn/no-useless-undefined -- none sent
    send.mockReturnValueOnce(undefined)
    rerender({ states: new Map([[SAVE.id, state('done')]]) })
    expect(send).toHaveBeenCalledTimes(1)

    rerender({
      states: new Map([
        [SAVE.id, state('done')],
        ['use-8', state('done')],
      ]),
    })
    expect(send).toHaveBeenCalledTimes(2)
    rerender({ states: new Map([[SAVE.id, state('done')]]) })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('sends nothing for an effect already gone from the sheet', () => {
    const { send } = setUp({
      states: new Map([[SAVE.id, state('done')]]),
      effects: [],
    })

    expect(send).not.toHaveBeenCalled()
  })

  // Round 0.42.1's review: the roller keeps only its newest 20 rolls, of every kind; a die spent
  // stays spent while its effect is on the sheet, however many follow (§0.8.11).
  it('holds its effect spent once the roller has let the roll go, while the effect stays on', () => {
    const others = Array.from({ length: 20 }, (_, at): LocalCheck => ({
      ...PLAIN,
      id: `check-${at + 2}`,
      at: 2000 + at,
    }))
    const { spent, send, rerender } = setUp({
      states: new Map([[SAVE.id, state('done')]]),
      ops: 'off',
    })

    rerender({
      rolls: others,
      states: new Map([[SAVE.id, state('done')]]),
      ops: 'off',
    })

    expect([...spent.current]).toEqual(['inspired'])
    expect(send).not.toHaveBeenCalled()
  })

  it('removes the effect once made, though the roller let the roll go before', () => {
    const { send, rerender } = setUp({
      states: new Map([[SAVE.id, state('rolling')]]),
    })

    rerender({ rolls: [PLAIN], states: new Map([[SAVE.id, state('rolling')]]) })
    expect(send).not.toHaveBeenCalled()
    rerender({ rolls: [PLAIN], states: new Map([[SAVE.id, state('done')]]) })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(INSPIRED, 'delete', SAVE.at - 1)
  })

  it('lets a roll the roller let go of go too once its effect has left the sheet', () => {
    const { spent, rerender } = setUp({ ops: 'off' })
    expect([...spent.current]).toEqual(['inspired'])

    rerender({ rolls: [PLAIN], effects: [], ops: 'off' })
    expect(spent.current.size).toBe(0)
    // Forgotten, as an Inspired given after is another effect: even the same one back isn't spent.
    rerender({ rolls: [PLAIN], ops: 'off' })
    expect(spent.current.size).toBe(0)
  })

  it.each([
    ['the controls are off', 'off'],
    ['the effect may only be turned off', ['disable']],
  ] as const)('sends nothing where %s, the effect still spent', (_, ops) => {
    const { send, spent, rerender } = setUp({
      states: new Map([[SAVE.id, state('done')]]),
      ops: ops === 'off' ? ops : [...ops],
    })

    // Nor once they're offered after, the roll told already.
    rerender({ states: new Map([[SAVE.id, state('done')]]) })

    expect(send).not.toHaveBeenCalled()
    expect([...spent.current]).toEqual(['inspired'])
  })
})
