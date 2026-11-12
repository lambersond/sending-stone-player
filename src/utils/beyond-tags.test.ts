import { withoutTags } from './beyond-tags'

describe('withoutTags', () => {
  it.each([
    ['a tagged condition', '[condition]Charmed[/condition]', 'Charmed'],
    ['a plain label', 'Charmed', 'Charmed'],
    [
      'several tags in one text',
      '[condition]Charmed[/condition] and [condition]Frightened[/condition]',
      'Charmed and Frightened',
    ],
    [
      'other tags, inside other text',
      '[sense]Darkvision[/sense] 60 ft, [spell]Fly[/spell] at will',
      'Darkvision 60 ft, Fly at will',
    ],
    [
      'any tag of that form',
      '[skill]Stealth[/skill], [action]Dash[/action], [magicitem]Bag of Holding[/magicitem], [rule]Cover[/rule]',
      'Stealth, Dash, Bag of Holding, Cover',
    ],
    ['mixed case', '[Condition]Poisoned[/CONDITION]', 'Poisoned'],
    ['a tag inside another', '[spell][b]Fireball[/b][/spell]', 'Fireball'],
    [
      'a tag never closed',
      '[condition]Charmed, [condition]Poisoned[/condition]',
      '[condition]Charmed, Poisoned',
    ],
    [
      'a tag closed by another',
      '[condition]Charmed[/spell]',
      '[condition]Charmed[/spell]',
    ],
    ['a closing tag alone', 'Charmed[/condition]', 'Charmed[/condition]'],
    ['brackets that are no tag', 'Poison [see notes]', 'Poison [see notes]'],
  ])('reads %s', (_, text, read) => {
    expect(withoutTags(text)).toBe(read)
  })
})
