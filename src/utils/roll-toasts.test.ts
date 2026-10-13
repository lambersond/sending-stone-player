import {
  dropToast,
  dueToasts,
  NO_TOASTS,
  popToasts,
  settledMark,
  TOAST_CAP,
  TOAST_FOR,
  type ToastBook,
} from './roll-toasts'
import type { LocalCheck } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

/** A check, thrown at `at`. */
const check = (id: string, at = 0): LocalCheck => ({
  kind: 'check',
  id,
  label: `${id} check`,
  total: 12,
  modifier: 2,
  d20s: [10],
  natural: 10,
  extras: [],
  at,
})

/** The rolls' ways to the game, by their ids, as a new map each time, as each poll makes one. */
const ways = (...entries: [string, TableRollState][]) => new Map(entries)

const NONE = ways()

/** The game's answer to a roll it made, as a new object each time, as each poll makes one. */
const done = (): TableRollState => ({
  status: 'done',
  visible: true,
  total: 14,
})

/** The ids of the toasts showing, top first. */
const ids = (book: ToastBook) => book.shown.map(({ id }) => id)

describe('utils/roll-toasts', () => {
  it('U1 pops a new roll up on top, for four seconds', () => {
    const a = check('a')
    const b = check('b', 1)
    const once = popToasts(NO_TOASTS, [a], NONE, 1000, true)
    expect(once.shown).toEqual([{ id: 'a', poppedAt: 1000, until: 5000 }])
    expect(TOAST_FOR).toBe(4000)

    const twice = popToasts(once, [b, a], NONE, 1500, true)
    expect(twice.shown).toEqual([
      { id: 'b', poppedAt: 1500, until: 5500 },
      { id: 'a', poppedAt: 1000, until: 5000 },
    ])
  })

  it('U2 puts the roll that landed last on top, whenever it was thrown', () => {
    // A is thrown first, but B's dice land first: the page keeps them by when they were thrown.
    const a = check('a', 1)
    const b = check('b', 2)
    const landed = popToasts(NO_TOASTS, [b], NONE, 100, true)
    const both = popToasts(landed, [b, a], NONE, 200, true)

    expect(ids(both)).toEqual(['a', 'b'])
    // Of rolls met at once, the newest thrown is on top.
    expect(ids(popToasts(NO_TOASTS, [b, a], NONE, 100, true))).toEqual([
      'b',
      'a',
    ])
  })

  it('U3 shows three at most, a fourth dropping the oldest at once', () => {
    const rolls = ['a', 'b', 'c', 'd'].map((id, at) => check(id, at))
    let book = NO_TOASTS
    for (const at of rolls.keys()) {
      book = popToasts(
        book,
        rolls.slice(0, at + 1).toReversed(),
        NONE,
        at * 100,
        true,
      )
    }

    expect(TOAST_CAP).toBe(3)
    expect(ids(book)).toEqual(['d', 'c', 'b'])
    expect(
      ids(popToasts(NO_TOASTS, rolls.toReversed(), NONE, 0, true)),
    ).toEqual(['d', 'c', 'b'])
  })

  it('U4 gives a toast its full time again where it is, as its roll is made at the table', () => {
    const a = check('a', 1)
    const b = check('b', 2)
    let book = popToasts(
      NO_TOASTS,
      [a],
      ways(['a', { status: 'sending' }]),
      0,
      true,
    )
    book = popToasts(
      book,
      [b, a],
      ways(['a', { status: 'sending' }], ['b', { status: 'sending' }]),
      500,
      true,
    )

    const settled = popToasts(
      book,
      [b, a],
      ways(
        ['a', { status: 'done', visible: true, total: 14 }],
        ['b', { status: 'sending' }],
      ),
      1500,
      true,
    )

    expect(settled.shown).toEqual([
      { id: 'b', poppedAt: 500, until: 4500 },
      { id: 'a', poppedAt: 0, until: 5500 },
    ])
  })

  it.each([
    ['its time was up', (book: ToastBook) => dueToasts(book, 4000)],
    ['it was tapped away', (book: ToastBook) => dropToast(book, 'a')],
  ])(
    'U5 pops a roll up again on top as it is made at the table, where %s',
    (_, gone) => {
      const a = check('a', 1)
      const b = check('b', 2)
      const book = popToasts(
        NO_TOASTS,
        [a],
        ways(['a', { status: 'sending' }]),
        0,
        true,
      )
      const away = popToasts(
        gone(book),
        [b, a],
        ways(['a', { status: 'sending' }]),
        100,
        true,
      )
      expect(ids(away)).toEqual(['b'])

      const again = popToasts(
        away,
        [b, a],
        ways(['a', { status: 'failed', reason: 'busy' }]),
        6000,
        true,
      )

      expect(again.shown).toEqual([
        { id: 'a', poppedAt: 6000, until: 10_000 },
        { id: 'b', poppedAt: 100, until: 4100 },
      ])
    },
  )

  it('U6 pops a roll made by the time it landed once, the same ways polled again changing nothing', () => {
    const a = check('a')
    const book = popToasts(NO_TOASTS, [a], ways(['a', done()]), 0, true)
    expect(book.shown).toEqual([{ id: 'a', poppedAt: 0, until: 4000 }])
    expect(book.told.get('a')).toBe('done:')

    expect(popToasts(book, [a], ways(['a', done()]), 1000, true)).toBe(book)
    const gone = dueToasts(book, 4000)
    expect(popToasts(gone, [a], ways(['a', done()]), 5000, true)).toBe(gone)
  })

  it.each<[string, TableRollState, TableRollState]>([
    [
      'too long, then made',
      { status: 'failed', reason: 'timeout' },
      { status: 'done', visible: true, total: 9 },
    ],
    [
      'lost, then made',
      { status: 'lost' },
      { status: 'done', visible: true, total: 9 },
    ],
  ])(
    'U7 pops a roll up again each time its end changes: %s',
    (_, first, then) => {
      const a = check('a')
      let book = NO_TOASTS
      // When each toast popped up, as the page polls the game and the toasts' times run out.
      const popped = new Set<number>()
      const poll = (state: TableRollState, now: number) => {
        book = popToasts(
          dueToasts(book, now),
          [a],
          ways(['a', state]),
          now,
          true,
        )
        for (const { poppedAt } of book.shown) popped.add(poppedAt)
      }

      poll(first, 0)
      poll(first, 1000)
      poll(first, 5000)
      poll(then, 6000)
      poll(then, 7000)

      expect([...popped]).toEqual([0, 6000])
      expect(book.told.get('a')).toBe('done:')
    },
  )

  it('U8 gives no toast more time as a roll goes from sent to being made, or as dice sent one after another go', () => {
    const a = check('a')
    const book = popToasts(
      NO_TOASTS,
      [a],
      ways(['a', { status: 'sending' }]),
      0,
      true,
    )

    expect(
      popToasts(book, [a], ways(['a', { status: 'rolling' }]), 1000, true),
    ).toBe(book)
    const first = popToasts(
      book,
      [a],
      ways(['a', { status: 'sending', together: { count: 3, made: 1 } }]),
      1000,
      true,
    )
    expect(first).toBe(book)
    expect(
      popToasts(
        first,
        [a],
        ways(['a', { status: 'sending', together: { count: 3, made: 2 } }]),
        2000,
        true,
      ),
    ).toBe(book)
  })

  it('U9 pops nothing while toasts are off, nor ever for the rolls made meanwhile', () => {
    const a = check('a', 1)
    const b = check('b', 2)
    const off = popToasts(
      NO_TOASTS,
      [a],
      ways(['a', { status: 'sending' }]),
      0,
      false,
    )
    expect(off.shown).toEqual([])
    expect(off.quiet.has('a')).toBe(true)

    const on = popToasts(
      off,
      [a],
      ways(['a', { status: 'sending' }]),
      100,
      true,
    )
    expect(on.shown).toEqual([])
    const made = popToasts(
      on,
      [a],
      ways(['a', { status: 'done', visible: true, total: 9 }]),
      200,
      true,
    )
    expect(made.shown).toEqual([])

    const next = popToasts(
      made,
      [b, a],
      ways(['a', { status: 'done', visible: true, total: 9 }]),
      300,
      true,
    )
    expect(ids(next)).toEqual(['b'])
  })

  it('U10 takes every toast away as toasts are turned off', () => {
    const a = check('a')
    const book = popToasts(NO_TOASTS, [a], NONE, 0, true)

    const off = popToasts(book, [a], NONE, 100, false)

    expect(off.shown).toEqual([])
    expect(off.quiet.has('a')).toBe(false)
  })

  it('U10 pops nothing up as toasts are turned on again for a roll toasted before and made at the table meanwhile', () => {
    const a = check('a')
    const sending = ways(['a', { status: 'sending' }])
    let book = popToasts(NO_TOASTS, [a], sending, 0, true)
    book = popToasts(book, [a], sending, 100, false)
    // The page keeps looking while toasts are off, so that how the roll ended is known.
    book = popToasts(book, [a], ways(['a', done()]), 200, false)

    const on = popToasts(book, [a], ways(['a', done()]), 300, true)

    expect(on.shown).toEqual([])
    expect(on.told.get('a')).toBe('done:')
  })

  it('U11 keeps a toast until its time is up', () => {
    const book = popToasts(NO_TOASTS, [check('a')], NONE, 0, true)

    expect(dueToasts(book, 3999)).toBe(book)
    expect(dueToasts(book, 4000).shown).toEqual([])
  })

  it('U12 takes away the toast of a roll the page no longer keeps', () => {
    const a = check('a', 1)
    const b = check('b', 2)
    const book = popToasts(NO_TOASTS, [b, a], NONE, 0, true)

    expect(ids(popToasts(book, [b], NONE, 100, true))).toEqual(['b'])
  })

  it('U13 marks how a roll ended, and nothing while it is on its way', () => {
    expect(settledMark()).toBeUndefined()
    expect(settledMark({ status: 'sending' })).toBeUndefined()
    expect(settledMark({ status: 'rolling' })).toBeUndefined()
    expect(settledMark({ status: 'done', visible: true, total: 3 })).toBe(
      'done:',
    )
    expect(settledMark({ status: 'failed', reason: 'timeout' })).toBe(
      'failed:timeout',
    )
    expect(settledMark({ status: 'expired' })).toBe('expired:')
    expect(settledMark({ status: 'lost' })).toBe('lost:')
    expect(settledMark({ status: 'refused', reason: 'network' })).toBe(
      'refused:network',
    )
  })
})
