/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { act, renderHook } from '@testing-library/react'
import {
  Favoriting,
  NO_FAVORITING,
  useFavoriteChoice,
  useFavorites,
} from './favoriting'
import { FAVORITE_SETTLE } from '@/constants/sending-stone'
import { fullerSheet, sheetFavorites } from '@/mocks/sending-stone'
import { favoriteEntries } from '@/utils/favorites'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { FavoriteTarget } from '@/types/roll'
import type {
  SheetFavorite,
  SheetResourceFavorite,
} from '@/types/sending-stone'
import type { ReactNode } from 'react'

const ROPE: FavoriteTarget = { type: 'item', id: 'rope' }
const WARHAMMER: FavoriteTarget = { type: 'item', id: 'warhammer' }
const FIREBALL: FavoriteTarget = {
  type: 'activity',
  id: 'cast-fireball',
  item: 'staff',
}

/** Second Wind's resource, standing for its feature. */
const secondWind: SheetResourceFavorite = {
  type: 'resource',
  id: 'secondary',
  name: 'Second Wind',
  uses: { value: 1, max: 1, recovery: 'Short Rest' },
  itemId: 'second-wind',
}

type Props = {
  on?: boolean
  favorites?: SheetFavorite[]
  states?: ReadonlyMap<string, TableRollState>
}

/** A pane's favorites, as given, sending each with an id of its own. */
const renderFavorites = (initial: Props = {}) => {
  let sent = 0
  const send = jest.fn(() => `use-${++sent}`)
  const hook = renderHook(
    ({ on = true, favorites = sheetFavorites(), states = new Map() }: Props) =>
      useFavorites({
        on,
        favorites,
        entries: favoriteEntries(fullerSheet({ favorites })),
        states,
        send,
      }),
    { initialProps: initial },
  )
  return { ...hook, send }
}

/** A pane's one sent, in the state given. */
const states = (state: TableRollState) => new Map([['use-1', state]])

