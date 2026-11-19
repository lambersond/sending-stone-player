/**
 * @jest-environment node
 */
import { actingHealth } from './utils'
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
