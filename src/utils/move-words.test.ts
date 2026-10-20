/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import {
  moveLabel,
  moveReasons,
  moveWords,
  namesWords,
  thingsWords,
} from './move-words'
import type { LocalMove } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

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
      expect(moveReasons('gm', 'give').unavailable).toBe(
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
        expect(moveReasons(role, verb)).toMatchObject({
          members: 'the party’s members have changed. Try again',
          split: 'there isn’t a whole coin for each of them',
        })
      }
    },
  )

  it('says the party has too few for a take, a send or a distribution, and the giver for a give', () => {
    for (const verb of ['take', 'send', 'distribute'] as const) {
      expect(moveReasons('player', verb).short).toBe(
        'the party hasn’t that many',
      )
      expect(moveReasons('gm', verb).short).toBe('the party hasn’t that many')
    }
    expect(moveReasons('player', 'give').short).toBe('you haven’t that many')
    expect(moveReasons('gm', 'give').short).toBe('they haven’t that many')
  })
})
