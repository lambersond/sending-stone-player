import { checkEndTurn, checkUndoTurn } from './check-turns'
import { combat, combatant, mockCompanionEntry } from '@/mocks/sending-stone'
import type { HeldEndTurn } from './types'

const NOW = Date.parse('2026-10-09T20:00:00Z')

/**
 * A fight as last heard of, from module 0.36.0: Thorin, his wolf, a goblin, Vex and her wolf, a
 * wolf of both, and an imp named a companion that isn't listed; Thorin's turn in round 2 unless
 * said.
 */
const turnFight = (fields: object = {}) =>
  combat({
    round: 2,
    combatantId: 'c-thorin',
    combatants: [
      combatant({ id: 'c-thorin', character: 'actor-thorin' }),
      combatant({ id: 'c-brakka', companion: 'wolfBrakka' }),
      combatant({ id: 'c-goblin', name: 'Goblin' }),
      combatant({ id: 'c-vex', character: 'actor-vex' }),
      combatant({ id: 'c-vex-wolf', companion: 'wolfVex' }),
      combatant({ id: 'c-shared', companion: 'wolfShared' }),
      combatant({ id: 'c-imp', companion: 'sceneFrost-tokenImp' }),
    ],
    ...fields,
  })

/** A turn as the page was shown it: this combatant's, in round 2 unless said. */
const turnOf = (combatantId: string, round = 2) => ({
  combatId: 'cmbt1',
  round,
  combatantId,
})

describe('utils/roll-requests, a turn ended, from module 0.36.0', () => {
  /**
   * Thorin's wolf, Brakka, Vex's, and one of both, as the campaign lists them: the last Vex's
   * first, so that Thorin is the second of its characters.
   */
  const roster = [
    mockCompanionEntry({ key: 'wolfBrakka', of: ['actor-thorin'] }),
    mockCompanionEntry({ key: 'wolfVex', of: ['actor-vex'] }),
    mockCompanionEntry({
      key: 'wolfShared',
      of: ['actor-vex', 'actor-thorin'],
    }),
  ]
  const fight = turnFight
  /** On whose turn the combat is, the page naming that turn. */
  const check = (
    combatantId: string,
    fields: object = {},
    turn = turnOf(combatantId),
  ) =>
    checkEndTurn(
      turn,
      [fight({ combatantId, ...fields })],
      'actor-thorin',
      roster,
    )

  it("takes the character's own turn", () => {
    expect(check('c-thorin')).toBeUndefined()
  })

  it("takes the turn of one of the character's listed companions, from the character's seat", () => {
    expect(check('c-brakka')).toBeUndefined()
  })

  it("takes the turn of a companion of two characters from either one's seat, the second listed too", () => {
    expect(check('c-shared')).toBeUndefined()
    expect(
      checkEndTurn(
        turnOf('c-shared'),
        [fight({ combatantId: 'c-shared' })],
        'actor-vex',
        roster,
      ),
    ).toBeUndefined()
  })

  it("refuses the turn of another character's companion, which isn't the seat's", () => {
    expect(check('c-vex-wolf')).toBe('not-turn')
  })

  it('refuses the turn of a creature named a companion that the campaign doesn’t list', () => {
    expect(check('c-imp')).toBe('not-turn')
  })

  it('refuses anyone else’s turn', () => {
    expect(check('c-goblin')).toBe('not-turn')
    expect(check('c-vex')).toBe('not-turn')
  })

  it('refuses a turn of a combat not held, or none named', () => {
    expect(checkEndTurn(turnOf('c-thorin'), [], 'actor-thorin', roster)).toBe(
      'not-in-combat',
    )
    expect(
      checkEndTurn(
        { ...turnOf('c-thorin'), combatId: 'cmbt2' },
        [fight()],
        'actor-thorin',
        roster,
      ),
    ).toBe('not-in-combat')
    expect(checkEndTurn(undefined, [fight()], 'actor-thorin', roster)).toBe(
      'not-in-combat',
    )
  })

  it('refuses a turn of a combat not started', () => {
    expect(check('c-thorin', { started: false })).toBe('not-started')
  })

  it('refuses a turn that has moved on: another round, or another combatant now', () => {
    // Round 2 is Thorin's, as the page last saw it; the game is on round 3.
    expect(check('c-thorin', { round: 3 })).toBe('moved')
    // The page was shown Thorin's turn; the game has gone on to his wolf's, also his.
    expect(check('c-brakka', {}, turnOf('c-thorin'))).toBe('moved')
    // Or no one is current, as while a hidden combatant acts.
    expect(check('c-thorin', { combatantId: null })).toBe('moved')
  })

  it('refuses a current combatant that is hidden, or the combat has no row of', () => {
    const hidden = fight({
      combatants: [
        combatant({ id: 'c-thorin', character: 'actor-thorin', hidden: true }),
      ],
    })
    expect(
      checkEndTurn(turnOf('c-thorin'), [hidden], 'actor-thorin', roster),
    ).toBe('moved')
    expect(
      checkEndTurn(
        turnOf('c-thorin'),
        [fight({ combatants: [] })],
        'actor-thorin',
        roster,
      ),
    ).toBe('moved')
  })
})

