import { conditionNamed } from './utils'

describe('conditionNamed', () => {
  it.each([
    ['its name, as dnd5e labels it', 'Charmed', 'charmed'],
    ['its name in another letter case', 'pOISONED', 'poisoned'],
    ['its name with spaces around it', ' Exhaustion ', 'exhaustion'],
    ['a damage type, which is no condition', 'Poison', undefined],
    ['a condition the app has no rules for', 'Diseased', undefined],
    ['a name in another language', 'Bezaubert', undefined],
    ['a condition inside other text', 'Charmed while raging', undefined],
  ])('reads %s', (_, text, id) => {
    expect(conditionNamed(text)?.id).toBe(id)
  })
})
