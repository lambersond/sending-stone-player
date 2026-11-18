import {
  coinsWords,
  moveLabel,
  moveReasons,
  moveWords,
  namesWords,
  thingsWords,
} from './move-words'
import type { LocalMove, TableRollState } from '@/types/roll'

const take: LocalMove = {
  verb: 'take',
  things: '2 Potion of Healing',
  other: 'The Iron Company',
  item: 'potionHeal01',
}
const give: LocalMove = {
  verb: 'give',
  things: '5 gp',
  other: 'Vex',
}
const state = (fields: Partial<TableRollState>): TableRollState => ({
  status: 'failed',
  ...fields,
})

describe('utils/move-words', () => {
  describe('thingsWords', () => {
    it.each([
      [[{ quantity: 2, name: 'Potion of Healing' }], '2 Potion of Healing'],
      [[{ coins: 50, abbreviation: 'gp' }], '50 gp'],
      [
        [
          { quantity: 1, name: 'Rope' },
          { coins: 50, abbreviation: 'gp' },
        ],
        '1 Rope and 50 gp',
      ],
      [
        [
          { quantity: 2, name: 'Potion of Healing' },
          { quantity: 1, name: 'Rope' },
          { coins: 5, abbreviation: 'sp' },
        ],
        '2 Potion of Healing, 1 Rope, and 5 sp',
      ],
      [[{ quantity: 1, name: 'Backpack' }], '1 Backpack'],
      [[{ coins: 12_500, abbreviation: 'gp' }], '12,500 gp'],
    ])('says %j as the chat line does: %s', (parts, words) => {
      expect(thingsWords(parts)).toBe(words)
    })
  })

  describe('coinsWords', () => {
    const sheet = [
      { id: 'pp', abbreviation: 'pp' },
      { id: 'gp', abbreviation: 'gp' },
      { id: 'sp', abbreviation: 'sp' },
    ]

    it.each([
      [{ gp: 5 }, '5 gp'],
      // In the sheet's order, whatever order they're named in: stored, a result's are sorted.
      [{ sp: 3, gp: 5, pp: 2 }, '2 pp, 5 gp, and 3 sp'],
      [{ gp: 150, pp: 600 }, '600 pp and 150 gp'],
      // None of a coin isn't said; a coin the sheet doesn't list is, after them, by its key.
      [{ pp: 0, gp: 6000, crown: 2 }, '6,000 gp and 2 crown'],
      [{}, ''],
    ])('says %j as the chat line does: %s', (amounts, words) => {
      expect(coinsWords(sheet, amounts)).toBe(words)
    })
  })

  describe('moveLabel', () => {
    it("is what the Gamemaster's page calls a move", () => {
      expect(moveLabel(give)).toBe('Give 5 gp to Vex')
      expect(moveLabel({ ...take, things: '1 Rope' })).toBe(
        'Take 1 Rope from The Iron Company',
      )
    })
  })

  describe('moveWords', () => {
    it.each([
      ['sending', take, 'player', 'Sending to your Gamemaster’s game…'],
      ['sending', give, 'gm', 'Sending to your game…'],
      ['rolling', take, 'player', 'Taking it in your Gamemaster’s game…'],
      ['rolling', give, 'player', 'Giving it in your Gamemaster’s game…'],
      ['rolling', give, 'gm', 'Giving it in your game…'],
      [
        'done',
        take,
        'player',
        'Took 2 Potion of Healing from The Iron Company',
      ],
      ['done', give, 'player', 'Gave 5 gp to Vex'],
    ] as const)('on %s, a %s, for the %s', (status, move, role, words) => {
      expect(moveWords(move, { status }, role)).toBe(words)
    })

    it('says only that it was sent where the app took it with nothing to follow it by', () => {
      const unfollowed = { status: 'done', unfollowed: true } as const
      expect(moveWords(give, unfollowed, 'player')).toBe(
        'Sent to your Gamemaster’s game',
      )
      expect(moveWords(take, unfollowed, 'gm')).toBe('Sent to your game')
    })

    it('says who moved it on the Gamemaster’s page', () => {
      expect(
        moveWords({ ...give, mover: 'Thorin' }, { status: 'done' }, 'gm'),
      ).toBe('Thorin gave 5 gp to Vex')
      expect(
        moveWords(
          { ...take, things: '1 Rope', mover: 'Vex' },
          { status: 'done' },
          'gm',
        ),
      ).toBe('Vex took 1 Rope from The Iron Company')
    })

    it.each([
      ['unavailable', 'your Gamemaster’s game isn’t taking moves now'],
      ['off', 'your Gamemaster’s game isn’t taking moves now'],
      ['transfers-off', 'your Gamemaster’s game isn’t taking moves now'],
      ['busy', 'too many at once. Wait a moment'],
      ['moving', 'it’s on its way already'],
      ['invalid', 'your Gamemaster’s game couldn’t move it'],
      ['unknown', 'that isn’t in the campaign any more'],
      ['not-yours', 'that isn’t this character’s to move'],
      ['not-owner', 'you need Owner on the party in Foundry'],
      ['gone', 'it isn’t there any more'],
      ['short', 'the party hasn’t that many'],
      ['container', 'a container moves whole, with everything in it'],
      ['nested', 'it moves with its container already'],
      ['deep', 'it holds containers too deep to move from here'],
      ['error', 'something went wrong'],
      [
        'timeout',
        'your Gamemaster’s game took too long. The sheet shows whether it moved',
      ],
      ['network', 'Sending Stone couldn’t be reached'],
    ])('says why a take failed: %s', (reason, words) => {
      expect(moveWords(take, state({ reason }), 'player')).toBe(
        `Not taken: ${words}`,
      )
    })

    it.each([
      ['expired', 'your Gamemaster’s game didn’t pick it up'],
      [
        'lost',
        'no answer from your Gamemaster’s game. The sheet shows whether it moved',
      ],
    ] as const)('says why a move ran out: %s', (status, words) => {
      expect(moveWords(take, { status }, 'player')).toBe(`Not taken: ${words}`)
      expect(moveWords(give, { status }, 'player')).toBe(`Not given: ${words}`)
    })

    it('says whose there are too few of, by the verb and the seat', () => {
      const short = state({ reason: 'short' })
      expect(moveWords(take, short, 'player')).toBe(
        'Not taken: the party hasn’t that many',
      )
      expect(moveWords(take, short, 'gm')).toBe(
        'Not taken: the party hasn’t that many',
      )
      expect(moveWords(give, short, 'player')).toBe(
        'Not given: you haven’t that many',
      )
      expect(moveWords(give, short, 'gm')).toBe(
        'Not given: they haven’t that many',
      )
      expect(moveReasons('gm', { verb: 'give' }).unavailable).toBe(
        'your game isn’t taking moves now',
      )
    })

    it('says a move refused here, as a failed one', () => {
      expect(
        moveWords(take, { status: 'refused', reason: 'not-owner' }, 'player'),
      ).toBe('Not taken: you need Owner on the party in Foundry')
      expect(
        moveWords(give, { status: 'refused', reason: 'moving' }, 'gm'),
      ).toBe('Not given: it’s on its way already')
    })

    it('says a move made in part, where the game says what moved', () => {
      const partly = state({
        reason: 'error',
        transfer: {
          from: 'groupIronCo01',
          to: 'actorThorin1',
          items: [],
          currency: { gp: 50 },
        },
      })
      expect(moveWords(take, partly, 'player')).toBe(
        'Partly taken: something went wrong',
      )
      expect(moveWords(give, partly, 'gm')).toBe(
        'Partly given: something went wrong',
      )
      expect(
        moveWords(
          take,
          {
            ...partly,
            transfer: {
              ...partly.transfer!,
              items: [
                {
                  id: 'rope',
                  quantity: 1,
                  created: 'rope2',
                  stacked: null,
                },
              ],
              currency: null,
            },
          },
          'player',
        ),
      ).toBe('Partly taken: something went wrong')
      // Nothing moved is no part.
      expect(
        moveWords(
          take,
          { ...partly, transfer: { ...partly.transfer!, currency: null } },
          'player',
        ),
      ).toBe('Not taken: something went wrong')
    })

    it('falls back on why a roll was not made, or says no more', () => {
      const cancelled = state({ reason: 'cancelled' })
      expect(moveWords(take, cancelled, 'player')).toBe('Not taken')
      expect(
        moveWords(take, cancelled, 'player', {
          cancelled: 'it was called off in the game',
        }),
      ).toBe('Not taken: it was called off in the game')
    })
  })
})