describe('components/character-sheet/favoriting, from module 0.37.0', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('offers none where the pane doesn’t, as at a companion’s or a game that takes none', () => {
    const { result } = renderFavorites({ on: false })
    expect(result.current.choiceFor(ROPE, 'Rope')).toBeUndefined()
    expect(NO_FAVORITING.choiceFor(ROPE, 'Rope')).toBeUndefined()
  })

  it('offers Add of what isn’t a favorite, and Remove of what is, as the favorites say, never the stars', () => {
    const { result } = renderFavorites()
    expect(result.current.choiceFor(ROPE, 'Rope')).toMatchObject({
      op: 'add',
      waiting: false,
    })
    expect(result.current.choiceFor(WARHAMMER, 'Warhammer')).toMatchObject({
      op: 'remove',
      waiting: false,
    })
    // An activity, which no star marks, by its item and its own id.
    expect(result.current.choiceFor(FIREBALL, 'Cast Fireball')?.op).toBe(
      'remove',
    )
    expect(
      result.current.choiceFor({ ...FIREBALL, item: 'wand' }, 'Cast Fireball')
        ?.op,
    ).toBe('add')
  })

  it('offers nothing for a feature a resource stands for, whose place is the resource’s', () => {
    const { result } = renderFavorites({ favorites: [secondWind] })
    expect(
      result.current.choiceFor(
        { type: 'item', id: 'second-wind' },
        'Second Wind',
      ),
    ).toBeUndefined()
    // Its activities are rows of their own.
    expect(
      result.current.choiceFor(
        { type: 'activity', id: 'breather', item: 'second-wind' },
        'Breather',
      )?.op,
    ).toBe('add')
  })

  it('sends what is chosen, by the row’s name, and waits while it’s on its way, then until the sheet agrees', () => {
    jest.useFakeTimers()
    const { result, rerender, send } = renderFavorites()

    act(() => result.current.choiceFor(ROPE, 'Rope')?.choose())
    expect(send).toHaveBeenCalledWith(ROPE, 'add', 'Rope')

    rerender({ states: states({ status: 'sending' }) })
    expect(result.current.choiceFor(ROPE, 'Rope')).toMatchObject({
      op: 'add',
      waiting: true,
    })
    rerender({ states: states({ status: 'rolling' }) })
    expect(result.current.choiceFor(ROPE, 'Rope')?.waiting).toBe(true)
    // Made, but the sheet the page holds doesn't say so yet.
    rerender({ states: states({ status: 'done', favorited: true }) })
    expect(result.current.choiceFor(ROPE, 'Rope')).toMatchObject({
      op: 'add',
      waiting: true,
    })
    // Another target doesn't wait for it.
    expect(result.current.choiceFor(WARHAMMER, 'Warhammer')?.waiting).toBe(
      false,
    )
    // The sheet comes.
    rerender({
      states: states({ status: 'done', favorited: true }),
      favorites: [
        ...sheetFavorites(),
        { type: 'item', id: 'rope', itemType: 'loot', name: 'Rope', img: null },
      ],
    })
    expect(result.current.choiceFor(ROPE, 'Rope')).toMatchObject({
      op: 'remove',
      waiting: false,
    })
  })

  it('stops waiting once the sheet should have come, whatever it says', () => {
    jest.useFakeTimers()
    const { result, rerender } = renderFavorites()
    act(() => result.current.choiceFor(ROPE, 'Rope')?.choose())
    const done = new Map([
      ['use-1', { status: 'done', favorited: true }],
    ]) as ReadonlyMap<string, TableRollState>

    rerender({ states: done })
    act(() => jest.advanceTimersByTime(FAVORITE_SETTLE - 1))
    expect(result.current.choiceFor(ROPE, 'Rope')?.waiting).toBe(true)
    act(() => jest.advanceTimersByTime(1))
    expect(result.current.choiceFor(ROPE, 'Rope')?.waiting).toBe(false)
  })

  it.each([
    ['failed', { status: 'failed', reason: 'gone' }],
    ['refused', { status: 'refused', reason: 'moving' }],
    ['lost', { status: 'lost' }],
  ] as [string, TableRollState][])(
    'never waits once it %s, so it can be tried again',
    (_name, state) => {
      const { result, rerender } = renderFavorites()
      act(() => result.current.choiceFor(ROPE, 'Rope')?.choose())
      rerender({ states: new Map([['use-1', state]]) })
      expect(result.current.choiceFor(ROPE, 'Rope')).toMatchObject({
        op: 'add',
        waiting: false,
      })
    },
  )

  it('waits for the last one sent of a target, not an earlier one', () => {
    const { result, rerender } = renderFavorites()
    act(() => result.current.choiceFor(ROPE, 'Rope')?.choose())
    act(() => result.current.choiceFor(ROPE, 'Rope')?.choose())
    rerender({
      states: new Map([
        ['use-1', { status: 'sending' }],
        ['use-2', { status: 'failed', reason: 'busy' }],
      ]) as ReadonlyMap<string, TableRollState>,
    })
    expect(result.current.choiceFor(ROPE, 'Rope')?.waiting).toBe(false)
  })

  it('gives each row its entry from the pane around it, and none outside one, or for a row naming nothing', () => {
    const value = {
      choiceFor: jest.fn(() => ({
        op: 'add' as const,
        waiting: false,
        choose: jest.fn(),
      })),
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Favoriting value={value}>{children}</Favoriting>
    )
    expect(
      renderHook(() => useFavoriteChoice(ROPE, 'Rope'), { wrapper }).result
        .current?.op,
    ).toBe('add')
    expect(value.choiceFor).toHaveBeenCalledWith(ROPE, 'Rope')
    expect(
      renderHook(() => useFavoriteChoice(null, 'Ki'), { wrapper }).result
        .current,
    ).toBeUndefined()
    expect(
      renderHook(() => useFavoriteChoice(ROPE, 'Rope')).result.current,
    ).toBeUndefined()
  })
})
