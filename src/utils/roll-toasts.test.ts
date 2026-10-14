/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import {
  dropToast,
  dueToasts,
  NO_TOASTS,
  popToasts,
  settledMark,
  TOAST_CAP,
  TOAST_FADE,
  TOAST_FOR,
  type ToastBook,
} from './roll-toasts'
import type { LocalCheck, LocalUse } from '@/hooks/use-sheet-roller'
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
    // Of rolls met at once, each shows, the cap catching up as the next pops up.
    const all = popToasts(NO_TOASTS, rolls.toReversed(), NONE, 0, true)
    expect(ids(all)).toEqual(['d', 'c', 'b', 'a'])
    expect(popToasts(all, rolls.toReversed(), NONE, 100, true)).toBe(all)
    const e = check('e', 4)
    expect(
      ids(popToasts(all, [e, ...rolls.toReversed()], NONE, 200, true)),
    ).toEqual(['e', 'd', 'c'])
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

  describe('a toast that waits for the player', () => {
    const preview = {
      critical: false,
      plannable: true,
      rolls: [
        {
          formula: '1d8 + 4',
          type: 'slashing',
          dice: [{ faces: 8, number: 1 }],
        },
      ],
    }
    /** An attack the game made, a hit, its damage still to roll. */
    const hit = (fields: Partial<TableRollState> = {}): TableRollState => ({
      status: 'done',
      visible: true,
      total: 19,
      requestId: 'req-a',
      attack: { critical: false, fumble: false, outcome: 'hit' },
      damage: preview,
      ...fields,
    })
    const FOREVER = Number.POSITIVE_INFINITY
    /** An attack that missed, its damage still offered, as dnd5e offers it without Midi. */
    const missed = (id: string): [string, TableRollState] => [
      id,
      hit({ attack: { critical: false, fumble: false, outcome: 'miss' } }),
    ]
    /** The ways to the game of attacks that hit, by their ids, all waiting for their damage. */
    const waiting = (...ids: string[]) =>
      ways(...ids.map((id): [string, TableRollState] => [id, hit()]))

    it('U14 never goes while its damage waits, from popping or once made at the table', () => {
      const a = check('a')
      const landed = popToasts(NO_TOASTS, [a], ways(['a', hit()]), 0, true)
      expect(landed.shown).toEqual([{ id: 'a', poppedAt: 0, until: FOREVER }])
      expect(dueToasts(landed, 1_000_000)).toBe(landed)

      // On its way at first, then made: from then, it waits.
      const sent = popToasts(
        NO_TOASTS,
        [a],
        ways(['a', { status: 'sending' }]),
        0,
        true,
      )
      expect(sent.shown[0].until).toBe(TOAST_FOR)
      const made = popToasts(sent, [a], ways(['a', hit()]), 1000, true)
      expect(made.shown).toEqual([{ id: 'a', poppedAt: 0, until: FOREVER }])
      expect(popToasts(made, [a], ways(['a', hit()]), 9000, true)).toBe(made)
    })

    it('U15 is never dropped by the cap, the oldest of the others going instead, more than three showing while all wait', () => {
      const rolls = ['a', 'b', 'c', 'd', 'e'].map((id, at) => check(id, at))
      let book = NO_TOASTS
      for (const at of rolls.keys()) {
        book = popToasts(
          book,
          rolls.slice(0, at + 1).toReversed(),
          waiting('a'),
          at * 100,
          true,
        )
      }
      expect(ids(book)).toEqual(['e', 'd', 'a'])

      const all = popToasts(
        NO_TOASTS,
        rolls.toReversed(),
        waiting('a', 'b', 'c', 'd', 'e'),
        0,
        true,
      )
      expect(TOAST_CAP).toBe(3)
      expect(ids(all)).toEqual(['e', 'd', 'c', 'b', 'a'])
    })

    it('U20 shows a roll that pops up over three that wait, for its own time, never dropping it as it pops up', () => {
      const attacks = ['a1', 'a2', 'a3'].map((id, at) => check(id, at))
      let book = NO_TOASTS
      for (const at of attacks.keys()) {
        const met = attacks.slice(0, at + 1)
        book = popToasts(
          book,
          met.toReversed(),
          ways(...met.map(({ id }) => missed(id))),
          at * 100,
          true,
        )
      }
      expect(ids(book)).toEqual(['a3', 'a2', 'a1'])
      const save = check('s', 3)
      const rolls = [save, ...attacks.toReversed()]
      const as = (state?: TableRollState) =>
        ways(
          ...attacks.map(({ id }) => missed(id)),
          ...(state ? [['s', state] as [string, TableRollState]] : []),
        )

      const sent = popToasts(book, rolls, as({ status: 'sending' }), 1000, true)
      expect(ids(sent)).toEqual(['s', 'a3', 'a2', 'a1'])
      expect(sent.shown[0]).toEqual({
        id: 's',
        poppedAt: 1000,
        until: 1000 + TOAST_FOR,
      })
      // Asked again, the game says the same: it stays, over the cap, for its time.
      const polled = popToasts(
        sent,
        rolls,
        as({ status: 'sending' }),
        2000,
        true,
      )
      expect(polled).toBe(sent)
      // Made at the table, it takes its full time again where it is.
      const made = popToasts(polled, rolls, as(done()), 3000, true)
      expect(made.shown[0]).toEqual({
        id: 's',
        poppedAt: 1000,
        until: 3000 + TOAST_FOR,
      })
      expect(ids(dueToasts(made, 3000 + TOAST_FOR - 1))).toEqual([
        's',
        'a3',
        'a2',
        'a1',
      ])
      expect(ids(dueToasts(made, 3000 + TOAST_FOR))).toEqual(['a3', 'a2', 'a1'])

      // A roll never sent, popping up, takes the place of the one over the cap.
      const next = check('n', 4)
      expect(
        ids(popToasts(made, [next, ...rolls], as(done()), 4000, true)),
      ).toEqual(['n', 'a3', 'a2', 'a1'])
      // Met as all three wait, it shows, as it would were none to wait.
      expect(
        ids(popToasts(book, [next, ...attacks.toReversed()], as(), 1000, true)),
      ).toEqual(['n', 'a3', 'a2', 'a1'])
    })

    it("U21 pops up the damage rolled for a fourth attack over three that wait, the attack's going with its fade", () => {
      const attacks = ['a1', 'a2', 'a3', 'a4'].map((id, at) => check(id, at))
      const damage = check('d', 4)
      let book = popToasts(
        NO_TOASTS,
        attacks.toReversed(),
        waiting('a1', 'a2', 'a3', 'a4'),
        0,
        true,
      )
      expect(ids(book)).toEqual(['a4', 'a3', 'a2', 'a1'])
      const rolled = ways(
        ...['a1', 'a2', 'a3'].map((id): [string, TableRollState] => [
          id,
          hit(),
        ]),
        ['a4', hit({ damaged: true })],
      )

      // Its damage lands before the game says it's rolled.
      book = popToasts(
        book,
        [damage, ...attacks.toReversed()],
        waiting('a1', 'a2', 'a3', 'a4'),
        1000,
        true,
      )
      expect(ids(book)).toEqual(['d', 'a4', 'a3', 'a2', 'a1'])
      book = popToasts(
        book,
        [damage, ...attacks.toReversed()],
        rolled,
        2000,
        true,
      )
      expect(book.shown[1]).toEqual({
        id: 'a4',
        poppedAt: 0,
        until: 2000 + TOAST_FADE,
      })
      expect(ids(dueToasts(book, 2000 + TOAST_FADE))).toEqual([
        'd',
        'a3',
        'a2',
        'a1',
      ])

      // Or after: the damage's toast shows all the same.
      const said = popToasts(
        popToasts(NO_TOASTS, attacks.toReversed(), rolled, 0, true),
        [damage, ...attacks.toReversed()],
        rolled,
        1000,
        true,
      )
      expect(ids(said)).toEqual(['d', 'a3', 'a2', 'a1'])
    })

    it('U22 takes its full time over the cap once it stops waiting otherwise, rather than going at once', () => {
      const attacks = ['a', 'b', 'c', 'd'].map((id, at) => check(id, at))
      const book = popToasts(
        NO_TOASTS,
        attacks.toReversed(),
        waiting('a', 'b', 'c', 'd'),
        0,
        true,
      )

      const ended = popToasts(
        book,
        attacks.toReversed(),
        ways(
          ...['b', 'c', 'd'].map((id): [string, TableRollState] => [id, hit()]),
          ['a', hit({ damage: null })],
        ),
        7000,
        true,
      )

      expect(ended.shown).toEqual([
        ...book.shown.slice(0, 3),
        { id: 'a', poppedAt: 0, until: 7000 + TOAST_FOR },
      ])
    })

    it('U16 goes at once, with its fade, as its damage is rolled', () => {
      const a = check('a')
      const book = popToasts(NO_TOASTS, [a], ways(['a', hit()]), 0, true)

      const rolled = popToasts(
        book,
        [a],
        ways(['a', hit({ damaged: true })]),
        30_000,
        true,
      )

      expect(rolled.shown).toEqual([
        { id: 'a', poppedAt: 0, until: 30_000 + TOAST_FADE },
      ])
      expect(dueToasts(rolled, 30_000 + TOAST_FADE).shown).toEqual([])
    })

    it('U17 takes its full time from then where it stops waiting otherwise', () => {
      const a = check('a')
      const book = popToasts(NO_TOASTS, [a], ways(['a', hit()]), 0, true)
      const ended = popToasts(
        book,
        [a],
        ways(['a', hit({ damage: null })]),
        7000,
        true,
      )

      expect(ended.shown).toEqual([
        { id: 'a', poppedAt: 0, until: 7000 + TOAST_FOR },
      ])
    })

    it('U18 never pops up again once closed, however often the game is asked', () => {
      const a = check('a')
      const b = check('b', 1)
      const book = popToasts(NO_TOASTS, [a], ways(['a', hit()]), 0, true)

      let closed = dropToast(book, 'a')
      for (const now of [1000, 5000, 60_000]) {
        closed = popToasts(closed, [b, a], ways(['a', hit()]), now, true)
      }

      expect(ids(closed)).toEqual(['b'])
    })

    it('U19 waits for a use only while its kind of damage is to be chosen, as any other is rolled at once', () => {
      const breath: LocalUse = {
        kind: 'use',
        id: 'u',
        label: 'Dragon’s Breath',
        spell: true,
        at: 0,
      }
      const choosing = hit({
        attack: undefined,
        damage: {
          ...preview,
          rolls: [
            {
              formula: '3d6',
              type: 'acid',
              types: [
                { key: 'acid', label: 'Acid' },
                { key: 'fire', label: 'Fire' },
              ],
              dice: [{ faces: 6, number: 3 }],
            },
          ],
        },
      })

      expect(
        popToasts(NO_TOASTS, [breath], ways(['u', choosing]), 0, true).shown,
      ).toEqual([{ id: 'u', poppedAt: 0, until: FOREVER }])
      expect(
        popToasts(
          NO_TOASTS,
          [breath],
          ways(['u', hit({ attack: undefined })]),
          0,
          true,
        ).shown,
      ).toEqual([{ id: 'u', poppedAt: 0, until: TOAST_FOR }])
    })
  })
})