describe('utils/move-words, a party’s sends and distributions, from module 0.32.0', () => {
  const send: LocalMove = {
    verb: 'send',
    things: '2 gp',
    other: 'Vex',
    source: 'The Iron Company',
  }
  const distribute: LocalMove = {
    verb: 'distribute',
    things: '100 gp',
    other: 'The Iron Company',
    among: 'Bram, Lia, Thorin, and Vex',
    each: '25 gp',
  }
  const gm = (move: LocalMove): LocalMove => ({ ...move, mover: 'Thorin' })

  it('lists who shares a distribution as the module’s line does', () => {
    expect(namesWords(['Bram', 'Lia', 'Thorin', 'Vex'])).toBe(
      'Bram, Lia, Thorin, and Vex',
    )
    expect(namesWords(['Bram', 'Lia'])).toBe('Bram and Lia')
    expect(namesWords(['Bram'])).toBe('Bram')
  })

  it('calls each kind of move what the Gamemaster’s page calls it', () => {
    expect(moveLabel({ verb: 'give', things: '5 gp', other: 'Vex' })).toBe(
      'Give 5 gp to Vex',
    )
    expect(
      moveLabel({ verb: 'take', things: '1 Rope', other: 'The Iron Company' }),
    ).toBe('Take 1 Rope from The Iron Company')
    expect(moveLabel(send)).toBe('Send 2 gp from The Iron Company to Vex')
    expect(moveLabel(distribute)).toBe(
      'Distribute 100 gp from The Iron Company among Bram, Lia, Thorin, and Vex',
    )
  })

  it.each([
    ['player', 'your Gamemaster’s game'],
    ['gm', 'your game'],
  ] as const)('says where each stands for the %s', (role, game) => {
    expect(moveWords(send, { status: 'sending' }, role)).toBe(
      `Sending to ${game}…`,
    )
    expect(moveWords(distribute, { status: 'sending' }, role)).toBe(
      `Sending to ${game}…`,
    )
    expect(moveWords(send, { status: 'rolling' }, role)).toBe(
      `Sending it in ${game}…`,
    )
    expect(moveWords(distribute, { status: 'rolling' }, role)).toBe(
      `Distributing it in ${game}…`,
    )
    expect(moveWords(send, state({ reason: 'unknown' }), role)).toBe(
      'Not sent: that isn’t in the campaign any more',
    )
    expect(moveWords(distribute, state({ reason: 'not-owner' }), role)).toBe(
      'Not distributed: you need Owner on the party in Foundry',
    )
    expect(moveWords(send, state({ reason: 'mystery' }), role)).toBe('Not sent')
    expect(moveWords(distribute, state({ reason: 'mystery' }), role)).toBe(
      'Not distributed',
    )
  })

  it('says what was made, and who made it on the Gamemaster’s page', () => {
    expect(moveWords(send, { status: 'done' }, 'player')).toBe(
      'Sent 2 gp from The Iron Company to Vex',
    )
    expect(moveWords(distribute, { status: 'done' }, 'player')).toBe(
      'Distributed 100 gp among Bram, Lia, Thorin, and Vex (25 gp each)',
    )
    expect(moveWords(gm(send), { status: 'done' }, 'gm')).toBe(
      'Thorin sent 2 gp from The Iron Company to Vex',
    )
    expect(moveWords(gm(distribute), { status: 'done' }, 'gm')).toBe(
      'Thorin distributed 100 gp among Bram, Lia, Thorin, and Vex (25 gp each)',
    )
  })

  it('says a send or distribution made in part', () => {
    const moved = {
      from: 'groupIronCo01',
      to: null,
      items: [],
      currency: { gp: 25 },
      among: ['actorBram001'],
    }
    expect(
      moveWords(
        distribute,
        state({ reason: 'error', transfer: moved }),
        'player',
      ),
    ).toBe('Partly distributed: something went wrong')
    expect(
      moveWords(
        send,
        state({ reason: 'error', transfer: { ...moved, to: 'actorVex0001' } }),
        'player',
      ),
    ).toBe('Partly sent: something went wrong')
  })

  it.each(['give', 'take', 'send', 'distribute'] as const)(
    'says members and split for a %s, for either seat',
    verb => {
      for (const role of ['player', 'gm'] as const) {
        expect(moveReasons(role, { verb })).toMatchObject({
          members: 'the party’s members have changed. Try again',
          split: 'there isn’t a whole coin for each of them',
        })
      }
    },
  )

  it('says the party has too few for a take, a send or a distribution, and the giver for a give', () => {
    for (const verb of ['take', 'send', 'distribute'] as const) {
      expect(moveReasons('player', { verb }).short).toBe(
        'the party hasn’t that many',
      )
      expect(moveReasons('gm', { verb }).short).toBe(
        'the party hasn’t that many',
      )
    }
    expect(moveReasons('player', { verb: 'give' }).short).toBe(
      'you haven’t that many',
    )
    expect(moveReasons('gm', { verb: 'give' }).short).toBe(
      'they haven’t that many',
    )
  })
})