/**
 * An End Turn of the seat's, from module 0.36.0, for this turn, as held: made 5 s ago unless
 * said.
 */
const ended = (
  turn = turnOf('c-thorin'),
  fields: Partial<{ status: string; completedAt: Date | null }> = {},
): HeldEndTurn => ({
  status: 'done',
  completedAt: new Date(NOW - 5000),
  payload: {
    kind: 'endTurn',
    turn,
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
  },
  ...fields,
})

/** That End Turn, made this long ago. */
const endedAgo = (ago: number) =>
  ended(undefined, { completedAt: new Date(NOW - ago) })

describe('utils/roll-requests, a turn taken back, from module 0.36.0', () => {
  /** Thorin's wolf, Brakka, and Vex's, as the campaign lists them. */
  const roster = [
    mockCompanionEntry({ key: 'wolfBrakka', of: ['actor-thorin'] }),
    mockCompanionEntry({ key: 'wolfVex', of: ['actor-vex'] }),
  ]
  /**
   * Thorin's End Turn taken back from the turn it left, Brakka's, the combat on that turn unless
   * said.
   */
  const check = ({
    left = turnOf('c-brakka'),
    held = ended() as HeldEndTurn | null,
    fights = [turnFight({ combatantId: 'c-brakka' })],
    actorId = 'actor-thorin',
    now = NOW,
  } = {}) => checkUndoTurn(left, held, fights, actorId, roster, now)

  it("takes back the character's own turn from the turn it left", () => {
    expect(check()).toBeUndefined()
  })

  it("takes back a listed companion's turn, from the character's seat", () => {
    expect(
      check({
        held: ended(turnOf('c-brakka')),
        left: turnOf('c-goblin'),
        fights: [turnFight({ combatantId: 'c-goblin' })],
      }),
    ).toBeUndefined()
  })

  it('takes it back across a round, to the turn that ended it', () => {
    // Brakka's End Turn began round 3 on Thorin's turn.
    expect(
      check({
        held: ended(turnOf('c-brakka')),
        left: turnOf('c-thorin', 3),
        fights: [turnFight({ round: 3, combatantId: 'c-thorin' })],
      }),
    ).toBeUndefined()
  })

  it('takes it back across a round onto the same combatant: Thorin alone to act, his turn again', () => {
    // Thorin's End Turn in round 2 began round 3 on his own turn: not the turn it ended.
    expect(
      check({
        held: ended(turnOf('c-thorin', 2)),
        left: turnOf('c-thorin', 3),
        fights: [turnFight({ round: 3, combatantId: 'c-thorin' })],
      }),
    ).toBeUndefined()
  })

  it('refuses an End Turn not held as the seat’s', () => {
    expect(check({ held: null })).toBe('not-undoable')
  })

  it('refuses an End Turn the game hasn’t made, or didn’t', () => {
    for (const status of ['pending', 'claimed', 'failed']) {
      expect(check({ held: ended(undefined, { status }) })).toBe('not-undoable')
    }
    expect(check({ held: ended(undefined, { completedAt: null }) })).toBe(
      'not-undoable',
    )
  })

  it('refuses one made too long ago, but takes one made 30 s ago', () => {
    expect(check({ held: endedAgo(31_000) })).toBe('not-undoable')
    expect(check({ held: endedAgo(30_001) })).toBe('not-undoable')
    expect(check({ held: endedAgo(30_000) })).toBeUndefined()
  })

  it('refuses one of another combat, or one naming no turn', () => {
    expect(
      check({ held: ended({ ...turnOf('c-thorin'), combatId: 'cmbt2' }) }),
    ).toBe('not-undoable')
    expect(check({ held: { ...ended(), payload: { kind: 'endTurn' } } })).toBe(
      'not-undoable',
    )
  })

  it('refuses it in a combat not held, or not started', () => {
    expect(check({ fights: [] })).toBe('not-in-combat')
    expect(
      check({
        fights: [turnFight({ combatantId: 'c-brakka', started: false })],
      }),
    ).toBe('not-started')
  })

  it('refuses it once the combat has moved on from the turn the page shows: another round, or another combatant', () => {
    expect(
      check({ fights: [turnFight({ round: 3, combatantId: 'c-brakka' })] }),
    ).toBe('moved')
    // The page shows Brakka's turn; the game has gone on to the goblin's.
    expect(check({ fights: [turnFight({ combatantId: 'c-goblin' })] })).toBe(
      'moved',
    )
    expect(check({ fights: [turnFight({ combatantId: null })] })).toBe('moved')
  })

  it('refuses it while the one acting is hidden, or the combat has no row of them', () => {
    const hidden = turnFight({
      combatantId: 'c-brakka',
      combatants: [
        combatant({ id: 'c-thorin', character: 'actor-thorin' }),
        combatant({ id: 'c-brakka', companion: 'wolfBrakka', hidden: true }),
      ],
    })
    expect(check({ fights: [hidden] })).toBe('moved')
    expect(
      check({
        fights: [
          turnFight({
            combatantId: 'c-brakka',
            combatants: [
              combatant({ id: 'c-thorin', character: 'actor-thorin' }),
            ],
          }),
        ],
      }),
    ).toBe('moved')
  })

  it('refuses it where the turn is back on the turn it ended already', () => {
    expect(
      check({
        left: turnOf('c-thorin'),
        fights: [turnFight({ combatantId: 'c-thorin' })],
      }),
    ).toBe('moved')
  })

  it('refuses it where the turn it ended is of a combatant gone, or hidden now', () => {
    expect(
      check({
        fights: [
          turnFight({
            combatantId: 'c-brakka',
            combatants: [
              combatant({ id: 'c-brakka', companion: 'wolfBrakka' }),
            ],
          }),
        ],
      }),
    ).toBe('not-undoable')
    expect(
      check({
        fights: [
          turnFight({
            combatantId: 'c-brakka',
            combatants: [
              combatant({
                id: 'c-thorin',
                character: 'actor-thorin',
                hidden: true,
              }),
              combatant({ id: 'c-brakka', companion: 'wolfBrakka' }),
            ],
          }),
        ],
      }),
    ).toBe('not-undoable')
  })

  it('refuses it where the turn it ended is no longer the seat’s: a companion not listed now, or another’s', () => {
    // An imp the campaign no longer lists as anyone's companion.
    expect(
      check({
        held: ended(turnOf('c-imp')),
        left: turnOf('c-brakka'),
      }),
    ).toBe('not-turn')
    // Vex's wolf, as Thorin's seat would have it.
    expect(
      check({
        held: ended(turnOf('c-vex-wolf')),
        left: turnOf('c-brakka'),
      }),
    ).toBe('not-turn')
    // Thorin's own turn, named from Vex's seat.
    expect(check({ actorId: 'actor-vex' })).toBe('not-turn')
  })
})
