/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { act, renderHook } from '@testing-library/react'
import {
  NO_PREPARING,
  Preparing,
  usePrepareChoice,
  usePreparing,
} from './preparing'
import { PREPARE_SETTLE } from '@/constants/sending-stone'
import { sheetSpell } from '@/mocks/sending-stone'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { SheetSpellSection } from '@/types/sending-stone'
import type { ReactNode } from 'react'

/**
 * Thorin's spells: Witch Bolt not prepared, Bless prepared, Cure Wounds always, Guidance a cantrip,
 * a wand's Magic Missile cast from it, and Hex among his pact magic, not prepared.
 */
const spellbook = (
  prepared: { witch?: 0 | 1; bless?: 0 | 1 } = {},
): SheetSpellSection[] => [
  {
    id: 'spell0',
    label: 'Cantrips',
    slots: null,
    spells: [sheetSpell({ id: 'guidance', name: 'Guidance', level: 0 })],
  },
  {
    id: 'spell1',
    label: '1st Level',
    slots: { value: 2, max: 3 },
    spells: [
      sheetSpell({
        id: 'witch',
        name: 'Witch Bolt',
        prepared: prepared.witch ?? 0,
      }),
      sheetSpell({ id: 'bless', name: 'Bless', prepared: prepared.bless ?? 1 }),
      sheetSpell({ id: 'cure', name: 'Cure Wounds', prepared: 2 }),
    ],
  },
  {
    id: 'pact',
    label: 'Pact Magic',
    slots: { value: 1, max: 1, level: 1 },
    spells: [sheetSpell({ id: 'hex', name: 'Hex', prepared: 0 })],
  },
  {
    id: 'item',
    label: 'Wand of Magic Missiles',
    slots: null,
    spells: [
      sheetSpell({
        id: 'mm',
        name: 'Magic Missile',
        castFrom: { id: 'wand', name: 'Wand of Magic Missiles' },
      }),
    ],
  },
]

type Props = {
  on?: boolean
  spells?: SheetSpellSection[]
  states?: ReadonlyMap<string, TableRollState>
}

/** A pane's spells, as given, sending each with a line id of its own. */
const renderPreparing = (initial: Props = {}) => {
  let sent = 0
  const send = jest.fn(() => `use-${++sent}`)
  const hook = renderHook(
    ({ on = true, spells = spellbook(), states = new Map() }: Props) =>
      usePreparing({ on, spells, states, send }),
    { initialProps: initial },
  )
  return { ...hook, send }
}

/** The first one sent, in the state given. */
const states = (state: TableRollState) => new Map([['use-1', state]])