describe('utils/move-words, an item removed, from module 0.33.0', () => {
  const remove: LocalMove = {
    verb: 'remove',
    things: '2 Potion of Healing',
    other: 'Thorin',
    item: 'potionThorin',
  }
  const gmRemove: LocalMove = { ...remove, mover: 'Thorin' }

  it('calls it what the Gamemaster’s page calls it', () => {
    expect(moveLabel(remove)).toBe('Remove 2 Potion of Healing')
    expect(moveLabel({ ...remove, things: '1 Rope' })).toBe('Remove 1 Rope')
  })

  it('says where it stands, for either seat', () => {
    expect(moveWords(remove, state({ status: 'sending' }), 'player')).toBe(
      'Sending to your Gamemaster’s game…',
    )
    expect(moveWords(gmRemove, state({ status: 'sending' }), 'gm')).toBe(
      'Sending to your game…',
    )
    expect(moveWords(remove, state({ status: 'rolling' }), 'player')).toBe(
      'Removing it in your Gamemaster’s game…',
    )
    expect(moveWords(gmRemove, state({ status: 'rolling' }), 'gm')).toBe(
      'Removing it in your game…',
    )
    expect(moveWords(remove, state({ status: 'done' }), 'player')).toBe(
      'Removed 2 Potion of Healing',
    )
    expect(moveWords(gmRemove, state({ status: 'done' }), 'gm')).toBe(
      'Thorin removed 2 Potion of Healing',
    )
  })

  it.each([
    ['moving', 'it’s on its way already', 'it’s on its way already'],
    ['short', 'you haven’t that many', 'they haven’t that many'],
    [
      'changed',
      'how many there are has changed. Try again',
      'how many there are has changed. Try again',
    ],
    [
      'unavailable',
      'your Gamemaster’s game can’t remove items now',
      'your game can’t remove items now',
    ],
    [
      'off',
      'your Gamemaster’s game can’t remove items now',
      'your game can’t remove items now',
    ],
    [
      'invalid',
      'your Gamemaster’s game couldn’t remove it',
      'your game couldn’t remove it',
    ],
    ['gone', 'it isn’t there any more', 'it isn’t there any more'],
    [
      'unknown',
      'that isn’t in the campaign any more',
      'that isn’t in the campaign any more',
    ],
    [
      'busy',
      'too many at once. Wait a moment',
      'too many at once. Wait a moment',
    ],
    ['error', 'something went wrong', 'something went wrong'],
    [
      'timeout',
      'your Gamemaster’s game took too long. The sheet shows whether it was removed',
      'your game took too long. The sheet shows whether it was removed',
    ],
    [
      'lost',
      'no answer from your Gamemaster’s game. The sheet shows whether it was removed',
      'no answer from your game. The sheet shows whether it was removed',
    ],
    [
      'network',
      'Sending Stone couldn’t be reached',
      'Sending Stone couldn’t be reached',
    ],
    [
      'expired',
      'your Gamemaster’s game didn’t pick it up',
      'your game didn’t pick it up',
    ],
  ])('says why it wasn’t removed: %s', (reason, player, gm) => {
    expect(moveWords(remove, state({ reason }), 'player')).toBe(
      `Not removed: ${player}`,
    )
    expect(moveWords(gmRemove, state({ reason }), 'gm')).toBe(
      `Not removed: ${gm}`,
    )
  })

  it('says it was removed in part where the game says the item itself changed', () => {
    expect(
      moveWords(
        remove,
        state({
          reason: 'error',
          removed: { item: 'backpackThor', quantity: 1 },
        }),
        'player',
      ),
    ).toBe('Partly removed: something went wrong')
    expect(moveWords(remove, state({ reason: 'error' }), 'player')).toBe(
      'Not removed: something went wrong',
    )
    // Refused, not failed, is never in part.
    expect(
      moveWords(
        remove,
        state({
          status: 'refused',
          reason: 'moving',
          removed: { item: 'backpackThor', quantity: 1 },
        }),
        'player',
      ),
    ).toBe('Not removed: it’s on its way already')
  })

  it('says a move’s stack changed in the same words, and its own words otherwise', () => {
    expect(moveReasons('player', { verb: 'give' }).changed).toBe(
      'how many there are has changed. Try again',
    )
    expect(moveReasons('player', { verb: 'give' }).timeout).toBe(
      'your Gamemaster’s game took too long. The sheet shows whether it moved',
    )
    expect(moveReasons('gm', { verb: 'take' }).unavailable).toBe(
      'your game isn’t taking moves now',
    )
  })
})

