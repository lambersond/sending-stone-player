/**
 * @jest-environment node
 */
import { actingHealth, otherTurnsLine } from './utils'
import { mockTurnCombat } from '@/mocks/sending-stone'
import type { TableCombatant } from '@/types/table'

const fighter = (fields: Partial<TableCombatant> = {}): TableCombatant => ({
  id: 'ogre',
  name: 'Ogre',
  initiative: 14,
  defeated: false,
  side: 'other',
  ...fields,
})

// Item 58, module 0.50.0: the turn panel shows the acting creature's health only where its row has
// some to show, and never the party's.
describe('combat-tracker/utils actingHealth', () => {
  it.each([
    ['another creature with its word', fighter({ health: 'bloodied' }), true],
    [
      'another creature with its hit points',
      fighter({ hp: { value: 57, max: 59, temp: 0 } }),
      true,
    ],
    ['another creature with nothing shown', fighter(), false],
    [
      'one of the party',
      fighter({ side: 'party', hp: { value: 9, max: 9, temp: 0 } }),
      false,
    ],
    [
      'the seat’s own',
      fighter({ side: 'me', hp: { value: 31, max: 44, temp: 0 } }),
      false,
    ],
    ['no one', undefined, false],
  ])('on the turn of %s', (_name, current, shown) => {
    expect(actingHealth(current)).toBe(shown ? current : undefined)
  })
})

/** An encounter under way, `currentId`'s turn (item 36). */
const encounter = (id: string, currentId: string) =>
  mockTurnCombat({ id, currentId })

describe('otherTurnsLine (item 36)', () => {
  const shown = encounter('a', 'c-thorin')

  it.each([
    [
      'none where no other is the seat’s turn',
      [shown, encounter('b', 'c-goblin')],
      '',
    ],
    [
      'the character’s in another',
      [encounter('b', 'c-goblin'), encounter('c', 'c-thorin')],
      'Your turn, in another encounter.',
    ],
    [
      'each where it is, the shown one left out',
      [shown, encounter('b', 'c-brakka'), encounter('c', 'c-thorin')],
      'Brakka’s turn, in another encounter. Your turn, in another encounter.',
    ],
  ])('%s', (_, combats, line) => {
    expect(otherTurnsLine(combats, shown)).toBe(line)
  })
})
