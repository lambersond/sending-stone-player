import { onItsWayWords, usedWords } from './tray-words'
import type { Creature } from '../types'
import type { LocalUse, TableRollState } from '@/types/roll'

// Hit points set from the app (module 0.44.0), as the tray's line and the toasts say their way:
// the change made as the game says the numbers are, and why one wasn't.

/** Thorin's change, the GM's fall: 22 → 21, temporary 3 → 0. */
const fall: LocalUse = {
  kind: 'use',
  id: 'u-hp',
  label: 'Hit points',
  spell: false,
  hitPoints: { value: 21, temp: 0, from: { value: 22, temp: 3 } },
  at: 0,
}
const wolf: Creature = {
  name: 'Wolf',
  relation: { kind: 'owned', of: 'Thorin' },
  character: 'Thorin',
}
const way = (fields: Partial<TableRollState>): TableRollState => ({
  status: 'done',
  hitPoints: true,
  ...fields,
})

describe('features/rolling/utils/tray-words, hit points set', () => {
  it.each([
    [
      'on its way',
      way({ status: 'sending' }),
      undefined,
      'Sending to your Gamemaster’s game…',
    ],
    [
      'being set',
      way({ status: 'rolling' }),
      undefined,
      'Setting it in your Gamemaster’s game…',
    ],
    [
      'set, as the game says',
      way({ hitPointsNow: { value: 21, temp: 0, max: 30 } }),
      undefined,
      'Hit points now 21 / 30',
    ],
    [
      'a companion’s, set',
      way({ hitPointsNow: { value: 7, temp: 0, max: 11 } }),
      wolf,
      'Wolf’s hit points now 7 / 11',
    ],
    [
      'refused, changed in Foundry',
      way({ status: 'refused', reason: 'changed' }),
      undefined,
      'Couldn’t set your hit points: they changed in Foundry; look again',
    ],
    [
      'refused by the server, one on its way',
      way({ status: 'refused', reason: 'moving' }),
      undefined,
      'Couldn’t set your hit points: a change to these hit points is still on its way',
    ],
    [
      'stopped in Foundry',
      way({ status: 'failed', reason: 'cancelled' }),
      undefined,
      'Couldn’t set your hit points: a module in Foundry stopped it',
    ],
    [
      'a companion’s, no longer its character’s',
      way({ status: 'failed', reason: 'unknown' }),
      wolf,
      'Couldn’t set Wolf’s hit points: Wolf isn’t one of Thorin’s companions in your Gamemaster’s game now',
    ],
  ])('says one %s', (_name, state, creature, words) => {
    expect(usedWords(fall, state, 'player', creature)).toBe(words)
  })
})

describe('features/rolling/utils/tray-words, the dice the game asks for (module 0.45.0)', () => {
  it('says a roll the game holds asking for them waits for the player’s dice', () => {
    expect(
      onItsWayWords({ status: 'rolling', diceAsked: true }, 'player'),
    ).toBe('Waiting for your dice…')
    expect(onItsWayWords({ status: 'rolling' }, 'player')).toBe(
      'Rolling in your Gamemaster’s game…',
    )
  })
})