describe('components/character-sheet/preparing, from module 0.42.1 (round 0.42.1 §P.4)', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('offers none where the pane doesn’t, nor outside a pane', () => {
    const { result } = renderPreparing({ on: false })
    expect(result.current.choiceFor('witch')).toBeUndefined()
    expect(result.current.choiceFor('bless')).toBeUndefined()
    expect(NO_PREPARING.choiceFor('witch')).toBeUndefined()
  })

  it('offers Prepare of a spell not prepared and Unprepare of one prepared, found by its id in any section', () => {
    const { result } = renderPreparing()
    expect(result.current.choiceFor('witch')).toMatchObject({
      op: 'prepare',
      waiting: false,
    })
    expect(result.current.choiceFor('bless')).toMatchObject({
      op: 'unprepare',
      waiting: false,
    })
    // Pact magic's, whose casting prepares too.
    expect(result.current.choiceFor('hex')?.op).toBe('prepare')
  })

  it.each([
    ['always prepared', 'cure'],
    ['a cantrip', 'guidance'],
    ['cast from an item', 'mm'],
    ['not on the sheet', 'nope'],
  ])('offers none for a spell %s', (_name, id) => {
    const { result } = renderPreparing()
    expect(result.current.choiceFor(id)).toBeUndefined()
  })

  it('sends the spell and the state wanted once, as chosen, and waits while it’s on its way, however long', () => {
    jest.useFakeTimers()
    const { result, rerender, send } = renderPreparing()

    act(() => result.current.choiceFor('witch')?.choose())
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'witch', name: 'Witch Bolt' }),
      'prepare',
    )

    rerender({ states: states({ status: 'sending' }) })
    expect(result.current.choiceFor('witch')).toMatchObject({
      op: 'prepare',
      waiting: true,
    })
    // No timer while it's on its way: still waiting long after.
    act(() => jest.advanceTimersByTime(15_000))
    expect(result.current.choiceFor('witch')?.waiting).toBe(true)
    rerender({ states: states({ status: 'rolling' }) })
    expect(result.current.choiceFor('witch')?.waiting).toBe(true)
    // Another spell doesn't wait for it.
    expect(result.current.choiceFor('bless')?.waiting).toBe(false)
  })

  it('waits once made until the sheet has it as asked, by its id', () => {
    jest.useFakeTimers()
    const { result, rerender } = renderPreparing()
    act(() => result.current.choiceFor('witch')?.choose())

    // Made, but the sheet the page holds hasn't it prepared yet.
    rerender({ states: states({ status: 'done', visible: true }) })
    expect(result.current.choiceFor('witch')).toMatchObject({
      op: 'prepare',
      waiting: true,
    })
    // The sheet comes.
    rerender({
      states: states({ status: 'done', visible: true }),
      spells: spellbook({ witch: 1 }),
    })
    expect(result.current.choiceFor('witch')).toMatchObject({
      op: 'unprepare',
      waiting: false,
    })
  })

  it('waits for an unprepare until the sheet has it unprepared', () => {
    const { result, rerender } = renderPreparing()
    act(() => result.current.choiceFor('bless')?.choose())
    rerender({ states: states({ status: 'done', visible: true }) })
    expect(result.current.choiceFor('bless')).toMatchObject({
      op: 'unprepare',
      waiting: true,
    })
    rerender({
      states: states({ status: 'done', visible: true }),
      spells: spellbook({ bless: 0 }),
    })
    expect(result.current.choiceFor('bless')).toMatchObject({
      op: 'prepare',
      waiting: false,
    })
  })

  it('stops waiting once the sheet should have come, whatever it says', () => {
    jest.useFakeTimers()
    const { result, rerender } = renderPreparing()
    act(() => result.current.choiceFor('witch')?.choose())

    rerender({ states: states({ status: 'done', visible: true }) })
    act(() => jest.advanceTimersByTime(PREPARE_SETTLE - 1))
    expect(result.current.choiceFor('witch')?.waiting).toBe(true)
    act(() => jest.advanceTimersByTime(1))
    expect(result.current.choiceFor('witch')).toMatchObject({
      op: 'prepare',
      waiting: false,
    })
  })

  it.each([
    ['refused', { status: 'refused', reason: 'prepare' }],
    ['refused busy', { status: 'refused', reason: 'busy' }],
    ['failed', { status: 'failed', reason: 'gone' }],
    ['expired', { status: 'expired' }],
  ] as [string, TableRollState][])(
    'never waits once %s, so it can be tried again',
    (_name, state) => {
      const { result, rerender } = renderPreparing()
      act(() => result.current.choiceFor('witch')?.choose())
      rerender({ states: states(state) })
      expect(result.current.choiceFor('witch')).toMatchObject({
        op: 'prepare',
        waiting: false,
      })
    },
  )

  it('waits for the last one sent of a spell, not an earlier one', () => {
    const { result, rerender } = renderPreparing()
    act(() => result.current.choiceFor('witch')?.choose())
    act(() => result.current.choiceFor('witch')?.choose())
    rerender({
      states: new Map([
        ['use-1', { status: 'sending' }],
        ['use-2', { status: 'refused', reason: 'busy' }],
      ]) as ReadonlyMap<string, TableRollState>,
    })
    expect(result.current.choiceFor('witch')?.waiting).toBe(false)
  })

  it('gives each row its entry from the pane around it by the spell’s id, and none outside one, or for no id', () => {
    const choice = { op: 'prepare' as const, waiting: false, choose: jest.fn() }
    const value = { choiceFor: jest.fn(() => choice) }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Preparing value={value}>{children}</Preparing>
    )

    const inside = renderHook(() => usePrepareChoice('witch'), { wrapper })
    expect(inside.result.current).toBe(choice)
    expect(value.choiceFor).toHaveBeenCalledWith('witch')

    const none = renderHook(() => usePrepareChoice(), { wrapper })
    expect(none.result.current).toBeUndefined()

    const outside = renderHook(() => usePrepareChoice('witch'))
    expect(outside.result.current).toBeUndefined()
  })
})
