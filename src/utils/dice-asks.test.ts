import {
  answerFits,
  askTimes,
  heldTime,
  seesDiceAsks,
  toTableDiceAsks,
  waitsOnDice,
} from './dice-asks'
import {
  ASK_EXPIRES,
  ASKED_AT,
  heldIceKnife,
  twoRollsAsk,
} from '@/mocks/dice-asks'

/** This app's clock: a while after the game's, as two clocks are. */
const NOW = Date.parse('2026-11-10T12:30:00Z')
const at = (ms: number) => new Date(NOW + ms)

/** An ask that held a roll from `from` until `to`, ms from now, or open and out at `expires`. */
const span = (from: number, to: number | null, expires = to ?? 60_000) => ({
  askedAt: at(from),
  expiresAt: at(expires),
  closedAt: to === null ? null : at(to),
})

describe('utils/dice-asks (module 0.44.0)', () => {
  describe('seesDiceAsks', () => {
    const player = { role: 'player' as const, manualDice: true }
    it.each([
      [
        'a player typing in their dice, the game taking the answer',
        true,
        player,
        ['dice'],
      ],
      // On its own: the Gamemaster's rolls open no run, whatever their seat says.
      [
        "the Gamemaster's seat",
        false,
        { ...player, role: 'gm' as const },
        ['dice'],
      ],
      [
        'a player not typing in their dice',
        false,
        { ...player, manualDice: false },
        ['dice'],
      ],
      ['a game not taking the answer now', false, player, ['damage']],
    ] as const)('%s: %s', (_, sees, seat, kinds) => {
      expect(seesDiceAsks(seat, kinds)).toBe(sees)
    })
  })

  describe('askTimes', () => {
    it.each([
      ['sent as it was asked: the whole minute left', ASKED_AT, 0, 60_000],
      [
        'sent 20 s after, as a hello carrying it: 40 s left, asked 20 s ago',
        '2026-11-10T12:00:20.000Z',
        -20_000,
        40_000,
      ],
      [
        'sent after its minute: none left, never a wait before it was asked',
        '2026-11-10T12:05:00.000Z',
        -60_000,
        0,
      ],
      [
        'an envelope time before it was asked: counted from when it was',
        '2026-11-10T11:59:00.000Z',
        0,
        60_000,
      ],
      ['an envelope time that can’t be read: the same', 'soon', 0, 60_000],
    ])('%s', (_, sentAt, asked, left) => {
      expect(
        askTimes({ askedAt: ASKED_AT, expiresAt: ASK_EXPIRES }, sentAt, NOW),
      ).toEqual({ askedAt: at(asked), expiresAt: at(left) })
    })

    it('never holds one longer than the game waits, whatever it says', () => {
      expect(
        askTimes(
          { askedAt: ASKED_AT, expiresAt: '2026-11-10T13:00:00.000Z' },
          ASKED_AT,
          NOW,
        ).expiresAt,
      ).toEqual(at(60_000))
    })
  })

  describe('toTableDiceAsks and waitsOnDice', () => {
    const open = heldIceKnife({ expiresAt: at(30_000) })
    it.each([
      ['open, its wait not over', open, true],
      ['its wait over', heldIceKnife({ expiresAt: at(-1) }), false],
      [
        'closed',
        heldIceKnife({ expiresAt: at(30_000), closedAt: at(-5000) }),
        false,
      ],
    ])('one %s waits: %s', (_, ask, waits) => {
      expect(waitsOnDice([ask], NOW)).toBe(waits)
      expect(toTableDiceAsks([ask], NOW)).toHaveLength(waits ? 1 : 0)
    })

    it('shows one as its page reads it, a critical hit’s and a die thrown again marked', () => {
      const thrownAgain = heldIceKnife({
        askId: 'ask2',
        expiresAt: at(30_000),
        data: {
          label: 'Wand of Luck: Use',
          purpose: 'again',
          again: 'explode',
          critical: true,
          rolls: [{ formula: '1d6', terms: [{ faces: 6, number: 1 }] }],
        },
      })
      expect(toTableDiceAsks([open, thrownAgain], NOW)).toEqual([
        {
          id: 'ask1',
          command: 'roll-thorin-1',
          label: 'Ice Knife: Shard Explosion',
          purpose: 'damage',
          rolls: [
            {
              formula: '2d6',
              type: 'cold',
              flavor: 'Cold',
              terms: [{ faces: 6, number: 2 }],
            },
          ],
          expiresAt: at(30_000).toISOString(),
        },
        expect.objectContaining({
          id: 'ask2',
          purpose: 'again',
          again: 'explode',
          critical: true,
        }),
      ])
    })
  })

  describe('heldTime', () => {
    it.each([
      ['none', [], 0],
      ['one answered after 20 s', [span(-50_000, -30_000)], 20_000],
      ['one still open, asked 10 s ago', [span(-10_000, null)], 10_000],
      [
        'one never closed, its minute over',
        [span(-90_000, null, -30_000)],
        60_000,
      ],
      [
        'two after another',
        [span(-50_000, -40_000), span(-30_000, -20_000)],
        20_000,
      ],
      [
        'two at once, counted once',
        [span(-50_000, -30_000), span(-40_000, -20_000)],
        30_000,
      ],
      [
        'one within another',
        [span(-50_000, -10_000), span(-40_000, -20_000)],
        40_000,
      ],
    ])('%s', (_, asks, held) => {
      expect(heldTime(asks, NOW)).toBe(held)
    })
  })

  describe('answerFits', () => {
    const { rolls } = twoRollsAsk()
    it.each([
      [
        'every term',
        [
          { roll: 0, term: 0, results: [1, 6, 3] },
          { roll: 1, term: 0, results: [4] },
          { roll: 1, term: 1, results: [2] },
        ],
        true,
      ],
      [
        'one term, the rest left to the game',
        [{ roll: 1, term: 1, results: [5] }],
        true,
      ],
      ['none, every die left to the game', [], true],
      ['a roll it doesn’t list', [{ roll: 2, term: 0, results: [1] }], false],
      ['a term it doesn’t list', [{ roll: 1, term: 2, results: [1] }], false],
      [
        'a term twice',
        [
          { roll: 1, term: 0, results: [4] },
          { roll: 1, term: 0, results: [3] },
        ],
        false,
      ],
      ['too few values', [{ roll: 0, term: 0, results: [1, 6] }], false],
      ['too many values', [{ roll: 1, term: 0, results: [1, 2] }], false],
      [
        'a value its die doesn’t have',
        [{ roll: 1, term: 0, results: [5] }],
        false,
      ],
      ['a value below 1', [{ roll: 1, term: 1, results: [0] }], false],
      [
        'a value that isn’t whole',
        [{ roll: 1, term: 1, results: [2.5] }],
        false,
      ],
    ])('%s: %s', (_, answer, fits) => {
      expect(answerFits({ rolls }, answer)).toBe(fits)
    })
  })
})
