/**
 * @jest-environment node
 */
import { switcherCreatures } from './creatures'
import { mockTableView } from '@/mocks/sending-stone'
import type { RowCompanion } from '@/types/table'

/** The row's creatures, as the switcher is given them, for this row. */
const creaturesOf = (row: RowCompanion[]) =>
  switcherCreatures({
    character: 'Thorin',
    view: mockTableView(),
    asking: false,
    asksForRoll: ', your Gamemaster asks for a roll',
    row,
    numbers: new Map(),
    waitingKeys: new Set(),
    paneMarks: new Map(),
  })

// Module 0.51.0 (item 18): a companion on another scene is away on its tab; a gone one never is,
// whatever it was last listed as.
describe('features/table/utils/creatures, a companion on another scene', () => {
  it('is away as the row lists it, and never once it’s gone', () => {
    const [, wolf, bat, left] = creaturesOf([
      { key: 'wolf', name: 'Wolf', kind: 'owned' },
      { key: 'bat', name: 'Bat', kind: 'summoned', away: true },
      { key: 'imp', name: 'Imp', kind: 'summoned', away: true, gone: true },
    ])
    expect(wolf).not.toHaveProperty('away')
    expect(bat.away).toBe(true)
    expect(left).toMatchObject({ key: 'imp', gone: true })
    expect(left).not.toHaveProperty('away')
  })
})
