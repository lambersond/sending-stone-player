import { gmRollsOf } from './gm-rolls'
import { gmLine } from './gm-words'

describe('utils/gm-words', () => {
  it('says the hit points regained of hit dice the game made some of, as the player’s own say', () => {
    const { rolls, states } = gmRollsOf([
      {
        id: 'req-1',
        kind: 'hitDice',
        label: 'Hit dice (3d10)',
        at: '2026-11-04T12:00:00.000Z',
        status: 'failed',
        reason: 'no-hit-dice',
        spent: { count: 3, made: 2 },
        healed: 9,
      },
    ])
    const [roll] = rolls

    expect(gmLine(roll, states.get(roll.id), 'player')).toEqual({
      tone: 'not',
      text: '2 of 3 made at the table · 9 HP regained. Not the rest: you have no hit dice of that size left',
    })
  })
})
