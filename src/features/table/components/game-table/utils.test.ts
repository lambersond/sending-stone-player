import { shownPanels } from './utils'

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
})
