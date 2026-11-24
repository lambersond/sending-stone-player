/**
 * @jest-environment node
 */
import {
  askedWords,
  awayWords,
  describe as described,
  relationOf,
  unplacedWords,
} from './utils'
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

// Module 0.54.0 (item 98): a constant companion, on a scene, on another, or on none, in words.
describe('features/companions/utils, a constant companion', () => {
  const steel: SwitcherCreature = {
    key: 'steel',
    name: 'Steel Defender',
    kind: 'constant',
    news: '',
  }
  it.each([
    [steel, 'Thorin’s constant companion'],
    [
      { ...steel, unplaced: true as const },
      'Thorin’s constant companion, not on a scene',
    ],
    [
      { ...steel, away: true as const },
      'Thorin’s constant companion, on another scene',
    ],
    [
      { ...steel, unplaced: true as const, gone: true as const },
      'No longer with Thorin in your Gamemaster’s game',
    ],
  ])('describes %p as %p, gone first', (creature, words) => {
    expect(described(creature, 'Thorin', GAME)).toBe(words)
  })

  it.each([
    [
      'player',
      'Steel Defender isn’t on a scene in your Gamemaster’s game. You can still roll for it and use its features here; its attacks and spells go without a target.',
    ],
    [
      'gm',
      'Steel Defender isn’t on a scene in your game. You can still roll for it and use its features here; its attacks and spells go without a target.',
    ],
  ] as const)(
    'says it has no token on its sheet at the %s’s seat',
    (role, words) => {
      expect(unplacedWords('Steel Defender', seatWords(role))).toBe(words)
    },
  )

  it.each([
    ['owned', undefined, { kind: 'owned', of: 'Thorin' }],
    [
      'summoned',
      'Find Familiar',
      { kind: 'summoned', of: 'Thorin', from: 'Find Familiar' },
    ],
    ['summoned', undefined, { kind: 'summoned', of: 'Thorin' }],
    ['constant', 'Find Familiar', { kind: 'constant', of: 'Thorin' }],
    [undefined, undefined, { kind: 'owned', of: 'Thorin' }],
  ] as const)(
    'reads a %s one as whose it is (from %p)',
    (kind, from, relation) => {
      expect(relationOf(kind, 'Thorin', from)).toEqual(relation)
    },
  )
})

// Item 64: what a companion is asked for, "an" before a silent h, as the chat's request card says.
describe('features/companions/utils, what a companion is asked for', () => {
  it.each([
    ['Honor check', 'an Honor check'],
    ['Sanity saving throw', 'a Sanity saving throw'],
  ])('says %p as %p', (label, words) => {
    expect(askedWords({ label })).toBe(words)
  })
})
