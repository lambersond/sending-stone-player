/**
 * @jest-environment node
 */
import { awayWords, describe as described } from './utils'
import { seatWords } from '@/utils/seat-words'
import type { SwitcherCreature } from './types'

const wolf: SwitcherCreature = {
  key: 'wolf',
  name: 'Wolf',
  kind: 'owned',
  news: '',
}
const bat: SwitcherCreature = {
  key: 'bat',
  name: 'Bat',
  kind: 'summoned',
  from: 'Find Familiar',
  news: '',
}
const GAME = 'your Gamemaster’s game'

// Module 0.51.0 (item 18): a companion on another scene than the active one, in words.
describe('features/companions/utils, a companion on another scene', () => {
  it.each([
    [wolf, 'Thorin’s companion, on another scene'],
    [bat, 'Summoned by Thorin with Find Familiar, on another scene'],
    [{ ...bat, gone: true }, 'No longer with Thorin in your Gamemaster’s game'],
  ])('describes %p away as %p, gone first', (creature, words) => {
    expect(described({ ...creature, away: true }, 'Thorin', GAME)).toBe(words)
  })

  it.each([
    [
      'player',
      'Brakka is on another scene in your Gamemaster’s game. You can still roll for it here, but an attack may be refused while your Gamemaster isn’t viewing its target.',
    ],
    [
      'gm',
      'Brakka is on another scene in your game. You can still roll for it here, but an attack may be refused while you aren’t viewing its target.',
    ],
  ] as const)('says so on its sheet at the %s’s seat', (role, words) => {
    expect(awayWords('Brakka', seatWords(role))).toBe(words)
  })
})
