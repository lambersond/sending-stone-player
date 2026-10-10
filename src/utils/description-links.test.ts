import { linkAttributes, linkClassOf, linkOf } from './description-links'

describe('utils/description-links', () => {
  describe('linkOf', () => {
    it('reads a saving throw, its abilities once each, its DC and whether it checks concentration', () => {
      expect(
        linkOf({
          class: 'ss-save roll',
          'data-n': '0',
          'data-ability': 'str|dex|str',
          'data-dc': '15',
        }),
      ).toEqual({
        kind: 'save',
        n: 0,
        abilities: ['str', 'dex'],
        dc: 15,
        concentration: false,
      })
      expect(
        linkOf({
          class: 'ss-save roll',
          'data-n': '4',
          'data-ability': 'wis',
          'data-type': 'concentration',
        }),
      ).toEqual({
        kind: 'save',
        n: 4,
        abilities: ['wis'],
        concentration: true,
      })
    })

    it("takes a concentration check that names no ability, as dnd5e's own, as Constitution's", () => {
      const attribs = {
        class: 'ss-save roll',
        'data-n': '1',
        'data-type': 'concentration',
        'data-dc': '10',
      }

      expect(linkAttributes('ss-save', attribs)).toEqual({
        'data-n': '1',
        'data-type': 'concentration',
        'data-dc': '10',
      })
      expect(linkOf(attribs)).toEqual({
        kind: 'save',
        n: 1,
        abilities: ['con'],
        dc: 10,
        concentration: true,
      })
      // Any other saving throw names its abilities.
      expect(linkOf({ ...attribs, 'data-type': undefined })).toBeUndefined()
      expect(linkOf({ ...attribs, 'data-type': 'check' })).toBeUndefined()
    })

    it('reads damage by part, with the kinds each may be, and healing', () => {
      expect(
        linkOf({
          class: 'ss-damage roll',
          'data-n': '2',
          'data-formulas': '2d6 + 3&1d4&5',
          'data-types': 'fire|cold&&force',
          'data-healing': 'true',
        }),
      ).toEqual({
        kind: 'damage',
        n: 2,
        parts: [
          { formula: '2d6 + 3', types: ['fire', 'cold'] },
          { formula: '1d4', types: [] },
          { formula: '5', types: ['force'] },
        ],
        healing: true,
      })
      expect(
        linkOf({ class: 'ss-damage', 'data-n': '3', 'data-formulas': '1d6' }),
      ).toEqual({
        kind: 'damage',
        n: 3,
        parts: [{ formula: '1d6', types: [] }],
        healing: false,
      })
    })

    it('reads a roll of its own and a condition', () => {
      expect(
        linkOf({ class: 'ss-roll roll', 'data-n': '5', 'data-formula': '1d6' }),
      ).toEqual({ kind: 'roll', n: 5, formula: '1d6' })
      expect(
        linkOf({ class: 'ss-condition ref', 'data-condition': 'prone' }),
      ).toEqual({ kind: 'condition', condition: 'prone' })
    })

    it.each([
      ['no class', { 'data-n': '0', 'data-formula': '1d6' }],
      ['a class it has not', { class: 'roll', 'data-n': '0' }],
      ['no number', { class: 'ss-roll', 'data-formula': '1d6' }],
      [
        'roll data',
        { class: 'ss-roll', 'data-n': '0', 'data-formula': '@mod' },
      ],
      [
        'an ability any object has',
        { class: 'ss-save', 'data-n': '0', 'data-ability': 'constructor' },
      ],
    ])('reads nothing from a span with %s', (_name, attribs) => {
      expect(linkOf(attribs)).toBeUndefined()
    })
  })

  it('finds the first class of a link a class list names', () => {
    expect(linkClassOf('roll ss-damage ss-save')).toBe('ss-save')
    expect(linkClassOf('roll')).toBeUndefined()
    expect(linkClassOf('')).toBeUndefined()
  })
})