/** Coins taken away, as the game answered: 5 gp, with what else it says it used. */
const paid = (used: Record<string, number> | null) =>
  state({
    status: 'done',
    coins: { op: 'remove', currency: { gp: 5 }, used },
  })

// Changed on purpose (item 89): coins taken away are told as removed, as Add or remove says.
describe('utils/move-words, coins added and removed, from module 0.49.0', () => {
  /** dnd5e's coins' abbreviations, as a sheet lists them, the largest first. */
  const abbreviations = { pp: 'pp', gp: 'gp', ep: 'ep', sp: 'sp', cp: 'cp' }
  const receive: LocalMove = {
    verb: 'receive',
    things: '5 gp',
    other: 'Thorin',
  }
  const pay: LocalMove = {
    verb: 'pay',
    things: '5 gp',
    other: 'Thorin',
    abbreviations,
  }
  it('calls each what the Gamemaster’s page calls it', () => {
    expect(moveLabel(receive)).toBe('Add 5 gp')
    expect(moveLabel(pay)).toBe('Remove 5 gp')
  })

  it('says where each stands, for either seat', () => {
    expect(moveWords(receive, state({ status: 'rolling' }), 'player')).toBe(
      'Adding it in your Gamemaster’s game…',
    )
    expect(moveWords(pay, state({ status: 'rolling' }), 'gm')).toBe(
      'Removing it in your game…',
    )
    expect(moveWords(receive, state({ status: 'done' }), 'player')).toBe(
      'Received 5 gp',
    )
    expect(moveWords({ ...pay, mover: 'Thorin' }, paid(null), 'gm')).toBe(
      'Thorin paid 5 gp',
    )
  })

  it.each([
    ['none, as the game says', null, 'Paid 5 gp'],
    ['a larger coin broken', { pp: 1 }, 'Paid 5 gp, using 1 pp'],
    // As a jsonb column gives its keys back, by name: told in the sheet's order all the same.
    [
      'a larger coin and smaller ones',
      { sp: 80, pp: 1 },
      'Paid 5 gp, using 1 pp and 80 sp',
    ],
    ['a coin the sheet doesn’t list', { gems: 2 }, 'Paid 5 gp, using 2 gems'],
  ])(
    'says which other coins the game used to pay: %s',
    (_name, used, words) => {
      expect(moveWords(pay, paid(used), 'player')).toBe(words)
    },
  )

  it('says nothing of other coins where the game’s answer couldn’t be followed, nor of coins added', () => {
    expect(moveWords(pay, state({ status: 'done' }), 'player')).toBe(
      'Paid 5 gp',
    )
    expect(
      moveWords(
        receive,
        state({
          status: 'done',
          coins: { op: 'add', currency: { gp: 5 }, used: null },
        }),
        'player',
      ),
    ).toBe('Received 5 gp')
  })

  it.each([
    [
      'unavailable',
      'your Gamemaster’s game isn’t changing coins now',
      'your game isn’t changing coins now',
    ],
    [
      'off',
      'your Gamemaster’s game isn’t changing coins now',
      'your game isn’t changing coins now',
    ],
    [
      'moving',
      'a change to these coins is still on its way',
      'a change to these coins is still on its way',
    ],
    [
      'invalid',
      'your Gamemaster’s game couldn’t change them',
      'your game couldn’t change them',
    ],
    [
      'gone',
      'that coin isn’t on the sheet any more',
      'that coin isn’t on the sheet any more',
    ],
    [
      'short',
      'you haven’t the coins for that',
      'they haven’t the coins for that',
    ],
    [
      'timeout',
      'your Gamemaster’s game took too long. The sheet shows whether they changed',
      'your game took too long. The sheet shows whether they changed',
    ],
    [
      'lost',
      'no answer from your Gamemaster’s game. The sheet shows whether they changed',
      'no answer from your game. The sheet shows whether they changed',
    ],
  ])('says why they weren’t changed: %s', (reason, player, gm) => {
    for (const verb of ['receive', 'pay'] as const) {
      expect(moveReasons('player', { verb })[reason]).toBe(player)
      expect(moveReasons('gm', { verb })[reason]).toBe(gm)
    }
  })

  it('says each not made, never in part, and leaves a transformed character to the roll’s words', () => {
    expect(
      moveWords(pay, state({ status: 'refused', reason: 'short' }), 'player'),
    ).toBe('Not removed: you haven’t the coins for that')
    expect(
      moveWords(receive, state({ status: 'failed', reason: 'off' }), 'gm'),
    ).toBe('Not added: your game isn’t changing coins now')
    expect(moveReasons('player', { verb: 'pay' }).shaped).toBeUndefined()
    expect(
      moveWords(pay, state({ status: 'refused', reason: 'shaped' }), 'player', {
        shaped: 'that waits until your character is back in their own form',
      }),
    ).toBe(
      'Not removed: that waits until your character is back in their own form',
    )
  })
})

