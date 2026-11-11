import { checkDiceAnswer } from './check-dice'
import { NO_DICE } from '@/constants/roll-kinds'
import { heldIceKnife } from '@/mocks/dice-asks'
import type { RollRequestInput } from '@/types/roll'

const NOW = Date.parse('2026-11-10T12:00:30Z')
const ago = (ms: number) => new Date(NOW - ms)

/** Ice Knife's 2d6 cold, answered with a 3 and a 5. */
const answer: RollRequestInput = {
  kind: 'dice',
  diceAsk: 'ask1',
  answer: [{ roll: 0, term: 0, results: [3, 5] }],
  ...NO_DICE,
}

/** Thorin's player at his sheet, typing in his dice. */
const thorin = {
  role: 'player' as const,
  manualDice: true,
  actorId: 'actor-thorin',
}
/** The same player at his wolf's. */
const atWolf = {
  ...thorin,
  actorId: 'wolfBrakka',
  companion: { of: 'actor-thorin' },
}
const wolfAsk = heldIceKnife({
  actorId: 'wolfBrakka',
  ofActorId: 'actor-thorin',
})

describe('utils/requests/check-dice (module 0.44.0)', () => {
  it.each([
    ['the character’s own, waiting', thorin, heldIceKnife()],
    ['a companion’s, of its character’s run, at its seat', atWolf, wolfAsk],
  ])('takes an answer to %s', (_, seat, ask) => {
    expect(checkDiceAnswer(answer, ask, seat as never, [], NOW)).toBeUndefined()
  })

  it.each([
    [
      'from a player not typing in their dice',
      { ...thorin, manualDice: false },
      heldIceKnife(),
    ],
    ['from the Gamemaster’s seat', { ...thorin, role: 'gm' }, heldIceKnife()],
    ['to one not held, as after the Gamemaster reloads', thorin, null],
    [
      'to another character’s',
      { ...thorin, actorId: 'actor-vex' },
      heldIceKnife(),
    ],
    ['to a companion’s, at the character’s seat', thorin, wolfAsk],
    [
      'to the character’s own, at a companion’s seat',
      atWolf,
      heldIceKnife({ actorId: 'wolfBrakka' }),
    ],
    ['to one closed', thorin, heldIceKnife({ closedAt: ago(1000) })],
    ['to one out of time', thorin, heldIceKnife({ expiresAt: ago(0) })],
  ])('refuses one %s', (_, seat, ask) => {
    expect(checkDiceAnswer(answer, ask, seat as never, [], NOW)).toBe('diceAsk')
  })

  it.each([
    [
      'on its way',
      { status: 'pending' as const, createdAt: ago(1000), claimedAt: null },
      'diceAsk',
    ],
    [
      'being made',
      {
        status: 'claimed' as const,
        createdAt: ago(2000),
        claimedAt: ago(1000),
      },
      'diceAsk',
    ],
    [
      'made',
      { status: 'done' as const, createdAt: ago(2000), claimedAt: ago(1000) },
      'diceAsk',
    ],
    [
      'refused by the game',
      { status: 'failed' as const, createdAt: ago(2000), claimedAt: ago(1000) },
      undefined,
    ],
  ])('with another answer %s: %s', (_, other, refusal) => {
    expect(checkDiceAnswer(answer, heldIceKnife(), thorin, [other], NOW)).toBe(
      refusal,
    )
  })

  it('refuses values that don’t fit what’s asked', () => {
    expect(
      checkDiceAnswer(
        { ...answer, answer: [{ roll: 0, term: 0, results: [3, 7] }] },
        heldIceKnife(),
        thorin,
        [],
        NOW,
      ),
    ).toBe('dice')
  })
})
