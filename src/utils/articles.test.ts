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
  ])('says "%s" with "%s" before it', (word, said) => {
    expect(articleOf(word)).toBe(said)
  })
})