/** As the game answered it: what each was given, to whom, and what else it used. */
const given = (each: string[], used: Record<string, number> | null) => ({
  from: 'actorThorin1',
  to: null,
  items: [],
  currency: { pp: 200, gp: 50 },
  each,
  used,
})

// Changed on purpose (item 89): coins given to several characters at once are told as a Give,
// and coins given to one character, as a give, carry the sheet's abbreviations too.
describe('utils/move-words, coins given to characters, from module 0.49.0', () => {
  const abbreviations = { pp: 'pp', gp: 'gp', ep: 'ep', sp: 'sp', cp: 'cp' }
  const handOut: LocalMove = {
    verb: 'handOut',
    things: '200 pp and 50 gp',
    other: 'Thorin',
    among: 'Vex, Bram, and Lia',
    abbreviations,
  }
  /** 5 gp given to Vex alone, as the Give dialog sends it. */
  const toVex: LocalMove = {
    verb: 'give',
    things: '5 gp',
    other: 'Vex',
    abbreviations,
  }
  const ALL = ['actorVex0001', 'actorBram001', 'actorLia0001']

  it('calls a give to several what the Gamemaster’s page calls it, and says where it stands', () => {
    expect(moveLabel(handOut)).toBe(
      'Give 200 pp and 50 gp each to Vex, Bram, and Lia',
    )
    expect(moveLabel(toVex)).toBe('Give 5 gp to Vex')
    expect(moveWords(handOut, state({ status: 'rolling' }), 'player')).toBe(
      'Giving it in your Gamemaster’s game…',
    )
  })

  it('says what each was given, to whom, and which other coins the game used', () => {
    expect(
      moveWords(
        handOut,
        state({ status: 'done', transfer: given(ALL, null) }),
        'player',
      ),
    ).toBe('Gave 200 pp and 50 gp each to Vex, Bram, and Lia')
    expect(
      moveWords(
        { ...handOut, mover: 'Thorin' },
        state({ status: 'done', transfer: given(ALL, { pp: 13 }) }),
        'gm',
      ),
    ).toBe(
      'Thorin gave 200 pp and 50 gp each to Vex, Bram, and Lia, using 13 pp',
    )
    expect(
      moveWords(
        toVex,
        state({ status: 'done', transfer: given(['vex'], { pp: 1 }) }),
        'player',
      ),
    ).toBe('Gave 5 gp to Vex, using 1 pp')
    expect(
      moveWords(
        toVex,
        state({ status: 'done', transfer: given(['vex'], null) }),
        'player',
      ),
    ).toBe('Gave 5 gp to Vex')
  })

  it.each<[string, Pick<LocalMove, 'verb' | 'abbreviations'>, string, string]>([
    [
      'a give of items, or of coins to a party',
      { verb: 'give' },
      'you haven’t that many',
      'they haven’t that many',
    ],
    [
      'coins given to one character',
      { verb: 'give', abbreviations },
      'you haven’t the coins for that',
      'they haven’t the coins for that',
    ],
    [
      'coins given to several',
      { verb: 'handOut', abbreviations },
      'you haven’t the coins for that',
      'they haven’t the coins for that',
    ],
  ])(
    'says too few, of %s, as the coins the game may pay with',
    (_name, move, player, gm) => {
      expect(moveReasons('player', move).short).toBe(player)
      expect(moveReasons('gm', move).short).toBe(gm)
    },
  )

  it('says why not as a give does, and in part where some were given', () => {
    expect(moveReasons('player', handOut).shaped).toBe(
      moveReasons('player', { verb: 'give' }).shaped,
    )
    expect(
      moveWords(handOut, state({ status: 'refused', reason: 'short' }), 'gm'),
    ).toBe('Not given: they haven’t the coins for that')
    expect(
      moveWords(toVex, state({ status: 'refused', reason: 'short' }), 'player'),
    ).toBe('Not given: you haven’t the coins for that')
    expect(
      moveWords(
        handOut,
        state({
          status: 'failed',
          reason: 'error',
          transfer: given(['actorVex0001'], null),
        }),
        'player',
      ),
    ).toBe('Partly given: something went wrong')
  })
})

