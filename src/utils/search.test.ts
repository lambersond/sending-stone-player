import { matchesSearch, searchKey } from './search'

describe('utils/search', () => {
  it.each([
    ['Goblin BOSS', 'goblin boss'],
    ['Éowyn', 'eowyn'],
    ['Dáin Ironfoot', 'dain ironfoot'],
    // Lowercased first, so a capital whose lowercase carries a dot loses it.
    ['İlse', 'ilse'],
    ['Warden’s Ward', "warden's ward"],
    ['“Lucky” Pete', '"lucky" pete'],
    ['  Goblin \t Archer\n 2 ', 'goblin archer 2'],
    // A ligature, as its letters.
    ['ﬁre', 'fire'],
  ])('compares %p as %p', (text, key) => {
    expect(searchKey(text)).toBe(key)
  })

  it('matches each word typed, anywhere in what is shown, in any order', () => {
    expect(matchesSearch(['Goblin Archer 2'], 'gob 2')).toBe(true)
    expect(matchesSearch(['Goblin Archer 2'], '2 ARCH')).toBe(true)
    expect(matchesSearch(['Goblin Archer 2'], 'gob 3')).toBe(false)
    expect(matchesSearch(['Éowyn'], 'eowyn')).toBe(true)
    expect(matchesSearch(['Eowyn'], 'Éowyn')).toBe(true)
    expect(matchesSearch(['Warden’s Ward'], "warden's")).toBe(true)
    expect(matchesSearch(["Warden's Ward"], 'warden’s')).toBe(true)
  })

  it('matches across each of the texts shown', () => {
    expect(matchesSearch(['Self', 'Thorin Oakenshield'], 'self')).toBe(true)
    expect(matchesSearch(['Self', 'Thorin Oakenshield'], 'thorin')).toBe(true)
    expect(matchesSearch(['Self', 'Thorin Oakenshield'], 'self oak')).toBe(true)
    expect(matchesSearch(['Self'], 'thorin')).toBe(false)
  })

  it('matches everything for nothing typed, or only spaces', () => {
    expect(matchesSearch(['Goblin'], '')).toBe(true)
    expect(matchesSearch(['Goblin'], ' '.repeat(3))).toBe(true)
    expect(matchesSearch([], '')).toBe(true)
    expect(matchesSearch([], 'a')).toBe(false)
  })
})
