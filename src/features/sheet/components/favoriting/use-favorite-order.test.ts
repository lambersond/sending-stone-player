import { act, renderHook } from '@testing-library/react'
import { useFavoriteOrder } from './use-favorite-order'
import { fullerSheet, sheetFavorites } from '@/mocks/sending-stone'
import { targetKey } from '@/utils/favorite-commands'
import { favoriteEntries } from '@/utils/favorites'
import type { FavoriteTarget, TableRollState } from '@/types/roll'
import type { SheetFavorite } from '@/types/sending-stone'

type Props = {
  on?: boolean
  favorites?: SheetFavorite[]
  states?: ReadonlyMap<string, TableRollState>
}

/** The pane's favorites put in order, sending each order with an id of its own. */
const renderOrder = (initial: Props = {}) => {
  let sent = 0
  const send = jest.fn(() => `use-${++sent}`)
  const hook = renderHook(
    ({ on = true, favorites = sheetFavorites(), states = new Map() }: Props) =>
      useFavoriteOrder({ on, favorites, states, send }),
    { initialProps: initial },
  )
  return { ...hook, send }
}

/** The order the list shows, by key, of the sheet's favorites given. */
const shown = (
  arrange: (entries: ReturnType<typeof favoriteEntries>) => unknown[],
  favorites = sheetFavorites(),
) =>
  (
    arrange(favoriteEntries(fullerSheet({ favorites }))) as { key: string }[]
  ).map(entry => entry.key)

const SHEET = [
  'resource:primary',
  'item:warhammer',
  'activity:staff.cast-fireball',
  'effect:blessed',
  'skill:prc',
  'tool:thief',
  'slots:spell1',
]
/** Bless moved first, the rest as they were. */
const BLESS_FIRST = [
  'effect:blessed',
  'item:warhammer',
  'activity:staff.cast-fireball',
  'skill:prc',
  'tool:thief',
  'slots:spell1',
]

describe('useFavoriteOrder, from module 0.47.0', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('sends the whole order and the one shown, named for what moved, and shows it at once', () => {
    const { result, send } = renderOrder()
    expect(result.current.on).toBe(true)
    expect(shown(result.current.arrange)).toEqual(SHEET)

    act(() => result.current.save(BLESS_FIRST, 'Bless'))
    expect(send).toHaveBeenCalledWith(
      [
        { type: 'effect', id: 'blessed' },
        { type: 'item', id: 'warhammer' },
        { type: 'activity', id: 'cast-fireball', item: 'staff' },
        { type: 'skill', id: 'prc' },
        { type: 'tool', id: 'thief' },
        { type: 'slots', id: 'spell1' },
      ],
      [
        { type: 'item', id: 'warhammer' },
        { type: 'activity', id: 'cast-fireball', item: 'staff' },
        { type: 'effect', id: 'blessed' },
        { type: 'skill', id: 'prc' },
        { type: 'tool', id: 'thief' },
        { type: 'slots', id: 'spell1' },
      ],
      'Bless',
    )
    // The resource stays first; the rest in the order sent, before the game has heard of it.
    expect(shown(result.current.arrange)).toEqual([
      'resource:primary',
      ...BLESS_FIRST,
    ])
    // The same order again sends nothing.
    act(() => result.current.save(BLESS_FIRST, 'Bless'))
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('shows the sheet’s order again once the game refuses it', () => {
    const { result, rerender } = renderOrder()
    act(() => result.current.save(BLESS_FIRST, 'Bless'))
    rerender({ states: new Map([['use-1', { status: 'sending' }]]) })
    expect(shown(result.current.arrange)[1]).toBe('effect:blessed')
    rerender({
      states: new Map([['use-1', { status: 'failed', reason: 'changed' }]]),
    })
    expect(shown(result.current.arrange)).toEqual(SHEET)
  })

  it('keeps showing it once made until the sheet does, and then the sheet’s', () => {
    const { result, rerender } = renderOrder()
    act(() => result.current.save(BLESS_FIRST, 'Bless'))
    const done = new Map([['use-1', { status: 'done' } as TableRollState]])
    rerender({ states: done })
    expect(shown(result.current.arrange)[1]).toBe('effect:blessed')
    const [resource, warhammer, fireball, bless, ...rest] = sheetFavorites()
    const reordered = [resource, bless, warhammer, fireball, ...rest]
    rerender({ states: done, favorites: reordered })
    expect(shown(result.current.arrange, reordered)).toEqual([
      'resource:primary',
      ...BLESS_FIRST,
    ])
  })

  // Athletics favorited while Bless's order is on its way, from a row's menu or in Foundry: the
  // sheet lists it last. A move of it, or of another, names it, from the order shown.
  it.each([
    [
      'Athletics moved up',
      [...BLESS_FIRST.slice(0, -1), 'skill:ath', 'slots:spell1'],
    ],
    [
      'the Warhammer moved down',
      [
        'effect:blessed',
        'activity:staff.cast-fireball',
        'item:warhammer',
        ...BLESS_FIRST.slice(3),
        'skill:ath',
      ],
    ],
  ])(
    'while one waits, names a favorite added meanwhile where the sheet lists it: %s',
    (label, moved) => {
      const { result, rerender, send } = renderOrder()
      act(() => result.current.save(BLESS_FIRST, 'Bless'))
      const favorites: SheetFavorite[] = [
        ...sheetFavorites(),
        { type: 'skill', id: 'ath', name: 'Athletics' },
      ]
      rerender({
        states: new Map([['use-1', { status: 'sending' }]]),
        favorites,
      })
      act(() => result.current.save(moved, label))
      const [order, was] = (send.mock.calls[1] as unknown[])
        .slice(0, 2)
        .map(targets =>
          (targets as FavoriteTarget[]).map(target => targetKey(target)),
        )
      expect({ order, was }).toEqual({
        order: moved,
        was: [...BLESS_FIRST, 'skill:ath'],
      })
    },
  )

  it('moves only those shown, any the page doesn’t show keeping its place', () => {
    const { result, send } = renderOrder()
    // The list shows all but the tool and the slots, say: they keep their places.
    act(() =>
      result.current.save(
        [
          'skill:prc',
          'item:warhammer',
          'activity:staff.cast-fireball',
          'effect:blessed',
        ],
        'Perception',
      ),
    )
    expect(
      (send.mock.calls[0] as unknown[][])[0].map(
        target => (target as { id: string }).id,
      ),
    ).toEqual([
      'prc',
      'warhammer',
      'cast-fireball',
      'blessed',
      'thief',
      'spell1',
    ])
  })
})
