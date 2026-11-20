import { articleOf } from './articles'

describe('utils/articles', () => {
  it.each([
    ['Ape', 'an'],
    ['elk', 'an'],
    ['Honor', 'an'],
    ['Honor (Etiquette) check', 'an'],
    ['Honour', 'an'],
    ['Honest Fool', 'an'],
    ['hour', 'an'],
    ['Heir', 'an'],
    ['Wolf', 'a'],
    ['Honey Badger', 'a'],
    ['Hound', 'a'],
    ['DC 12 Honor check', 'a'],
    // A "u" or "eu" said "you", and "one" said "won" (item 96).
    ['Utility', 'a'],
    ['Use Magic Device', 'a'],
    ['Usual', 'a'],
    ['Unicorn', 'a'],
    ['Uniform', 'a'],
    ['Unique', 'a'],
    ['Utensil', 'a'],
    ['Utopia', 'a'],
    ['Utahraptor', 'a'],
    ['Uranium', 'a'],
    ['Ureter', 'a'],
    ['Urine', 'a'],
    ['Uvula', 'a'],
    ['European', 'a'],
    ['Eurypterid', 'a'],
    ['One', 'a'],
    ['One-Eyed', 'a'],
    // And not where it's said with a vowel.
    ['Unarmed Strike', 'an'],
    ['Undead', 'an'],
    ['Umber Hulk', 'an'],
    ['Unidentified', 'an'],
    ['Uninvited', 'an'],
    ['Unimpressed', 'an'],
    ['Unironic', 'an'],
    ['Urchin', 'an'],
    ['Urban', 'an'],
    ['Usher', 'an'],
    ['Utter', 'an'],
    ['Utmost', 'an'],
    ['Onyx', 'an'],
    ['Onerous', 'an'],
    ['Oneiric', 'an'],
    // Numbers said with a vowel: eight and the eighties, eleven, eighteen.
    ['8th-level spell slot', 'an'],
    ['80', 'an'],
    ['11th', 'an'],
    ['18th', 'an'],
    ['1st-level spell slot', 'a'],
    ['110', 'a'],
    ['180', 'a'],
    ['3rd', 'a'],
  ])('says "%s" with "%s" before it', (word, said) => {
    expect(articleOf(word)).toBe(said)
  })

  // dnd5e's own names that begin with a vowel or an h, its abilities, skills and kinds of tool in
  // 5.3.3's and 6.0.5's lang/en.json alike, and a tool by its own name: as they read before.
  it.each([
    ['Acrobatics', 'an'],
    ['Animal Handling', 'an'],
    ['Arcana', 'an'],
    ["Artisan's Tools", 'an'],
    ['Athletics', 'an'],
    ['Herbalism Kit', 'a'],
    ['History', 'a'],
    ['Honor', 'an'],
    ['Insight', 'an'],
    ['Intelligence', 'an'],
    ['Intimidation', 'an'],
    ['Investigation', 'an'],
    ["Alchemist's Supplies", 'an'],
  ])('says dnd5e’s "%s" with "%s" as before', (word, said) => {
    expect(articleOf(word)).toBe(said)
  })
})
