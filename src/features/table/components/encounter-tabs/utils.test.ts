/**
 * @jest-environment node
 */
import { encounterLabels, encounterNews } from './utils'
import { mockTurnCombat } from '@/mocks/sending-stone'
import type { TableCombat, TableCombatant } from '@/types/table'

const thorin = mockTurnCombat().combatants[0]
const brakka = mockTurnCombat().combatants[1]
const goblin = mockTurnCombat().combatants[2]
const vex = mockTurnCombat().combatants[3]
/** An encounter with these combatants, its first one's turn. */
const fight = (
  id: string,
  combatants: TableCombatant[],
  fields: Partial<TableCombat> = {},
) => mockTurnCombat({ id, combatants, currentId: combatants[0]?.id, ...fields })

describe('features/table/components/encounter-tabs/utils', () => {
  it('names each encounter, the first that applies, a repeat numbered in the list’s order', () => {
    const labels = encounterLabels([
      fight('a', [goblin, thorin], { name: 'Goblin Ambush' }),
      fight('b', [goblin, thorin]),
      fight('c', [goblin, brakka]),
      fight('d', [goblin, vex]),
      fight('e', [goblin]),
      fight('f', [thorin]),
      fight('g', [goblin], { name: '  ' }),
    ])
    expect([...labels.values()]).toEqual([
      'Goblin Ambush',
      'Thorin',
      'Brakka',
      'Vex',
      'Encounter',
      'Thorin (2)',
      'Encounter (2)',
    ])
  })

  it.each([
    [
      'the seat’s character’s turn',
      fight('a', [thorin, goblin]),
      ', your turn',
    ],
    ['a companion’s', fight('a', [brakka, goblin]), ', Brakka’s turn'],
    ['nobody of the seat’s', fight('a', [goblin, thorin]), ''],
    ['a hidden one’s', fight('a', [thorin], { currentId: undefined }), ''],
    ['one not under way', fight('a', [thorin], { underWay: false }), ''],
  ])('says what’s new on a tab: %s', (_, combat, news) => {
    expect(encounterNews(combat)).toBe(news)
  })
})
