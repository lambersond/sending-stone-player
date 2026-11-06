import { rollsInGame, shownPanels } from './utils'
import { mockTableView } from '@/mocks/sending-stone'

describe('features/table/game-table/utils', () => {
  it.each([
    ['the character’s own sheet', true, 'character', 'self', ['sheet-panel']],
    ['its own sheet beside combat', true, 'combat', 'self', ['sheet-panel']],
    [
      'a companion’s sheet, or its panel while it has none',
      true,
      'character',
      'wolf',
      ['creature-wolf-sheet-panel', 'creature-panel-wolf'],
    ],
    ['combat, on a phone', false, 'combat', 'wolf', ['combat-pane']],
    ['the chat, on a phone', false, 'chat', 'self', ['chat-pane']],
  ] as const)(
    'finds the panel shown under the notices: %s',
    (_, characterInView, tab, chosen, panels) => {
      expect(shownPanels(characterInView, tab, chosen)).toEqual(panels)
    },
  )

  it('hands on the rolls the game takes from the seat while the character is in its game, and none once it isn’t', () => {
    const view = mockTableView({
      rollsToTable: ['formula', 'plainRoll'],
      rollFeatures: ['modifiers'],
    })
    expect(rollsInGame(view)).toEqual({
      kinds: ['formula', 'plainRoll'],
      features: ['modifiers'],
    })
    expect(rollsInGame({ ...view, connected: false })).toEqual({})
  })
})