describe('utils/move-words, a transformed character, from module 0.40.0', () => {
  const SHAPED =
    'a transformed character can’t give or take until back in their own form'

  it.each(['give', 'take', 'send', 'distribute'] as const)(
    'says why a %s with a transformed end was refused, for either seat',
    verb => {
      expect(moveReasons('player', { verb }).shaped).toBe(SHAPED)
      expect(moveReasons('gm', { verb }).shaped).toBe(SHAPED)
    },
  )

  it('says it of a give whose giver or recipient is transformed', () => {
    expect(
      moveWords(give, state({ status: 'refused', reason: 'shaped' }), 'player'),
    ).toBe(`Not given: ${SHAPED}`)
    expect(
      moveWords(take, state({ status: 'failed', reason: 'shaped' }), 'player'),
    ).toBe(`Not taken: ${SHAPED}`)
  })

  it('leaves a removal to the roll’s words, which say it waits for the character’s own form', () => {
    const remove: LocalMove = {
      verb: 'remove',
      things: '1 Rope',
      other: 'Elowen',
    }
    expect(moveReasons('player', { verb: 'remove' }).shaped).toBeUndefined()
    expect(
      moveWords(
        remove,
        state({ status: 'refused', reason: 'shaped' }),
        'player',
        { shaped: 'that waits until your character is back in their own form' },
      ),
    ).toBe(
      'Not removed: that waits until your character is back in their own form',
    )
  })
})
